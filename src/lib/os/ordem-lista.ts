import { limitesDoMes } from "./filtro-postgrest";
import type { Execucao, StatusChamado } from "./rotulos";
import { paraBrasilia, somarDias } from "./tempo";

// Tela "Ordens de serviço" (a central de Operações): filtros da URL, os
// quatro cartões e o que cada cartão conta. Regras puras; a consulta fica
// em src/server/os/ordem-consulta.ts.

export const FILTROS_STATUS = {
  em_aberto: "Em aberto (aberto, em andamento, aguardando)",
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  concluido: "Concluído",
  fechado: "Fechado (finalizada)",
  cancelado: "Cancelado",
} as const;
export type FiltroStatus = keyof typeof FILTROS_STATUS;

export const CARTOES_OS = {
  abertas: "Abertas",
  em_execucao: "Em execução agora",
  terceirizadas: "Terceirizadas aguardando retorno",
  finalizadas_mes: "Finalizadas no mês",
} as const;
export type CartaoOS = keyof typeof CARTOES_OS;

/** Atalhos do período (data de criação); sem atalho nem datas, todas. */
export const PERIODOS_OS = {
  mes: "Este mês",
  "30d": "Últimos 30 dias",
  ano: "Este ano",
} as const;
export type PeriodoOS = keyof typeof PERIODOS_OS;

export interface FiltrosOS {
  status: FiltroStatus | null;
  execucao: Execucao | null;
  categoria: string | null;
  tecnico: string | null;
  empresa: string | null;
  rateio: boolean | null;
  /** Atalho do período; com ele, `de` e `ate` são ignorados. */
  periodo: PeriodoOS | null;
  /** Criadas de / até (aaaa-mm-dd), no período personalizado. */
  de: string | null;
  ate: string | null;
  /** Texto no local (loja, bloco, ponto). */
  local: string | null;
  /** Busca no número, título e descrição. */
  q: string | null;
  cartao: CartaoOS | null;
}

/** Filtros que ficam no painel "Filtros" (o resto está na barra). */
export const FILTROS_EXTRAS = [
  "categoria",
  "tecnico",
  "empresa",
  "rateio",
  "local",
] as const satisfies readonly (keyof FiltrosOS)[];

type Busca = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v)?.trim() || null;
const uuid = (v: string | null) =>
  v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    ? v
    : null;
const data = (v: string | null) =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
function deLista<T extends string>(v: string | null, lista: object): T | null {
  return v && Object.hasOwn(lista, v) ? (v as T) : null;
}

/** Filtros da URL; o que não vale é ignorado. */
export function lerFiltrosOS(b: Busca): FiltrosOS {
  const rateio = um(b.rateio);
  const periodo = deLista<PeriodoOS>(um(b.periodo), PERIODOS_OS);
  return {
    status: deLista<FiltroStatus>(um(b.status), FILTROS_STATUS),
    execucao: deLista<Execucao>(um(b.execucao), {
      interna: 1,
      terceirizada: 1,
    }),
    categoria: uuid(um(b.categoria)),
    tecnico: uuid(um(b.tecnico)),
    empresa: uuid(um(b.empresa)),
    rateio: rateio === "sim" ? true : rateio === "nao" ? false : null,
    periodo,
    de: periodo ? null : data(um(b.de)),
    ate: periodo ? null : data(um(b.ate)),
    local: um(b.local)?.slice(0, 80) ?? null,
    q: um(b.q)?.slice(0, 80) ?? null,
    cartao: deLista<CartaoOS>(um(b.cartao), CARTOES_OS),
  };
}

/** Datas de criação (aaaa-mm-dd, inclusive) pedidas pelo período. */
export function criadasEntre(
  f: Pick<FiltrosOS, "periodo" | "de" | "ate">,
  agora: Date,
): { de: string | null; ate: string | null } {
  const hoje = paraBrasilia(agora).data;
  switch (f.periodo) {
    case "mes":
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case "30d":
      return { de: somarDias(hoje, -29), ate: hoje };
    case "ano":
      return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
    default:
      return { de: f.de, ate: f.ate };
  }
}

/** Quantos filtros do painel "Filtros" estão em uso (o número do botão). */
export function extrasAtivos(f: FiltrosOS): number {
  return FILTROS_EXTRAS.filter((k) => f[k] !== null).length;
}

/** Status que a consulta pede ao banco pelo filtro escolhido. */
export function statusDoFiltro(f: FiltroStatus | null): StatusChamado[] {
  if (!f) return [];
  if (f === "em_aberto") return [...EM_ABERTO];
  return [f];
}

export const EM_ABERTO: StatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
];

/**
 * O que cada cartão acrescenta à consulta (a contagem e a lista do cartão
 * clicado são feitas no banco). "Em execução" é a OS com sessão aberta.
 */
export interface CriterioDoCartao {
  status?: StatusChamado[];
  execucao?: Execucao;
  /** Fechada neste intervalo (instantes ISO, fim exclusivo). */
  fechadoEntre?: { de: string; ate: string };
  /** Só as OS com o cronômetro rodando. */
  rodando?: true;
}

export function criterioDoCartao(c: CartaoOS, agora: Date): CriterioDoCartao {
  switch (c) {
    case "abertas":
      return { status: EM_ABERTO };
    case "em_execucao":
      return { rodando: true };
    case "terceirizadas":
      return { status: EM_ABERTO, execucao: "terceirizada" };
    case "finalizadas_mes":
      return {
        status: ["fechado"],
        fechadoEntre: limitesDoMes(paraBrasilia(agora).data),
      };
  }
}

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O texto digitado aparece no local (sem acento nem maiúsculas). */
export function localConfere(local: string, busca: string | null): boolean {
  return !busca || semAcento(local).includes(semAcento(busca));
}

/** Parâmetros da URL com uma troca (e sem a janela lateral nem a página). */
export function urlDosFiltros(
  caminho: string,
  f: FiltrosOS,
  troca: Partial<Record<keyof FiltrosOS, string | null>> = {},
): string {
  const p = new URLSearchParams();
  const atual: Record<string, string | null> = {
    status: f.status,
    execucao: f.execucao,
    categoria: f.categoria,
    tecnico: f.tecnico,
    empresa: f.empresa,
    rateio: f.rateio === null ? null : f.rateio ? "sim" : "nao",
    periodo: f.periodo,
    de: f.de,
    ate: f.ate,
    local: f.local,
    q: f.q,
    cartao: f.cartao,
    ...troca,
  };
  for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${caminho}?${qs}` : caminho;
}
