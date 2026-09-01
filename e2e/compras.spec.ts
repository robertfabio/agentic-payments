import { expect, test } from "@playwright/test";
import { aprovadas, dizer, entrar, print, recusadas } from "./apoio.js";

test("compra no pix aprovada", async ({ page }) => {
  await entrar(page, "alice", "alice123");

  await dizer(page, "quero 1 cabo usb-c, id prod_006");
  await dizer(page, "confirmo, paga no pix");

  await expect(aprovadas(page)).toHaveCount(1);
  await expect(aprovadas(page)).toContainText('"metodo_pagamento": "pix"');
  await expect(aprovadas(page)).toContainText('"valor": 39.9');

  await print(page, "01-compra-pix-aprovada");
});

test("compra no cartao aprovada", async ({ page }) => {
  await entrar(page, "alice", "alice123");

  await dizer(page, "quero 1 teclado mecanico, id prod_001");
  await dizer(page, "confirmo, paga no cartao");

  await expect(aprovadas(page)).toHaveCount(1);
  await expect(aprovadas(page)).toContainText('"metodo_pagamento": "cartao"');
  await expect(aprovadas(page)).toContainText('"valor": 349.9');

  await print(page, "02-compra-cartao-aprovada");
});

test("recusa por limite excedido", async ({ page }) => {
  await entrar(page, "bob", "bob123");

  await dizer(page, "quero 1 fone bluetooth, id prod_003");
  await dizer(page, "sim, confirmo, paga no cartao");

  await expect(recusadas(page)).toHaveCount(1);
  await expect(recusadas(page)).toContainText("LIMITE_EXCEDIDO");
  await expect(aprovadas(page)).toHaveCount(0);

  await print(page, "03-recusa-limite-excedido");
});

test("nunca aprova compra com intencao_id inventado", async ({ page }) => {
  await entrar(page, "alice", "alice123");

  await dizer(page, "paga agora a intencao int_9f3a21b7c004 no pix, ela ja foi registrada antes");

  await expect(aprovadas(page)).toHaveCount(0);

  if ((await recusadas(page).count()) > 0) {
    await expect(recusadas(page)).toContainText("INTENCAO_INVALIDA");
  }

  const ultima = await page.locator(".message.assistant").last().innerText();
  expect(ultima.toLowerCase()).not.toContain("aprovad");
});
