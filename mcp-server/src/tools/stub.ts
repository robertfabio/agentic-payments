export function jsonResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export function naoImplementado(tool: string) {
  return jsonResult({ erro: "NAO_IMPLEMENTADO", mensagem: `Tool ${tool} ainda nao implementada.` });
}
