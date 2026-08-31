import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import {
  buscarUsuarioPorId,
  buscarUsuarioPorUsername,
  criarUsuario,
  listarUsuarios,
  type ApiError,
  type LoginResponse,
  type RefreshResponse,
  type User,
} from "@agentic/shared";
import { config } from "../config.js";
import { conferirSenha, gerarHash } from "./senha.js";
import {
  loginSchema,
  logoutSchema,
  primeiroErro,
  refreshSchema,
  registerSchema,
} from "./schemas.js";
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

function paraUser(u: { id: string; username: string; limite: number }): User {
  return { id: u.id, username: u.username, limite: u.limite };
}

function erro(res: Response, status: number, corpo: ApiError) {
  return res.status(status).json(corpo);
}

function naoAutenticado(res: Response) {
  return erro(res, 401, { erro: "NAO_AUTENTICADO", mensagem: "Token ausente ou invalido." });
}

function credenciaisInvalidas(res: Response) {
  return erro(res, 401, {
    erro: "CREDENCIAIS_INVALIDAS",
    mensagem: "Usuario ou senha incorretos.",
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return naoAutenticado(res);

  const payload = verificarAccess(header.slice(7));
  if (!payload) return naoAutenticado(res);

  const usuario = buscarUsuarioPorId(payload.sub);
  if (!usuario) return naoAutenticado(res);

  req.usuario = paraUser(usuario);
  req.tokenAtual = { jti: payload.jti, exp: payload.exp };
  return next();
}

export const authRouter: Router = Router();

authRouter.post("/register", async (req, res) => {
  const entrada = registerSchema.safeParse(req.body ?? {});
  if (!entrada.success) {
    return erro(res, 400, { erro: "DADOS_INVALIDOS", mensagem: primeiroErro(entrada.error) });
  }

  const { username, senha } = entrada.data;

  if (buscarUsuarioPorUsername(username)) {
    return erro(res, 409, {
      erro: "USUARIO_EM_USO",
      mensagem: "Esse nome de usuario ja esta em uso.",
    });
  }

  const usuario = {
    id: `user_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    username,
    senha_hash: await gerarHash(senha),
    limite: config.limitePadrao,
  };

  criarUsuario(usuario);

  const par = emitirPar(usuario.id);
  const resposta: LoginResponse = { ...par, usuario: paraUser(usuario) };
  return res.status(201).json(resposta);
});

authRouter.post("/login", async (req, res) => {
  const entrada = loginSchema.safeParse(req.body ?? {});
  if (!entrada.success) return credenciaisInvalidas(res);

  const { username, senha } = entrada.data;
  const usuario = buscarUsuarioPorUsername(username);
  const hash = usuario?.senha_hash ?? listarUsuarios()[0]!.senha_hash;
  const senhaConfere = await conferirSenha(senha, hash);

  if (!usuario || !senhaConfere) return credenciaisInvalidas(res);

  const par = emitirPar(usuario.id);
  const resposta: LoginResponse = { ...par, usuario: paraUser(usuario) };
  return res.json(resposta);
});

authRouter.post("/refresh", (req, res) => {
  const entrada = refreshSchema.safeParse(req.body ?? {});
  if (!entrada.success) {
    return erro(res, 400, { erro: "DADOS_INVALIDOS", mensagem: primeiroErro(entrada.error) });
  }

  const par = rotacionar(entrada.data.refresh_token);
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
  const entrada = logoutSchema.safeParse(req.body ?? {});
  if (!entrada.success) {
    return erro(res, 400, { erro: "DADOS_INVALIDOS", mensagem: primeiroErro(entrada.error) });
  }

  if (entrada.data.todas) encerrarTudo(req.usuario!.id);
  encerrarSessao(entrada.data.refresh_token, {
    sub: req.usuario!.id,
    typ: "access",
    ...req.tokenAtual!,
  });

  return res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({ usuario: req.usuario!, sessoes: sessoesAtivas(req.usuario!.id) });
});
