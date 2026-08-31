import { app } from "./app.js";
import { config } from "./config.js";
import { getMcpClient } from "./mcp/client.js";

app.listen(config.port, () => {
  console.log(`[backend] http://localhost:${config.port}`);

  getMcpClient()
    .then(() => console.log("[backend] servidor mcp pronto"))
    .catch((err) => console.error("[backend] falha ao conectar no mcp:", err));
});
