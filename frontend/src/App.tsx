import { useEffect, useState } from "react";
import type { User } from "@agentic/shared";
import { Chat } from "./components/Chat.js";
import { Login } from "./components/Login.js";
import { logout, retomarSessao, temSessao } from "./api.js";

export function App() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [verificando, setVerificando] = useState(temSessao());

  useEffect(() => {
    if (!temSessao()) return;
    let ativo = true;

    retomarSessao()
      .then((u) => ativo && setUsuario(u))
      .finally(() => ativo && setVerificando(false));

    return () => {
      ativo = false;
    };
  }, []);

  async function sair() {
    await logout();
    setUsuario(null);
  }

  if (verificando) {
    return (
      <main className="login-page">
        <p>Carregando…</p>
      </main>
    );
  }

  if (!usuario) return <Login onEntrar={setUsuario} />;
  return <Chat usuario={usuario} onSair={sair} />;
}
