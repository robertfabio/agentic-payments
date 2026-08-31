import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const ALGORITMO = "HS256";
export const EMISSOR = "agentic-payments";

const VALIDADE_ACCESS_S = 15 * 60;
const VALIDADE_REFRESH_S = 7 * 24 * 60 * 60;

export type TipoToken = "access" | "refresh";

interface Payload extends jwt.JwtPayload {
  sub: string;
  typ: TipoToken;
  jti: string;
}

const refreshAtivos = new Map<string, { usuarioId: string; expiraEm: number }>();

const accessRevogados = new Map<string, number>();

function limpar() {
  const agora = Date.now();
  for (const [jti, s] of refreshAtivos) if (s.expiraEm <= agora) refreshAtivos.delete(jti);
  for (const [jti, exp] of accessRevogados) if (exp <= agora) accessRevogados.delete(jti);
}

function assinar(usuarioId: string, typ: TipoToken, segundos: number): [string, string] {
  const jti = randomUUID();
  const token = jwt.sign({ sub: usuarioId, typ, jti }, config.jwtSecret, {
    algorithm: ALGORITMO,
    issuer: EMISSOR,
    expiresIn: segundos,
  });
  return [token, jti];
}

export interface ParDeTokens {
  token: string;
  refresh_token: string;
  expira_em_s: number;
}

export function emitirPar(usuarioId: string): ParDeTokens {
  limpar();
  const [token] = assinar(usuarioId, "access", VALIDADE_ACCESS_S);
  const [refresh, jti] = assinar(usuarioId, "refresh", VALIDADE_REFRESH_S);

  refreshAtivos.set(jti, { usuarioId, expiraEm: Date.now() + VALIDADE_REFRESH_S * 1000 });
  return { token, refresh_token: refresh, expira_em_s: VALIDADE_ACCESS_S };
}

function verificar(token: string, typ: TipoToken): Payload | undefined {
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: [ALGORITMO],
      issuer: EMISSOR,
    });
    if (typeof payload === "string") return undefined;

    const { sub, typ: tipo, jti } = payload as Payload;
    if (!sub || !jti || tipo !== typ) return undefined;
    return payload as Payload;
  } catch {
    return undefined;
  }
}

export function verificarAccess(token: string): Payload | undefined {
  limpar();
  const payload = verificar(token, "access");
  if (!payload || accessRevogados.has(payload.jti)) return undefined;
  return payload;
}

export function rotacionar(refreshToken: string): ParDeTokens | undefined {
  limpar();
  const payload = verificar(refreshToken, "refresh");
  if (!payload) return undefined;

  const sessao = refreshAtivos.get(payload.jti);
  if (!sessao || sessao.usuarioId !== payload.sub) return undefined;

  refreshAtivos.delete(payload.jti);
  return emitirPar(payload.sub);
}

export function encerrarSessao(refreshToken: string | undefined, accessPayload?: Payload) {
  limpar();

  if (refreshToken) {
    const payload = verificar(refreshToken, "refresh");
    if (payload) refreshAtivos.delete(payload.jti);
  }

  if (accessPayload?.jti && accessPayload.exp) {
    accessRevogados.set(accessPayload.jti, accessPayload.exp * 1000);
  }
}

export function encerrarTudo(usuarioId: string) {
  for (const [jti, s] of refreshAtivos) if (s.usuarioId === usuarioId) refreshAtivos.delete(jti);
}

export function sessoesAtivas(usuarioId: string): number {
  limpar();
  let n = 0;
  for (const s of refreshAtivos.values()) if (s.usuarioId === usuarioId) n++;
  return n;
}
