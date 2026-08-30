import { z } from "zod";

import { CATALOGO } from "../catalog.js";

import {
  buscarUsuario,
} from "../store/state.js";

import {
  jsonResult,
} from "../utils/result.js";

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
export async function listarCatalogo(
  args: ListarCatalogoArgs,
) {
  const {
    usuario_id,
    categoria,
  } = args;

  /**
   * O usuário deve existir.
   */
  const usuario = buscarUsuario(usuario_id);

  if (!usuario) {
    return jsonResult({
      status: "recusado",
      erro: "USUARIO_INVALIDO",
      mensagem:
        "O usuário informado não existe.",
    });
  }

  /**
   * Começamos utilizando todo o catálogo.
   */
  let produtos = CATALOGO;

  /**
   * Caso exista uma categoria, filtramos.
   *
   * toLowerCase evita problemas como:
   *
   * Audio
   * AUDIO
   * audio
   */
  if (categoria) {
    const categoriaNormalizada =
      categoria.trim().toLowerCase();

    produtos = CATALOGO.filter(
      (produto) =>
        produto.categoria
          .toLowerCase() ===
        categoriaNormalizada,
    );
  }

  /**
   * Retorna apenas os campos exigidos pelo desafio.
   *
   * A categoria existe internamente,
   * porém não é obrigatória no retorno.
   */
  return jsonResult({
    produtos: produtos.map(
      (produto) => ({
        id: produto.id,
        nome: produto.nome,
        preco: produto.preco,
        moeda: produto.moeda,
        estoque: produto.estoque,
      }),
    ),
  });
}