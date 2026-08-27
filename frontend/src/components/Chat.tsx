import { useState, type FormEvent } from "react";
import type { ChatMessage, LoginResponse } from "@agentic/shared";
import { enviarChat } from "../api.js";

interface Props {
  sessao: LoginResponse;
  onSair: () => void;
}

export function Chat({ sessao, onSair }: Props) {
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [texto, setTexto] = useState("");

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;

    const historico: ChatMessage[] = [...mensagens, { role: "user", content: texto }];
    setMensagens(historico);
    setTexto("");
    setMensagens(await enviarChat(historico, sessao.token));
  }

  return (
    <div>
      <header>
        {sessao.usuario.username} — limite R$ {sessao.usuario.limite.toFixed(2)}
        <button onClick={onSair}>Sair</button>
      </header>

      {mensagens.map((m, i) => (
        <p key={i}>
          <strong>{m.role}:</strong> {"content" in m ? m.content : null}
        </p>
      ))}

      <form onSubmit={enviar}>
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="mensagem" />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
}
