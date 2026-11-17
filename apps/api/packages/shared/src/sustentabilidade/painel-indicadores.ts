// Indicadores do Painel de Sustentabilidade (spec 4.9): o catálogo (nome,
// unidade, se maior ou menor é melhor), os filtros da tela (ano, até o mês,
// comparar), os links de origem e os totais do ano que o "Fechar ano" grava.
// Meta, marco e equivalência não ficam aqui: vêm dos Parâmetros.

import type { Direcao } from "../indicadores";
import { competenciaDo } from "./painel-apuracao";

export interface InfoDoIndicador {
  nome: string;
  unidade: string;
  casas: number;
  direcao: Direcao;
  /** Soma do ano (a meta é do ano inteiro); senão, é uma foto (meta vale já). */
  acumulado: boolean;
  /** Valor em reais: só com "Ver valores". */
  reais?: boolean;
}

/** Quem tem meta em `core.metas` (indicador `sustentabilidade.<chave>`). */
export const INDICADORES_DO_PAINEL = {
  volume_reciclado: {
    nome: "Volume reciclado no ano",
    unidade: "kg",
    casas: 0,
    direcao: "maior_melhor",
    acumulado: true,
  },
  energia_gerada: {
    nome: "Energia limpa gerada no ano",
    unidade: "kWh",
    casas: 0,
    direcao: "maior_melhor",
    acumulado: true,
  },
  co2_evitado: {
    nome: "CO₂ evitado no ano",
    unidade: "t",
    casas: 2,
    direcao: "maior_melhor",
    acumulado: true,
  },
  consumo_agua: {
    nome: "Consumo de água do mês",
    unidade: "m³",
    casas: 0,
    direcao: "menor_melhor",
    acumulado: false,
  },
  rcc_total: {
    nome: "RCC retirado no ano",
    unidade: "t",
    casas: 2,
    direcao: "maior_melhor",
    acumulado: true,
  },
  rcc_reciclado_pct: {
    nome: "RCC reciclado (classe A)",
    unidade: "%",
    casas: 1,
    direcao: "maior_melhor",
    acumulado: false,
  },
  rcc_economia: {
    nome: "Valor economizado com RCC",
    unidade: "R$",
    casas: 2,
    direcao: "maior_melhor",
    acumulado: true,
    reais: true,
  },
  participantes_clube: {
    nome: "Participantes do Clube",
    unidade: "participantes",
    casas: 0,
    direcao: "maior_melhor",
    acumulado: false,
  },
  pessoas_impactadas: {
    nome: "Pessoas impactadas no ano",
    unidade: "pessoas",
    casas: 0,
    direcao: "maior_melhor",
    acumulado: true,
  },
  oficinas: {
    nome: "Oficinas no ano",
    unidade: "oficinas",
    casas: 0,
    direcao: "maior_melhor",
    acumulado: true,
  },
  produtores_participacoes: {
    nome: "Produtores locais (participações)",
    unidade: "participações",
    casas: 0,
    direcao: "maior_melhor",
    acumulado: true,
  },
  cobertura_entrevistas: {
    nome: "Cobertura das entrevistas",
    unidade: "%",
    casas: 1,
    direcao: "maior_melhor",
    acumulado: false,
  },
  ocupacao_coletores: {
    nome: "Ocupação média dos coletores",
    unidade: "%",
    casas: 0,
    direcao: "menor_melhor",
    acumulado: false,
  },
} as const satisfies Record<string, InfoDoIndicador>;

export type ChaveDoIndicador = keyof typeof INDICADORES_DO_PAINEL;

export const infoDoIndicador = (chave: ChaveDoIndicador): InfoDoIndicador =>
  INDICADORES_DO_PAINEL[chave];

/**
 * Metas que a equipe edita em Parâmetros › Painel. A ocupação dos coletores
 * não: o limite vem de Coletores (limite de alerta de ocupação).
 */
export const CHAVES_COM_META = (
  Object.keys(INDICADORES_DO_PAINEL) as ChaveDoIndicador[]
).filter((c) => c !== "ocupacao_coletores");

/** Indicador de `core.metas`: "sustentabilidade.<chave>". */
export const indicadorDaMeta = (chave: string) => `sustentabilidade.${chave}`;

/** Chave de volta ("sustentabilidade.oficinas" → "oficinas"); null se não for do painel. */
export function chaveDaMeta(indicador: string): ChaveDoIndicador | null {
  const chave = indicador.replace(/^sustentabilidade\./, "");
  return chave in INDICADORES_DO_PAINEL ? (chave as ChaveDoIndicador) : null;
}

/** Indicadores que aceitam marco inicial (total de antes do sistema). */
export const MARCOS_DO_PAINEL = {
  volume_reciclado: "Volume reciclado (kg)",
  energia_gerada: "Energia gerada (kWh)",
  rcc_total: "RCC retirado (t)",
  pessoas_impactadas: "Pessoas impactadas",
  participantes_clube: "Participantes do Clube",
} as const;
export type ChaveDoMarco = keyof typeof MARCOS_DO_PAINEL;
export const ehChaveDoMarco = (v: unknown): v is ChaveDoMarco =>
  typeof v === "string" && v in MARCOS_DO_PAINEL;

/** Nomes dos grupos de impacto que alimentam os cartões (spec 4.9). */
export const GRUPOS_DOS_CARTOES = {
  volume: "Volume reciclado",
  pessoas: "Pessoas impactadas",
  oficinas: "Oficinas",
  produtores: "Produtores locais",
} as const;

/**
 * Totais que o "Fechar ano" grava em `consolidados.totais` (sem reais) e
 * `consolidado_valores.totais` (reais). A mesma chave do marco inicial.
 */
export const TOTAIS_DO_ANO = {
  volume_reciclado: "Volume reciclado (kg)",
  energia_gerada: "Energia gerada (kWh)",
  co2_evitado: "CO₂ evitado (t)",
  rcc_total: "RCC retirado (t)",
  rcc_reciclado_pct: "RCC reciclado (%)",
  pessoas_impactadas: "Pessoas impactadas",
  oficinas: "Oficinas",
  produtores_participacoes: "Produtores locais (participações)",
  produtores_unicos: "Produtores locais (únicos)",
  participantes_clube: "Participantes do Clube",
  rcc_economia: "Valor economizado com RCC (R$)",
} as const;
export type ChaveDoTotal = keyof typeof TOTAIS_DO_ANO;
/** O total em reais (só com "Ver valores"). */
export const TOTAIS_EM_REAIS: readonly ChaveDoTotal[] = ["rcc_economia"];

// ---------------------------------------------------------------------------
// Filtros da tela: ano, até o mês, comparar com o ano anterior
// ---------------------------------------------------------------------------

export interface FiltrosDoPainel {
  ano: number;
  /** 1 a 12: o painel vai de janeiro até este mês. */
  ateMes: number;
  comparar: boolean;
}

const ANO_MINIMO = 2000;
const ANO_MAXIMO = 2100;

/**
 * Padrão: o ano atual até o último mês fechado (o mês passado). Em janeiro
 * ainda não há mês fechado no ano, então o padrão é o ano anterior inteiro.
 */
export function filtrosPadraoDoPainel(hoje: string): FiltrosDoPainel {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  return mes === 1
    ? { ano: ano - 1, ateMes: 12, comparar: false }
    : { ano, ateMes: mes - 1, comparar: false };
}

/** "Até o mês" padrão de um ano: o último mês fechado no ano atual; dezembro nos outros. */
export function ateMesPadrao(ano: number, hoje: string): number {
  const padrao = filtrosPadraoDoPainel(hoje);
  return ano === padrao.ano ? padrao.ateMes : 12;
}

function numeroDaBusca(v: string | undefined): number | null {
  return v && /^\d+$/.test(v) ? Number(v) : null;
}

/** Filtros da URL (já com os lembrados), com o padrão onde não vieram ou são inválidos. */
export function lerFiltrosDoPainel(
  busca: { ano?: string; ate?: string; comparar?: string },
  hoje: string,
): FiltrosDoPainel {
  const padrao = filtrosPadraoDoPainel(hoje);
  const ano = numeroDaBusca(busca.ano);
  const anoValido =
    ano !== null && ano >= ANO_MINIMO && ano <= ANO_MAXIMO ? ano : padrao.ano;
  const ate = numeroDaBusca(busca.ate);
  const ateMes =
    ate !== null && ate >= 1 && ate <= 12 ? ate : ateMesPadrao(anoValido, hoje);
  return { ano: anoValido, ateMes, comparar: busca.comparar === "sim" };
}

/** Anos que o filtro oferece: do primeiro com dado ou marco até o atual. */
export function anosDoFiltro(
  primeiroAno: number | null,
  anoAtual: number,
): number[] {
  const de = Math.min(primeiroAno ?? anoAtual, anoAtual);
  return Array.from({ length: anoAtual - de + 1 }, (_, i) => anoAtual - i);
}

export const NOMES_DOS_MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** "Janeiro a outubro de 2026" para a linha de filtros. */
export function periodoEscrito(f: FiltrosDoPainel): string {
  const fim = NOMES_DOS_MESES[f.ateMes - 1] ?? "";
  return f.ateMes === 1
    ? `janeiro de ${f.ano}`
    : `janeiro a ${fim} de ${f.ano}`;
}

/** "mmm/aaaa" curto do mês do filtro ("out/2026"). */
export function mesCurto(f: FiltrosDoPainel): string {
  return `${MESES_CURTOS[f.ateMes - 1]}/${f.ano}`;
}

// ---------------------------------------------------------------------------
// Links de origem (cada número abre a tela de onde veio, já filtrada)
// ---------------------------------------------------------------------------

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** Último dia do mês (aaaa-mm-dd). */
function ultimoDia(ano: number, mes: number): string {
  const d = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${doisDigitos(mes)}-${doisDigitos(d)}`;
}

export type OrigemDoCartao =
  | "volume"
  | "energia"
  | "agua"
  | "rcc"
  | "clube"
  | "pessoas"
  | "oficinas"
  | "produtores"
  | "entrevistas"
  | "rondas";

/**
 * Tela de origem de cada cartão com o filtro do painel: período como
 * `de`/`ate` (aaaa-mm-dd), `mes` (aaaa-mm) nas telas de um mês só e `grupo`
 * nos programas. Operações abre pelo mês, sem exigir acesso ao painel lá.
 */
export function hrefDeOrigem(o: OrigemDoCartao, f: FiltrosDoPainel): string {
  const de = `${f.ano}-01-01`;
  const ate = ultimoDia(f.ano, f.ateMes);
  const periodo = `de=${de}&ate=${ate}`;
  const mes = `${f.ano}-${doisDigitos(f.ateMes)}`;
  const grupo = (g: string) =>
    `/sustentabilidade/programas?${periodo}&grupo=${encodeURIComponent(g)}`;
  switch (o) {
    case "volume":
      return grupo(GRUPOS_DOS_CARTOES.volume);
    case "pessoas":
      return grupo(GRUPOS_DOS_CARTOES.pessoas);
    case "oficinas":
      return grupo(GRUPOS_DOS_CARTOES.oficinas);
    case "produtores":
      return grupo(GRUPOS_DOS_CARTOES.produtores);
    case "energia":
      return `/operacoes/energia/solar?mes=${mes}`;
    case "agua":
      return `/operacoes/agua?mes=${mes}`;
    case "rcc":
      return `/sustentabilidade/rcc?${periodo}`;
    case "clube":
      return "/sustentabilidade/clube?cartao=ativos";
    case "entrevistas":
      return "/sustentabilidade/entrevistas";
    case "rondas":
      return `/sustentabilidade/rondas?de=${f.ano}-${doisDigitos(f.ateMes)}-01&ate=${ate}`;
  }
}

/** "aaaa-mm-01" do mês do filtro. */
export const competenciaDoFiltro = (f: FiltrosDoPainel) =>
  competenciaDo(f.ano, f.ateMes);

/**
 * "novembro e dezembro": os meses que o ano ainda não completou (o mês
 * corrente em diante), para o aviso de "Fechar ano". Null se o ano já acabou.
 */
export function mesesQueFaltam(ano: number, hoje: string): string | null {
  if (ano < Number(hoje.slice(0, 4))) return null;
  const faltam = NOMES_DOS_MESES.slice(Number(hoje.slice(5, 7)) - 1);
  if (faltam.length <= 1) return faltam[0] ?? null;
  return `${faltam.slice(0, -1).join(", ")} e ${faltam.at(-1)}`;
}
