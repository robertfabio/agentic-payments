/**
 * Converte qualquer objeto JavaScript em uma resposta
 * compatível com o formato esperado pelo MCP.
 *
 * As tools usam esta função para devolver JSON ao MCP Client.
 */
export function jsonResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}