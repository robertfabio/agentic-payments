import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

export interface RegistroAuditoria {
  data: string;
  usuario_id: string;
  tool: string;
  argumentos: Record<string, unknown>;
  status: "aprovado" | "recusado" | "erro" | "ok";
  erro?: string;
  valor?: number;
  transacao_id?: string;
  intencao_id?: string;
  duracao_ms: number;
}

const MAX_EM_MEMORIA = 500;
const registros: RegistroAuditoria[] = [];

function resumirResultado(texto: string) {
  try {
    const d = JSON.parse(texto) as Record<string, unknown>;
    const status: RegistroAuditoria["status"] =
      d.status === "aprovado" || d.status === "recusado" ? d.status : "ok";

    return {
      status,
      ...(typeof d.erro === "string" && { erro: d.erro }),
      ...(typeof d.valor === "number" && { valor: d.valor }),
      ...(typeof d.valor_total === "number" && { valor: d.valor_total }),
      ...(typeof d.transacao_id === "string" && { transacao_id: d.transacao_id }),
      ...(typeof d.intencao_id === "string" && { intencao_id: d.intencao_id }),
    };
  } catch {
    return { status: "ok" as const };
  }
}

export function registrar(
  usuarioId: string,
  tool: string,
  argumentos: Record<string, unknown>,
  resultado: string,
  duracaoMs: number,
): RegistroAuditoria {
  const { usuario_id: _oculto, ...visiveis } = argumentos;

  const registro: RegistroAuditoria = {
    data: new Date().toISOString(),
    usuario_id: usuarioId,
    tool,
    argumentos: visiveis,
    duracao_ms: duracaoMs,
    ...resumirResultado(resultado),
  };

  registros.push(registro);
  if (registros.length > MAX_EM_MEMORIA) registros.shift();

  if (config.auditoria.arquivo) void gravarEmDisco(registro);
  return registro;
}

export function registrarFalha(
  usuarioId: string,
  tool: string,
  argumentos: Record<string, unknown>,
  mensagem: string,
  duracaoMs: number,
): RegistroAuditoria {
  const { usuario_id: _oculto, ...visiveis } = argumentos;

  const registro: RegistroAuditoria = {
    data: new Date().toISOString(),
    usuario_id: usuarioId,
    tool,
    argumentos: visiveis,
    status: "erro",
    erro: mensagem,
    duracao_ms: duracaoMs,
  };

  registros.push(registro);
  if (registros.length > MAX_EM_MEMORIA) registros.shift();

  if (config.auditoria.arquivo) void gravarEmDisco(registro);
  return registro;
}

async function gravarEmDisco(registro: RegistroAuditoria) {
  const destino = config.auditoria.arquivo;
  if (!destino) return;

  try {
    await mkdir(path.dirname(destino), { recursive: true });
    await appendFile(destino, `${JSON.stringify(registro)}\n`, "utf8");
  } catch (err) {
    console.error("[auditoria] nao consegui gravar:", err);
  }
}

export function listar(usuarioId: string, limite = 50): RegistroAuditoria[] {
  return registros
    .filter((r) => r.usuario_id === usuarioId)
    .slice(-limite)
    .reverse();
}

export function limpar() {
  registros.length = 0;
}
