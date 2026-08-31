import { useState, useEffect, type FormEvent, useRef } from "react";
import type { ChatMessage, User } from "@agentic/shared";
import { enviarChat } from "../api.js";

interface Props {
  usuario: User;
  onSair: () => void;
}

// O conteudo de uma mensagem `tool` e o JSON cru do servidor MCP.
function ResultadoFerramenta({ nome, conteudo }: { nome: string; conteudo: string }) {
  let dados: unknown = null;
  try {
    dados = JSON.parse(conteudo);
  } catch {
    dados = null;
  }

  const status = (dados as { status?: string } | null)?.status;
  const variante = status === "aprovado" ? "ok" : status === "recusado" ? "recusado" : "";

  return (
    <div className={`tool-result ${variante}`}>
      <span className="tool-name">{nome}</span>
      <pre>{dados ? JSON.stringify(dados, null, 2) : conteudo}</pre>
    </div>
  );
}

function comEnfase(texto: string) {
  return texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((parte, i) => {
    if (parte.startsWith("**") && parte.endsWith("**") && parte.length > 4) {
      return <strong key={i}>{parte.slice(2, -2)}</strong>;
    }
    if (parte.startsWith("`") && parte.endsWith("`") && parte.length > 2) {
      return <code key={i}>{parte.slice(1, -1)}</code>;
    }
    return parte;
  });
}

function Formatado({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {comEnfase(linha)}
        </span>
      ))}
    </>
  );
}

function Mensagem({ m }: { m: ChatMessage }) {
  if (m.role === "user") return <div className="message user">{m.content}</div>;

  if (m.role === "tool") return <ResultadoFerramenta nome={m.name} conteudo={m.content} />;

  if (m.role === "assistant") {
    return (
      <>
        {m.content ? (
          <div className="message assistant">
            <Formatado texto={m.content} />
          </div>
        ) : null}
        {m.tool_calls?.map((c) => (
          <div key={c.id} className="tool-call">
            <span className="tool-name">{c.function.name}</span>
            <code>{c.function.arguments}</code>
          </div>
        ))}
      </>
    );
  }

  // `system` nunca chega ao cliente: o backend monta a prompt a cada chamada.
  return null;
}

export function Chat({ usuario, onSair }: Props) {
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [conversaId, setConversaId] = useState<string | undefined>();
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimDasMensagens = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fimDasMensagens.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim() || carregando) return;

    const pergunta = texto;
    const anteriores = mensagens;

    // Otimista, so para a mensagem aparecer na hora. A lista boa vem do servidor.
    setMensagens([...anteriores, { role: "user", content: pergunta }]);
    setTexto("");
    setCarregando(true);
    setErro(null);

    try {
      const resposta = await enviarChat(pergunta, conversaId);
      setConversaId(resposta.conversa_id);
      setMensagens(resposta.messages);
    } catch (err) {
      // O servidor descarta a pergunta quando falha, entao voltamos ao estado
      // anterior para nao ficar dessincronizado com o historico de la.
      setMensagens(anteriores);
      setTexto(pergunta);
      setErro(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div>
          <strong>Agentic Payments</strong>
          <p>
            {usuario.username} — limite{" "}
            {usuario.limite.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        </div>

        <button onClick={onSair}>Sair</button>
      </header>

      <main className="chat-messages">
        {mensagens.length === 0 && !carregando && (
          <div className="message assistant">
            Olá, {usuario.username}! Posso mostrar o catálogo e fechar a compra por você. O que você
            está procurando?
          </div>
        )}

        {mensagens.map((m, i) => (
          <Mensagem key={i} m={m} />
        ))}

        {carregando && <div className="message assistant mensagem-carregando">Digitando...</div>}

        {erro && <p className="error-message">{erro}</p>}

        <div ref={fimDasMensagens}></div>
      </main>

      <footer className="chat-input">
        <form onSubmit={enviar}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite sua mensagem"
            disabled={carregando}
          />

          <button type="submit" disabled={carregando}>
            {carregando ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </footer>
    </div>
  );
}
