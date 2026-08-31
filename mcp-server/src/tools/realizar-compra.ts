import { z } from "zod";

import type { PaymentMethod, PurchaseResult } from "@agentic/shared";

import { METODOS_PAGAMENTO } from "@agentic/shared";

import { CATALOGO } from "../catalog.js";

import {
  atualizarLimiteDisponivel,
  buscarIntencao,
  buscarUsuario,
  obterLimiteDisponivel,
  salvarTransacao,
} from "../store/state.js";

import { gerarTransacaoId } from "../utils/ids.js";

import { jsonResult } from "../utils/result.js";

/**
 * Importante:
 *
 * metodo_pagamento permanece string no schema
 * para conseguirmos devolver explicitamente
 * METODO_INVALIDO.
 *
 * Se utilizássemos z.enum diretamente, o SDK
 * rejeitaria o argumento antes da nossa função
 * executar e não conseguiríamos devolver o erro
 * exigido pelo desafio.
 */
export const schema = {
  usuario_id: z.string(),

  intencao_id: z.string(),

  metodo_pagamento: z.string(),
};

interface RealizarCompraArgs {
  usuario_id: string;
  intencao_id: string;
  metodo_pagamento: string;
}

/**
 * Verifica manualmente se o método recebido
 * corresponde a um dos métodos aceitos.
 */
function metodoPagamentoValido(metodo: string): metodo is PaymentMethod {
  return METODOS_PAGAMENTO.includes(metodo as PaymentMethod);
}

/**
 * Cria uma resposta de erro padronizada
 * para os cinco erros obrigatórios.
 */
function compraRecusada(
  erro:
    | "INTENCAO_INVALIDA"
    | "INTENCAO_EXPIRADA"
    | "INTENCAO_JA_PAGA"
    | "LIMITE_EXCEDIDO"
    | "METODO_INVALIDO",
  mensagem: string,
): PurchaseResult {
  return {
    status: "recusado",
    erro,
    mensagem,
  };
}

/**
 * Tool: realizar_compra
 *
 * Ordem das validações:
 *
 * 1. usuário;
 * 2. intenção existe;
 * 3. intenção pertence ao usuário;
 * 4. intenção já foi paga;
 * 5. intenção expirou;
 * 6. método;
 * 7. produto;
 * 8. estoque atual;
 * 9. limite;
 * 10. pagamento;
 */
export async function realizarCompra(args: RealizarCompraArgs) {
  const { usuario_id, intencao_id, metodo_pagamento } = args;

  /**
   * 1. Validar usuário.
   */
  const usuario = buscarUsuario(usuario_id);

  if (!usuario) {
    return jsonResult(compraRecusada("INTENCAO_INVALIDA", "Usuário inválido para esta intenção."));
  }

  /**
   * 2. Buscar intenção.
   *
   * Se o LLM inventar:
   *
   * int_falsa
   *
   * não existirá no Map.
   */
  const intencao = buscarIntencao(intencao_id);

  if (!intencao) {
    return jsonResult(
      compraRecusada(
        "INTENCAO_INVALIDA",
        "A intenção de compra informada não existe ou não foi criada pelo servidor.",
      ),
    );
  }

  /**
   * 3. A intenção precisa pertencer
   * ao usuário autenticado.
   *
   * Bob não pode utilizar uma intenção
   * criada para Alice.
   */
  if (intencao.usuario_id !== usuario_id) {
    return jsonResult(
      compraRecusada("INTENCAO_INVALIDA", "A intenção informada não pertence ao usuário atual."),
    );
  }

  /**
   * 4. Impedir pagamento duplicado.
   */
  if (intencao.status === "paga") {
    return jsonResult(
      compraRecusada(
        "INTENCAO_JA_PAGA",
        "Esta intenção de compra já foi utilizada em uma transação.",
      ),
    );
  }

  /**
   * 5. Verificar expiração.
   */
  const agora = new Date();

  const expiracao = new Date(intencao.expira_em);

  if (agora.getTime() > expiracao.getTime()) {
    intencao.status = "expirada";

    return jsonResult(
      compraRecusada(
        "INTENCAO_EXPIRADA",
        "A intenção de compra expirou. Registre uma nova intenção.",
      ),
    );
  }

  /**
   * 6. Validar pagamento.
   */
  if (!metodoPagamentoValido(metodo_pagamento)) {
    return jsonResult(
      compraRecusada("METODO_INVALIDO", "Método de pagamento inválido. Utilize cartao ou pix."),
    );
  }

  /**
   * A partir deste ponto o TypeScript
   * sabe que metodo_pagamento é:
   *
   * "cartao" | "pix"
   */
  const metodo: PaymentMethod = metodo_pagamento;

  /**
   * 7. O produto precisa continuar existindo.
   */
  const produto = CATALOGO.find((item) => item.id === intencao.produto_id);

  if (!produto) {
    return jsonResult(
      compraRecusada(
        "INTENCAO_INVALIDA",
        "O produto relacionado à intenção não está mais disponível.",
      ),
    );
  }

  /**
   * 8. Revalidar estoque no momento da compra.
   *
   * Isto é necessário porque outra compra pode
   * ter consumido o estoque depois que esta
   * intenção foi registrada.
   */
  if (produto.estoque < intencao.quantidade) {
    return jsonResult({
      status: "recusado",
      erro: "ESTOQUE_INSUFICIENTE",
      mensagem: "O estoque atual não é suficiente para concluir esta compra.",
    });
  }

  /**
   * 9. Buscar limite atual do usuário.
   */
  const limiteDisponivel = obterLimiteDisponivel(usuario_id);

  if (limiteDisponivel === undefined) {
    return jsonResult(
      compraRecusada(
        "LIMITE_EXCEDIDO",
        "Não foi possível determinar o limite disponível do usuário.",
      ),
    );
  }

  /**
   * A intenção possui um valor que foi
   * calculado anteriormente pelo próprio
   * servidor.
   *
   * Nunca utilizamos um valor recebido
   * do modelo.
   */
  if (intencao.valor_total > limiteDisponivel) {
    return jsonResult(
      compraRecusada(
        "LIMITE_EXCEDIDO",
        `Compra de R$ ${intencao.valor_total.toFixed(2)} excede o limite disponível de R$ ${limiteDisponivel.toFixed(2)}.`,
      ),
    );
  }

  /**
   * 10. PAGAMENTO SIMULADO.
   *
   * Como o exercício não utiliza gateway
   * financeiro real, após todas as verificações
   * o pagamento é considerado aprovado.
   *
   * Tanto PIX quanto cartão passam por aqui.
   */

  /**
   * Calcula novo limite.
   */
  const novoLimite = Math.round((limiteDisponivel - intencao.valor_total) * 100) / 100;

  /**
   * Baixa o estoque SOMENTE depois
   * da compra ser aprovada.
   */
  produto.estoque -= intencao.quantidade;

  /**
   * Atualiza o limite.
   */
  atualizarLimiteDisponivel(usuario_id, novoLimite);

  /**
   * Marca a intenção como paga.
   *
   * Isso impede que a mesma intenção
   * seja utilizada duas vezes.
   */
  intencao.status = "paga";

  /**
   * Criamos a transação.
   */
  const transacaoId = gerarTransacaoId();

  const data = new Date().toISOString();

  salvarTransacao({
    transacao_id: transacaoId,

    intencao_id: intencao.intencao_id,

    usuario_id,

    valor: intencao.valor_total,

    metodo_pagamento: metodo,

    data,
  });

  /**
   * Resposta obrigatória de sucesso.
   */
  const resultado: PurchaseResult = {
    status: "aprovado",

    transacao_id: transacaoId,

    intencao_id: intencao.intencao_id,

    valor: intencao.valor_total,

    metodo_pagamento: metodo,

    limite_restante: novoLimite,

    data,
  };

  return jsonResult(resultado);
}
