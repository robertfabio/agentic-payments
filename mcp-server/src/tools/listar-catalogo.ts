import { z } from "zod";
import { naoImplementado } from "./stub.js";

export const schema = {
  usuario_id: z.string(),
  categoria: z.string().optional(),
};

export async function listarCatalogo(_args: { usuario_id: string; categoria?: string }) {
  return naoImplementado("listar_catalogo");
}
