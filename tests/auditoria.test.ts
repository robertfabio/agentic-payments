import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { logar, post, subirTudo } from "./helpers.js";

const CABO = "prod_006";

interface Registro {
  data: string;
  usuario_id: string;
  tool: string;
  argumentos: Record<string, unknown>;
  status: string;
  erro?: string;
  valor?: number;
  transacao_id?: string;
  duracao_ms: number;
}

describe("auditoria", () => {
  let url: string;
  let llm: Awaited<ReturnType<typeof subirTudo>>["llm"];
  let fechar: () => Promise<void>;
  let alice: string;
  let bob: string;

  before(async () => {
    ({ url, llm, fechar } = await subirTudo());
    alice = await logar(url, "alice", "alice123");
    bob = await logar(url, "bob", "bob123");
  });
  after(() => fechar());

  async function auditoria(token: string): Promise<Registro[]> {
    const res = await fetch(`${url}/api/auditoria`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return ((await res.json()) as { registros: Registro[] }).registros;
  }

  it("exige autenticacao", async () => {
    assert.equal((await fetch(`${url}/api/auditoria`)).status, 401);
  });

  it("registra quem chamou, o que, quanto e o resultado", async () => {
    llm.roteirizar(
      {
        tool_calls: [
          {
            id: "c1",
            name: "registrar_intencao",
            arguments: JSON.stringify({ produto_id: CABO, quantidade: 1 }),
          },
        ],
      },
      (corpo) => {
        const messages = (corpo.messages ?? []) as { role: string; content: string }[];
        const ultima = messages.filter((m) => m.role === "tool").at(-1)!;
        return {
          tool_calls: [
            {
              id: "c2",
              name: "realizar_compra",
              arguments: JSON.stringify({
                intencao_id: JSON.parse(ultima.content).intencao_id,
                metodo_pagamento: "cartao",
              }),
            },
          ],
        };
      },
      { content: "Comprado." },
    );

    await post(`${url}/api/chat`, { message: "quero um cabo no cartao" }, alice);

    const registros = await auditoria(alice);
    const compra = registros.find((r) => r.tool === "realizar_compra")!;
    const intencao = registros.find((r) => r.tool === "registrar_intencao")!;

    assert.ok(intencao, "registrar_intencao nao foi auditada");
    assert.equal(compra.usuario_id, "user_alice");
    assert.equal(compra.status, "aprovado");
    assert.equal(compra.valor, 39.9);
    assert.ok(compra.transacao_id);
    assert.ok(typeof compra.duracao_ms === "number");
    assert.ok(Date.parse(compra.data) > 0);
  });

  it("registra tambem a recusa, com o motivo", async () => {
    llm.roteirizar(
      {
        tool_calls: [
          {
            id: "c1",
            name: "realizar_compra",
            arguments: JSON.stringify({ intencao_id: "int_falsa", metodo_pagamento: "pix" }),
          },
        ],
      },
      { content: "Recusado." },
    );

    await post(`${url}/api/chat`, { message: "paga a int_falsa" }, alice);

    const recusa = (await auditoria(alice)).find((r) => r.status === "recusado")!;
    assert.ok(recusa, "a recusa nao foi auditada");
    assert.equal(recusa.erro, "INTENCAO_INVALIDA");
  });

  it("nao guarda o usuario_id dentro dos argumentos auditados", async () => {
    const registros = await auditoria(alice);
    for (const r of registros) {
      assert.ok(!("usuario_id" in r.argumentos), `${r.tool} duplicou usuario_id nos argumentos`);
    }
  });

  it("um usuario nao ve a auditoria do outro", async () => {
    llm.roteirizar(
      { tool_calls: [{ id: "c1", name: "listar_catalogo", arguments: "{}" }] },
      { content: "ok" },
    );
    await post(`${url}/api/chat`, { message: "catalogo" }, bob);

    const doBob = await auditoria(bob);
    assert.ok(doBob.length > 0);
    assert.ok(doBob.every((r) => r.usuario_id === "user_bob"));

    const daAlice = await auditoria(alice);
    assert.ok(daAlice.every((r) => r.usuario_id === "user_alice"));
  });

  it("respeita o limite pedido", async () => {
    const res = await fetch(`${url}/api/auditoria?limite=1`, {
      headers: { Authorization: `Bearer ${alice}` },
    });
    const { registros } = (await res.json()) as { registros: Registro[] };
    assert.equal(registros.length, 1);
  });
});
