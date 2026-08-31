import { Router, type NextFunction, type Request, type Response } from "express";
import {
  SEED_USERS,
  type ApiError,
  type LoginResponse,
  type LogoutRequest,
  type RefreshRequest,
  type RefreshResponse,
  type User,
} from "@agentic/shared";
import { config } from "../config.js";
import { conferirSenha } from "./senha.js";
import {
  emitirPar,
  encerrarSessao,
  encerrarTudo,
  rotacionar,
  sessoesAtivas,
  verificarAccess,
} from "./tokens.js";

declare global {
  namespace Express {
    interface Request {
      usuario?: User;
      tokenAtual?: { jti: string; exp?: number };
    }
  }
}

const SEGREDOS_DE_EXEMPLO = new Set(["dev-secret", "troque-este-segredo-em-desenvolvimento"]);

if (SEGREDOS_DE_EXEMPLO.has(config.jwtSecret)) {
  const aviso = "[auth] JWT_SECRET ainda esta com o valor de exemplo do .env.example.";
  if (process.env.NODE_ENV === "production") throw new Error(aviso);
  console.warn(`${aviso} Ok em desenvolvimento, troque antes de expor o backend.`);
}

function paraUser(s: (typeof SEED_USERS)[number]): User {
  return { id: s.id, username: s.username, limite: s.limite };
}

function erro(res: Response, status: number, corpo: ApiError) {
  return res.status(status).json(corpo);
}

function naoAutenticado(res: Response) {
  return erro(res, 401, { erro: "NAO_AUTENTICADO", mensagem: "Token ausente ou invalido." });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return naoAutenticado(res);

  const payload = verificarAccess(header.slice(7));
  if (!payload) return naoAutenticado(res);

  const seed = SEED_USERS.find((u) => u.id === payload.sub);
  if (!seed) return naoAutenticado(res);

  req.usuario = paraUser(seed);
  req.tokenAtual = { jti: payload.jti, exp: payload.exp };
  return next();
}

export const authRouter: Router = Router();

authRouter.post("/login", async (req, res) => {
  const { username, senha } = (req.body ?? {}) as { username?: unknown; senha?: unknown };

  if (typeof username !== "string" || typeof senha !== "string") {
    return erro(res, 401, {
      erro: "CREDENCIAIS_INVALIDAS",
      mensagem: "Usuario ou senha incorretos.",
    });
  }

  const seed = SEED_USERS.find((u) => u.username === username);
  const hash = seed?.senha_hash ?? SEED_USERS[0]!.senha_hash;
  const senhaConfere = await conferirSenha(senha, hash);

  if (!seed || !senhaConfere) {
    return erro(res, 401, {
      erro: "CREDENCIAIS_INVALIDAS",
      mensagem: "Usuario ou senha incorretos.",
    });
  }

  const usuario = paraUser(seed);
  const par = emitirPar(usuario.id);
  const resposta: LoginResponse = { ...par, usuario };
  return res.json(resposta);
});

authRouter.post("/refresh", (req, res) => {
  const { refresh_token } = (req.body ?? {}) as Partial<RefreshRequest>;

  if (typeof refresh_token !== "string" || !refresh_token) {
    return erro(res, 400, { erro: "DADOS_INVALIDOS", mensagem: "Envie `refresh_token`." });
  }

  const par = rotacionar(refresh_token);
  if (!par) {
    return erro(res, 401, {
      erro: "REFRESH_INVALIDO",
      mensagem: "Refresh token invalido, expirado ou ja utilizado.",
    });
  }

  const resposta: RefreshResponse = par;
  return res.json(resposta);
});

authRouter.post("/logout", requireAuth, (req, res) => {
  const { refresh_token, todas } = (req.body ?? {}) as Partial<LogoutRequest>;

  if (todas) encerrarTudo(req.usuario!.id);
  encerrarSessao(typeof refresh_token === "string" ? refresh_token : undefined, {
    sub: req.usuario!.id,
    typ: "access",
    ...req.tokenAtual!,
  });

  return res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({ usuario: req.usuario!, sessoes: sessoesAtivas(req.usuario!.id) });
});
