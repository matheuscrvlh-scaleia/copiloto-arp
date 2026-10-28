import "server-only";
import type {
  ColunaExtra,
  LinhaChamado,
  ListaChamados,
  ParteLista,
} from "@/components/os/paineis/tipos";
import { formatarData, formatarNumero } from "@/lib/formato";
import { formatarDuracao } from "@/lib/os/calculos";
import type { Janela, LinhaMeta } from "@/lib/os/indicadores";
import { ROTAS_OS } from "@/lib/os/rotas";
import { STATUS } from "@/lib/os/rotulos";
import { instante, paraBrasilia } from "@/lib/os/tempo";
import type { Permissao } from "@/lib/permissions";
import type { Categoria, Parametros, Setor } from "@/server/os/base";
import type { ChamadoDoPainel, FiltrosPainel } from "./consultas";

// O que todos os blocos de um painel compartilham: filtros, momento, nomes,
// os chamados e o registro das listas (cada id citado vira uma linha que vai
// uma vez só para o navegador).

export interface Ctx {
  f: FiltrosPainel;
  agora: Date;
  janela: Janela;
  /** Agora, ou o fim do período se ele já passou. */
  momento: Date;
  /** "agora" ou "em 30/09/2026". */
  quando: string;
  pode: (p: Permissao) => boolean;
  parametros: Parametros;
  metas: LinhaMeta[];
  setores: Setor[];
  categorias: Categoria[];
  setorNome: (id: string | null) => string;
  categoriaNome: (id: string | null) => string;
  pessoaNome: (id: string | null, vazio?: string) => string;
  setoresDasPessoas: Map<string, string[]>;
  /** Tudo o que o usuário vê no período (todos os setores). */
  todos: ChamadoDoPainel[];
  /** Os do painel: setor, categoria e pessoa do filtro. */
  base: ChamadoDoPainel[];
  listas: Listas;
  /** Chamados citados que não vieram na consulta do painel (viram linhas). */
  extras: ChamadoDoPainel[];
  /** Algum bloco usou dado de exemplo (vistorias, agenda). */
  exemplo: boolean;
  /** aaaa-mm-dd: a leitura cobre o que mudou desde esta data. */
  desde: string;
}

// ---------------------------------------------------------------------------
// Listas
// ---------------------------------------------------------------------------

type Itens = { id: string }[] | string[];

const idsDe = (itens: Itens): string[] =>
  itens.map((i) => (typeof i === "string" ? i : i.id));

export interface OpcoesLista
  extends Partial<Omit<ListaChamados, "tipo" | "titulo" | "partes">> {
  extra?: ColunaExtra;
  vazio?: string;
}

export class Listas {
  readonly usados = new Set<string>();

  constructor(
    private readonly semSetor: boolean,
    private readonly secaoPadrao: string,
  ) {}

  /** Uma lista de chamados (os ids entram no registro). */
  lista(titulo: string, itens: Itens, o: OpcoesLista = {}): ListaChamados {
    const { extra, vazio, ...resto } = o;
    return this.partes(titulo, [{ ids: idsDe(itens), extra, vazio }], resto);
  }

  /** Lista em partes (ex.: no prazo e fora do prazo), cada uma com título. */
  partes(
    titulo: string,
    partes: (Omit<ParteLista, "ids"> & { itens?: Itens; ids?: string[] })[],
    o: Partial<Omit<ListaChamados, "tipo" | "titulo" | "partes">> = {},
  ): ListaChamados {
    const prontas = partes.map(({ itens, ids, ...p }) => {
      const lista = [...new Set(ids ?? idsDe(itens ?? []))];
      for (const id of lista) this.usados.add(id);
      return { ...p, ids: lista };
    });
    return {
      tipo: "chamados",
      secao: o.secao ?? this.secaoPadrao,
      semSetor: this.semSetor,
      ...o,
      titulo,
      partes: prontas,
    };
  }
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** Minutos → "3h 20min" até 2 dias; depois, "4,5 dias". */
export function tempoLegivel(min: number | null): string {
  if (min === null) return "—";
  if (min < 2880) return formatarDuracao(min);
  return `${formatarNumero(min / 1440, 1)} dias`;
}

/** Instante → "dd/mm/aaaa" em Brasília. */
export function dataDe(iso: string | null): string {
  return iso ? formatarData(paraBrasilia(instante(iso)).data) : "—";
}

export const plural = (n: number, um: string, varios: string) =>
  `${formatarNumero(n)} ${n === 1 ? um : varios}`;

export function linhaDe(c: ChamadoDoPainel, ctx: Ctx): LinhaChamado {
  return {
    id: c.id,
    numero: c.numero,
    titulo: c.titulo,
    setor: ctx.setorNome(c.setor_id),
    categoria: ctx.categoriaNome(c.categoria_id),
    status: STATUS[c.status],
    responsavel: ctx.pessoaNome(c.responsavel_id, "Sem responsável"),
    aberto: paraBrasilia(instante(c.criado_em)).data,
    prazo: c.prazo ? paraBrasilia(instante(c.prazo)).data : null,
    concluido: c.concluido_em
      ? paraBrasilia(instante(c.concluido_em)).data
      : null,
    exemplo: c.exemplo,
  };
}

/**
 * "Abrir na lista": a tela Geral com o setor e os filtros do painel
 * (só no painel de um setor; o detalhe exato fica no modal).
 */
export function linkDaLista(
  ctx: Ctx,
  extra: Record<string, string> = {},
): { href: string; rotulo: string } | undefined {
  if (!ctx.f.setor) return undefined;
  const p = new URLSearchParams({ setores: ctx.f.setor.id });
  if (ctx.f.categoria) p.set("categoria", ctx.f.categoria.id);
  if (ctx.f.pessoa) p.set("responsavel", ctx.f.pessoa);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return { href: `${ROTAS_OS.meuSetor}?${p}`, rotulo: "Abrir na lista" };
}

/** Coluna extra com o tempo de cada chamado (ordena pelos minutos). */
export function colunaDeTempo(
  titulo: string,
  minutos: Map<string, number>,
): ColunaExtra {
  const valores: Record<string, string> = {};
  const ordem: Record<string, number> = {};
  for (const [id, m] of minutos) {
    valores[id] = tempoLegivel(m);
    ordem[id] = m;
  }
  return { titulo, numero: true, valores, ordem };
}

/** Coluna extra com dias (1 casa). */
export function colunaDeDias(
  titulo: string,
  dias: Map<string, number>,
): ColunaExtra {
  const valores: Record<string, string> = {};
  const ordem: Record<string, number> = {};
  for (const [id, d] of dias) {
    valores[id] = `${formatarNumero(d, 1)} d`;
    ordem[id] = d;
  }
  return { titulo, numero: true, valores, ordem };
}
