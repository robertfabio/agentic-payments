import { useState } from "react";
import type { LoginResponse } from "@agentic/shared";
import { Chat } from "./components/Chat.js";
import { Login } from "./components/Login.js";

export function App() {
  const [sessao, setSessao] = useState<LoginResponse | null>(null);

  if (!sessao) return <Login onEntrar={setSessao} />;
  return <Chat sessao={sessao} onSair={() => setSessao(null)} />;
}
