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
    baseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    model: process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3-nano-30b-a3b",
  },

  auditoria: {
    arquivo: process.env.AUDIT_LOG_FILE ?? "",
  },

  mcp: {
    command: process.env.MCP_SERVER_COMMAND ?? "npx",
    args: (process.env.MCP_SERVER_ARGS ?? "tsx,../mcp-server/src/server.ts").split(","),
  },
} as const;
