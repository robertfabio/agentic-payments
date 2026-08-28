import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@agentic/shared";

interface Conversa {
  id: string;
  usuario_id: string;
  messages: ChatMessage[];
}

const conversas = new Map<string, Conversa>();

export function criarConversa(usuarioId: string): Conversa {
  const conversa: Conversa = { id: randomUUID(), usuario_id: usuarioId, messages: [] };
  conversas.set(conversa.id, conversa);
  return conversa;
}

export function getConversa(id: string, usuarioId: string): Conversa | undefined {
  const conversa = conversas.get(id);
  if (!conversa || conversa.usuario_id !== usuarioId) return undefined;
  return conversa;
}

export function apagarConversa(id: string, usuarioId: string): boolean {
  if (!getConversa(id, usuarioId)) return false;
  return conversas.delete(id);
}
