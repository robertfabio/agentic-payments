import { useState, type FormEvent } from "react";
import {FiUser, FiLock} from "react-icons/fi";
import { MdOutlineChat } from "react-icons/md";
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
  <main className="login-page">
    <form className="login-form" onSubmit={enviar}>
      <div className="login-icon"><MdOutlineChat></MdOutlineChat></div>
      <h1 className="login-title">Agentic Payments</h1>
      <p className="login-subtitle">Entre para acessar o chat de pagamentos</p>

      <label>
        Usuário:

        <div className="input-wrapper">
          <FiUser className="input-icon"></FiUser>

        <input value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Digite seu nome de usuário"
        />
        </div>
      </label>

      <label>
        Senha:

        <div className="input-wrapper">
          <FiLock className="input-icon"></FiLock>

        <input 
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)} 
        placeholder="Digite sua senha"
        />
        </div>
      </label>

      <button type="submit">Entrar</button>

      {erro && <p className="error-message">{erro}</p>}
      
    </form>
  </main>
);
}
