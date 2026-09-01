import type {
  ApiError,
  ChatRequest,
  ChatResponse,
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  User,
} from "@agentic/shared";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";
const CHAVE = "agentic-payments:sessao";

interface Sessao {
  token: string;
  refresh_token: string;
}

let sessao: Sessao | null = lerDoDisco();

function lerDoDisco(): Sessao | null {
  try {
    const cru = localStorage.getItem(CHAVE);
    return cru ? (JSON.parse(cru) as Sessao) : null;
  } catch {
    return null;
  }
}

function guardar(nova: Sessao | null) {
  sessao = nova;
  try {
    if (nova) localStorage.setItem(CHAVE, JSON.stringify(nova));
    else localStorage.removeItem(CHAVE);
  } catch {}
}

export function temSessao(): boolean {
  return sessao !== null;
}

async function parseOuFalhar<T>(res: Response): Promise<T> {
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error((corpo as ApiError | null)?.mensagem ?? `Erro ${res.status}`);
  return corpo as T;
}

async function renovar(): Promise<boolean> {
  if (!sessao) return false;

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: sessao.refresh_token }),
  });

  if (!res.ok) {
    guardar(null);
    return false;
  }

  const novo = (await res.json()) as RefreshResponse;
  guardar({ token: novo.token, refresh_token: novo.refresh_token });
  return true;
}

async function autenticado(
  caminho: string,
  init: RequestInit,
  jaRenovou = false,
): Promise<Response> {
  const res = await fetch(`${BASE_URL}${caminho}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !jaRenovou && (await renovar())) {
    return autenticado(caminho, init, true);
  }
  return res;
}

export async function login(credenciais: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credenciais),
  });

  const corpo = await parseOuFalhar<LoginResponse>(res);
  guardar({ token: corpo.token, refresh_token: corpo.refresh_token });
  return corpo;
}

export async function retomarSessao(): Promise<User | null> {
  if (!sessao) return null;

  const res = await autenticado("/auth/me", { method: "GET" });
  if (!res.ok) {
    guardar(null);
    return null;
  }
  return ((await res.json()) as { usuario: User }).usuario;
}

export async function logout(): Promise<void> {
  const refresh = sessao?.refresh_token;
  try {
    await autenticado("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token: refresh }),
    });
  } catch {}
  guardar(null);
}

export async function enviarChat(message: string, conversaId?: string): Promise<ChatResponse> {
  const corpo: ChatRequest = { message, conversa_id: conversaId };
  const res = await autenticado("/api/chat", { method: "POST", body: JSON.stringify(corpo) });
  return parseOuFalhar<ChatResponse>(res);
}
