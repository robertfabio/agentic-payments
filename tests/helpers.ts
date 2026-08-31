import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createServer } from "node:http";

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

export interface ToolCallFalsa {
  id: string;
  name: string;
  arguments: string;
}

export interface RespostaFalsa {
  content?: string | null;
  tool_calls?: ToolCallFalsa[];
  /** Quando presente, o servidor devolve esse status em vez de uma resposta. */
  erro?: number;
}

/**
 * Um passo do roteiro pode ser uma funcao: ela recebe o corpo que o agente
 * mandou, o que permite ler o resultado da ferramenta anterior (por exemplo
 * o intencao_id, que so existe depois que o servidor MCP o gerou).
 */
export type PassoFalso = RespostaFalsa | ((corpo: Record<string, unknown>) => RespostaFalsa);

export interface LlmFalso {
  url: string;
  /** Fila de respostas. Cada ida do agente ao modelo consome uma. */
  roteirizar: (...respostas: PassoFalso[]) => void;
  /** Responde sempre a mesma coisa, para exercitar o teto de iteracoes. */
  repetir: (resposta: RespostaFalsa) => void;
  requisicoes: () => Record<string, unknown>[];
  fechar: () => Promise<void>;
}

function comoChatCompletion(r: RespostaFalsa) {
  const tool_calls = r.tool_calls?.map((c) => ({
    id: c.id,
    type: "function" as const,
    function: { name: c.name, arguments: c.arguments },
  }));

  return {
    id: "chatcmpl-falso",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "modelo-falso",
    choices: [
      {
        index: 0,
        finish_reason: tool_calls?.length ? "tool_calls" : "stop",
        message: { role: "assistant", content: r.content ?? null, ...(tool_calls && { tool_calls }) },
      },
    ],
  };
}

/**
 * Servidor minimo que fala o formato /chat/completions da OpenAI.
 * O agente nao sabe que nao e a NVIDIA do outro lado, entao o laco de
 * ferramentas roda de verdade contra o servidor MCP de verdade.
 */
export async function subirLlmFalso(): Promise<LlmFalso> {
  let fila: PassoFalso[] = [];
  let fixa: RespostaFalsa | undefined;
  const recebidas: Record<string, unknown>[] = [];

  const server = createServer((req, res) => {
    let corpo = "";
    req.on("data", (c) => (corpo += c));
    req.on("end", () => {
      const recebido = JSON.parse(corpo || "{}");
      recebidas.push(recebido);

      const passo = fixa ?? fila.shift() ?? { content: "ok" };
      const proxima = typeof passo === "function" ? passo(recebido) : passo;

      if (proxima.erro) {
        res.writeHead(proxima.erro, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "falha simulada do modelo" } }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(comoChatCompletion(proxima)));
    });
  });

  server.listen(0);
  await new Promise((r) => server.once("listening", r));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://localhost:${port}/v1`,
    roteirizar: (...respostas) => {
      fixa = undefined;
      fila = [...respostas];
    },
    repetir: (resposta) => {
      fixa = resposta;
    },
    requisicoes: () => recebidas,
    fechar: () => new Promise((r) => server.close(() => r(undefined))),
  };
}

/**
 * Sobe o LLM falso, aponta a config do backend para ele e so entao importa o
 * app: `config` le o process.env no import, entao a ordem importa.
 */
export async function subirTudo() {
  const llm = await subirLlmFalso();
  process.env.NVIDIA_API_KEY = "chave-de-teste";
  process.env.NVIDIA_BASE_URL = llm.url;

  const app = await subirApp();
  const { fecharMcpClient } = await import("../backend/src/mcp/client.js");

  return {
    url: app.url,
    llm,
    fechar: async () => {
      await app.fechar();
      await llm.fechar();
      await fecharMcpClient();
    },
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
