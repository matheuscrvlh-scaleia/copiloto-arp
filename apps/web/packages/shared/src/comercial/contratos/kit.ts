import { z } from "zod";
import { momento } from "./base";

// Kit de entrega (spec 4.14): documentos com a versão atual, histórico de
// versões e o kit do LUC num PDF só.
//
//   GET   /api/v1/comercial/kit                          → RespostaKit
//   GET   /api/v1/comercial/kit/documentos/:id           → RespostaDocumentoKit
//   GET   /api/v1/comercial/kit/arquivo/:id              → 302 para o link assinado
//   GET   /api/v1/comercial/kit/luc?luc=                 → PDF
//   POST  /api/v1/comercial/kit/documentos               EntradaNovoDocumentoKit → { mensagem, documentoId, versaoId }
//   PATCH /api/v1/comercial/kit/documentos/:id           Formulario → { mensagem }
//   POST  /api/v1/comercial/kit/documentos/:id/envio     EntradaEnvioKit → { url, path }
//   POST  /api/v1/comercial/kit/documentos/:id/arquivo   EntradaArquivoKit → { mensagem }

export const versaoDoKit = z.object({
  id: z.string(),
  documento_id: z.string(),
  versao: z.string(),
  data: z.string().nullable(),
  validade: z.string().nullable(),
  paginas: z.number().nullable(),
  arquivo_nome: z.string().nullable(),
  tamanho: z.number().nullable(),
  atual: z.boolean(),
  enviado_por: z.string().nullable(),
  enviado_em: z.string(),
  temArquivo: z.boolean(),
});
export type VersaoDoKit = z.infer<typeof versaoDoKit>;

export const documentoDoKit = z.object({
  id: z.string(),
  nome: z.string(),
  categoria: z.string(),
  ordem: z.number(),
  blocos: z.array(z.string()),
  /** LUCs atendidos pelo mapa (vazio = todo o bloco). */
  lucs: z.array(z.string()),
  todo_contrato: z.boolean(),
  ativo: z.boolean(),
  atual: versaoDoKit.nullable(),
});
export type DocumentoDoKitLido = z.infer<typeof documentoDoKit>;

export const lucDoKit = z.object({
  numero: z.string(),
  local: z.string(),
  bloco: z.string().nullable(),
});

export const respostaKit = momento.extend({
  documentos: z.array(documentoDoKit),
  categorias: z.array(z.string()),
  avisoDias: z.number(),
  lucs: z.array(lucDoKit),
});
export type RespostaKit = z.infer<typeof respostaKit>;

const nome = z.object({ id: z.string(), nome: z.string() });

export const respostaDocumentoKit = momento.extend({
  documento: documentoDoKit,
  versoes: z.array(versaoDoKit),
  /** Nome de quem enviou cada versão. */
  nomes: z.array(nome),
  categorias: z.array(z.string()),
  avisoDias: z.number(),
});
export type RespostaDocumentoKit = z.infer<typeof respostaDocumentoKit>;

export const paramsKit = z.object({ id: z.uuid() });
export const consultaKitDoLuc = z.object({ luc: z.string().max(80) });

/** Dados de uma versão (o formulário manda texto; null = vazio). */
export const metaVersaoKit = z.object({
  versao: z.string(),
  data: z.string().nullable(),
  validade: z.string().nullable(),
  paginas: z.number().nullable(),
});
export type MetaVersaoKit = z.infer<typeof metaVersaoKit>;

export const entradaNovoDocumentoKit = z.object({
  documento: z.object({
    nome: z.string(),
    categoria: z.string(),
    blocos: z.array(z.string()).max(40),
    lucs: z.array(z.string()).max(200).default([]),
    todoContrato: z.boolean(),
  }),
  versao: metaVersaoKit,
});
export type EntradaNovoDocumentoKit = z.infer<typeof entradaNovoDocumentoKit>;

export const respostaDocumentoKitCriado = z.object({
  mensagem: z.string(),
  documentoId: z.string(),
  versaoId: z.string(),
});

export const entradaEnvioKit = z.object({
  nome: z.string().min(1).max(255),
  tamanho: z.number().int().positive(),
});
export const respostaEnvioKit = z.object({ url: z.string(), path: z.string() });

export const entradaArquivoKit = z.object({
  path: z.string().max(400),
  nome: z.string().min(1).max(255),
  versaoId: z.uuid().optional(),
  versao: metaVersaoKit.optional(),
});
export type EntradaArquivoKit = z.infer<typeof entradaArquivoKit>;
