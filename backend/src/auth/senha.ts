import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derivar = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
  opcoes: { N: number; r: number; p: number },
) => Promise<Buffer>;

// Parametros do scrypt. Gravados junto do hash para que uma troca futura
// nao invalide as senhas ja existentes.
const N = 16384;
const R = 8;
const P = 1;
const TAMANHO = 64;

/** Formato: scrypt$N$r$p$sal$hash, tudo em hex. */
export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(senha, sal, TAMANHO, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString("hex")}$${hash.toString("hex")}`;
}

// timingSafeEqual: um `===` vazaria, pelo tempo, quantos bytes bateram.
export async function conferirSenha(senha: string, guardado: string): Promise<boolean> {
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const [, n, r, p, salHex, hashHex] = partes;
  const esperado = Buffer.from(hashHex!, "hex");

  let obtido: Buffer;
  try {
    obtido = await derivar(senha, Buffer.from(salHex!, "hex"), esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
  } catch {
    return false;
  }

  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}
