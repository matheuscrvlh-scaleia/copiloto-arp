import type { Sessao } from "./calculos";
import type { Execucao, StatusChamado } from "./rotulos";
import { paraBrasilia } from "./tempo";

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

export interface FiltrosOS {
  status: FiltroStatus | null;
  execucao: Execucao | null;
  categoria: string | null;
  tecnico: string | null;
  empresa: string | null;
  rateio: boolean | null;
  /** Criadas de / até (aaaa-mm-dd). */
  de: string | null;
  ate: string | null;
  /** Texto no local (loja, bloco, ponto). */
  local: string | null;
  cartao: CartaoOS | null;
}

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
  return v && v in lista ? (v as T) : null;
}

/** Filtros da URL; o que não vale é ignorado. */
export function lerFiltrosOS(b: Busca): FiltrosOS {
  const rateio = um(b.rateio);
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
    de: data(um(b.de)),
    ate: data(um(b.ate)),
    local: um(b.local)?.slice(0, 80) ?? null,
    cartao: deLista<CartaoOS>(um(b.cartao), CARTOES_OS),
  };
}

/** Status que a consulta pede ao banco pelo filtro escolhido. */
export function statusDoFiltro(f: FiltroStatus | null): StatusChamado[] {
  if (!f) return [];
  if (f === "em_aberto") return ["aberto", "em_andamento", "aguardando"];
  return [f];
}

const EM_ABERTO: StatusChamado[] = ["aberto", "em_andamento", "aguardando"];

export interface OSParaCartao {
  status: StatusChamado;
  execucao: Execucao | null;
  fechado_em: string | null;
  sessoes: Pick<Sessao, "fim">[];
}

/** Se a OS entra no cartão. */
export function noCartao(o: OSParaCartao, c: CartaoOS, agora: Date): boolean {
  switch (c) {
    case "abertas":
      return EM_ABERTO.includes(o.status);
    case "em_execucao":
      return o.sessoes.some((s) => s.fim === null);
    case "terceirizadas":
      return o.execucao === "terceirizada" && EM_ABERTO.includes(o.status);
    case "finalizadas_mes":
      return (
        o.status === "fechado" &&
        !!o.fechado_em &&
        paraBrasilia(new Date(o.fechado_em)).data.slice(0, 7) ===
          paraBrasilia(agora).data.slice(0, 7)
      );
  }
}

export function contarCartoes(
  oss: OSParaCartao[],
  agora: Date,
): Record<CartaoOS, number> {
  const chaves = Object.keys(CARTOES_OS) as CartaoOS[];
  return Object.fromEntries(
    chaves.map((c) => [c, oss.filter((o) => noCartao(o, c, agora)).length]),
  ) as Record<CartaoOS, number>;
}

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** O texto digitado aparece no local (sem acento nem maiúsculas). */
export function localConfere(local: string, busca: string | null): boolean {
  return !busca || semAcento(local).includes(semAcento(busca));
}

/** Parâmetros da URL com uma troca (e sem a janela lateral). */
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
    de: f.de,
    ate: f.ate,
    local: f.local,
    cartao: f.cartao,
    ...troca,
  };
  for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
  const qs = p.toString();
  return qs ? `${caminho}?${qs}` : caminho;
}
