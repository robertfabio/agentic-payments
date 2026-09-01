import { Router } from "express";
import type { ApiError, ChatMessage, ChatRequest, ChatResponse } from "@agentic/shared";
import { requireAuth } from "../auth/index.js";
import { responder } from "../agent/loop.js";
import { apagarConversa, criarConversa, getConversa } from "./store.js";
import { config } from "../config.js";

export const chatRouter: Router = Router();

const naoEncontrada: ApiError = {
  erro: "CONVERSA_NAO_ENCONTRADA",
  mensagem: "Conversa inexistente ou de outro usuario.",
};

chatRouter.post("/chat", requireAuth, async (req, res) => {
  const usuario = req.usuario!;
  const { message, conversa_id } = (req.body ?? {}) as Partial<ChatRequest>;

  if (typeof message !== "string" || !message.trim()) {
    const erro: ApiError = { erro: "DADOS_INVALIDOS", mensagem: "Envie `message` com texto." };
    return res.status(400).json(erro);
  }

  if (message.length > config.chat.maxCaracteres) {
    const erro: ApiError = {
      erro: "MENSAGEM_LONGA",
      mensagem: `A mensagem passa de ${config.chat.maxCaracteres} caracteres.`,
    };
    return res.status(413).json(erro);
  }

  const conversa = conversa_id ? getConversa(conversa_id, usuario.id) : undefined;
  if (conversa_id && !conversa) return res.status(404).json(naoEncontrada);

  const comPergunta: ChatMessage[] = [
    ...(conversa?.messages ?? []),
    { role: "user", content: message },
  ];

  try {
    const messages = await responder(comPergunta, usuario);

    const alvo = conversa ?? criarConversa(usuario.id);
    alvo.messages = messages;

    const resposta: ChatResponse = { conversa_id: alvo.id, messages };
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

chatRouter.delete("/chat/:id", requireAuth, (req, res) => {
  if (!apagarConversa(req.params.id!, req.usuario!.id)) {
    return res.status(404).json(naoEncontrada);
  }
  return res.status(204).end();
});
