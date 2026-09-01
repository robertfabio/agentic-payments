import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { authRouter } from "./auth/index.js";
import { chatRouter } from "./chat/routes.js";
import { auditRouter } from "./audit/routes.js";
import { mcpConectado } from "./mcp/client.js";

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: "64kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/ready", (_req, res) => {
  const mcp = mcpConectado();
  return res.status(mcp ? 200 : 503).json({ ok: mcp, mcp });
});
app.use("/auth", authRouter);
app.use("/api", chatRouter);
app.use("/api", auditRouter);
