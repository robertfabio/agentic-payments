import { Router } from "express";
import type { ApiError, ChatRequest, ChatResponse } from "@agentic/shared";
import { requireAuth } from "../auth/index.js";
import { responder } from "../agent/loop.js";

export const chatRouter: Router = Router();

chatRouter.post("/chat", requireAuth, async (req, res) => {
  const { messages } = (req.body ?? {}) as Partial<ChatRequest>;
  if (!Array.isArray(messages)) {
    const erro: ApiError = {
      erro: "DADOS_INVALIDOS",
      mensagem: "Envie o historico completo em `messages`.",
    };
    return res.status(400).json(erro);
  }

  try {
    const resposta: ChatResponse = { messages: await responder(messages, req.usuario!) };
    return res.json(resposta);
  } catch (err) {
    console.error("[chat]", err);
    const erro: ApiError = {
      erro: "ERRO_INTERNO",
      mensagem: err instanceof Error ? err.message : "Falha ao processar a conversa.",
    };
    return res.status(500).json(erro);
  }
});
