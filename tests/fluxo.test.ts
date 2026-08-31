import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ChatMessage, ChatResponse } from "@agentic/shared";
import { logar, post, subirTudo } from "./helpers.js";

const CABO = "prod_006";

type MensagemDeTool = Extract<ChatMessage, { role: "tool" }>;

function chamar(id: string, name: string, args: Record<string, unknown>) {
  return { id, name, arguments: JSON.stringify(args) };
}

function resultados(messages: ChatMessage[]) {
  return messages
    .filter((m): m is MensagemDeTool => m.role === "tool")
    .map((m) => ({ nome: m.name, dados: JSON.parse(m.content) as Record<string, unknown> }));
}

function ultimoIntencaoId(corpo: Record<string, unknown>): string {
  const messages = corpo.messages as ChatMessage[];
  const tools = messages.filter((m): m is MensagemDeTool => m.role === "tool");
  return JSON.parse(tools.at(-1)!.content).intencao_id;
}

describe("intencao presa a conversa", () => {
  let url: string;
  let llm: Awaited<ReturnType<typeof subirTudo>>["llm"];
  let fechar: () => Promise<void>;
  let alice: string;

  before(async () => {
    ({ url, llm, fechar } = await subirTudo());
    alice = await logar(url, "alice", "alice123");
  });
  after(() => fechar());

  async function conversar(message: string, conversaId?: string) {
    const { status, corpo } = await post(
      `${url}/api/chat`,
      { message, conversa_id: conversaId },
      alice,
    );
    assert.equal(status, 200);
    return corpo as ChatResponse;
  }

  it("deixa pagar a intencao registrada no mesmo turno", async () => {
    llm.roteirizar(
      { tool_calls: [chamar("c1", "registrar_intencao", { produto_id: CABO, quantidade: 1 })] },
      (corpo) => ({
        tool_calls: [
          chamar("c2", "realizar_compra", {
            intencao_id: ultimoIntencaoId(corpo),
            metodo_pagamento: "pix",
          }),
        ],
      }),
      { content: "Comprado." },
    );

    const { messages } = await conversar("quero um cabo no pix");
    const [, compra] = resultados(messages);
    assert.equal(compra!.dados.status, "aprovado");
  });

  it("deixa pagar uma intencao registrada num turno anterior da mesma conversa", async () => {
    llm.roteirizar({
      tool_calls: [chamar("c1", "registrar_intencao", { produto_id: CABO, quantidade: 1 })],
    });
    const primeira = await conversar("quero um cabo");
    const intencaoId = resultados(primeira.messages).at(-1)!.dados.intencao_id as string;

    llm.roteirizar(
      {
        tool_calls: [
          chamar("c2", "realizar_compra", { intencao_id: intencaoId, metodo_pagamento: "cartao" }),
        ],
      },
      { content: "Pago." },
    );
    const segunda = await conversar("pode pagar no cartao", primeira.conversa_id);

    const compra = resultados(segunda.messages).find((r) => r.nome === "realizar_compra")!;
    assert.equal(compra.dados.status, "aprovado");
  });

  it("recusa uma intencao valida que nasceu em OUTRA conversa", async () => {
    llm.roteirizar({
      tool_calls: [chamar("c1", "registrar_intencao", { produto_id: CABO, quantidade: 1 })],
    });
    const outraConversa = await conversar("quero um cabo");
    const intencaoId = resultados(outraConversa.messages).at(-1)!.dados.intencao_id as string;

    llm.roteirizar(
      {
        tool_calls: [
          chamar("c2", "realizar_compra", { intencao_id: intencaoId, metodo_pagamento: "pix" }),
        ],
      },
      { content: "Nao deu." },
    );
    const nova = await conversar("paga aquela intencao de antes");

    const compra = resultados(nova.messages).find((r) => r.nome === "realizar_compra")!;
    assert.equal(compra.dados.status, "recusado");
    assert.equal(compra.dados.erro, "INTENCAO_INVALIDA");
  });

  it("recusa antes de chegar no servidor mcp", async () => {
    llm.roteirizar(
      {
        tool_calls: [
          chamar("c1", "realizar_compra", {
            intencao_id: "int_nunca_vista",
            metodo_pagamento: "pix",
          }),
        ],
      },
      { content: "Nao deu." },
    );
    const { messages } = await conversar("paga a int_nunca_vista");

    const compra = resultados(messages)[0]!;
    assert.equal(compra.dados.erro, "INTENCAO_INVALIDA");
    assert.match(String(compra.dados.mensagem), /nesta conversa/i);
  });
});
