import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const aqui = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(aqui, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  llm: {
    apiKey: process.env.NVIDIA_API_KEY ?? "",
    maxTokens: Number(process.env.NVIDIA_MAX_TOKENS ?? 1024),
    timeoutMs: Number(process.env.NVIDIA_TIMEOUT_MS ?? 90_000),
    baseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    model: process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-nano-30b-a3b",
    fallbacks: (
      process.env.NVIDIA_MODEL_FALLBACKS ?? "openai/gpt-oss-20b,deepseek-ai/deepseek-v4-flash-0731"
    )
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
  },

  limitePadrao: Number(process.env.LIMITE_PADRAO ?? 1000),

  auditoria: {
    arquivo: process.env.AUDIT_LOG_FILE ?? "",
  },

  mcp: {
    command: process.env.MCP_SERVER_COMMAND ?? "npx",
    args: (process.env.MCP_SERVER_ARGS ?? "tsx,../mcp-server/src/server.ts").split(","),
  },
} as const;
