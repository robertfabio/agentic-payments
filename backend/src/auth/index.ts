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

const ALGORITMO = "HS256";
const EMISSOR = "agentic-payments";
const VALIDADE = "8h";

/**
 * Os segredos de exemplo que acompanham o repositorio. Assinar com um deles
 * significa que qualquer um que leu o README consegue forjar um token.
 */
const SEGREDOS_DE_EXEMPLO = new Set([
  "dev-secret",
  "troque-este-segredo-em-desenvolvimento",
]);

if (SEGREDOS_DE_EXEMPLO.has(config.jwtSecret)) {
  const aviso = "[auth] JWT_SECRET ainda esta com o valor de exemplo do .env.example.";
  if (process.env.NODE_ENV === "production") throw new Error(aviso);
  console.warn(`${aviso} Ok em desenvolvimento, troque antes de expor o backend.`);
}

function paraUser(s: (typeof SEED_USERS)[number]): User {
  return { id: s.id, username: s.username, limite: s.limite };
}

function naoAutenticado(res: Response) {
  const erro: ApiError = { erro: "NAO_AUTENTICADO", mensagem: "Token ausente ou invalido." };
  return res.status(401).json(erro);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return naoAutenticado(res);

  try {
    // Algoritmo e emissor fixos: sem isso um token assinado de outro jeito
    // (ou por outro servico que use o mesmo segredo) passaria pela verificacao.
    const payload = jwt.verify(header.slice(7), config.jwtSecret, {
      algorithms: [ALGORITMO],
      issuer: EMISSOR,
    });

    const sub = typeof payload === "string" ? undefined : payload.sub;
    const seed = SEED_USERS.find((u) => u.id === sub);
    if (!seed) return naoAutenticado(res);

    req.usuario = paraUser(seed);
    return next();
  } catch {
    return naoAutenticado(res);
  }
}

export const authRouter: Router = Router();

authRouter.post("/login", (req, res) => {
  const { username, senha } = (req.body ?? {}) as { username?: unknown; senha?: unknown };

  const seed =
    typeof username === "string" && typeof senha === "string"
      ? SEED_USERS.find((u) => u.username === username && u.senha === senha)
      : undefined;

  // Mesma resposta para usuario inexistente e senha errada: nao entregamos
  // de graca a lista de quem tem conta.
  if (!seed) {
    const erro: ApiError = {
      erro: "CREDENCIAIS_INVALIDAS",
      mensagem: "Usuario ou senha incorretos.",
    };
    return res.status(401).json(erro);
  }

  const usuario = paraUser(seed);
  const token = jwt.sign({ sub: usuario.id }, config.jwtSecret, {
    algorithm: ALGORITMO,
    issuer: EMISSOR,
    expiresIn: VALIDADE,
  });
  const resposta: LoginResponse = { token, usuario };
  return res.json(resposta);
});
