import { z } from "zod";

import { CATALOGO } from "../catalog.js";

import { buscarUsuario } from "../store/state.js";

import { jsonResult } from "../utils/result.js";

/**
 * Tira acentos e caixa para comparar categoria.
 *
 * O catalogo guarda as categorias sem acento, mas tanto o usuario quanto o
 * modelo escrevem em portugues normal, com acento. Sem normalizar, pedir a
 * categoria acentuada devolvia lista vazia e o agente respondia que a
 * categoria nao existe, o que e falso.
 */
function normalizar(texto: string): string {
  return texto
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Schema exposto pelo MCP.
 *
 * usuario_id:
 * deverá ser informado pelo backend autenticado.
 *
 * categoria:
 * filtro opcional.
 */
export const schema = {
  usuario_id: z.string(),
  categoria: z.string().optional(),
};

interface ListarCatalogoArgs {
  usuario_id: string;
  categoria?: string;
}

/**
 * Tool: listar_catalogo
 *
 * Lista produtos disponíveis.
 * Quando categoria for enviada, filtra o catálogo.
 */
export async function listarCatalogo(args: ListarCatalogoArgs) {
  const { usuario_id, categoria } = args;

  /**
   * O usuário deve existir.
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
   * Começamos utilizando todo o catálogo.
   */
  let produtos = CATALOGO;

  // Aceita caixa e acento variados: "AUDIO", "audio", "áudio".
  if (categoria) {
    const categoriaNormalizada = normalizar(categoria);

    produtos = CATALOGO.filter((produto) => normalizar(produto.categoria) === categoriaNormalizada);
  }

  /**
   * Retorna apenas os campos exigidos pelo desafio.
   *
   * A categoria existe internamente,
   * porém não é obrigatória no retorno.
   */
  return jsonResult({
    produtos: produtos.map((produto) => ({
      id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      moeda: produto.moeda,
      estoque: produto.estoque,
    })),
  });
}
