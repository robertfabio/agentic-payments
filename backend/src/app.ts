import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { authRouter } from "./auth/index.js";
import { chatRouter } from "./chat/routes.js";
import { auditRouter } from "./audit/routes.js";

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRouter);
app.use("/api", chatRouter);
app.use("/api", auditRouter);
