import { useState, type FormEvent } from "react";
import type { ChatMessage, LoginResponse } from "@agentic/shared";
import { enviarChat } from "../api.js";

interface Props {
  sessao: LoginResponse;
  onSair: () => void;
}

export function Chat({ sessao, onSair }: Props) {
  const [mensagens, setMensagens] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Olá! como posso ajudar você?"
    },
  ]);

  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const[erro, setErro] = useState<string | null>(null);

async function enviar(e: FormEvent){
  e.preventDefault();

  if (!texto.trim()) return;

  const historico: ChatMessage[] = [
    ...mensagens,
    {role:"user", content:texto},

  ];

  setMensagens(historico);
  setTexto("");
  setCarregando(true);
  setErro(null);

  try{
    const mensagensAtualizadas = await enviarChat(historico, sessao.token);
    setMensagens(mensagensAtualizadas);
  }catch(err) {
    setErro(
      err instanceof Error ? err.message : "Erro ao enviar mensagem"
    );
  }finally{
    setCarregando(false);
  }
}

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div>
        <strong>Agentic Payments</strong>
        <p>
        {sessao.usuario.username} — limite R$: {""} {sessao.usuario.limite.toFixed(2)}
        </p>
        </div>

        <button onClick={onSair}>Sair</button>   

      </header>

       
      <main className="chat-messages">
      {mensagens.length === 0 && (<p>Nenhuma mensagem ainda</p>
    )}  
      {mensagens.map((m, i) => (
        <div
        key={i}
          className={`message ${m.role === "user" ? "user" : "assistant"}`}>
          {"content" in m ? m.content : null}
       
        </div>
      ))}

      {carregando && <p>Enviando...</p>}

      {erro && <p className="error-message">{erro}</p>}

      </main>

      <footer className="chat-input">
      <form onSubmit={enviar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Digite sua mensagem" 
        disabled = {carregando}
        />

        <button type="submit" disabled={carregando}>{carregando ? "Enviando..." : "Enviar"} </button>

      </form>
      </footer>
    </div>
  );
}
