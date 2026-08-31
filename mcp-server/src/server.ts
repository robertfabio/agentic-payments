import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { listarCatalogo, schema as schemaCatalogo } from "./tools/listar-catalogo.js";

import { registrarIntencao, schema as schemaIntencao } from "./tools/registrar-intencao.js";

import { realizarCompra, schema as schemaCompra } from "./tools/realizar-compra.js";

/**
 * Instância principal do servidor MCP.
 */
const server = new McpServer({
  name: "agentic-payments",

  version: "0.1.0",
});

/**
 * TOOL 1
 *
 * listar_catalogo
 */
server.registerTool(
  "listar_catalogo",

  {
    description: "Retorna os produtos disponiveis, opcionalmente filtrados por categoria.",

    inputSchema: schemaCatalogo,
  },

  listarCatalogo,
);

/**
 * TOOL 2
 *
 * registrar_intencao
 */
server.registerTool(
  "registrar_intencao",

  {
    description: "Registra a intencao de comprar um item e devolve um intencao_id.",

    inputSchema: schemaIntencao,
  },

  registrarIntencao,
);

/**
 * TOOL 3
 *
 * realizar_compra
 */
server.registerTool(
  "realizar_compra",

  {
    description: "Executa o pagamento a partir de uma intencao ja registrada.",

    inputSchema: schemaCompra,
  },

  realizarCompra,
);

/**
 * Transporte stdio.
 *
 * O backend iniciará/conectará o MCP Client
 * neste processo.
 */
await server.connect(new StdioServerTransport());

/**
 * IMPORTANTE:
 *
 * Não utilizar console.log em um servidor
 * MCP baseado em stdio porque stdout é
 * utilizado pelo protocolo.
 *
 * console.error escreve em stderr.
 */
console.error("[mcp] servidor conectado");
