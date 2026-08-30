import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

process.env.JWT_SECRET ??= "test-secret";

export async function subirApp(): Promise<{ url: string; fechar: () => Promise<void> }> {
  const { app } = await import("../backend/src/app.js");
  const server: Server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://localhost:${port}`,
    fechar: () => new Promise((r) => server.close(() => r(undefined))),
  };
}

export async function post(url: string, corpo: unknown, token?: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  });
  return { status: res.status, corpo: await res.json().catch(() => null) };
}

export async function logar(url: string, username: string, senha: string): Promise<string> {
  const { corpo } = await post(`${url}/auth/login`, { username, senha });
  return (corpo as { token: string }).token;
}
