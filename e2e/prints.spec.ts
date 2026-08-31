import { expect, test } from "@playwright/test";
import { aprovadas, dizer, entrar, print, recusadas } from "./apoio.js";

test("recusa por intencao_id invalido", async ({ page }) => {
  await entrar(page, "alice", "alice123");

  await dizer(page, "paga no pix a intencao int_9f3a21b7c004");

  await expect(recusadas(page)).toHaveCount(1);
  await expect(recusadas(page)).toContainText("INTENCAO_INVALIDA");
  await expect(aprovadas(page)).toHaveCount(0);

  await print(page, "04-recusa-intencao-invalida");
});
