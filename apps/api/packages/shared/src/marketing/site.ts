import type {
  BuscaLinha,
  Ga4Linha,
  RdContato,
  RdConversao,
  RdLandingPageDia,
} from "./fontes";
import { dentro, type PeriodoMkt } from "./periodo";

// Site e leads (spec 4.6): o site e as landing pages estão gerando contato?
// Separa quem quer Evento de quem quer Locação pelo tipo da landing page
// cadastrado em Configurações (landing page do RD sem cadastro = "Sem tipo").
// Cada conversão é uma linha; os cartões contam contatos únicos. Nome,
// e-mail e telefone só saem daqui com `comContato` (permissão
// marketing.site.dados_lead): sem ela, o campo nem existe na linha.

type Periodo = Pick<PeriodoMkt, "de" | "ate">;

/** Mesmo valor de Interesse em server/marketing/filtros (lib não importa servidor). */
export type InteresseLp = "evento" | "locacao" | "outro" | "sem_tipo";
export type InteresseDe = (identificador: string) => InteresseLp;

export interface FontesSite {
  ga4: Ga4Linha[];
  buscas: BuscaLinha[];
}

export interface FontesRd {
  contatos: RdContato[];
  conversoes: RdConversao[];
  landingPages: RdLandingPageDia[];
}

// ---------------------------------------------------------------------------
// Canais (sessionDefaultChannelGroup do GA4)
// ---------------------------------------------------------------------------

const CANAIS: Record<string, string> = {
  "Organic Search": "Busca orgânica",
  "Paid Social": "Social pago",
  Direct: "Direto",
  "Organic Social": "Social orgânico",
  Referral: "Referência",
  Email: "E-mail",
  "Paid Search": "Pesquisa paga",
  "Paid Video": "Vídeo pago",
  "Cross-network": "Rede cruzada",
  Unassigned: "Não atribuído",
};
export const rotuloCanal = (c: string) => CANAIS[c] ?? c;

/**
 * Cor fixa de cada canal nos gráficos (nunca pelo ranking). Os de menos
 * volume juntam em "Outros canais" (neutro): 5 cores é o teto da paleta.
 */
export const COR_CANAL: Record<string, 1 | 2 | 3 | 4 | 5> = {
  "Organic Search": 1,
  Direct: 2,
  "Paid Social": 3,
  "Organic Social": 4,
  "Paid Search": 5,
};

/**
 * Canal de um lead do RD pelas regras padrão do GA4 sobre origem e mídia,
 * para o filtro "canal de origem" valer também nos leads. O RD não separa
 * vídeo pago nem rede cruzada: Google pago cai em Pesquisa paga.
 */
export function canalDoLead(origem: string, midia: string): string {
  const o = origem.toLowerCase();
  const m = midia.toLowerCase();
  const social = /facebook|instagram|tiktok|linkedin|youtube|twitter|pinterest/;
  const pago = /^(.*cp.*|ppc|retargeting|paid.*)$/;
  if (o === "(direct)" && (m === "(none)" || m === "(not set)" || !m))
    return "Direct";
  if (pago.test(m)) return social.test(o) ? "Paid Social" : "Paid Search";
  if (m === "organic") return "Organic Search";
  if (social.test(o) || /social/.test(m)) return "Organic Social";
  if (m === "email" || o.includes("email")) return "Email";
  if (m === "referral") return "Referral";
  return "Unassigned";
}

/** Campanha do GA4 entre parênteses ("(organic)", "(direct)") não é campanha. */
export const rotuloCampanhaGa4 = (c: string) =>
  !c || c.startsWith("(") ? "sem campanha" : c;

// ---------------------------------------------------------------------------
// Quadro 1: tráfego por canal
// ---------------------------------------------------------------------------

export interface Trafego {
  sessoes: number;
  usuarios: number;
  novos: number;
  engajadas: number;
  /** % (0–100); null sem sessão. */
  taxaEngajamento: number | null;
  /** Segundos, média ponderada pelas sessões; null sem sessão. */
  tempoMedio: number | null;
  eventosChave: number;
}

export interface CanalLinha extends Trafego {
  canal: string;
  rotulo: string;
}

function somarTrafego(ls: Ga4Linha[]): Trafego {
  let sessoes = 0;
  let usuarios = 0;
  let novos = 0;
  let engajadas = 0;
  let segundos = 0;
  let eventosChave = 0;
  for (const l of ls) {
    sessoes += l.sessions;
    usuarios += l.totalUsers;
    novos += l.newUsers;
    engajadas += l.engagedSessions;
    segundos += l.averageSessionDuration * l.sessions;
    eventosChave += l.keyEvents;
  }
  return {
    sessoes,
    usuarios,
    novos,
    engajadas,
    taxaEngajamento: sessoes ? (engajadas / sessoes) * 100 : null,
    tempoMedio: sessoes ? segundos / sessoes : null,
    eventosChave,
  };
}

/** Linhas do GA4 no período (e no canal, se escolhido). */
export function ga4Do(
  ga4: Ga4Linha[],
  periodo: Periodo,
  canal = "",
): Ga4Linha[] {
  return ga4.filter(
    (l) =>
      dentro(l.date, periodo) &&
      (!canal || l.sessionDefaultChannelGroup === canal),
  );
}

/** Uma linha por canal, da que mais trouxe sessões para a que menos. */
export function linhasDeCanal(
  ga4: Ga4Linha[],
  periodo: Periodo,
  canal = "",
): CanalLinha[] {
  return agrupar(
    ga4Do(ga4, periodo, canal),
    (l) => l.sessionDefaultChannelGroup,
  )
    .map(([c, t]) => ({ canal: c, rotulo: rotuloCanal(c), ...t }))
    .sort((a, b) => b.sessoes - a.sessoes);
}

export function totalTrafego(ga4: Ga4Linha[]): Trafego {
  return somarTrafego(ga4);
}

/** Quebra de um canal por origem/mídia ou por campanha (detalhe do Quadro 1). */
export function quebraDoCanal(
  ga4: Ga4Linha[],
  periodo: Periodo,
  canal: string,
  por: "origem" | "campanha",
): { chave: string; trafego: Trafego }[] {
  return agrupar(ga4Do(ga4, periodo, canal), (l) =>
    por === "origem"
      ? l.sessionSourceMedium
      : rotuloCampanhaGa4(l.sessionCampaignName),
  )
    .map(([chave, trafego]) => ({ chave, trafego }))
    .sort((a, b) => b.trafego.sessoes - a.trafego.sessoes);
}

function agrupar(
  ls: Ga4Linha[],
  chave: (l: Ga4Linha) => string,
): [string, Trafego][] {
  const mapa = new Map<string, Ga4Linha[]>();
  for (const l of ls) {
    const k = chave(l);
    const lista = mapa.get(k);
    if (lista) lista.push(l);
    else mapa.set(k, [l]);
  }
  return [...mapa.entries()].map(([k, v]) => [k, somarTrafego(v)]);
}

/** 125 s → "2:05". */
export function minutosESegundos(segundos: number | null): string {
  if (segundos === null) return "—";
  const s = Math.round(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Quadro 2: landing pages do RD
// ---------------------------------------------------------------------------

export interface LandingPageLinha {
  id: string;
  /** Nome no RD. */
  nome: string;
  interesse: InteresseLp;
  visitas: number;
  conversoes: number;
  /** % (0–100); null sem visita. */
  taxa: number | null;
}

/** Landing pages com estatística no período (filtros de interesse e LP). */
export function linhasDeLandingPage(
  dias: RdLandingPageDia[],
  periodo: Periodo,
  interesseDe: InteresseDe,
  filtro: { interesse?: string; landingPage?: string } = {},
): LandingPageLinha[] {
  const mapa = new Map<string, LandingPageLinha>();
  for (const d of dias) {
    if (!dentro(d.date, periodo)) continue;
    const interesse = interesseDe(d.conversion_identifier);
    if (filtro.interesse && interesse !== filtro.interesse) continue;
    if (filtro.landingPage && d.conversion_identifier !== filtro.landingPage)
      continue;
    const l = mapa.get(d.conversion_identifier) ?? {
      id: d.conversion_identifier,
      nome: d.nome,
      interesse,
      visitas: 0,
      conversoes: 0,
      taxa: null,
    };
    l.visitas += d.visits_count;
    l.conversoes += d.conversion_count;
    mapa.set(l.id, l);
  }
  return [...mapa.values()]
    .map((l) => ({
      ...l,
      taxa: l.visitas ? (l.conversoes / l.visitas) * 100 : null,
    }))
    .sort((a, b) => b.conversoes - a.conversoes);
}

/** Landing pages do RD (todo o histórico) sem tipo em Configurações. */
export function landingPagesSemTipo(
  dias: RdLandingPageDia[],
  interesseDe: InteresseDe,
): { id: string; nome: string }[] {
  const mapa = new Map<string, string>();
  for (const d of dias)
    if (interesseDe(d.conversion_identifier) === "sem_tipo")
      mapa.set(d.conversion_identifier, d.nome);
  return [...mapa.entries()].map(([id, nome]) => ({ id, nome }));
}

// ---------------------------------------------------------------------------
// Quadro 3: leads do período (uma linha por conversão)
// ---------------------------------------------------------------------------

export interface FiltroLeads {
  interesse?: string;
  landingPage?: string;
  /** sessionDefaultChannelGroup (o do lead sai de canalDoLead). */
  canal?: string;
  /** lifecycle_stage. */
  etapa?: string;
}

export interface LeadLinha {
  evento: string;
  contato: string;
  /** "Lead nº 123": número estável do contato, sem dado pessoal. */
  numero: number;
  /** ISO da conversão. */
  data: string;
  /** Só com comContato; sem a permissão nem existe. */
  nome?: string;
  email?: string;
  telefone?: string;
  cidade: string;
  uf: string;
  landingPage: string;
  nomeLandingPage: string;
  interesse: InteresseLp;
  /** traffic_source / traffic_medium. */
  origem: string;
  canal: string;
  /** "" = sem campanha. */
  campanha: string;
  etapa: string;
}

/**
 * Número de cada contato pela ordem de cadastro no RD (o mesmo para todo
 * mundo, todo dia): identifica o lead sem mostrar quem é.
 */
export function numerosDosContatos(contatos: RdContato[]): Map<string, number> {
  const ordem = [...contatos].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.uuid.localeCompare(b.uuid),
  );
  return new Map(ordem.map((c, i) => [c.uuid, i + 1]));
}

/** Conversões do período com os filtros, a mais recente primeiro. */
export function leadsDoPeriodo(
  rd: Pick<FontesRd, "contatos" | "conversoes" | "landingPages">,
  periodo: Periodo,
  interesseDe: InteresseDe,
  comContato: boolean,
  filtro: FiltroLeads = {},
): LeadLinha[] {
  const contatos = new Map(rd.contatos.map((c) => [c.uuid, c]));
  const numeros = numerosDosContatos(rd.contatos);
  const nomes = new Map(
    rd.landingPages.map((l) => [l.conversion_identifier, l.nome]),
  );
  const out: LeadLinha[] = [];
  for (const c of rd.conversoes) {
    if (!dentro(c.created_at, periodo)) continue;
    const contato = contatos.get(c.contact_uuid);
    const interesse = interesseDe(c.conversion_identifier);
    const canal = canalDoLead(c.traffic_source, c.traffic_medium);
    const etapa = contato?.lifecycle_stage ?? "";
    if (filtro.interesse && interesse !== filtro.interesse) continue;
    if (filtro.landingPage && c.conversion_identifier !== filtro.landingPage)
      continue;
    if (filtro.canal && canal !== filtro.canal) continue;
    if (filtro.etapa && etapa !== filtro.etapa) continue;
    out.push({
      evento: c.event_uuid,
      contato: c.contact_uuid,
      numero: numeros.get(c.contact_uuid) ?? 0,
      data: c.created_at,
      ...(comContato && contato
        ? {
            nome: contato.name,
            email: contato.email,
            telefone: contato.mobile_phone,
          }
        : {}),
      cidade: contato?.city ?? "",
      uf: contato?.state ?? "",
      landingPage: c.conversion_identifier,
      nomeLandingPage:
        nomes.get(c.conversion_identifier) ?? c.conversion_identifier,
      interesse,
      origem: `${c.traffic_source} / ${c.traffic_medium}`,
      canal,
      campanha: c.traffic_campaign,
      etapa,
    });
  }
  // Instantes com o mesmo fuso do RD: o texto ordena como a data.
  return out.sort((a, b) => b.data.localeCompare(a.data));
}

export interface ContagemLeads {
  /** Contatos únicos (o mesmo contato em 2 landing pages conta 1). */
  unicos: number;
  conversoes: number;
  evento: number;
  locacao: number;
}

/**
 * Leads únicos do período. Quem converteu numa LP de Evento e numa de
 * Locação conta nas duas, e uma vez só no total.
 */
export function contarLeads(leads: LeadLinha[]): ContagemLeads {
  const todos = new Set<string>();
  const evento = new Set<string>();
  const locacao = new Set<string>();
  for (const l of leads) {
    todos.add(l.contato);
    if (l.interesse === "evento") evento.add(l.contato);
    if (l.interesse === "locacao") locacao.add(l.contato);
  }
  return {
    unicos: todos.size,
    conversoes: leads.length,
    evento: evento.size,
    locacao: locacao.size,
  };
}

/** Top `n` cidades dos leads (contatos únicos), "Cidade/UF". */
export function cidadesDosLeads(
  leads: LeadLinha[],
  n = 10,
): { cidade: string; leads: number }[] {
  const mapa = new Map<string, Set<string>>();
  for (const l of leads) {
    const k = l.cidade ? `${l.cidade}/${l.uf}` : "Sem cidade";
    const s = mapa.get(k) ?? new Set<string>();
    s.add(l.contato);
    mapa.set(k, s);
  }
  return [...mapa.entries()]
    .map(([cidade, s]) => ({ cidade, leads: s.size }))
    .sort((a, b) => b.leads - a.leads || a.cidade.localeCompare(b.cidade))
    .slice(0, n);
}

/** Contatos únicos por interesse (para o gráfico semanal). */
export function leadsPorInteresse(
  leads: LeadLinha[],
): Record<InteresseLp, number> {
  const s: Record<InteresseLp, Set<string>> = {
    evento: new Set(),
    locacao: new Set(),
    outro: new Set(),
    sem_tipo: new Set(),
  };
  for (const l of leads) s[l.interesse].add(l.contato);
  return {
    evento: s.evento.size,
    locacao: s.locacao.size,
    outro: s.outro.size,
    sem_tipo: s.sem_tipo.size,
  };
}

/**
 * Contatos que estão (hoje, no RD) em lead qualificado ou cliente, entre os
 * leads do período. Para o funil.
 */
export function etapasDosLeads(leads: LeadLinha[]): {
  qualificados: number;
  clientes: number;
} {
  const q = new Set<string>();
  const c = new Set<string>();
  for (const l of leads) {
    if (l.etapa === "Lead qualificado" || l.etapa === "Cliente")
      q.add(l.contato);
    if (l.etapa === "Cliente") c.add(l.contato);
  }
  return { qualificados: q.size, clientes: c.size };
}

// ---------------------------------------------------------------------------
// Quadro 4: buscas no Google (Search Console)
// ---------------------------------------------------------------------------

export interface BuscaTermo {
  termo: string;
  cliques: number;
  impressoes: number;
  /** % (0–100). */
  ctr: number | null;
  /** Posição média ponderada pelas impressões. */
  posicao: number | null;
  /** Posição 4–10, impressões acima da mediana da lista e CTR abaixo do da lista. */
  oportunidade: boolean;
}

/**
 * Os `n` termos com mais cliques no período. "Oportunidade": já está na
 * primeira página mas abaixo do 3º lugar, aparece bastante e quase ninguém
 * clica; os cortes são relativos à própria lista (nada de número fixo).
 */
export function buscasDoPeriodo(
  buscas: BuscaLinha[],
  periodo: Periodo,
  n = 20,
): BuscaTermo[] {
  const mapa = new Map<
    string,
    { cliques: number; impressoes: number; posPeso: number }
  >();
  for (const b of buscas) {
    if (!dentro(b.date, periodo)) continue;
    const t = mapa.get(b.query) ?? { cliques: 0, impressoes: 0, posPeso: 0 };
    t.cliques += b.clicks;
    t.impressoes += b.impressions;
    t.posPeso += b.position * b.impressions;
    mapa.set(b.query, t);
  }
  const top = [...mapa.entries()]
    .map(([termo, t]) => ({
      termo,
      cliques: t.cliques,
      impressoes: t.impressoes,
      ctr: t.impressoes ? (t.cliques / t.impressoes) * 100 : null,
      posicao: t.impressoes ? t.posPeso / t.impressoes : null,
      oportunidade: false,
    }))
    .sort((a, b) => b.cliques - a.cliques || b.impressoes - a.impressoes)
    .slice(0, n);
  const impr = top.map((t) => t.impressoes).sort((a, b) => a - b);
  const mediana = impr.length ? (impr[Math.floor(impr.length / 2)] ?? 0) : 0;
  const totI = top.reduce((s, t) => s + t.impressoes, 0);
  const ctrLista = totI
    ? (top.reduce((s, t) => s + t.cliques, 0) / totI) * 100
    : 0;
  for (const t of top)
    t.oportunidade =
      t.posicao !== null &&
      t.posicao >= 4 &&
      t.posicao <= 10 &&
      t.impressoes >= mediana &&
      t.ctr !== null &&
      t.ctr < ctrLista;
  return top;
}

/**
 * Buscas pela marca no período: impressões e cliques das buscas que têm um
 * dos termos (Configurações › Benchmark e marca), sem diferença de
 * maiúscula e acento. null quando o Search Console não entregou nada.
 */
export function buscasDaMarca(
  buscas: BuscaLinha[],
  periodo: Periodo,
  termos: string[],
): { impressoes: number; cliques: number } | null {
  if (!buscas.length) return null;
  const norm = (t: string) =>
    t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const ts = termos.map(norm).filter(Boolean);
  let impressoes = 0;
  let cliques = 0;
  for (const b of buscas) {
    if (!dentro(b.date, periodo)) continue;
    const q = norm(b.query);
    if (!ts.some((t) => q.includes(t))) continue;
    impressoes += b.impressions;
    cliques += b.clicks;
  }
  return { impressoes, cliques };
}

// ---------------------------------------------------------------------------
// Exportação do Quadro 3 (com ou sem contato, conforme a permissão)
// ---------------------------------------------------------------------------

export type CelulaSite = string | number | null;

const ROTULO_INTERESSE: Record<InteresseLp, string> = {
  evento: "Evento",
  locacao: "Locação",
  outro: "Outro",
  sem_tipo: "Sem tipo",
};
export const rotuloInteresse = (i: InteresseLp) => ROTULO_INTERESSE[i];

/** "2026-10-20T14:05:00-03:00" → "20/10/2026 14:05" (hora do RD). */
export function dataHoraDoLead(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a} ${iso.slice(11, 16)}`;
}

export function colunasLeads(
  comContato: boolean,
): { titulo: string; numero?: boolean }[] {
  return [
    { titulo: "Data" },
    ...(comContato
      ? [{ titulo: "Nome" }, { titulo: "E-mail" }, { titulo: "Telefone" }]
      : [{ titulo: "Lead" }]),
    { titulo: "Cidade/UF" },
    { titulo: "Landing page" },
    { titulo: "Interesse" },
    { titulo: "Origem" },
    { titulo: "Campanha" },
    { titulo: "Etapa do funil" },
  ];
}

/**
 * Linhas do Excel/PDF do Quadro 3. Sem a permissão, sai "Lead nº" no lugar
 * de nome, e-mail e telefone (e as linhas já vêm sem esses campos).
 */
export function linhasExportarLeads(
  leads: LeadLinha[],
  comContato: boolean,
): CelulaSite[][] {
  return leads.map((l) => [
    dataHoraDoLead(l.data),
    ...(comContato
      ? [l.nome ?? "", l.email ?? "", l.telefone ?? ""]
      : [`Lead nº ${l.numero}`]),
    l.cidade ? `${l.cidade}/${l.uf}` : "",
    l.nomeLandingPage,
    rotuloInteresse(l.interesse),
    l.origem,
    l.campanha || "sem campanha",
    l.etapa,
  ]);
}

// ---------------------------------------------------------------------------
// Resumo para o Painel do Marketing
// ---------------------------------------------------------------------------

export interface ResumoSite {
  sessoes: number;
  /** Contatos únicos que converteram no período. */
  leadsUnicos: number;
  conversoes: number;
  leadsEvento: number;
  leadsLocacao: number;
  /** Landing pages do RD sem tipo em Configurações (todo o histórico). */
  landingPagesSemTipo: { id: string; nome: string }[];
}

export function resumoSite(
  site: Pick<FontesSite, "ga4">,
  rd: FontesRd,
  periodo: Periodo,
  interesseDe: InteresseDe,
): ResumoSite {
  const leads = contarLeads(leadsDoPeriodo(rd, periodo, interesseDe, false));
  return {
    sessoes: totalTrafego(ga4Do(site.ga4, periodo)).sessoes,
    leadsUnicos: leads.unicos,
    conversoes: leads.conversoes,
    leadsEvento: leads.evento,
    leadsLocacao: leads.locacao,
    landingPagesSemTipo: landingPagesSemTipo(rd.landingPages, interesseDe),
  };
}
