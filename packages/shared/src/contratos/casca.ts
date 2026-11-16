import { z } from "zod";

// Contrato da casca (menu, sino, barra de filtros), usado pela API e pela
// tela. Nenhuma destas rotas conta como uso da sessão.
//
//   GET  /api/v1/avisos                               → RespostaAvisos
//   GET  /api/v1/notificacoes                         → RespostaNotificacoes
//   POST /api/v1/notificacoes/:id/lida                → RespostaMensagem
//   POST /api/v1/notificacoes/lidas                   → RespostaMensagem
//   GET  /api/v1/preferencias/filtros/:modulo/:tela   → RespostaFiltros
//   PUT  /api/v1/preferencias/filtros/:modulo/:tela   EntradaFiltros → RespostaMensagem

/** Pendência do sistema, só para quem pode resolvê-la. */
export const aviso = z.object({
  /** Estável por tipo de pendência ("rubricas", "folha", "metas"...). */
  id: z.string(),
  titulo: z.string(),
  descricao: z.string(),
  /** Tela (caminho interno) onde a pendência se resolve. */
  href: z.string(),
});
export type Aviso = z.infer<typeof aviso>;

export const respostaAvisos = z.object({ avisos: z.array(aviso) });
export type RespostaAvisos = z.infer<typeof respostaAvisos>;

/** Notificação do sino (Tickets e lembretes do Comercial). */
export const notificacaoDoSino = z.object({
  id: z.number().int(),
  tipo: z.string(),
  titulo: z.string(),
  texto: z.string().nullable(),
  href: z.string(),
  /** ISO 8601. */
  criado_em: z.string(),
});
export type NotificacaoDoSino = z.infer<typeof notificacaoDoSino>;

export const respostaNotificacoes = z.object({
  notificacoes: z.array(notificacaoDoSino),
});
export type RespostaNotificacoes = z.infer<typeof respostaNotificacoes>;

export const parametrosDaNotificacao = z.object({
  id: z.coerce.number().int().positive(),
});

// Filtros lembrados de cada pessoa por tela (spec 4.3). Os Tickets têm os
// seus no próprio módulo.

export const MODULOS_COM_FILTROS = [
  "marketing",
  "comercial",
  "operacoes",
] as const;
export type ModuloComFiltros = (typeof MODULOS_COM_FILTROS)[number];

export const parametrosDosFiltros = z.object({
  modulo: z.enum(MODULOS_COM_FILTROS),
  tela: z.string().regex(/^[a-z_]+$/),
});
export type ParametrosDosFiltros = z.infer<typeof parametrosDosFiltros>;

export const entradaFiltros = z.object({
  /** Só a query da própria tela ("periodo=mes&plataforma=meta"); vazia apaga. */
  query: z.string().max(500),
});
export type EntradaFiltros = z.infer<typeof entradaFiltros>;

export const respostaFiltros = z.object({
  /** null sem registro. */
  query: z.string().nullable(),
});
export type RespostaFiltros = z.infer<typeof respostaFiltros>;
