import { z } from "zod";
import { momento } from "./base";

// Censo (spec 4.8, 4.9): rodadas, indicadores, feedbacks e o questionário.
//
//   GET  /api/v1/comercial/censo                           → RespostaCenso
//   GET  /api/v1/comercial/censo/indicadores               → RespostaIndicadoresCenso
//   GET  /api/v1/comercial/censo/panorama?rodada=&bloco=&segmento= → PDF
//   GET  /api/v1/comercial/censo/feedbacks?rodada=&origem= → RespostaFeedbacksCenso
//   GET  /api/v1/comercial/censo/rodadas                   → RespostaRodadasCenso
//   GET  /api/v1/comercial/censo/rodadas/:id               → RespostaRodadaCenso
//   GET  /api/v1/comercial/censo/demonstracao              → RespostaQuestionarioCenso
//   GET  /api/v1/comercial/censo/presencial/:convite       → RespostaConviteCenso
//   POST /api/v1/comercial/censo/rodadas                   Formulario → { mensagem }
//   POST /api/v1/comercial/censo/rodadas/:id/convites      → { mensagem }
//   POST /api/v1/comercial/censo/rodadas/:id/encerrar      → { mensagem }
//   POST /api/v1/comercial/censo/convites/:id/enviado      → { mensagem }
//   POST /api/v1/comercial/censo/respostas                 Formulario (modo presencial|demonstracao) → { mensagem }
//   POST /api/v1/comercial/censo/sugestoes/mover           Formulario → { mensagem }
//   POST /api/v1/comercial/censo/temas                     Formulario → { mensagem }
//
// Pelo link (sem login; vale pelo token):
//
//   GET  /api/v1/censo/:token                              → RespostaCensoPublico
//   POST /api/v1/censo/:token                              Formulario → { mensagem }
//
// Resposta do questionário com pergunta errada: 400 `validacao` com a
// mensagem geral e `campos` (pergunta → erro).

export const rodadaCenso = z.object({
  id: z.string(),
  nome: z.string(),
  inicio: z.string(),
  fim: z.string(),
  situacao: z.string(),
  exemplo: z.boolean(),
  importacao_id: z.string().nullable(),
  encerrada_em: z.string().nullable(),
});
export type RodadaCenso = z.infer<typeof rodadaCenso>;

export const respostaCenso = momento.extend({
  rodadas: z.array(rodadaCenso),
  /** Listas ativas censo_bloco, censo_segmento e censo_expectativa. */
  blocos: z.array(z.string()),
  segmentos: z.array(z.string()),
  expectativas: z.array(z.string()),
});
export type RespostaCenso = z.infer<typeof respostaCenso>;

export const respostaDoIndicador = z.object({
  id: z.string(),
  rodada_id: z.string(),
  bloco: z.string().nullable(),
  segmento: z.string().nullable(),
  colaboradores: z.number().nullable(),
  visitantes_dia: z.number().nullable(),
  ticket_ajustado: z.number().nullable(),
  conversoes_dia: z.number().nullable(),
  expectativas: z.array(z.string()),
});

export const contagemDaRodada = z.object({
  rodada: z.string(),
  convites: z.number(),
  respostas: z.number(),
});
export type ContagemDaRodada = z.infer<typeof contagemDaRodada>;

export const respostaIndicadoresCenso = z.object({
  /** Respostas que contam, de todas as rodadas. */
  respostas: z.array(respostaDoIndicador),
  /** Convites só para quem aplica o Censo (os outros veem 0). */
  contagem: z.array(contagemDaRodada),
});
export type RespostaIndicadoresCenso = z.infer<
  typeof respostaIndicadoresCenso
>;

export const respostaCensoLida = z.object({
  id: z.string(),
  rodada_id: z.string(),
  convite_id: z.string().nullable(),
  email: z.string().nullable(),
  bloco: z.string().nullable(),
  segmento: z.string().nullable(),
  empresa_nome: z.string(),
  colaboradores: z.number().nullable(),
  visitantes_dia: z.number().nullable(),
  ticket: z.number().nullable(),
  mensalidade: z.boolean().nullable(),
  dias_uso: z.number().nullable(),
  conversoes_dia: z.number().nullable(),
  expectativas: z.array(z.string()),
  sugestao: z.string().nullable(),
  ticket_ajustado: z.number().nullable(),
  considerada: z.boolean(),
  origem: z.string(),
  respondida_em: z.string(),
  lancada_por: z.string().nullable(),
  locatario_enet_id: z.string().nullable(),
  exemplo: z.boolean(),
});
export type RespostaCensoLida = z.infer<typeof respostaCensoLida>;

export const conviteDaRodada = z.object({
  id: z.string(),
  token: z.string(),
  empresa_nome: z.string(),
  luc: z.string().nullable(),
  bloco: z.string().nullable(),
  enviado_em: z.string().nullable(),
  locatario_enet_id: z.string().nullable(),
});

const nome = z.object({ id: z.string(), nome: z.string() });

export const respostaRodadasCenso = z.object({
  contagem: z.array(contagemDaRodada),
});

export const respostaRodadaCenso = z.object({
  convites: z.array(conviteDaRodada),
  respostas: z.array(respostaCensoLida),
  /** Nome de quem lançou (presencial). */
  nomes: z.array(nome),
});
export type RespostaRodadaCenso = z.infer<typeof respostaRodadaCenso>;

export const consultaFeedbacksCenso = z.object({
  rodada: z.uuid(),
  origem: z.string().max(20).optional(),
});

export const temaCenso = z.object({
  id: z.string(),
  nome: z.string(),
  ordem: z.number(),
  ativo: z.boolean(),
});

export const respostaFeedbacksCenso = z.object({
  temas: z.array(temaCenso),
  respostas: z.array(respostaCensoLida),
  contatos: z.array(
    z.object({
      id: z.string(),
      data: z.string(),
      locatario_enet_id: z.string().nullable(),
      locatario_nome: z.string(),
      bloco: z.string().nullable(),
      tipo: z.string(),
      descricao: z.string(),
    }),
  ),
  vinculos: z.array(
    z.object({
      id: z.string(),
      tema_id: z.string(),
      resposta_id: z.string().nullable(),
      contato_id: z.string().nullable(),
      trecho: z.string().nullable(),
      origem: z.string(),
      movido_por: z.string().nullable(),
      movido_em: z.string().nullable(),
    }),
  ),
  /** Nome de quem moveu. */
  nomes: z.array(nome),
  /** Clientes do ENET (o segmento dos registros de contato). */
  clientes: z.array(
    z.object({ codigo: z.string(), nome: z.string(), atividade: z.string() }),
  ),
});
export type RespostaFeedbacksCenso = z.infer<typeof respostaFeedbacksCenso>;

export const consultaPanoramaCenso = z.object({
  rodada: z.string().max(60).optional(),
  bloco: z.string().max(80).optional(),
  segmento: z.string().max(120).optional(),
});

export const paramsRodada = z.object({ id: z.uuid() });
export const paramsConvite = z.object({ convite: z.string().max(60) });

export const opcoesQuestionario = z.object({
  blocos: z.array(z.string()),
  segmentos: z.array(z.string()),
  expectativas: z.array(z.string()),
});

export const respostaQuestionarioCenso = z.object({
  opcoes: opcoesQuestionario,
  diasPadrao: z.number(),
});

export const valoresQuestionario = z.object({
  email: z.string(),
  bloco: z.string(),
  segmento: z.string(),
  empresa_nome: z.string(),
  colaboradores: z.string(),
  visitantes_dia: z.string(),
  ticket: z.string(),
  mensalidade: z.boolean(),
  dias_uso: z.string(),
  conversoes_dia: z.string(),
  expectativas: z.array(z.string()),
  sugestao: z.string(),
});
export type ValoresQuestionario = z.infer<typeof valoresQuestionario>;

/** O convite (link ou presencial) com a rodada e os valores do formulário. */
export const conviteCenso = z.object({
  hoje: z.string(),
  convite: z.object({
    id: z.string(),
    token: z.string(),
    empresa_nome: z.string(),
    luc: z.string().nullable(),
    bloco: z.string().nullable(),
  }),
  rodada: z.object({
    id: z.string(),
    nome: z.string(),
    inicio: z.string(),
    fim: z.string(),
    situacao: z.string(),
  }),
  /** Quando já respondeu (o envio corrige a mesma resposta). */
  respondidaEm: z.string().nullable(),
  opcoes: opcoesQuestionario,
  diasPadrao: z.number(),
  inicial: valoresQuestionario,
});
export type ConviteCenso = z.infer<typeof conviteCenso>;

export const respostaConviteCenso = conviteCenso;

export const paramsTokenCenso = z.object({ token: z.string().max(4096) });

export const respostaCensoPublico = z.union([
  z.object({ motivo: z.literal("inexistente") }),
  conviteCenso,
]);
export type RespostaCensoPublico = z.infer<typeof respostaCensoPublico>;
