import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ApiError } from "@agentic/shared";
import { logar, post, subirTudo } from "./helpers.js";

describe("guardrails", () => {
  let url: string;
  let llm: Awaited<ReturnType<typeof subirTudo>>["llm"];
  let fechar: () => Promise<void>;
  let alice: string;
  let bob: string;

  before(async () => {
    ({ url, llm, fechar } = await subirTudo());
    alice = await logar(url, "alice", "alice123");
    bob = await logar(url, "bob", "bob123");
    llm.repetir({ content: "ok" });
  });
  after(() => fechar());

  it("recusa mensagem acima do limite de caracteres", async () => {
    const { status, corpo } = await post(`${url}/api/chat`, { message: "a".repeat(2001) }, alice);

    assert.equal(status, 413);
    assert.equal((corpo as ApiError).erro, "MENSAGEM_LONGA");
  });

  it("aceita uma mensagem no limite", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "a".repeat(2000) }, alice);
    assert.equal(status, 200);
  });

  it("recusa corpo maior que o limite do express", async () => {
    const res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${alice}` },
      body: JSON.stringify({ message: "oi", lixo: "x".repeat(100_000) }),
    });
    assert.equal(res.status, 413);
  });

  it("corta o usuario depois de muitas mensagens seguidas", async () => {
    let visto429 = false;
    let ultimaResposta: { status: number; corpo: unknown } | undefined;

    for (let i = 0; i < 25; i++) {
      ultimaResposta = await post(`${url}/api/chat`, { message: "oi" }, bob);
      if (ultimaResposta.status === 429) {
        visto429 = true;
        break;
      }
    }

    assert.ok(visto429, "o limite de taxa nunca disparou");
    assert.equal((ultimaResposta!.corpo as ApiError).erro, "MUITAS_REQUISICOES");
  });

  it("o limite de taxa e por usuario", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, alice);
    assert.notEqual(status, 429);
  });

  it("responde com Retry-After quando corta", async () => {
    let res = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bob}` },
      body: JSON.stringify({ message: "oi" }),
    });

    for (let i = 0; i < 25 && res.status !== 429; i++) {
      res = await fetch(`${url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${bob}` },
        body: JSON.stringify({ message: "oi" }),
      });
    }

    assert.equal(res.status, 429);
    assert.ok(Number(res.headers.get("retry-after")) > 0);
  });

  it("exige autenticacao antes de contar o limite", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" });
    assert.equal(status, 401);
  });
});
