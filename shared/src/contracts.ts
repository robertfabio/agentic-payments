export type Moeda = "BRL";

export type PaymentMethod = "cartao" | "pix";

export const METODOS_PAGAMENTO: readonly PaymentMethod[] = ["cartao", "pix"];

export interface Product {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  moeda: Moeda;
  estoque: number;
  imagem: string;
}

export interface User {
  id: string;
  username: string;
  limite: number;
}

export interface PurchaseIntent {
  intencao_id: string;
  usuario_id: string;
  produto_id: string;
  quantidade: number;
  valor_total: number;
  moeda: Moeda;
  status: "pendente" | "paga" | "expirada";
  expira_em: string;
}

export type PurchaseError =
  | "INTENCAO_INVALIDA"
  | "INTENCAO_EXPIRADA"
  | "INTENCAO_JA_PAGA"
  | "LIMITE_EXCEDIDO"
  | "METODO_INVALIDO";

export type PurchaseResult =
  | {
      status: "aprovado";
      transacao_id: string;
      intencao_id: string;
      valor: number;
      metodo_pagamento: PaymentMethod;
      limite_restante: number;
      data: string;
    }
  | {
      status: "recusado";
      erro: PurchaseError;
      mensagem: string;
    };

export interface LoginRequest {
  username: string;
  senha: string;
}

export interface LoginResponse {
  /** Access token, curto. Vai no header Authorization. */
  token: string;
  /** Refresh token, longo e revogavel. Serve para renovar o access. */
  refresh_token: string;
  /** Validade do access em segundos, para o cliente renovar antes de expirar. */
  expira_em_s: number;
  usuario: User;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  token: string;
  refresh_token: string;
  expira_em_s: number;
}

export interface LogoutRequest {
  refresh_token?: string;
  /** Quando true, derruba todas as sessoes do usuario, nao so a atual. */
  todas?: boolean;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export interface ChatRequest {
  message: string;
  conversa_id?: string;
}

export interface ChatResponse {
  conversa_id: string;
  messages: ChatMessage[];
}

export interface ApiError {
  erro: string;
  mensagem: string;
}
