import { createServer } from "node:http";

const PORTA = Number(process.env.LLM_FALSO_PORTA ?? 4599);

interface Mensagem {
  role: string;
  content?: string | null;
  name?: string;
}

function resposta(content: string | null, toolCalls?: { name: string; args: object }[]) {
  return {
    id: "chatcmpl-roteirizado",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "roteirizado",
    choices: [
      {
        index: 0,
        finish_reason: toolCalls?.length ? "tool_calls" : "stop",
        message: {
          role: "assistant",
          content,
          ...(toolCalls?.length && {
            tool_calls: toolCalls.map((c, i) => ({
              id: `call_${i}`,
              type: "function",
              function: { name: c.name, arguments: JSON.stringify(c.args) },
            })),
          }),
        },
      },
    ],
  };
}

function decidir(messages: Mensagem[]) {
  const ultimaDoUsuario = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const texto = ultimaDoUsuario.toLowerCase();

  const jaChamou = (nome: string) => {
    const desdeUsuario = messages.slice(messages.findLastIndex((m) => m.role === "user"));
    return desdeUsuario.some((m) => m.role === "tool" && m.name === nome);
  };

  const idPedido = ultimaDoUsuario.match(/int_[0-9a-z]+/i)?.[0];

  if (idPedido) {
    if (jaChamou("realizar_compra")) {
      return resposta("Essa intencao nao foi aceita pelo servidor.");
    }
    const metodo = texto.includes("cartao") ? "cartao" : "pix";
    return resposta(null, [
      { name: "realizar_compra", args: { intencao_id: idPedido, metodo_pagamento: metodo } },
    ]);
  }

  const produto = ultimaDoUsuario.match(/prod_\d+/)?.[0];

  if (produto && !jaChamou("registrar_intencao")) {
    return resposta(null, [
      { name: "registrar_intencao", args: { produto_id: produto, quantidade: 1 } },
    ]);
  }

  if (jaChamou("registrar_intencao") && !jaChamou("realizar_compra")) {
    const anterior = [...messages]
      .reverse()
      .find((m) => m.role === "tool" && m.name === "registrar_intencao");
    const id = (anterior?.content ?? "").match(/int_[0-9a-f]+/)?.[0];
    if (id) {
      const metodo = texto.includes("cartao") ? "cartao" : "pix";
      return resposta(null, [
        { name: "realizar_compra", args: { intencao_id: id, metodo_pagamento: metodo } },
      ]);
    }
  }

  if (jaChamou("realizar_compra")) {
    const compra = [...messages]
      .reverse()
      .find((m) => m.role === "tool" && m.name === "realizar_compra");
    const recusada = (compra?.content ?? "").includes("recusado");
    return resposta(recusada ? "O servidor recusou essa compra." : "Compra concluida!");
  }

  if (!jaChamou("listar_catalogo")) {
    return resposta(null, [{ name: "listar_catalogo", args: {} }]);
  }

  return resposta("Posso ajudar com o catalogo ou fechar uma compra.");
}

createServer((req, res) => {
  let corpo = "";
  req.on("data", (c) => (corpo += c));
  req.on("end", () => {
    const { messages } = JSON.parse(corpo || "{}") as { messages: Mensagem[] };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(decidir(messages ?? [])));
  });
}).listen(PORTA, () => console.log(`[llm-roteirizado] http://127.0.0.1:${PORTA}`));
