import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SEED_USERS } from "./seed.js";

export interface UsuarioArmazenado {
  id: string;
  username: string;
  senha_hash: string;
  limite: number;
}

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function arquivo(): string {
  return process.env.USUARIOS_FILE || path.join(raiz, ".data", "usuarios.json");
}

function registrados(): UsuarioArmazenado[] {
  try {
    const cru = JSON.parse(readFileSync(arquivo(), "utf8")) as unknown;
    return Array.isArray(cru) ? (cru as UsuarioArmazenado[]) : [];
  } catch {
    return [];
  }
}

export function listarUsuarios(): UsuarioArmazenado[] {
  return [...SEED_USERS, ...registrados()];
}

export function buscarUsuarioPorId(id: string): UsuarioArmazenado | undefined {
  return listarUsuarios().find((u) => u.id === id);
}

export function buscarUsuarioPorUsername(username: string): UsuarioArmazenado | undefined {
  const alvo = username.trim().toLowerCase();
  return listarUsuarios().find((u) => u.username.toLowerCase() === alvo);
}

export function criarUsuario(usuario: UsuarioArmazenado): void {
  const lista = registrados();
  lista.push(usuario);

  const destino = arquivo();
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(lista, null, 2), "utf8");
}
