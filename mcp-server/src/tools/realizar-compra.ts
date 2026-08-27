import { z } from "zod";
import { METODOS_PAGAMENTO } from "@agentic/shared";
import { naoImplementado } from "./stub.js";

export const schema = {
  usuario_id: z.string(),
  intencao_id: z.string(),
  metodo_pagamento: z.enum(METODOS_PAGAMENTO as unknown as [string, ...string[]]),
};

export async function realizarCompra(_args: {
  usuario_id: string;
  intencao_id: string;
  metodo_pagamento: string;
}) {
  return naoImplementado("realizar_compra");
}
