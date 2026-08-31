import type { ChatMessage } from "@agentic/shared";

export function intencoesDaConversa(historico: ChatMessage[]): Set<string> {
  const ids = new Set<string>();

  for (const m of historico) {
    if (m.role !== "tool" || m.name !== "registrar_intencao") continue;

    try {
      const dados = JSON.parse(m.content) as { intencao_id?: unknown };
      if (typeof dados.intencao_id === "string") ids.add(dados.intencao_id);
    } catch {
      continue;
    }
  }

  return ids;
}

export function intencaoForaDaConversa(
  nomeDaTool: string,
  args: Record<string, unknown>,
  emitidas: Set<string>,
): string | null {
  if (nomeDaTool !== "realizar_compra") return null;

  const id = args.intencao_id;
  if (typeof id !== "string" || !emitidas.has(id)) return String(id ?? "");

  return null;
}
