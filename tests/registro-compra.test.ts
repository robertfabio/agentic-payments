import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ChatMessage, ChatResponse, LoginResponse } from "@agentic/shared";
import { post, subirTudo } from "./helpers.js";

let contador = 0;
const nome = () => `comprador${Date.now().toString(36)}${contador++}`;

describe("usuario novo comprando", () => {
  let url: string;
  let llm: Awaited<ReturnType<typeof subirTudo>>["llm"];
  let fechar: () => Promise<void>;

  before(async () => ({ url, llm, fechar } = await subirTudo()));
  after(() => fechar());

  it("o servidor mcp enxerga o usuario criado e aprova a compra", async () => {
    const { corpo } = await post(`${url}/auth/register`, {
      username: nome(),
      senha: "senhaforte1",
    });
    const { token, usuario } = corpo as LoginResponse;

    llm.roteirizar(
      {
        tool_calls: [
          {
            id: "c1",
            name: "registrar_intencao",
            arguments: JSON.stringify({ produto_id: "prod_006", quantidade: 1 }),
          },
        ],
      },
      (recebido) => {
        const messages = recebido.messages as { role: string; content: string }[];
        const ultima = messages.filter((m) => m.role === "tool").at(-1)!;
        return {
          tool_calls: [
            {
              id: "c2",
              name: "realizar_compra",
              arguments: JSON.stringify({
                intencao_id: JSON.parse(ultima.content).intencao_id,
                metodo_pagamento: "pix",
              }),
            },
          ],
        };
      },
      { content: "Comprado." },
    );

    const chat = await post(`${url}/api/chat`, { message: "quero um cabo no pix" }, token);
    assert.equal(chat.status, 200);

    const messages = (chat.corpo as ChatResponse).messages;
    const tools = messages.filter(
      (m): m is Extract<ChatMessage, { role: "tool" }> => m.role === "tool",
    );
    const compra = JSON.parse(tools.at(-1)!.content);

    assert.equal(compra.status, "aprovado");
    assert.equal(compra.limite_restante, usuario.limite - 39.9);
  });
});
