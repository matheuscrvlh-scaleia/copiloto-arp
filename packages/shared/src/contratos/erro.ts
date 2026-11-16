import { z } from "zod";

// Formato de erro de toda a API: `{ erro: { codigo, mensagem, campos? } }`.
// `mensagem` é para a pessoa ler; `codigo` é estável e é o que a tela testa.

export const CODIGOS_DE_ERRO = [
  "validacao", // 400: entrada inválida (`campos` diz quais)
  "nao_autenticado", // 401: sem sessão ou acesso vencido
  "sem_permissao", // 403
  "senha_provisoria", // 403: precisa definir a própria senha antes
  "nao_encontrado", // 404
  "conflito", // 409: já existe / mudou no meio
  "regra", // 422: regra de negócio
  "limite", // 429: muitas requisições
  "interno", // 500
] as const;
export type CodigoDeErro = (typeof CODIGOS_DE_ERRO)[number];

export const respostaDeErro = z.object({
  erro: z.object({
    codigo: z.enum(CODIGOS_DE_ERRO),
    mensagem: z.string(),
    /** Só em `validacao`: campo → mensagem. */
    campos: z.record(z.string(), z.string()).optional(),
  }),
});
export type RespostaDeErro = z.infer<typeof respostaDeErro>;
