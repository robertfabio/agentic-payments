# Arquitetura

Diagramas do projeto. Para a explicação em texto, veja
[como-funciona.md](como-funciona.md).

## As peças

```mermaid
flowchart LR
    U[Usuario] --> F[Frontend<br/>React + Vite<br/>5173]
    F -->|POST /api/chat| B[Backend<br/>Express<br/>3001]
    B -->|HTTPS| L[NVIDIA NIM<br/>nemotron-3-nano]
    B -->|MCP via stdio| M[Servidor MCP<br/>processo filho]
    M --> C[(Catalogo<br/>Intencoes<br/>Transacoes<br/>Limites)]
    B --> A[(Conversas<br/>Sessoes<br/>Auditoria)]
```

O modelo nunca fala com o servidor MCP direto. Ele só sugere chamadas, e o
backend decide se executa.

## Uma compra, do pedido ao pagamento

```mermaid
sequenceDiagram
    participant U as Usuario
    participant B as Backend
    participant L as Modelo
    participant M as Servidor MCP

    U->>B: "quero um fone"
    B->>L: historico + tools
    L-->>B: chamar listar_catalogo
    B->>M: listar_catalogo(usuario_id do token)
    M-->>B: produtos
    B->>L: resultado da ferramenta
    L-->>B: "Confirma 1 Fone por R$ 249,90?"
    B-->>U: pergunta

    U->>B: "confirmo, no pix"
    B->>L: historico
    L-->>B: chamar registrar_intencao
    B->>M: registrar_intencao
    M-->>B: intencao_id + valor calculado
    B->>L: resultado
    L-->>B: chamar realizar_compra(intencao_id)
    B->>M: realizar_compra
    M-->>B: aprovado ou recusado
    B->>L: resultado
    L-->>B: explicacao em portugues
    B-->>U: resposta + blocos das ferramentas
```

## Onde estão as barreiras

```mermaid
flowchart TD
    M[Modelo pede realizar_compra] --> G1{O intencao_id<br/>apareceu nesta<br/>conversa?}
    G1 -->|nao| R1[INTENCAO_INVALIDA<br/>barrado no backend]
    G1 -->|sim| INJ[Backend troca o usuario_id<br/>pelo dono do token]
    INJ --> G2{A intencao<br/>existe?}
    G2 -->|nao| R2[INTENCAO_INVALIDA]
    G2 -->|sim| G3{E do mesmo<br/>usuario?}
    G3 -->|nao| R3[INTENCAO_INVALIDA]
    G3 -->|sim| G4{Ja foi paga?}
    G4 -->|sim| R4[INTENCAO_JA_PAGA]
    G4 -->|nao| G5{Dentro do<br/>prazo?}
    G5 -->|nao| R5[INTENCAO_EXPIRADA]
    G5 -->|sim| G6{Metodo valido?}
    G6 -->|nao| R6[METODO_INVALIDO]
    G6 -->|sim| G7{Valor cabe<br/>no limite?}
    G7 -->|nao| R7[LIMITE_EXCEDIDO]
    G7 -->|sim| OK[aprovado<br/>debita limite<br/>baixa estoque]
```

O valor comparado com o limite vem da intenção guardada pelo servidor, nunca do
que o modelo escreveu. `realizar_compra` não tem campo de valor.

## O laço do agente

```mermaid
flowchart TD
    A[Mensagem do usuario] --> B[Monta system prompt<br/>+ historico completo]
    B --> C[Chama o modelo]
    C --> D{Pediu<br/>ferramenta?}
    D -->|nao| E[Devolve a conversa]
    D -->|sim| F[Executa via MCP<br/>com o usuario do token]
    F --> G[Adiciona o resultado<br/>ao historico]
    G --> H{Passou de<br/>8 voltas?}
    H -->|nao| C
    H -->|sim| I[Para e pede<br/>para reformular]
```

## Autenticação

```mermaid
flowchart LR
    L[POST /auth/login] --> P[Access 15min<br/>+ Refresh 7 dias]
    P --> U[Usa o access<br/>nas rotas]
    U --> E{Levou 401?}
    E -->|sim| R[POST /auth/refresh]
    R --> N[Par novo<br/>o refresh antigo morre]
    N --> U
    E -->|nao| U
    P --> S[POST /auth/logout]
    S --> X[Refresh apagado<br/>access revogado na hora]
```
