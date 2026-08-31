import { expect, test } from "@playwright/test";
import { dizer, entrar } from "./apoio.js";

test("o chat nao aparece sem login", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByPlaceholder("Digite seu nome de usuário")).toBeVisible();
  await expect(page.getByPlaceholder("Digite sua mensagem")).toHaveCount(0);
});

test("senha errada mostra erro e nao entra", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder("Digite seu nome de usuário").fill("alice");
  await page.getByPlaceholder("Digite sua senha").fill("errada");
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.locator(".error-message")).toContainText("incorretos");
  await expect(page.getByPlaceholder("Digite sua mensagem")).toHaveCount(0);
});

test("mostra o limite do usuario logado", async ({ page }) => {
  await entrar(page, "bob", "bob123");
  await expect(page.locator(".chat-header")).toContainText("bob");
  await expect(page.locator(".chat-header")).toContainText("200,00");
});

test("a sessao sobrevive a recarregar a pagina", async ({ page }) => {
  await entrar(page, "alice", "alice123");
  await page.reload();

  await expect(page.getByPlaceholder("Digite sua mensagem")).toBeVisible();
  await expect(page.locator(".chat-header")).toContainText("alice");
});

test("sair volta para o login e nao deixa voltar recarregando", async ({ page }) => {
  await entrar(page, "alice", "alice123");
  await page.getByRole("button", { name: "Sair" }).click();

  await expect(page.getByPlaceholder("Digite seu nome de usuário")).toBeVisible();

  await page.reload();
  await expect(page.getByPlaceholder("Digite seu nome de usuário")).toBeVisible();
  await expect(page.getByPlaceholder("Digite sua mensagem")).toHaveCount(0);
});

test("a conversa mostra a chamada de ferramenta e o resultado", async ({ page }) => {
  await entrar(page, "alice", "alice123");
  await dizer(page, "o que voces tem no catalogo?");

  await expect(page.locator(".tool-call").first()).toContainText("listar_catalogo");
  await expect(page.locator(".tool-result").first()).toContainText("produtos");
});
