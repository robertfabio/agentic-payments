import { expect, type Page } from "@playwright/test";

export const PRINTS = "docs/prints";

export async function entrar(page: Page, username: string, senha: string) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.getByPlaceholder("Digite seu nome de usuário").fill(username);
  await page.getByPlaceholder("Digite sua senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page.getByPlaceholder("Digite sua mensagem")).toBeVisible();
}

export async function dizer(page: Page, texto: string) {
  const campo = page.getByPlaceholder("Digite sua mensagem");
  await expect(campo).toBeEnabled();
  await campo.fill(texto);
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.locator(".mensagem-carregando")).toHaveCount(0, { timeout: 180_000 });
  await expect(campo).toBeEnabled({ timeout: 180_000 });
}

export function aprovadas(page: Page) {
  return page.locator(".ferramenta.ok").filter({ hasText: "realizar_compra" });
}

export function recusadas(page: Page) {
  return page.locator(".ferramenta.recusado").filter({ hasText: "realizar_compra" });
}

export async function print(page: Page, nome: string) {
  await page.screenshot({ path: `${PRINTS}/${nome}.png`, fullPage: true });
}
