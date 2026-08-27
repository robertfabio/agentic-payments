import { z } from "zod";
import { naoImplementado } from "./stub.js";

export const schema = {
  usuario_id: z.string(),
  produto_id: z.string(),
  quantidade: z.number().int().positive(),
};

export async function registrarIntencao(_args: {
  usuario_id: string;
  produto_id: string;
  quantidade: number;
}) {
  return naoImplementado("registrar_intencao");
}
