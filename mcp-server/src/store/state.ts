import type {
  PaymentMethod,
  PurchaseIntent,
} from "@agentic/shared";

import {
  SEED_USERS,
} from "@agentic/shared";

/**
 * Representa internamente uma transação concluída.
 *
 * O contrato compartilhado possui PurchaseResult,
 * mas não possui um tipo persistente para transação.
 * Por isso este tipo fica restrito ao MCP Server.
 */
export interface Transaction {
  transacao_id: string;
  intencao_id: string;
  usuario_id: string;
  valor: number;
  metodo_pagamento: PaymentMethod;
  data: string;
}

/**
 * Armazena todas as intenções criadas pelo servidor.
 *
 * A chave é o intencao_id.
 *
 * Como o desafio roda localmente, um Map em memória
 * é suficiente e evita a necessidade de banco de dados.
 */
const intencoes = new Map<string, PurchaseIntent>();

/**
 * Armazena as transações já concluídas.
 */
const transacoes = new Map<string, Transaction>();

/**
 * Mantém o limite disponível dos usuários durante
 * a execução do servidor.
 *
 * Os valores iniciais vêm do seed compartilhado.
 *
 * Alice -> R$ 5.000
 * Bob   -> R$ 200
 */
const limitesDisponiveis = new Map<string, number>(
  SEED_USERS.map((usuario) => [
    usuario.id,
    usuario.limite,
  ]),
);

/**
 * Retorna um usuário conhecido pelo sistema.
 */
export function buscarUsuario(usuarioId: string) {
  return SEED_USERS.find(
    (usuario) => usuario.id === usuarioId,
  );
}

/**
 * Salva uma nova intenção.
 */
export function salvarIntencao(
  intencao: PurchaseIntent,
): void {
  intencoes.set(
    intencao.intencao_id,
    intencao,
  );
}

/**
 * Busca uma intenção pelo ID.
 */
export function buscarIntencao(
  intencaoId: string,
): PurchaseIntent | undefined {
  return intencoes.get(intencaoId);
}

/**
 * Salva uma transação concluída.
 */
export function salvarTransacao(
  transacao: Transaction,
): void {
  transacoes.set(
    transacao.transacao_id,
    transacao,
  );
}

/**
 * Retorna o limite atualmente disponível
 * para determinado usuário.
 */
export function obterLimiteDisponivel(
  usuarioId: string,
): number | undefined {
  return limitesDisponiveis.get(usuarioId);
}

/**
 * Atualiza o limite disponível depois de
 * uma compra aprovada.
 */
export function atualizarLimiteDisponivel(
  usuarioId: string,
  novoLimite: number,
): void {
  limitesDisponiveis.set(
    usuarioId,
    novoLimite,
  );
}

/**
 * Funções abaixo não são obrigatórias para as tools,
 * mas facilitam debug e testes locais.
 */
export function listarIntencoes(): PurchaseIntent[] {
  return Array.from(intencoes.values());
}

export function listarTransacoes(): Transaction[] {
  return Array.from(transacoes.values());
}