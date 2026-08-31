import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  senha: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "O usuario precisa de pelo menos 3 caracteres.")
    .max(32, "O usuario pode ter no maximo 32 caracteres.")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Use apenas letras, numeros, ponto, hifen ou underline."),
  senha: z
    .string()
    .min(8, "A senha precisa de pelo menos 8 caracteres.")
    .max(200, "A senha pode ter no maximo 200 caracteres."),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1, "Envie `refresh_token`."),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(1).optional(),
  todas: z.boolean().optional(),
});

export function primeiroErro(erro: z.ZodError): string {
  return erro.issues[0]?.message ?? "Dados invalidos.";
}
