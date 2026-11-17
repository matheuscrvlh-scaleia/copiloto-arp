import { z } from "zod";
import {
  type CabecalhoDiferente,
  type PreviaImportacao,
  TIPOS_ORDEM,
  type TipoImportacao,
} from "../importacao";
import { momento } from "./base";

// Importações do histórico (Comercial › Configurações › Importações). O
// trabalho comum (permissão por tipo, hash, arquivo, comercial.importacoes,
// "arquivo já importado", substituir, desfazer) é da API; cada tipo só
// registra o leitor e a gravação (modules/comercial/importacoes.tipos.ts).
//
//   GET  /api/v1/comercial/importacoes                   → RespostaImportacoes
//   GET  /api/v1/comercial/importacoes/tipos             → { tipos }
//   POST /api/v1/comercial/importacoes/:tipo/previa      multipart "arquivo" → RespostaPrevia
//   POST /api/v1/comercial/importacoes/:tipo/confirmar   { importacao_id, substituir?, "escolha.<grupo>"? }
//                                                       → RespostaConfirmacao
//   POST /api/v1/comercial/importacoes/:id/desfazer      → { mensagem }

const tipos = TIPOS_ORDEM as [TipoImportacao, ...TipoImportacao[]];
export const tipoImportacao = z.enum(tipos);

export const importacaoNoHistorico = z.object({
  id: z.string(),
  tipo: tipoImportacao,
  arquivo: z.string(),
  status: z.enum(["previa", "confirmada", "desfeita"]),
  linhas: z.number(),
  duplicadas: z.number(),
  comAviso: z.number(),
  enviadoPor: z.string(),
  enviadoEm: z.string(),
  confirmadoPor: z.string().nullable(),
  confirmadoEm: z.string().nullable(),
  desfeitoPor: z.string().nullable(),
  desfeitoEm: z.string().nullable(),
});
export type ImportacaoNoHistorico = z.infer<typeof importacaoNoHistorico>;

export const respostaTiposImportacao = z.object({
  /** Tipos que a pessoa pode importar (comercial.pode_importar). */
  tipos: z.array(tipoImportacao),
});
export type RespostaTiposImportacao = z.infer<typeof respostaTiposImportacao>;

export const respostaImportacoes = momento.extend({
  tipos: z.array(tipoImportacao),
  historico: z.array(importacaoNoHistorico),
});
export type RespostaImportacoes = z.infer<typeof respostaImportacoes>;

export const paramsTipoImportacao = z.object({ tipo: tipoImportacao });
export const paramsImportacao = z.object({ id: z.uuid() });

const aviso = z.object({
  linha: z.number().nullable(),
  campo: z.string().optional(),
  mensagem: z.string(),
  href: z.string().optional(),
});

export const previaImportacao = z.object({
  importacaoId: z.string(),
  tipo: tipoImportacao,
  arquivo: z.string(),
  linhas: z.number(),
  duplicadas: z.number(),
  comAviso: z.number(),
  entram: z.number(),
  colunas: z.array(z.string()),
  itens: z.array(
    z.object({
      linha: z.number(),
      valores: z.array(z.string()),
      duplicada: z.boolean(),
      entra: z.boolean(),
      avisos: z.array(z.string()),
      grupo: z.string().optional(),
    }),
  ),
  avisos: z.array(aviso),
  jaImportado: z
    .object({
      importacaoId: z.string(),
      em: z.string(),
      por: z.string(),
      linhas: z.number(),
    })
    .nullable(),
}) satisfies z.ZodType<PreviaImportacao>;

export const cabecalhoDiferente = z.object({
  aba: z.string(),
  esperado: z.array(z.string()),
  recebido: z.array(z.string()),
  faltam: z.array(z.string()),
  sobram: z.array(z.string()),
  foraDeOrdem: z.boolean(),
}) satisfies z.ZodType<CabecalhoDiferente>;

/** A prévia, ou o cabeçalho diferente (bloqueia e mostra as colunas). */
export const respostaPrevia = z.object({
  previa: previaImportacao.optional(),
  cabecalho: cabecalhoDiferente.optional(),
});
export type RespostaPrevia = z.infer<typeof respostaPrevia>;

export const entradaConfirmacao = z
  .object({
    importacao_id: z.uuid({
      error: "Prévia inválida. Envie o arquivo de novo.",
    }),
    substituir: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.array(z.string())]));
export type EntradaConfirmacao = z.infer<typeof entradaConfirmacao>;

export const respostaConfirmacao = z.object({
  mensagem: z.string(),
  importacaoId: z.string(),
  gravadas: z.number(),
});
export type RespostaConfirmacao = z.infer<typeof respostaConfirmacao>;
