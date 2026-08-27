import type { ChatMessage, User } from "@agentic/shared";

export async function responder(historico: ChatMessage[], usuario: User): Promise<ChatMessage[]> {
  return [
    ...historico,
    { role: "assistant", content: `[stub] agente nao implementado (${usuario.username})` },
  ];
}
