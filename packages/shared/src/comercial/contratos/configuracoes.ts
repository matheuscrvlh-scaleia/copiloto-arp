import { z } from "zod";
import type { LinhaAuditoria } from "../parametros";
import {
  faixaEvento,
  fonteDePara,
  lista,
  momento,
  parametros,
  tipoLuc,
} from "./base";

// Comercial › Configurações (spec 4.13): Parâmetros (um bloco por aba),
// feriados, histórico das alterações. Gravações recebem o formulário como
// objeto (formParaObjeto da tela) e validam com as regras de ../parametros,
// com as mesmas mensagens.
//
//   GET    /api/v1/comercial/configuracoes/parametros            → RespostaParametros
//   GET    /api/v1/comercial/configuracoes/parametros/funil      → RespostaBlocoFunil
//   GET    /api/v1/comercial/configuracoes/parametros/ocupacao   → RespostaBlocoOcupacao
//   GET    /api/v1/comercial/configuracoes/parametros/eventos    → { faixas }
//   GET    /api/v1/comercial/configuracoes/parametros/calendario → RespostaCalendario
//   GET    /api/v1/comercial/configuracoes/historico?grupo=&limite= → { linhas }
//   PUT    /api/v1/comercial/configuracoes/parametros            Formulario → { mensagem }
//   PUT    /api/v1/comercial/configuracoes/listas/:lista         Formulario → { mensagem }
//   PUT    /api/v1/comercial/configuracoes/de-para               Formulario → { mensagem }
//   POST   /api/v1/comercial/configuracoes/de-para               Formulario → { mensagem }
//   DELETE /api/v1/comercial/configuracoes/de-para?fonte_rd=     → { mensagem }
//   PUT    /api/v1/comercial/configuracoes/tipos-luc             Formulario → { mensagem }
//   POST   /api/v1/comercial/configuracoes/tipos-luc             Formulario → { mensagem }
//   PUT    /api/v1/comercial/configuracoes/faixas-evento         Formulario → { mensagem }
//   DELETE /api/v1/comercial/configuracoes/faixas-evento/:id     → { mensagem }
//   POST   /api/v1/comercial/configuracoes/feriados              Formulario → { mensagem }
//   DELETE /api/v1/comercial/configuracoes/feriados/:data        → { mensagem }

/** O formulário como a tela manda (campo repetido vira lista). */
export const formulario = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);
export type Formulario = z.infer<typeof formulario>;

export const alteracaoCom = z.object({
  id: z.number(),
  tabela: z.string(),
  registro_id: z.string(),
  acao: z.string(),
  antes: z.record(z.string(), z.unknown()).nullable(),
  depois: z.record(z.string(), z.unknown()).nullable(),
  usuario_id: z.string().nullable(),
  em: z.string(),
  autor: z.string(),
}) satisfies z.ZodType<LinhaAuditoria & { autor: string }>;
export type AlteracaoCom = z.infer<typeof alteracaoCom>;

/** Quantas alterações o histórico mostra (as mais recentes). */
export const LIMITE_HISTORICO = 100;

export const consultaHistorico = z.object({
  grupo: z.enum(["parametros", "cadastros"]).optional(),
  limite: z.coerce.number().int().min(1).max(LIMITE_HISTORICO).optional(),
});

export const respostaHistorico = momento.extend({
  linhas: z.array(alteracaoCom),
});
export type RespostaHistorico = z.infer<typeof respostaHistorico>;

export const respostaParametros = momento.extend({
  parametros,
  listas: z.array(lista),
  /** Última alteração de parâmetros (topo da tela). */
  ultima: alteracaoCom.nullable(),
});
export type RespostaParametros = z.infer<typeof respostaParametros>;

export const respostaBlocoFunil = z.object({
  fontes: z.array(fonteDePara),
  fontesDoRd: z.array(z.string()),
  funisDoRd: z.array(z.string()),
});
export type RespostaBlocoFunil = z.infer<typeof respostaBlocoFunil>;

export const respostaBlocoOcupacao = z.object({
  tipos: z.array(tipoLuc),
  tiposDoEnet: z.array(z.string()),
});
export type RespostaBlocoOcupacao = z.infer<typeof respostaBlocoOcupacao>;

export const respostaBlocoEventos = z.object({ faixas: z.array(faixaEvento) });
export type RespostaBlocoEventos = z.infer<typeof respostaBlocoEventos>;

const feriadoLido = z.object({ data: z.string(), nome: z.string() });

export const respostaCalendario = z.object({
  /** null: a BrasilAPI não respondeu. */
  nacionais: z.array(feriadoLido).nullable(),
  cadastrados: z.array(feriadoLido),
});
export type RespostaCalendario = z.infer<typeof respostaCalendario>;

export const paramsLista = z.object({ lista: z.string().max(40) });
export const consultaDePara = z.object({ fonte_rd: z.string().max(200) });
export const paramsFaixa = z.object({ id: z.string().max(40) });
export const paramsFeriado = z.object({ data: z.string().max(20) });
