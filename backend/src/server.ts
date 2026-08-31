import { app } from "./app.js";
import { config } from "./config.js";
import { getMcpClient } from "./mcp/client.js";

app.listen(config.port, () => {
  console.log(`[backend] http://localhost:${config.port}`);

  // Sobe o servidor MCP ja na largada. O spawn do `npx tsx` leva ~20s na
  // primeira vez, e pagar isso dentro da primeira mensagem do usuario chega
  // a estourar o timeout de request do cliente MCP.
  getMcpClient()
    .then(() => console.log("[backend] servidor mcp pronto"))
    .catch((err) => console.error("[backend] falha ao conectar no mcp:", err));
});
