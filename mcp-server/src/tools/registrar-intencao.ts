import { z } from "zod";

import type { PurchaseIntent } from "@agentic/shared";

import { CATALOGO } from "../catalog.js";

import { buscarUsuario, salvarIntencao } from "../store/state.js";

import { gerarIntencaoId } from "../utils/ids.js";

import { jsonResult } from "../utils/result.js";

/**
 * Uma intenção será válida por cinco minutos.
 */
const TEMPO_EXPIRACAO_MS = Number(process.env.INTENCAO_TTL_MS ?? 5 * 60 * 1000);

/**
 * Schema exposto para o MCP Client.
 */
export const schema = {
  usuario_id: z.string(),

  produto_id: z.string(),

  quantidade: z.number().int().positive(),
};

interface RegistrarIntencaoArgs {
  usuario_id: string;
  produto_id: string;
  quantidade: number;
}

/**
 * Tool: registrar_intencao
 *
 * Esta função NÃO realiza pagamento.
 *
 * Ela apenas:
 *
 * 1. valida o usuário;
 * 2. valida produto;
 * 3. valida estoque;
 * 4. calcula o valor;
 * 5. gera intencao_id;
 * 6. salva a intenção;
 * 7. retorna a intenção.
 */
export async function registrarIntencao(args: RegistrarIntencaoArgs) {
  const { usuario_id, produto_id, quantidade } = args;

  /**
   * 1. Validar usuário.
   */
  const usuario = buscarUsuario(usuario_id);

  if (!usuario) {
    return jsonResult({
      status: "recusado",
      erro: "USUARIO_INVALIDO",
      mensagem: "O usuário informado não existe.",
    });
  }

  /**
   * 2. Localizar produto.
   */
  const produto = CATALOGO.find((item) => item.id === produto_id);

  if (!produto) {
    return jsonResult({
      status: "recusado",
      erro: "PRODUTO_INVALIDO",
      mensagem: "O produto informado não existe no catálogo.",
    });
  }

  /**
   * 3. Validar estoque.
   */
  if (produto.estoque < quantidade) {
    return jsonResult({
      status: "recusado",
      erro: "ESTOQUE_INSUFICIENTE",
      mensagem: `Estoque insuficiente. Disponível: ${produto.estoque}.`,
    });
  }

  /**
   * 4. Valor sempre é calculado pelo servidor.
   *
   * O LLM nunca informa preço.
   */
  const valorTotal = Math.round(produto.preco * quantidade * 100) / 100;

  /**
   * 5. Calculamos a expiração.
   */
  const agora = Date.now();

  const expiraEm = new Date(agora + TEMPO_EXPIRACAO_MS).toISOString();

  /**
   * 6. Criamos a intenção.
   */
  const intencao: PurchaseIntent = {
    intencao_id: gerarIntencaoId(),

    usuario_id,

    produto_id: produto.id,

    quantidade,

    valor_total: valorTotal,

    moeda: produto.moeda,

    status: "pendente",

    expira_em: expiraEm,
  };

  /**
   * 7. A intenção é salva internamente.
   *
   * Somente IDs existentes neste Map poderão
   * posteriormente realizar uma compra.
   */
  salvarIntencao(intencao);

  /**
   * Não devolvemos usuario_id porque ele não faz
   * parte do retorno exigido pelo desafio.
   */
  return jsonResult({
    intencao_id: intencao.intencao_id,

    produto_id: intencao.produto_id,

    quantidade: intencao.quantidade,

    valor_total: intencao.valor_total,

    moeda: intencao.moeda,

    status: intencao.status,

    expira_em: intencao.expira_em,
  });
}
