import { randomUUID } from "node:crypto";

/**
 * Gera um identificador único para uma intenção de compra.
 *
 * Exemplo:
 * int_a81d921e42bc
 */
export function gerarIntencaoId(): string {
  const id = randomUUID().replaceAll("-", "").slice(0, 12);

  return `int_${id}`;
}

/**
 * Gera um identificador único para uma transação.
 *
 * Exemplo:
 * tx_9ab8128f11cc
 */
export function gerarTransacaoId(): string {
  const id = randomUUID().replaceAll("-", "").slice(0, 12);

  return `tx_${id}`;
}
