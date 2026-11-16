import { formatarNumero } from "@/lib/formato";
import { formatarPercentual, formatarReais } from "./formatos";
import {
  type Calculo,
  calcularIndicador,
  type DefinicaoIndicador,
  ehSomavel,
  type IndicadorCalculado,
  somaPorGrupo,
} from "./indicadores";

// Indicadores dos programas (spec 4.8) sobre os lançamentos, para a lista,
// a aba Resumo e o Painel (4.9). Cada indicador conta só os lançamentos do
// seu formulário. "Contagem de valores diferentes", média e percentual
// nunca são somados: nem entre meses (o do ano é calculado sobre o ano
// inteiro) nem com outros indicadores do grupo (ficam "à parte"). Puro.

export interface IndicadorDoPrograma {
  id: string;
  programa_id: string;
  nome: string;
  formulario_id: string;
  campo_id: string | null;
  calculo: string;
  filtro: unknown;
  percentual_valor: string | null;
  unidade: string | null;
  grupo: string | null;
  mostrar_painel: boolean;
  em_reais: boolean;
  ativo: boolean;
  ordem: number;
}

export interface LancamentoDoIndicador {
  programa_id: string;
  formulario_id: string;
  /** "aaaa-mm-dd" (data do fato). */
  data: string;
  /** Comuns e em reais juntos (sem "Ver valores", só os comuns). */
  valores: Readonly<Record<string, unknown>>;
}

export const CALCULOS: Record<Calculo, string> = {
  soma: "Soma",
  contagem: "Contagem de lançamentos",
  contagem_distintos: "Contagem de valores diferentes",
  media: "Média",
  percentual: "Percentual de uma resposta",
};

const ehCalculo = (c: string): c is Calculo => c in CALCULOS;

/** Filtro gravado ({ campo_id, valor }) no formato do motor. */
export function filtroDoIndicador(
  filtro: unknown,
): DefinicaoIndicador["filtro"] {
  if (typeof filtro !== "object" || filtro === null) return null;
  const f = filtro as { campo_id?: unknown; valor?: unknown };
  return typeof f.campo_id === "string" && typeof f.valor === "string"
    ? { campoId: f.campo_id, valor: f.valor }
    : null;
}

export function definicaoDoIndicador(
  i: IndicadorDoPrograma,
): DefinicaoIndicador {
  return {
    campoId: i.campo_id ?? "",
    calculo: ehCalculo(i.calculo) ? i.calculo : "contagem",
    filtro: filtroDoIndicador(i.filtro),
    percentualValor: i.percentual_valor,
  };
}

/** Ativos, na ordem; os em reais só com "Ver valores". */
export function indicadoresVisiveis<T extends IndicadorDoPrograma>(
  lista: readonly T[],
  comValores: boolean,
): T[] {
  return lista
    .filter((i) => i.ativo && (!i.em_reais || comValores))
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

/** Competências "aaaa-mm-01" de janeiro até `ateMes` (1..12) do ano. */
export function competenciasDoAno(ano: number, ateMes = 12): string[] {
  return Array.from(
    { length: Math.min(Math.max(ateMes, 1), 12) },
    (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}-01`,
  );
}

/** O indicador mês a mês e no período, só com os lançamentos do formulário. */
export function calcularDoPrograma(
  i: IndicadorDoPrograma,
  lancamentos: readonly LancamentoDoIndicador[],
  competencias: readonly string[],
): IndicadorCalculado {
  return calcularIndicador(
    definicaoDoIndicador(i),
    lancamentos.filter(
      (l) =>
        l.programa_id === i.programa_id && l.formulario_id === i.formulario_id,
    ),
    competencias,
  );
}

/** Valor do indicador para a tela, conforme o cálculo e a unidade. */
export function formatarValorDoIndicador(
  valor: number | null,
  i: Pick<IndicadorDoPrograma, "calculo" | "em_reais" | "unidade">,
): string {
  if (valor === null) return "sem dado";
  if (i.em_reais) return formatarReais(valor);
  if (i.calculo === "percentual") return formatarPercentual(valor);
  const casas = Number.isInteger(valor) ? 0 : 2;
  const n = formatarNumero(valor, casas);
  const u = i.unidade?.trim();
  return u && u !== "%" ? `${n} ${u}` : n;
}

// ---- Painel (4.9) ----

export interface ProgramaDoPainel {
  id: string;
  nome: string;
  area: string | null;
  ativo: boolean;
}

export interface IndicadorNoPainel {
  indicadorId: string;
  programaId: string;
  programa: string;
  nome: string;
  unidade: string | null;
  grupo: string | null;
  calculo: Calculo;
  emReais: boolean;
  /** Um valor por competência (null = sem lançamento no mês). */
  porMes: (number | null)[];
  /** Calculado sobre o ano inteiro (nunca a soma dos meses). */
  ano: number | null;
}

export interface GrupoNoPainel {
  grupo: string;
  /** Soma dos somáveis (soma e contagem) do grupo, mês a mês. */
  porMes: (number | null)[];
  ano: number | null;
  /** Contagem de diferentes, média e percentual: à parte, nunca somados. */
  aParte: IndicadorNoPainel[];
}

export interface PainelDosProgramas {
  competencias: string[];
  grupos: GrupoNoPainel[];
  programas: (ProgramaDoPainel & { indicadores: IndicadorNoPainel[] })[];
}

/**
 * Indicadores marcados "mostrar no painel" (ativos; os em reais só com
 * valores), por grupo de impacto e por programa. Programa inativo continua:
 * os meses passados ficam no painel. A soma do grupo no ano é a soma dos
 * somáveis calculados no ano; os não somáveis vão à parte.
 */
export function painelDosProgramas(p: {
  programas: readonly ProgramaDoPainel[];
  indicadores: readonly IndicadorDoPrograma[];
  lancamentos: readonly LancamentoDoIndicador[];
  competencias: readonly string[];
  comValores: boolean;
}): PainelDosProgramas {
  const nomes = new Map(p.programas.map((x) => [x.id, x]));
  const calculados: IndicadorNoPainel[] = indicadoresVisiveis(
    p.indicadores.filter((i) => i.mostrar_painel && nomes.has(i.programa_id)),
    p.comValores,
  ).map((i) => {
    const c = calcularDoPrograma(i, p.lancamentos, p.competencias);
    const def = definicaoDoIndicador(i);
    return {
      indicadorId: i.id,
      programaId: i.programa_id,
      programa: nomes.get(i.programa_id)?.nome ?? "",
      nome: i.nome,
      unidade: i.unidade,
      grupo: i.grupo?.trim() || null,
      calculo: def.calculo,
      emReais: i.em_reais,
      porMes: c.porMes.map((m) => m.valor),
      ano: c.periodo,
    };
  });

  const doGrupo = (valor: (i: IndicadorNoPainel) => number | null) =>
    somaPorGrupo(
      calculados.map((i) => ({
        nome: i.nome,
        grupo: i.grupo,
        calculo: i.calculo,
        valor: valor(i),
      })),
    );
  const noAno = doGrupo((i) => i.ano);
  const porMes = p.competencias.map(
    (_, k) =>
      new Map(
        doGrupo((i) => i.porMes[k] ?? null).map((g) => [g.grupo, g.soma]),
      ),
  );
  const grupos: GrupoNoPainel[] = noAno.map((g) => ({
    grupo: g.grupo,
    porMes: porMes.map((m) => m.get(g.grupo) ?? null),
    ano: g.soma,
    aParte: calculados.filter(
      (i) => i.grupo === g.grupo && !ehSomavel(i.calculo),
    ),
  }));

  return {
    competencias: [...p.competencias],
    grupos,
    programas: p.programas
      .map((x) => ({
        ...x,
        indicadores: calculados.filter((i) => i.programaId === x.id),
      }))
      .filter((x) => x.indicadores.length > 0),
  };
}

/**
 * Soma do grupo (ex.: "Pessoas impactadas") no mês, sobre os somáveis
 * ativos do grupo (sem exigir "mostrar no painel": é o cartão da tela de
 * Programas). null = nenhum indicador do grupo com lançamento no mês.
 */
export function somaDoGrupoNoMes(
  grupo: string,
  indicadores: readonly IndicadorDoPrograma[],
  lancamentos: readonly LancamentoDoIndicador[],
  competencia: string,
  comValores: boolean,
): number | null {
  const alvo = grupo.trim().toLowerCase();
  let soma: number | null = null;
  for (const i of indicadoresVisiveis(indicadores, comValores)) {
    if (i.grupo?.trim().toLowerCase() !== alvo) continue;
    const def = definicaoDoIndicador(i);
    if (!ehSomavel(def.calculo)) continue;
    const v = calcularDoPrograma(i, lancamentos, [competencia]).periodo;
    if (v !== null) soma = (soma ?? 0) + v;
  }
  return soma;
}
