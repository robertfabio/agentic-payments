import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "../config.js";
import { registrar, registrarFalha } from "../audit/log.js";

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

let clientePromise: Promise<Client> | undefined;
let conectado = false;

export function getMcpClient(): Promise<Client> {
  clientePromise ??= (async () => {
    const cliente = new Client({ name: "agentic-payments-backend", version: "0.1.0" });
    await cliente.connect(
      new StdioClientTransport({
        command: config.mcp.command,
        args: [...config.mcp.args],
        cwd: backendDir,
        env: {
          ...getDefaultEnvironment(),
          ...(process.env.USUARIOS_FILE ? { USUARIOS_FILE: process.env.USUARIOS_FILE } : {}),
          ...(process.env.INTENCAO_TTL_MS ? { INTENCAO_TTL_MS: process.env.INTENCAO_TTL_MS } : {}),
        },
      }),
    );
    conectado = true;
    return cliente;
  })().catch((err) => {
    clientePromise = undefined;
    throw err;
  });
  return clientePromise;
}

export interface LlmTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export async function listarToolsParaLlm(): Promise<LlmTool[]> {
  const { tools } = await (
    await getMcpClient()
  ).listTools(undefined, {
    timeout: config.mcp.timeoutMs,
  });

  return tools.map((tool) => {
    const schema = (tool.inputSchema ?? {}) as {
      properties?: Record<string, unknown>;
      required?: string[];
    };
    const { usuario_id: _interno, ...properties } = schema.properties ?? {};

    return {
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description ?? "",
        parameters: {
          type: "object",
          properties,
          required: (schema.required ?? []).filter((c) => c !== "usuario_id"),
        },
      },
    };
  });
}

export async function chamarTool(
  nome: string,
  argsDoModelo: Record<string, unknown>,
  usuarioId: string,
): Promise<string> {
  const inicio = Date.now();
  const argumentos = { ...argsDoModelo, usuario_id: usuarioId };

  try {
    const resultado = await (
      await getMcpClient()
    ).callTool({ name: nome, arguments: argumentos }, undefined, { timeout: config.mcp.timeoutMs });

    const texto = ((resultado.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");

    registrar(usuarioId, nome, argumentos, texto, Date.now() - inicio);
    return texto;
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    registrarFalha(usuarioId, nome, argumentos, mensagem, Date.now() - inicio);
    throw err;
  }
}

export function mcpConectado(): boolean {
  return conectado;
}

export async function fecharMcpClient(): Promise<void> {
  const pendente = clientePromise;
  if (!pendente) return;
  clientePromise = undefined;
  conectado = false;
  await (await pendente).close();
}
