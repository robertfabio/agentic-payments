import type { NextFunction, Request, Response } from "express";
import type { ApiError } from "@agentic/shared";
import { config } from "../config.js";

const janelas = new Map<string, number[]>();

function limpar(agora: number) {
  for (const [chave, marcas] of janelas) {
    const vivas = marcas.filter((t) => agora - t < config.chat.janelaMs);
    if (vivas.length === 0) janelas.delete(chave);
    else janelas.set(chave, vivas);
  }
}

export function limitarTaxa(req: Request, res: Response, next: NextFunction) {
  const usuarioId = req.usuario!.id;
  const agora = Date.now();

  limpar(agora);

  const marcas = (janelas.get(usuarioId) ?? []).filter((t) => agora - t < config.chat.janelaMs);

  if (marcas.length >= config.chat.maxPorJanela) {
    const esperaS = Math.ceil((config.chat.janelaMs - (agora - marcas[0]!)) / 1000);
    res.setHeader("Retry-After", String(esperaS));

    const erro: ApiError = {
      erro: "MUITAS_REQUISICOES",
      mensagem: `Muitas mensagens seguidas. Tente de novo em ${esperaS}s.`,
    };
    return res.status(429).json(erro);
  }

  marcas.push(agora);
  janelas.set(usuarioId, marcas);
  return next();
}

export function zerarLimites() {
  janelas.clear();
}
