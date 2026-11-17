import { z } from "zod";

// Contrato do módulo de acesso (/api/v1/auth/*), usado pela API e pela tela.
//
// Sessão: dois cookies HttpOnly que o navegador manda sozinho (a tela nunca
// lê nem guarda token). Toda gravação (POST, PATCH, PUT, DELETE) leva o
// cabeçalho `X-ARP: 1`.
//
//   POST /api/v1/auth/entrar        EntradaEntrar       → RespostaEu
//   GET  /api/v1/auth/eu            (sem corpo)         → RespostaEu
//   POST /api/v1/auth/renovar       (sem corpo)         → RespostaSessao
//   POST /api/v1/auth/uso           (sem corpo)         → RespostaSessao
//   POST /api/v1/auth/trocar-senha  EntradaTrocarSenha  → RespostaMensagem
//   POST /api/v1/auth/sair          (sem corpo)         → RespostaMensagem
//
// Erros: ver ./erro.ts. Os que a tela precisa tratar aqui:
// - 401 `nao_autenticado`: o acesso (10 min) venceu ou não há sessão. A tela
//   chama `renovar` UMA vez e repete o pedido; se `renovar` também der 401,
//   a sessão acabou (8 h, 30 min parada, saiu ou foi encerrada): ir para o
//   login.
// - 403 `senha_provisoria`: a pessoa ainda não definiu a própria senha. Só
//   `eu`, `renovar`, `uso`, `trocar-senha` e `sair` respondem; ir para a
//   tela de trocar a senha.
// - 429 `limite`: muitas tentativas; a mensagem diz para esperar.
//
// Inatividade: só `POST /auth/uso` (e entrar) conta como uso. A tela chama
// `uso` quando a pessoa mexe (teclado, ponteiro, navegação), no máximo uma
// vez a cada AVISO_DE_USO_MS (@arp/shared/sessao). Consultas automáticas
// (sino, atualização de painel) não prolongam a sessão.

export const entradaEntrar = z.object({
  email: z.string().trim().pipe(z.email().max(320)),
  senha: z.string().min(1).max(200),
});
export type EntradaEntrar = z.infer<typeof entradaEntrar>;

export const SENHA_MINIMO = 10;
export const SENHA_MAXIMO = 72;

export const entradaTrocarSenha = z
  .object({
    senha: z
      .string()
      .min(SENHA_MINIMO, "A senha precisa ter pelo menos 10 caracteres.")
      .max(SENHA_MAXIMO, "A senha pode ter no máximo 72 caracteres."),
    confirmacao: z.string().max(200),
  })
  .refine((v) => v.senha === v.confirmacao, {
    message: "As senhas não conferem.",
    path: ["confirmacao"],
  });
export type EntradaTrocarSenha = z.infer<typeof entradaTrocarSenha>;

export const usuarioDaSessao = z.object({
  id: z.uuid(),
  nome: z.string(),
  email: z.string(),
  /** Chaves de @arp/shared/permissions que a pessoa tem agora. */
  permissoes: z.array(z.string()),
});
export type UsuarioDaSessao = z.infer<typeof usuarioDaSessao>;

/** Prazos da sessão, em ISO 8601 (UTC). */
export const prazosDaSessao = z.object({
  /** Quando entrou. */
  inicio: z.iso.datetime(),
  /** Fim da sessão mesmo em uso (início + 8 h). */
  expira_em: z.iso.datetime(),
  /** Fim por inatividade (último uso + 30 min). */
  inatividade_em: z.iso.datetime(),
  /** Fim do acesso atual (10 min): depois disso, chamar `renovar`. */
  acesso_expira_em: z.iso.datetime(),
});
export type PrazosDaSessao = z.infer<typeof prazosDaSessao>;

export const respostaSessao = z.object({ sessao: prazosDaSessao });
export type RespostaSessao = z.infer<typeof respostaSessao>;

export const respostaEu = z.object({
  usuario: usuarioDaSessao,
  /** true: só pode trocar a senha e sair. */
  senha_provisoria: z.boolean(),
  sessao: prazosDaSessao,
});
export type RespostaEu = z.infer<typeof respostaEu>;

export const respostaMensagem = z.object({ mensagem: z.string() });
export type RespostaMensagem = z.infer<typeof respostaMensagem>;
