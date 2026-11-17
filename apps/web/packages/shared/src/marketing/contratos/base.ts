import { z } from "zod";
import type { ContaPublica } from "../benchmark";
import type { EventoSite } from "../eventos";
import type { ContagemCamera, DiaEstacionamento } from "../publico";

// Contrato da base do Marketing: os cadastros de Configurações (iguais para
// todos do módulo), as metas, o fluxo das câmeras, a agenda do site, o
// Benchmark e o histórico de Configurações. Os cadastros exigem acesso ao
// módulo (alguma permissão marketing.*), como o RLS deles.
//
//   GET /api/v1/marketing/parametros          → RespostaParametros
//   GET /api/v1/marketing/locatarios          → RespostaLocatarios
//   GET /api/v1/marketing/landing-pages       → RespostaLandingPages
//   GET /api/v1/marketing/regras-alerta       → RespostaRegras
//   GET /api/v1/marketing/temas-e-codigos     → RespostaTemasECodigos
//   GET /api/v1/marketing/metas               → RespostaMetas
//   GET /api/v1/marketing/referencias         → RespostaReferencias
//   GET /api/v1/marketing/benchmark           → RespostaBenchmark (null sem marketing.reputacao)
//   GET /api/v1/marketing/publico             → RespostaPublico (null sem marketing.publico)
//   GET /api/v1/marketing/eventos/agenda      → AgendaDoSite (marketing.eventos)
//   GET /api/v1/marketing/historico           → RespostaHistorico (marketing.parametros)

// ---------------------------------------------------------------------------
// Cadastros (as linhas das tabelas marketing.*)
// ---------------------------------------------------------------------------

export const parametros = z.object({
  asana_projeto_calendario: z.string().nullable(),
  asana_projeto_ronda: z.string().nullable(),
  asana_projetos_marketing: z.array(z.string()),
  asana_tag_gratuita: z.string().nullable(),
  asana_tag_locatario: z.string().nullable(),
  asana_tag_paga: z.string().nullable(),
  asana_tag_terceiro: z.string().nullable(),
  atualizado_em: z.string(),
  estrelas_reclamacao: z.array(z.number()),
  id: z.boolean(),
  janela_reputacao_dias: z.number(),
  nota_atencao: z.number(),
  quadros_ocultos: z.array(z.string()),
  reclamacoes_alerta: z.number(),
  reclamacoes_atencao: z.number(),
  sinalizacao_antiga_dias: z.number(),
  termos_marca: z.array(z.string()),
});
export type Parametros = z.infer<typeof parametros>;
export const respostaParametros = z.object({ parametros });

export const locatario = z.object({
  ativo: z.boolean(),
  atualizado_em: z.string(),
  categoria: z.string(),
  criado_em: z.string(),
  entrada_em: z.string(),
  forma_acesso: z.string(),
  id: z.string(),
  nome: z.string(),
  perfil_url: z.string().nullable(),
  saida_em: z.string().nullable(),
});
export type Locatario = z.infer<typeof locatario>;
export const respostaLocatarios = z.object({
  locatarios: z.array(locatario),
});

export const landingPage = z.object({
  atualizado_em: z.string(),
  identificador: z.string(),
  interesse: z.string().nullable(),
  nome: z.string(),
});
export type LandingPage = z.infer<typeof landingPage>;
export const respostaLandingPages = z.object({
  landingPages: z.array(landingPage),
});

export const regraAlerta = z.object({
  ativa: z.boolean(),
  atualizado_em: z.string(),
  limite: z.number().nullable(),
  nivel: z.string(),
  regra: z.string(),
});
export type RegraAlerta = z.infer<typeof regraAlerta>;
export const respostaRegras = z.object({ regras: z.array(regraAlerta) });

export const tema = z.object({
  ativo: z.boolean(),
  atualizado_em: z.string(),
  id: z.string(),
  nome: z.string(),
  ordem: z.number(),
});
export type Tema = z.infer<typeof tema>;

export const codigoRonda = z.object({
  area: z.string(),
  atualizado_em: z.string(),
  codigo: z.string(),
  descricao: z.string(),
});
export type CodigoRonda = z.infer<typeof codigoRonda>;

/** Temas e códigos da ronda (mudam junto com os parâmetros). */
export const respostaTemasECodigos = z.object({
  temas: z.array(tema),
  codigos: z.array(codigoRonda),
});
export type TemasECodigos = z.infer<typeof respostaTemasECodigos>;

/** Referência do Benchmark (marketing.benchmark). */
export const referencia = z.object({
  ativo: z.boolean(),
  atualizado_em: z.string(),
  cidade: z.string().nullable(),
  criado_em: z.string(),
  id: z.string(),
  instagram: z.string().nullable(),
  nome: z.string(),
  site: z.string().nullable(),
});
export type Referencia = z.infer<typeof referencia>;
export const respostaReferencias = z.object({
  referencias: z.array(referencia),
});

// ---------------------------------------------------------------------------
// Metas (core.metas, indicador "marketing.*")
// ---------------------------------------------------------------------------

export const INDICADORES_MKT = {
  "marketing.avaliacoes_novas_arp": {
    nome: "Avaliações novas da ARP no mês",
    direcao: "maior_melhor",
    unidade: "quantidade",
  },
  "marketing.nota_media_arp": {
    nome: "Nota média da ARP",
    direcao: "maior_melhor",
    unidade: "nota",
  },
  "marketing.leads_mes": {
    nome: "Leads do mês no RD",
    direcao: "maior_melhor",
    unidade: "quantidade",
  },
  "marketing.custo_por_lead": {
    nome: "Custo por lead",
    direcao: "menor_melhor",
    unidade: "reais",
  },
} as const;

export type IndicadorMkt = keyof typeof INDICADORES_MKT;

export const metaMkt = z.object({
  id: z.string(),
  indicador: z.string(),
  direcao: z.enum(["maior_melhor", "menor_melhor"]),
  meta: z.number(),
  limite_atencao: z.number().nullable(),
  /** O mesmo limite, no formato de @arp/shared/indicadores (status()). */
  limiteAtencao: z.number().nullable(),
  vigente_desde: z.string(),
});
export type MetaMkt = z.infer<typeof metaMkt>;
export const respostaMetas = z.object({ metas: z.array(metaMkt) });

// ---------------------------------------------------------------------------
// Público (câmeras de contagem)
// ---------------------------------------------------------------------------

export const contagemCamera: z.ZodType<ContagemCamera> = z.object({
  deviceid: z.string(),
  inicio: z.string(),
  entradas: z.number(),
});

export const dadosPublico = z.object({
  contagens: z.array(contagemCamera),
  /** Último contato de cada câmera (heartbeat ou contagem). */
  cameras: z.array(
    z.object({ deviceid: z.string(), ultimoContato: z.string() }),
  ),
  /** Entradas de veículos por dia no estacionamento (WPS), todos os tipos. */
  estacionamento: z.array(
    z.object({ dia: z.string(), entradas: z.number() }),
  ) satisfies z.ZodType<DiaEstacionamento[]>,
});
export type DadosPublico = z.infer<typeof dadosPublico>;
/** null: sem a permissão marketing.publico. */
export const respostaPublico = z.object({ publico: dadosPublico.nullable() });

// ---------------------------------------------------------------------------
// Agenda de eventos do site
// ---------------------------------------------------------------------------

export const eventoSite: z.ZodType<EventoSite> = z.object({
  id: z.number(),
  titulo: z.string(),
  inicio: z.string(),
  fim: z.string(),
  horario: z.string().nullable(),
  descricao: z.string(),
  link: z.string(),
  linkExterno: z.string().nullable(),
  imagem: z.string().nullable(),
});

export const agendaDoSite = z.discriminatedUnion("situacao", [
  z.object({ situacao: z.literal("sem_endereco") }),
  z.object({ situacao: z.literal("desativada") }),
  z.object({ situacao: z.literal("erro"), mensagem: z.string() }),
  z.object({
    situacao: z.literal("ok"),
    eventos: z.array(eventoSite),
    lidoEm: z.string(),
  }),
]);
export type AgendaDoSite = z.infer<typeof agendaDoSite>;

// ---------------------------------------------------------------------------
// Benchmark (números públicos do Instagram, lidos pela conta da ARP na Meta)
// ---------------------------------------------------------------------------

export const contaPublica: z.ZodType<ContaPublica> = z.object({
  username: z.string(),
  name: z.string(),
  followers_count: z.number(),
  media_count: z.number(),
  media: z.object({
    data: z.array(
      z.object({
        id: z.string(),
        timestamp: z.string(),
        permalink: z.string(),
        caption: z.string(),
        media_type: z.string(),
        like_count: z.number(),
        comments_count: z.number(),
        miniatura: z.string().nullable(),
      }),
    ),
  }),
});

export const contaLida = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), conta: contaPublica }),
  z.object({ ok: z.literal(false), aviso: z.string() }),
]);
export type ContaLida = z.infer<typeof contaLida>;

export const dadosBenchmark = z.object({
  arp: contaLida.nullable(),
  referencias: z.array(z.object({ referencia, leitura: contaLida.nullable() })),
  /** Por que nada foi lido (Meta sem acesso). */
  aviso: z.string().optional(),
});
export type DadosBenchmark = z.infer<typeof dadosBenchmark>;
/** null: sem a permissão marketing.reputacao. */
export const respostaBenchmark = z.object({
  benchmark: dadosBenchmark.nullable(),
});

// ---------------------------------------------------------------------------
// Histórico de Configurações (core.auditoria)
// ---------------------------------------------------------------------------

const registro = z.record(z.string(), z.unknown()).nullable();

export const linhaAuditoria = z.object({
  id: z.number(),
  tabela: z.string(),
  registro_id: z.string(),
  acao: z.string(),
  antes: registro,
  depois: registro,
  usuario_id: z.string().nullable(),
  em: z.string(),
});

export const alteracaoMkt = linhaAuditoria.extend({
  /** Nome de quem alterou (core.usuarios). */
  autor: z.string(),
});
export type AlteracaoMkt = z.infer<typeof alteracaoMkt>;

/** Quantas alterações a aba Histórico mostra. */
export const LIMITE_HISTORICO = 100;

export const consultaHistorico = z.object({
  limite: z.coerce.number().int().min(1).max(LIMITE_HISTORICO).optional(),
});
export const respostaHistorico = z.object({
  alteracoes: z.array(alteracaoMkt),
});
