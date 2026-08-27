import { Router, type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { SEED_USERS, type ApiError, type LoginResponse, type User } from "@agentic/shared";
import { config } from "../config.js";

declare global {
  namespace Express {
    interface Request {
      usuario?: User;
    }
  }
}

function paraUser(s: (typeof SEED_USERS)[number]): User {
  return { id: s.id, username: s.username, limite: s.limite };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const erro: ApiError = { erro: "NAO_AUTENTICADO", mensagem: "Token ausente ou invalido." };
  if (!header?.startsWith("Bearer ")) return res.status(401).json(erro);

  try {
    const { sub } = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string };
    const seed = SEED_USERS.find((u) => u.id === sub);
    if (!seed) return res.status(401).json(erro);
    req.usuario = paraUser(seed);
    return next();
  } catch {
    return res.status(401).json(erro);
  }
}

export const authRouter: Router = Router();

authRouter.post("/login", (req, res) => {
  const { username, senha } = (req.body ?? {}) as { username?: string; senha?: string };
  const seed = SEED_USERS.find((u) => u.username === username && u.senha === senha);

  if (!seed) {
    const erro: ApiError = {
      erro: "CREDENCIAIS_INVALIDAS",
      mensagem: "Usuario ou senha incorretos.",
    };
    return res.status(401).json(erro);
  }

  const usuario = paraUser(seed);
  const token = jwt.sign({ sub: usuario.id }, config.jwtSecret, { expiresIn: "8h" });
  const resposta: LoginResponse = { token, usuario };
  return res.json(resposta);
});
