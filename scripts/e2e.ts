import type { ChatMessage, ChatResponse, LoginResponse } from "@agentic/shared";

const url = "http://127.0.0.1:3001";
const usuario = process.argv[2] ?? "alice";
const senha = usuario === "bob" ? "bob123" : "alice123";
const turnos = process.argv.slice(3);

async function chamar(caminho: string, corpo?: unknown, token?: string, metodo = "POST") {
  const res = await fetch(`${url}${caminho}`, {
    method: metodo,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  return { status: res.status, corpo: (await res.json().catch(() => null)) as never };
}

const entrada = await chamar("/auth/login", { username: usuario, senha });
if (entrada.status !== 200) {
  console.error("login falhou:", entrada.status, entrada.corpo);
  process.exit(1);
}
const { token } = entrada.corpo as LoginResponse;
console.log(`\n=== ${usuario} ===`);

let conversaId: string | undefined;
let vistas = 0;

for (const message of turnos) {
  const res = await chamar("/api/chat", { message, conversa_id: conversaId }, token);
  if (res.status !== 200) {
    console.error(`\n[falhou] ${res.status}`, res.corpo);
    break;
  }
  const { conversa_id, messages } = res.corpo as ChatResponse;
  conversaId = conversa_id;

  for (const m of (messages as ChatMessage[]).slice(vistas)) {
    if (m.role === "user") console.log(`\n\x1b[1m> ${m.content}\x1b[0m`);
    else if (m.role === "tool") {
      const d = JSON.parse(m.content);
      const cor = d.status === "recusado" ? "\x1b[31m" : "\x1b[32m";
      console.log(`  ${cor}[${m.name}]\x1b[0m ${JSON.stringify(d).slice(0, 170)}`);
    } else if (m.role === "assistant") {
      if (m.content) console.log(`\x1b[36m${m.content.slice(0, 240)}\x1b[0m`);
      for (const c of m.tool_calls ?? []) {
        console.log(`  \x1b[33m-> ${c.function.name}(${c.function.arguments})\x1b[0m`);
      }
    }
  }
  vistas = messages.length;
}

console.log("\n=== auditoria ===");
const aud = await chamar("/api/auditoria?limite=10", undefined, token, "GET");
for (const r of (aud.corpo as never as { registros: Record<string, unknown>[] }).registros) {
  console.log(
    ` ${String(r.data).slice(11, 19)}  ${r.usuario_id}  ${r.tool}  ->  ${r.status}` +
      `${r.erro ? " " + r.erro : ""}${r.valor !== undefined ? "  R$" + r.valor : ""}  ${r.duracao_ms}ms`,
  );
}
console.log("");
