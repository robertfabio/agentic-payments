import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { SEED_USERS, type LoginResponse, type RefreshResponse } from "@agentic/shared";
import { post, subirApp } from "./helpers.js";

const SEGREDO = process.env.JWT_SECRET!;
const EMISSOR = "agentic-payments";

function forjar(payload: object, opcoes: jwt.SignOptions = {}) {
  return jwt.sign({ jti: randomUUID(), ...payload }, SEGREDO, {
    algorithm: "HS256",
    issuer: EMISSOR,
    ...opcoes,
  });
}

async function autenticar(url: string, username: string, senha: string) {
  const { corpo } = await post(`${url}/auth/login`, { username, senha });
  return corpo as LoginResponse;
}

describe("senhas", () => {
  it("nao guarda senha em texto puro no seed", () => {
    for (const u of SEED_USERS) {
      assert.ok(!("senha" in u), `${u.username} ainda tem senha em texto puro`);
      assert.match(u.senha_hash, /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
      assert.ok(!u.senha_hash.includes("123"));
    }
  });
});

describe("login", () => {
  let url: string;
  let fechar: () => Promise<void>;

  before(async () => ({ url, fechar } = await subirApp()));
  after(() => fechar());

  it("devolve o par de tokens e o usuario", async () => {
    const { status, corpo } = await post(`${url}/auth/login`, {
      username: "alice",
      senha: "alice123",
    });
    const sessao = corpo as LoginResponse;

    assert.equal(status, 200);
    assert.ok(sessao.token);
    assert.ok(sessao.refresh_token);
    assert.equal(sessao.expira_em_s, 900);
    assert.equal(sessao.usuario.limite, 5000);
  });

  it("nao devolve a senha nem o hash", async () => {
    const { corpo } = await post(`${url}/auth/login`, { username: "alice", senha: "alice123" });
    const texto = JSON.stringify(corpo);
    assert.ok(!texto.includes("alice123"));
    assert.ok(!texto.includes("scrypt"));
  });

  it("recusa senha errada", async () => {
    const { status, corpo } = await post(`${url}/auth/login`, {
      username: "alice",
      senha: "errada",
    });
    assert.equal(status, 401);
    assert.equal((corpo as { erro: string }).erro, "CREDENCIAIS_INVALIDAS");
  });

  it("responde igual para usuario inexistente e senha errada", async () => {
    const inexistente = await post(`${url}/auth/login`, { username: "zeca", senha: "x" });
    const senhaErrada = await post(`${url}/auth/login`, { username: "alice", senha: "x" });
    assert.deepEqual(inexistente.corpo, senhaErrada.corpo);
    assert.equal(inexistente.status, senhaErrada.status);
  });

  it("recusa credenciais que nao sao string", async () => {
    const { status } = await post(`${url}/auth/login`, {
      username: { $ne: null },
      senha: { $ne: null },
    });
    assert.equal(status, 401);
  });
});

describe("access token", () => {
  let url: string;
  let fechar: () => Promise<void>;

  before(async () => ({ url, fechar } = await subirApp()));
  after(() => fechar());

  it("bloqueia o chat sem token", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" });
    assert.equal(status, 401);
  });

  it("bloqueia o chat com token invalido", async () => {
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, "token.falso.aqui");
    assert.equal(status, 401);
  });

  it("recusa token assinado com outro segredo", async () => {
    const outro = jwt.sign({ sub: "user_alice", typ: "access", jti: randomUUID() }, "outro", {
      algorithm: "HS256",
      issuer: EMISSOR,
    });
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, outro);
    assert.equal(status, 401);
  });

  it("recusa token de outro emissor", async () => {
    const t = forjar({ sub: "user_alice", typ: "access" }, { issuer: "outro-servico" });
    assert.equal((await post(`${url}/api/chat`, { message: "oi" }, t)).status, 401);
  });

  it("recusa token expirado", async () => {
    const t = forjar({ sub: "user_alice", typ: "access" }, { expiresIn: -10 });
    assert.equal((await post(`${url}/api/chat`, { message: "oi" }, t)).status, 401);
  });

  it("recusa token de um usuario que nao existe", async () => {
    const t = forjar({ sub: "user_x", typ: "access" });
    assert.equal((await post(`${url}/api/chat`, { message: "oi" }, t)).status, 401);
  });

  it("recusa token sem sub", async () => {
    assert.equal(
      (await post(`${url}/api/chat`, { message: "oi" }, forjar({ typ: "access" }))).status,
      401,
    );
  });

  it("recusa token sem tipo", async () => {
    const t = forjar({ sub: "user_alice" });
    assert.equal((await post(`${url}/api/chat`, { message: "oi" }, t)).status, 401);
  });

  it("nao aceita um refresh token no lugar do access", async () => {
    const sessao = await autenticar(url, "alice", "alice123");
    const { status } = await post(`${url}/api/chat`, { message: "oi" }, sessao.refresh_token);
    assert.equal(status, 401);
  });
});

describe("refresh", () => {
  let url: string;
  let fechar: () => Promise<void>;

  before(async () => ({ url, fechar } = await subirApp()));
  after(() => fechar());

  it("troca o refresh por um par novo", async () => {
    const sessao = await autenticar(url, "alice", "alice123");
    const { status, corpo } = await post(`${url}/auth/refresh`, {
      refresh_token: sessao.refresh_token,
    });
    const novo = corpo as RefreshResponse;

    assert.equal(status, 200);
    assert.ok(novo.token);
    assert.notEqual(novo.refresh_token, sessao.refresh_token);

    const me = await fetch(`${url}/auth/me`, {
      headers: { Authorization: `Bearer ${novo.token}` },
    });
    assert.equal(me.status, 200);
  });

  it("invalida o refresh antigo depois de usar (rotacao)", async () => {
    const sessao = await autenticar(url, "alice", "alice123");
    const primeira = await post(`${url}/auth/refresh`, { refresh_token: sessao.refresh_token });
    assert.equal(primeira.status, 200);

    const reuso = await post(`${url}/auth/refresh`, { refresh_token: sessao.refresh_token });
    assert.equal(reuso.status, 401);
    assert.equal((reuso.corpo as { erro: string }).erro, "REFRESH_INVALIDO");
  });

  it("recusa um refresh inventado", async () => {
    const t = forjar({ sub: "user_alice", typ: "refresh" });
    const { status } = await post(`${url}/auth/refresh`, { refresh_token: t });
    assert.equal(status, 401);
  });

  it("nao aceita um access token no lugar do refresh", async () => {
    const sessao = await autenticar(url, "alice", "alice123");
    const { status } = await post(`${url}/auth/refresh`, { refresh_token: sessao.token });
    assert.equal(status, 401);
  });

  it("exige o campo refresh_token", async () => {
    const { status } = await post(`${url}/auth/refresh`, {});
    assert.equal(status, 400);
  });
});

describe("logout", () => {
  let url: string;
  let fechar: () => Promise<void>;

  before(async () => ({ url, fechar } = await subirApp()));
  after(() => fechar());

  async function logout(sessao: LoginResponse, corpo: object = {}) {
    return post(
      `${url}/auth/logout`,
      { refresh_token: sessao.refresh_token, ...corpo },
      sessao.token,
    );
  }

  it("invalida o access token na hora", async () => {
    const sessao = await autenticar(url, "alice", "alice123");

    const antes = await fetch(`${url}/auth/me`, {
      headers: { Authorization: `Bearer ${sessao.token}` },
    });
    assert.equal(antes.status, 200);

    assert.equal((await logout(sessao)).status, 204);

    const depois = await fetch(`${url}/auth/me`, {
      headers: { Authorization: `Bearer ${sessao.token}` },
    });
    assert.equal(depois.status, 401);
  });

  it("invalida o refresh token", async () => {
    const sessao = await autenticar(url, "alice", "alice123");
    await logout(sessao);

    const { status } = await post(`${url}/auth/refresh`, {
      refresh_token: sessao.refresh_token,
    });
    assert.equal(status, 401);
  });

  it("derruba as outras sessoes quando pede todas", async () => {
    const primeira = await autenticar(url, "bob", "bob123");
    const segunda = await autenticar(url, "bob", "bob123");

    assert.equal((await logout(primeira, { todas: true })).status, 204);

    const { status } = await post(`${url}/auth/refresh`, {
      refresh_token: segunda.refresh_token,
    });
    assert.equal(status, 401);
  });

  it("nao derruba a sessao de outro usuario", async () => {
    const daAlice = await autenticar(url, "alice", "alice123");
    const doBob = await autenticar(url, "bob", "bob123");

    await logout(daAlice, { todas: true });

    const { status } = await post(`${url}/auth/refresh`, { refresh_token: doBob.refresh_token });
    assert.equal(status, 200);
  });

  it("exige estar autenticado", async () => {
    assert.equal((await post(`${url}/auth/logout`, {})).status, 401);
  });
});

describe("me", () => {
  let url: string;
  let fechar: () => Promise<void>;

  before(async () => ({ url, fechar } = await subirApp()));
  after(() => fechar());

  it("devolve o usuario do token", async () => {
    const sessao = await autenticar(url, "bob", "bob123");
    const res = await fetch(`${url}/auth/me`, {
      headers: { Authorization: `Bearer ${sessao.token}` },
    });
    const corpo = (await res.json()) as { usuario: { username: string; limite: number } };

    assert.equal(res.status, 200);
    assert.equal(corpo.usuario.username, "bob");
    assert.equal(corpo.usuario.limite, 200);
  });

  it("exige token", async () => {
    assert.equal((await fetch(`${url}/auth/me`)).status, 401);
  });
});
