import { useState, type FormEvent } from "react";
import type { LoginResponse } from "@agentic/shared";
import { login } from "../api.js";

export function Login({ onEntrar }: { onEntrar: (s: LoginResponse) => void }) {
  const [username, setUsername] = useState("alice");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      onEntrar(await login({ username, senha }));
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha no login.");
    }
  }

  return (
    <form onSubmit={enviar}>
      <h1>Agentic Payments</h1>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario" />
      <input
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="senha"
      />
      <button type="submit">Entrar</button>
      {erro && <p>{erro}</p>}
    </form>
  );
}
