import type {
  ApiError,
  ChatRequest,
  ChatResponse,
  LoginRequest,
  LoginResponse,
} from "@agentic/shared";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function parseOuFalhar<T>(res: Response): Promise<T> {
  const corpo = await res.json().catch(() => null);
  if (!res.ok) throw new Error((corpo as ApiError | null)?.mensagem ?? `Erro ${res.status}`);
  return corpo as T;
}

export async function login(credenciais: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credenciais),
  });
  return parseOuFalhar<LoginResponse>(res);
}

export async function enviarChat(
  message: string,
  token: string,
  conversaId?: string,
): Promise<ChatResponse> {
  const corpo: ChatRequest = { message, conversa_id: conversaId };
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(corpo),
  });
  return parseOuFalhar<ChatResponse>(res);
}
