import { z } from "zod";
import { SITUACOES_FICHA, TIPOS_FICHA } from "../ficha";
import { momento } from "./base";

// Fichas cadastrais (spec 4.12): a tela interna e a ficha pelo link.
//
//   GET    /api/v1/comercial/fichas?desde=&tipo=           → RespostaFichas
//   GET    /api/v1/comercial/fichas/demonstracao           → RespostaDemonstracaoFicha
//   GET    /api/v1/comercial/fichas/:id                    → RespostaDetalheFicha
//   GET    /api/v1/comercial/fichas/:id/pdf                → PDF
//   GET    /api/v1/comercial/fichas/:id/documento/:doc     → 302 para o link assinado
//   POST   /api/v1/comercial/fichas/links                  Formulario → RespostaLinkFicha
//   POST   /api/v1/comercial/fichas/:id/reenviar           → RespostaLinkFicha
//   POST   /api/v1/comercial/fichas/:id/cancelar           → { mensagem }
//
// Pelo link (sem login; vale pelo token):
//
//   GET    /api/v1/ficha/:token                            → RespostaFichaPublica
//   POST   /api/v1/ficha/:token                            EntradaFichaPublica → EstadoDaFicha
//   POST   /api/v1/ficha/:token/documentos                 multipart → EstadoDoDocumento
//   DELETE /api/v1/ficha/:token/documentos/:id             → EstadoDoDocumento
//   GET    /api/v1/ficha/:token/consultas/{cep|cnpj}/:valor → como /comercial/consultas

const tipo = z.enum(TIPOS_FICHA).nullable();
const situacao = z.enum(SITUACOES_FICHA);

export const opcaoLuc = z.object({ valor: z.string(), rotulo: z.string() });
export type OpcaoLuc = z.infer<typeof opcaoLuc>;

export const documentoExigido = z.object({
  documento: z.string(),
  obrigatorio: z.boolean(),
});
export const documentosPorTipo = z.object({
  pj: z.array(documentoExigido),
  pf: z.array(documentoExigido),
  fiador: z.array(documentoExigido),
});
export type DocumentosPorTipo = z.infer<typeof documentosPorTipo>;

export const fichaDaLista = z.object({
  id: z.string(),
  tipo,
  situacao,
  luc: z.string().nullable(),
  nome: z.string().nullable(),
  origem: z.string(),
  gerada_em: z.string(),
  recebida_em: z.string().nullable(),
  expira_em: z.string().nullable(),
  cancelada_em: z.string().nullable(),
  iniciada_em: z.string().nullable(),
  exemplo: z.boolean(),
  ficha_principal_id: z.string().nullable(),
});
export type FichaDaLista = z.infer<typeof fichaDaLista>;

/** Geradas desde `desde` (aaaa-mm-dd; sem ele, todas) e do tipo. */
export const consultaFichas = z.object({
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  tipo: z.enum(TIPOS_FICHA).optional(),
});
export type ConsultaFichas = z.infer<typeof consultaFichas>;

export const respostaFichas = momento.extend({
  fichas: z.array(fichaDaLista),
  /** Só para quem gera link (comercial.formulario.link). */
  lucs: z.array(opcaoLuc).nullable(),
  validadeDias: z.number(),
});
export type RespostaFichas = z.infer<typeof respostaFichas>;

export const respostaDemonstracaoFicha = momento.extend({
  boasVindas: z.string(),
  termoLgpd: z.string(),
  documentos: documentosPorTipo,
  lucs: z.array(opcaoLuc),
});
export type RespostaDemonstracaoFicha = z.infer<
  typeof respostaDemonstracaoFicha
>;

export const paramsFicha = z.object({ id: z.string().max(60) });
export const paramsDocumentoFicha = z.object({
  id: z.string().max(60),
  doc: z.string().max(60),
});

export const detalheDaFicha = z.object({
  ficha: fichaDaLista.extend({
    /** Endereço do link: só com comercial.formulario.link e em preenchimento. */
    link: z.string().nullable(),
    rd_oportunidade: z.string().nullable(),
    consentimento_em: z.string().nullable(),
    usada_em: z.string().nullable(),
    ultimo_acesso_em: z.string().nullable(),
  }),
  /** Só com comercial.formulario.ver; `respostas` sai como foi gravada. */
  dados: z
    .object({
      documento: z.string().nullable(),
      respostas: z.unknown(),
      assinatura: z.string().nullable(),
    })
    .nullable(),
  documentos: z.array(
    z.object({
      id: z.string(),
      documento: z.string(),
      arquivo_nome: z.string(),
      tamanho: z.number().nullable(),
      enviado_em: z.string(),
    }),
  ),
  acessos: z.array(
    z.object({ em: z.string(), acao: z.string(), nome: z.string() }),
  ),
  mesmoDocumento: z.array(
    z.object({
      id: z.string(),
      nome: z.string().nullable(),
      situacao: z.string(),
      gerada_em: z.string(),
    }),
  ),
  principal: z
    .object({ id: z.string(), nome: z.string().nullable() })
    .nullable(),
  fiadores: z.array(
    z.object({
      id: z.string(),
      nome: z.string().nullable(),
      situacao: z.string(),
    }),
  ),
});

export const respostaDetalheFicha = momento.extend(detalheDaFicha.shape);
export type RespostaDetalheFicha = z.infer<typeof respostaDetalheFicha>;

export const respostaLinkFicha = z.object({
  mensagem: z.string(),
  /** Endereço para enviar ao interessado. */
  link: z.string(),
  /** "dd/mm/aaaa". */
  validoAte: z.string(),
});
export type RespostaLinkFicha = z.infer<typeof respostaLinkFicha>;

// ---------------------------------------------------------------------------
// Pelo link
// ---------------------------------------------------------------------------

export const MOTIVOS_INATIVO = [
  "inexistente",
  "expirada",
  "cancelada",
  "enviada",
] as const;
export type MotivoInativo = (typeof MOTIVOS_INATIVO)[number];

export const paramsTokenFicha = z.object({ token: z.string().max(4096) });
export const paramsDocumentoPublico = paramsTokenFicha.extend({
  id: z.string().max(60),
});
export const paramsConsultaFicha = paramsTokenFicha.extend({
  valor: z.string().max(40),
});

export const documentoEnviado = z.object({
  id: z.string(),
  documento: z.string(),
  arquivo_nome: z.string(),
});
export type DocumentoEnviado = z.infer<typeof documentoEnviado>;

export const respostaFichaPublica = z.union([
  z.object({ motivo: z.enum(MOTIVOS_INATIVO) }),
  z.object({
    hoje: z.string(),
    ficha: z.object({
      token: z.string(),
      tipo,
      luc: z.string().nullable(),
      /** Respostas salvas (null: ainda nada); a tela lê com lerRespostas. */
      respostas: z.unknown(),
      documentos: z.array(documentoEnviado),
    }),
    textos: z.object({
      boasVindas: z.string(),
      termoLgpd: z.string(),
      validadeDias: z.number(),
    }),
    documentos: documentosPorTipo,
    lucs: z.array(opcaoLuc),
  }),
]);
export type RespostaFichaPublica = z.infer<typeof respostaFichaPublica>;

export const entradaFichaPublica = z.object({
  acao: z.enum(["salvar", "enviar"]),
  /** As respostas em JSON (como o formulário de antes mandava). */
  respostas: z.string().max(400_000),
  confirmar: z.string().max(2).optional(),
});
export type EntradaFichaPublica = z.infer<typeof entradaFichaPublica>;

export const problemaDaFicha = z.object({
  campo: z.string(),
  pergunta: z.number(),
  mensagem: z.string(),
});

export const estadoDaFicha = z.object({
  ok: z.string().optional(),
  erro: z.string().optional(),
  /** O que falta para enviar, pergunta a pergunta. */
  problemas: z.array(problemaDaFicha).optional(),
  /** Avisos que pedem confirmação (ex.: nome do envio diferente da 15). */
  avisos: z.array(z.string()).optional(),
  /** Ficha enviada: a página mostra o agradecimento. */
  enviada: z.boolean().optional(),
  /** Link parou de valer no meio do preenchimento. */
  inativo: z.enum(MOTIVOS_INATIVO).optional(),
});
export type EstadoDaFicha = z.infer<typeof estadoDaFicha>;

export const estadoDoDocumento = z.object({
  ok: z.string().optional(),
  erro: z.string().optional(),
  inativo: z.enum(MOTIVOS_INATIVO).optional(),
  documento: documentoEnviado.optional(),
});
export type EstadoDoDocumento = z.infer<typeof estadoDoDocumento>;
