import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { ApiError, LoginResponse } from "@agentic/shared";
import { post, subirApp } from "./helpers.js";

let contador = 0;
const nome = () => `novato${Date.now().toString(36)}${contador++}`;

describe("registro", () => {
  let url: string;
  let fechar: () => Promise<void>;

  before(async () => ({ url, fechar } = await subirApp()));
  after(() => fechar());

  it("cria o usuario e ja devolve a sessao", async () => {
    const username = nome();
    const { status, corpo } = await post(`${url}/auth/register`, {
      username,
      senha: "senhaforte1",
    });
    const sessao = corpo as LoginResponse;

    assert.equal(status, 201);
    assert.ok(sessao.token);
    assert.ok(sessao.refresh_token);
    assert.equal(sessao.usuario.username, username);
    assert.match(sessao.usuario.id, /^user_/);
  });

  it("o limite vem do servidor, nunca do request", async () => {
    const { corpo } = await post(`${url}/auth/register`, {
      username: nome(),
      senha: "senhaforte1",
      limite: 999999,
    });

    assert.equal((corpo as LoginResponse).usuario.limite, 1000);
  });

  it("nao devolve a senha nem o hash", async () => {
    const { corpo } = await post(`${url}/auth/register`, {
      username: nome(),
      senha: "senhaforte1",
    });
    const texto = JSON.stringify(corpo);

    assert.ok(!texto.includes("senhaforte1"));
    assert.ok(!texto.includes("scrypt"));
  });

  it("o usuario criado consegue logar depois", async () => {
    const username = nome();
    await post(`${url}/auth/register`, { username, senha: "senhaforte1" });

    const { status, corpo } = await post(`${url}/auth/login`, { username, senha: "senhaforte1" });
    assert.equal(status, 200);
    assert.equal((corpo as LoginResponse).usuario.username, username);
  });

  it("o usuario criado acessa o chat", async () => {
    const username = nome();
    const { corpo } = await post(`${url}/auth/register`, { username, senha: "senhaforte1" });
    const { token } = corpo as LoginResponse;

    const res = await fetch(`${url}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 200);
  });

  it("recusa username ja em uso", async () => {
    const username = nome();
    await post(`${url}/auth/register`, { username, senha: "senhaforte1" });

    const { status, corpo } = await post(`${url}/auth/register`, {
      username,
      senha: "outrasenha1",
    });
    assert.equal(status, 409);
    assert.equal((corpo as ApiError).erro, "USUARIO_EM_USO");
  });

  it("recusa colidir com um usuario de seed", async () => {
    const { status } = await post(`${url}/auth/register`, {
      username: "alice",
      senha: "senhaforte1",
    });
    assert.equal(status, 409);
  });

  it("a colisao ignora maiusculas", async () => {
    const { status } = await post(`${url}/auth/register`, {
      username: "ALICE",
      senha: "senhaforte1",
    });
    assert.equal(status, 409);
  });

  it("recusa senha curta", async () => {
    const { status, corpo } = await post(`${url}/auth/register`, {
      username: nome(),
      senha: "1234567",
    });
    assert.equal(status, 400);
    assert.match((corpo as ApiError).mensagem, /8 caracteres/);
  });

  it("recusa username curto", async () => {
    const { status } = await post(`${url}/auth/register`, { username: "ab", senha: "senhaforte1" });
    assert.equal(status, 400);
  });

  it("recusa caractere invalido no username", async () => {
    const { status, corpo } = await post(`${url}/auth/register`, {
      username: "com espaco",
      senha: "senhaforte1",
    });
    assert.equal(status, 400);
    assert.match((corpo as ApiError).mensagem, /letras, numeros/);
  });

  it("recusa corpo sem os campos", async () => {
    assert.equal((await post(`${url}/auth/register`, {})).status, 400);
  });

  it("recusa tipos errados", async () => {
    const { status } = await post(`${url}/auth/register`, {
      username: { $ne: null },
      senha: ["x"],
    });
    assert.equal(status, 400);
  });
});
