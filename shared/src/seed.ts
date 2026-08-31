/**
 * Usuarios de teste do desafio.
 *
 * As senhas ficam como hash scrypt (formato scrypt$N$r$p$sal$hash), nunca em
 * texto puro. As credenciais continuam sendo alice/alice123 e bob/bob123 —
 * estao documentadas no README de proposito, sao contas de demonstracao.
 *
 * O mcp-server importa daqui apenas `id` e `limite`.
 */
export const SEED_USERS = [
  {
    id: "user_alice",
    username: "alice",
    senha_hash:
      "scrypt$16384$8$1$fae45315ea95aa71f619460adb2db986$418d8556a5c839e22e17f41b54e82c0da744c01672b17cb45efcf4b865db8d41d3b04db7fb2fd7fd5629af6d543b132500b958f4ac4290b531706a2a87f399b6",
    limite: 5000,
  },
  {
    id: "user_bob",
    username: "bob",
    senha_hash:
      "scrypt$16384$8$1$69183a9bfbbce0bfd9723e0dfd2fada8$673d30e9237542738673b98c39f058230ab220cb193372a2af8bb4d279c311fcdd2c4e74e23d55b07672b14d04295fa74cd31fa467b315bc6376d893aa1c978b",
    limite: 200,
  },
];
