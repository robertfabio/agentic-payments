import { Router } from "express";
import type { ApiError, ChatRequest, ChatResponse } from "@agentic/shared";
import { requireAuth } from "../auth/index.js";
import { responder } from "../agent/loop.js";
import { criarConversa, getConversa } from "./store.js";

export const chatRouter: Router = Router();

chatRouter.post("/chat", requireAuth, async (req, res) => {
  const usuario = req.usuario!;
  const { message, conversa_id } = (req.body ?? {}) as Partial<ChatRequest>;

  if (typeof message !== "string" || !message.trim()) {
    const erro: ApiError = { erro: "DADOS_INVALIDOS", mensagem: "Envie `message` com texto." };
    return res.status(400).json(erro);
  }

  const conversa = conversa_id ? getConversa(conversa_id, usuario.id) : criarConversa(usuario.id);
  if (!conversa) {
    const erro: ApiError = {
      erro: "CONVERSA_NAO_ENCONTRADA",
      mensagem: "Conversa inexistente ou de outro usuario.",
    };
    return res.status(404).json(erro);
  }

  conversa.messages.push({ role: "user", content: message });

  try {
    conversa.messages = await responder(conversa.messages, usuario);
    const resposta: ChatResponse = { conversa_id: conversa.id, messages: conversa.messages };
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

