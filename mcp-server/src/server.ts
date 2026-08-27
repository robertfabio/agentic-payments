import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { listarCatalogo, schema as schemaCatalogo } from "./tools/listar-catalogo.js";
import { registrarIntencao, schema as schemaIntencao } from "./tools/registrar-intencao.js";
import { realizarCompra, schema as schemaCompra } from "./tools/realizar-compra.js";

const server = new McpServer({ name: "agentic-payments", version: "0.1.0" });

server.registerTool(
  "listar_catalogo",
  {
    description: "Retorna os produtos disponiveis, opcionalmente filtrados por categoria.",
    inputSchema: schemaCatalogo,
  },
  listarCatalogo,
);

server.registerTool(
  "registrar_intencao",
  {
    description: "Registra a intencao de comprar um item e devolve um intencao_id.",
    inputSchema: schemaIntencao,
  },
  registrarIntencao,
);

server.registerTool(
  "realizar_compra",
  {
    description: "Executa o pagamento a partir de uma intencao ja registrada.",
    inputSchema: schemaCompra,
  },
  realizarCompra,
);

await server.connect(new StdioServerTransport());
console.error("[mcp] servidor conectado");
