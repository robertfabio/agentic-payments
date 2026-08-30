import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { post, subirApp } from "./helpers.js";

const SEGREDO = process.env.JWT_SECRET!;
const EMISSOR = "agentic-payments";

function token(payload: object, opcoes: jwt.SignOptions = {}) {
  return jwt.sign(payload, SEGREDO, { algorithm: "HS256", issuer: EMISSOR, ...opcoes });
}

describe("autenticacao", () => {
  let url: string;
  let fechar: () => Promise<void>;

  before(async () => ({ url, fechar } = await subirApp()));
  after(() => fechar());

  it("devolve token e usuario com credenciais validas", async () => {
    const { status, corpo } = await post(`${url}/auth/login`, {
      username: "alice",
      senha: "alice123",
    });
    assert.equal(status, 200);
    assert.ok((corpo as { token: string }).token);
    assert.equal((corpo as { usuario: { limite: number } }).usuario.limite, 5000);
  });

  it("nao devolve a senha no corpo do login", async () => {
    const { corpo } = await post(`${url}/auth/login`, { username: "alice", senha: "alice123" });
    assert.ok(!JSON.stringify(corpo).includes("alice123"));
  });

  it("recusa senha errada", async () => {
    const { status, corpo } = await post(`${url}/auth/login`, {
      username: "alice",
      senha: "errada",
    });
    assert.equal(status, 401);
    assert.equal((corpo as { erro: string }).erro, "CREDENCIAIS_INVALIDAS");
  });

  it("recusa credenciais que nao sao string", async () => {
    const { status } = await post(`${url}/auth/login`, {
      username: { $ne: null },
      senha: { $ne: null },
    });
    assert.equal(status, 401);
  });

  it("bloqueia o chat sem token", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" });
    assert.equal(status, 401);
  });

  it("bloqueia o chat com token invalido", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, "token.falso.aqui");
    assert.equal(status, 401);
  });

  it("recusa token assinado com outro segredo", async () => {
    const forjado = jwt.sign({ sub: "user_alice" }, "outro-segredo", {
      algorithm: "HS256",
      issuer: EMISSOR,
    });
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, forjado);
    assert.equal(status, 401);
  });

  it("recusa token de outro emissor", async () => {
    const { status } = await post(
      `${url}/api/chat`,
      { message: "oi" },
      token({ sub: "user_alice" }, { issuer: "outro-servico" }),
    );
    assert.equal(status, 401);
  });

  it("recusa token expirado", async () => {
    const { status } = await post(
      `${url}/api/chat`,
      { message: "oi" },
      token({ sub: "user_alice" }, { expiresIn: -10 }),
    );
    assert.equal(status, 401);
  });

  it("recusa token de um usuario que nao existe", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, token({ sub: "user_x" }));
    assert.equal(status, 401);
  });

  it("recusa token sem sub", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, token({}));
    assert.equal(status, 401);
  });
});
