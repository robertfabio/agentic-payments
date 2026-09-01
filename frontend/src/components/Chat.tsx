import { useState, useEffect, type FormEvent, useRef } from "react";
import type { ChatMessage, User } from "@agentic/shared";
import { enviarChat } from "../api.js";

interface Props {
  usuario: User;
  onSair: () => void;
}

type Item =
  | { tipo: "user"; chave: string; texto: string }
  | { tipo: "assistant"; chave: string; texto: string }
  | { tipo: "ferramenta"; chave: string; nome: string; args: string; resultado: string | null };

function montarItens(mensagens: ChatMessage[]): Item[] {
  const resultados = new Map<string, string>();
  for (const m of mensagens) {
    if (m.role === "tool") resultados.set(m.tool_call_id, m.content);
  }

  const itens: Item[] = [];

  mensagens.forEach((m, i) => {
    if (m.role === "user") {
      itens.push({ tipo: "user", chave: `u${i}`, texto: m.content });
      return;
    }

    if (m.role !== "assistant") return;

    if (m.content) itens.push({ tipo: "assistant", chave: `a${i}`, texto: m.content });

    for (const c of m.tool_calls ?? []) {
      itens.push({
        tipo: "ferramenta",
        chave: c.id,
        nome: c.function.name,
        args: c.function.arguments,
        resultado: resultados.get(c.id) ?? null,
      });
    }
  });

  return itens;
}

function moeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Resumo {
  variante: string;
  texto: string;
  aberto: boolean;
}

function resumir(nome: string, resultado: string | null): Resumo {
  if (resultado === null) return { variante: "", texto: "executando…", aberto: false };

  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(resultado) as Record<string, unknown>;
  } catch {
    return { variante: "", texto: "resposta ilegível", aberto: true };
  }

  if (dados.status === "aprovado") {
    return {
      variante: "ok",
      texto: `aprovado · ${moeda(Number(dados.valor))} no ${dados.metodo_pagamento}`,
      aberto: true,
    };
  }

  if (dados.status === "recusado") {
    return { variante: "recusado", texto: `recusado · ${dados.erro}`, aberto: true };
  }

  if (nome === "listar_catalogo" && Array.isArray(dados.produtos)) {
    return { variante: "", texto: `${dados.produtos.length} produtos`, aberto: false };
  }

  if (nome === "registrar_intencao" && typeof dados.valor_total === "number") {
    return { variante: "", texto: `intenção de ${moeda(dados.valor_total)}`, aberto: false };
  }

  return { variante: "", texto: "concluído", aberto: false };
}

interface ProdutoDoCatalogo {
  id: string;
  nome: string;
  preco: number;
  estoque: number;
  imagem?: string;
}

function Vitrine({ produtos }: { produtos: ProdutoDoCatalogo[] }) {
  return (
    <div className="vitrine">
      {produtos.map((p) => (
        <article key={p.id} className="produto">
          {p.imagem ? (
            <img
              src={p.imagem}
              alt={p.nome}
              loading="lazy"
              onError={(e) => e.currentTarget.classList.add("sem-imagem")}
            />
          ) : (
            <div className="produto-sem-foto" />
          )}
          <div className="produto-info">
            <span className="produto-nome">{p.nome}</span>
            <span className="produto-preco">{moeda(p.preco)}</span>
            <span className="produto-estoque">{p.estoque} em estoque</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function catalogoDe(nome: string, resultado: string | null): ProdutoDoCatalogo[] | null {
  if (nome !== "listar_catalogo" || resultado === null) return null;

  try {
    const dados = JSON.parse(resultado) as { produtos?: ProdutoDoCatalogo[] };
    return Array.isArray(dados.produtos) && dados.produtos.length > 0 ? dados.produtos : null;
  } catch {
    return null;
  }
}

function Ferramenta({
  nome,
  args,
  resultado,
}: Omit<Item & { tipo: "ferramenta" }, "tipo" | "chave">) {
  const { variante, texto, aberto } = resumir(nome, resultado);
  const produtos = catalogoDe(nome, resultado);

  let corpo = resultado ?? "";
  try {
    corpo = JSON.stringify(JSON.parse(corpo), null, 2);
  } catch {
    corpo = resultado ?? "";
  }

  return (
    <div className="ferramenta-bloco">
      <details className={`ferramenta ${variante}`} open={aberto && !produtos}>
        <summary>
          <span className="tool-name">{nome}</span>
          <span className="tool-resumo">{texto}</span>
        </summary>
        <div className="ferramenta-corpo">
          <code className="ferramenta-args">{args}</code>
          {resultado !== null && <pre>{corpo}</pre>}
        </div>
      </details>

      {produtos && <Vitrine produtos={produtos} />}
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

    setMensagens([...anteriores, { role: "user", content: pergunta }]);
    setTexto("");
    setCarregando(true);
    setErro(null);

    try {
      const resposta = await enviarChat(pergunta, conversaId);
      setConversaId(resposta.conversa_id);
      setMensagens(resposta.messages);
    } catch (err) {
      setMensagens(anteriores);
      setTexto(pergunta);
      setErro(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    } finally {
      setCarregando(false);
    }
  }

  const itens = montarItens(mensagens);

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div>
          <strong>Agentic Payments</strong>
          <p>
            {usuario.username} — limite {moeda(usuario.limite)}
          </p>
        </div>

        <button onClick={onSair}>Sair</button>
      </header>

      <main className="chat-messages">
        <p className="intro">Peça o catálogo para começar.</p>

        {itens.map((item) =>
          item.tipo === "ferramenta" ? (
            <Ferramenta
              key={item.chave}
              nome={item.nome}
              args={item.args}
              resultado={item.resultado}
            />
          ) : (
            <div key={item.chave} className={`message ${item.tipo}`}>
              {item.tipo === "assistant" ? <Formatado texto={item.texto} /> : item.texto}
            </div>
          ),
        )}

        {carregando && <div className="message assistant mensagem-carregando">Digitando…</div>}

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
            {carregando ? "Enviando…" : "Enviar"}
          </button>
        </form>
      </footer>
    </div>
  );
}
