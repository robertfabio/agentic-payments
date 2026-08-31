import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { chamarTool, fecharMcpClient, listarToolsParaLlm } from "../backend/src/mcp/client.js";

// Um unico servidor MCP para o arquivo inteiro: subir o processo custa ~10s.
after(() => fecharMcpClient());

const ALICE = "user_alice";
const BOB = "user_bob";

const CABO = "prod_006"; // R$ 39,90
const FONE = "prod_003"; // R$ 249,90

async function tool(nome: string, args: Record<string, unknown>, usuarioId: string) {
  return JSON.parse(await chamarTool(nome, args, usuarioId));
}

async function intencao(usuarioId: string, produtoId: string, quantidade = 1) {
  return tool("registrar_intencao", { produto_id: produtoId, quantidade }, usuarioId);
}

describe("cliente mcp", () => {
  it("descobre as tres tools do servidor", async () => {
    const tools = await listarToolsParaLlm();
    const nomes = tools.map((t) => t.function.name).sort();
    assert.deepEqual(nomes, ["listar_catalogo", "realizar_compra", "registrar_intencao"]);
  });

  it("nao expoe usuario_id no schema que vai para o modelo", async () => {
    const tools = await listarToolsParaLlm();
    for (const tool of tools) {
      const { properties } = tool.function.parameters as { properties: Record<string, unknown> };
      assert.ok(!("usuario_id" in properties), `${tool.function.name} vazou usuario_id`);
    }
  });

  it("nao aceita valor vindo do modelo em realizar_compra", async () => {
    const tools = await listarToolsParaLlm();
    const compra = tools.find((t) => t.function.name === "realizar_compra")!;
    const { properties } = compra.function.parameters as { properties: Record<string, unknown> };
    for (const proibido of ["valor", "valor_total", "preco", "limite"]) {
      assert.ok(!(proibido in properties), `realizar_compra aceita ${proibido} do modelo`);
    }
  });
});

describe("catalogo", () => {
  it("lista os produtos", async () => {
    const { produtos } = await tool("listar_catalogo", {}, ALICE);
    assert.equal(produtos.length, 6);
    assert.ok(produtos.every((p: { preco: number }) => typeof p.preco === "number"));
  });

  it("filtra por categoria", async () => {
    const { produtos } = await tool("listar_catalogo", { categoria: "audio" }, ALICE);
    assert.deepEqual(
      produtos.map((p: { id: string }) => p.id).sort(),
      ["prod_003", "prod_004"],
    );
  });

  it("acha a categoria mesmo escrita com acento", async () => {
    // O catalogo guarda "audio" e "acessorios", mas ninguem digita assim.
    for (const [escrito, esperado] of [
      ["áudio", ["prod_003", "prod_004"]],
      ["ÁUDIO", ["prod_003", "prod_004"]],
      ["acessórios", ["prod_006"]],
      ["  Acessórios  ", ["prod_006"]],
    ] as const) {
      const { produtos } = await tool("listar_catalogo", { categoria: escrito }, ALICE);
      assert.deepEqual(
        produtos.map((p: { id: string }) => p.id).sort(),
        [...esperado],
        `categoria "${escrito}" nao bateu`,
      );
    }
  });

  it("devolve vazio para uma categoria que nao existe", async () => {
    const { produtos } = await tool("listar_catalogo", { categoria: "geladeiras" }, ALICE);
    assert.deepEqual(produtos, []);
  });
});

describe("intencao e compra", () => {
  it("o servidor calcula o valor da intencao", async () => {
    const criada = await intencao(ALICE, CABO, 2);
    assert.match(criada.intencao_id, /^int_/);
    assert.equal(criada.valor_total, 79.8);
    assert.equal(criada.status, "pendente");
  });

  it("aprova uma compra no cartao e debita o limite", async () => {
    const { intencao_id } = await intencao(ALICE, CABO);
    const r = await tool("realizar_compra", { intencao_id, metodo_pagamento: "cartao" }, ALICE);
    assert.equal(r.status, "aprovado");
    assert.equal(r.valor, 39.9);
    assert.equal(r.metodo_pagamento, "cartao");
    assert.ok(r.limite_restante < 5000);
  });

  it("aprova uma compra no pix", async () => {
    const { intencao_id } = await intencao(ALICE, CABO);
    const r = await tool("realizar_compra", { intencao_id, metodo_pagamento: "pix" }, ALICE);
    assert.equal(r.status, "aprovado");
    assert.equal(r.metodo_pagamento, "pix");
  });

  it("recusa um intencao_id inventado pelo modelo", async () => {
    const r = await tool(
      "realizar_compra",
      { intencao_id: "int_alucinado_pelo_llm", metodo_pagamento: "pix" },
      ALICE,
    );
    assert.equal(r.status, "recusado");
    assert.equal(r.erro, "INTENCAO_INVALIDA");
  });

  it("recusa uma intencao de outro usuario", async () => {
    const { intencao_id } = await intencao(ALICE, CABO);
    const r = await tool("realizar_compra", { intencao_id, metodo_pagamento: "pix" }, BOB);
    assert.equal(r.status, "recusado");
    assert.equal(r.erro, "INTENCAO_INVALIDA");
  });

  it("recusa pagar duas vezes a mesma intencao", async () => {
    const { intencao_id } = await intencao(ALICE, CABO);
    const primeira = await tool(
      "realizar_compra",
      { intencao_id, metodo_pagamento: "cartao" },
      ALICE,
    );
    assert.equal(primeira.status, "aprovado");

    const segunda = await tool(
      "realizar_compra",
      { intencao_id, metodo_pagamento: "cartao" },
      ALICE,
    );
    assert.equal(segunda.status, "recusado");
    assert.equal(segunda.erro, "INTENCAO_JA_PAGA");
  });

  it("recusa uma compra acima do limite", async () => {
    const { intencao_id, valor_total } = await intencao(BOB, FONE);
    assert.equal(valor_total, 249.9); // bob so tem R$ 200

    const r = await tool("realizar_compra", { intencao_id, metodo_pagamento: "cartao" }, BOB);
    assert.equal(r.status, "recusado");
    assert.equal(r.erro, "LIMITE_EXCEDIDO");
  });

  it("recusa um metodo de pagamento invalido", async () => {
    const { intencao_id } = await intencao(ALICE, CABO);
    const r = await tool("realizar_compra", { intencao_id, metodo_pagamento: "boleto" }, ALICE);
    assert.equal(r.status, "recusado");
    assert.equal(r.erro, "METODO_INVALIDO");
  });
});
