import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { setTimeout as esperar } from "node:timers/promises";

process.env.INTENCAO_TTL_MS = "80";

type Tool = (args: never) => Promise<{ content: Array<{ type: string; text?: string }> }>;

function ler(resultado: { content: Array<{ type: string; text?: string }> }) {
  return JSON.parse(resultado.content.map((b) => b.text ?? "").join("")) as Record<string, unknown>;
}

describe("intencao expirada", () => {
  let registrarIntencao: Tool;
  let realizarCompra: Tool;

  before(async () => {
    ({ registrarIntencao } = await import("../mcp-server/src/tools/registrar-intencao.js"));
    ({ realizarCompra } = await import("../mcp-server/src/tools/realizar-compra.js"));
  });

  it("registra com prazo curto e recusa o pagamento depois do prazo", async () => {
    const intencao = ler(
      await registrarIntencao({
        usuario_id: "user_alice",
        produto_id: "prod_006",
        quantidade: 1,
      } as never),
    );

    assert.equal(intencao.status, "pendente");
    const criadaEm = Date.now();
    const expiraEm = new Date(intencao.expira_em as string).getTime();
    assert.ok(expiraEm - criadaEm <= 1000, "o TTL configuravel nao foi respeitado");

    await esperar(150);

    const compra = ler(
      await realizarCompra({
        usuario_id: "user_alice",
        intencao_id: intencao.intencao_id as string,
        metodo_pagamento: "pix",
      } as never),
    );

    assert.equal(compra.status, "recusado");
    assert.equal(compra.erro, "INTENCAO_EXPIRADA");
  });

  it("paga normalmente enquanto o prazo nao venceu", async () => {
    const intencao = ler(
      await registrarIntencao({
        usuario_id: "user_alice",
        produto_id: "prod_006",
        quantidade: 1,
      } as never),
    );

    const compra = ler(
      await realizarCompra({
        usuario_id: "user_alice",
        intencao_id: intencao.intencao_id as string,
        metodo_pagamento: "pix",
      } as never),
    );

    assert.equal(compra.status, "aprovado");
  });

  it("uma intencao expirada nao volta a valer", async () => {
    const intencao = ler(
      await registrarIntencao({
        usuario_id: "user_bob",
        produto_id: "prod_006",
        quantidade: 1,
      } as never),
    );

    await esperar(150);

    for (const metodo of ["pix", "cartao"]) {
      const compra = ler(
        await realizarCompra({
          usuario_id: "user_bob",
          intencao_id: intencao.intencao_id as string,
          metodo_pagamento: metodo,
        } as never),
      );
      assert.equal(compra.erro, "INTENCAO_EXPIRADA");
    }
  });
});
