import { fimDoMes, isoLocal } from "@/lib/formato";

// ---------------------------------------------------------------------------
// Jornada (ponto)
// ---------------------------------------------------------------------------

export interface LinhaPonto {
  colaborador_id: string;
  nome: string;
  matricula: number | null;
  departamento_id: string | null;
  departamento: string;
  previstas_min: number;
  faltas_min: number;
  atrasos_min: number;
  faltas_dias: number;
  abonos_min: Record<string, number>;
  banco_saldo_min: number;
  banco_creditos_min: number;
  banco_debitos_min: number;
}

export interface TotaisPonto {
  colaboradores: number;
  previstas_min: number;
  faltas_min: number;
  atrasos_min: number;
  faltas_dias: number;
  abonos_min: number;
  banco_saldo_min: number;
  /** Soma só dos saldos positivos: horas que a empresa deve (passivo). */
  banco_positivo_min: number;
  /** Soma só dos saldos negativos: horas que os colaboradores devem. */
  banco_negativo_min: number;
  banco_creditos_min: number;
  banco_debitos_min: number;
  /** (faltas + atrasos) ÷ horas previstas × 100. Abonos não entram. */
  absenteismo: number | null;
}

const somaAbonos = (a: Record<string, number>) =>
  Object.values(a).reduce((s, v) => s + v, 0);

/** Horas de ausência ÷ horas previstas × 100 (atestado/abono não conta). */
export function absenteismo(l: {
  previstas_min: number;
  faltas_min: number;
  atrasos_min: number;
}): number | null {
  return l.previstas_min > 0
    ? ((l.faltas_min + l.atrasos_min) / l.previstas_min) * 100
    : null;
}

export function somarPonto(linhas: LinhaPonto[]): TotaisPonto {
  const t = {
    colaboradores: linhas.length,
    previstas_min: 0,
    faltas_min: 0,
    atrasos_min: 0,
    faltas_dias: 0,
    abonos_min: 0,
    banco_saldo_min: 0,
    banco_positivo_min: 0,
    banco_negativo_min: 0,
    banco_creditos_min: 0,
    banco_debitos_min: 0,
  };
  for (const l of linhas) {
    t.previstas_min += l.previstas_min;
    t.faltas_min += l.faltas_min;
    t.atrasos_min += l.atrasos_min;
    t.faltas_dias += l.faltas_dias;
    t.abonos_min += somaAbonos(l.abonos_min);
    t.banco_saldo_min += l.banco_saldo_min;
    t.banco_positivo_min += Math.max(l.banco_saldo_min, 0);
    t.banco_negativo_min += Math.min(l.banco_saldo_min, 0);
    t.banco_creditos_min += l.banco_creditos_min;
    t.banco_debitos_min += l.banco_debitos_min;
  }
  return { ...t, absenteismo: absenteismo(t) };
}

export interface TotaisSetor extends TotaisPonto {
  departamento_id: string | null;
  departamento: string;
}

/** Totais por departamento, do maior absenteísmo para o menor. */
export function porSetor(linhas: LinhaPonto[]): TotaisSetor[] {
  const grupos = new Map<string | null, LinhaPonto[]>();
  for (const l of linhas) {
    grupos.set(l.departamento_id, [
      ...(grupos.get(l.departamento_id) ?? []),
      l,
    ]);
  }
  return [...grupos.values()]
    .map((ls) => ({
      departamento_id: ls[0]?.departamento_id ?? null,
      departamento: ls[0]?.departamento ?? "Sem departamento",
      ...somarPonto(ls),
    }))
    .sort((a, b) => (b.absenteismo ?? -1) - (a.absenteismo ?? -1));
}

/** Nomes das colunas de abono presentes (Abono2, Abono3…), em ordem. */
export function colunasDeAbono(linhas: LinhaPonto[]): string[] {
  return [...new Set(linhas.flatMap((l) => Object.keys(l.abonos_min)))].sort();
}

// ---------------------------------------------------------------------------
// Quadro e turnover
// ---------------------------------------------------------------------------

export interface ColaboradorQuadro {
  id: string;
  nome: string;
  matricula: number | null;
  departamento_id: string | null;
  departamento: string;
  admissao: string | null;
  desligamento: string | null;
  tipo_turnover: string | null;
}

/** Quem estava ativo no fim do dia `data` (aaaa-mm-dd). */
export function ativosEm<
  T extends Pick<ColaboradorQuadro, "admissao" | "desligamento">,
>(colaboradores: T[], data: string): T[] {
  return colaboradores.filter(
    (c) =>
      c.admissao !== null &&
      c.admissao <= data &&
      (c.desligamento === null || c.desligamento > data),
  );
}

export interface MovimentoMes {
  competencia: string;
  inicio: number;
  fim: number;
  admissoes: number;
  /** Desligamentos que contam no turnover (efetivação não conta). */
  desligamentos: number;
  efetivacoes: number;
  desligamentosPorTipo: Record<string, number>;
  /** ((admissões + desligamentos) ÷ 2) ÷ quadro médio × 100. */
  turnover: number | null;
}

/** Efetivação (estagiário/aprendiz que vira CLT) não é saída de verdade. */
export const TIPO_EFETIVACAO = "efetivacao";

export function movimentoDoMes(
  colaboradores: ColaboradorQuadro[],
  competencia: string,
): MovimentoMes {
  const inicioMes = competencia;
  const fimMes = fimDoMes(competencia);
  const [a, m] = competencia.split("-").map(Number) as [number, number];
  const vespera = isoLocal(new Date(a, m - 1, 0));

  const inicio = ativosEm(colaboradores, vespera).length;
  const fim = ativosEm(colaboradores, fimMes).length;
  const noMes = (d: string | null) =>
    d !== null && d >= inicioMes && d <= fimMes;

  const admissoes = colaboradores.filter((c) => noMes(c.admissao)).length;
  const saidas = colaboradores.filter((c) => noMes(c.desligamento));
  const efetivacoes = saidas.filter(
    (c) => c.tipo_turnover === TIPO_EFETIVACAO,
  ).length;
  const desligamentosPorTipo: Record<string, number> = {};
  for (const c of saidas) {
    const tipo = c.tipo_turnover ?? "nao_classificado";
    desligamentosPorTipo[tipo] = (desligamentosPorTipo[tipo] ?? 0) + 1;
  }
  const desligamentos = saidas.length - efetivacoes;
  const medio = (inicio + fim) / 2;

  return {
    competencia,
    inicio,
    fim,
    admissoes,
    desligamentos,
    efetivacoes,
    desligamentosPorTipo,
    turnover:
      medio > 0 ? ((admissoes + desligamentos) / 2 / medio) * 100 : null,
  };
}

/** Meses completos de casa até `data`. */
export function mesesDeCasa(admissao: string, data: string): number {
  const [a1, m1, d1] = admissao.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [a2, m2, d2] = data.split("-").map(Number) as [number, number, number];
  return (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
}

export function formatarTempoDeCasa(meses: number): string {
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${resto} ${resto === 1 ? "mês" : "meses"}`;
  if (resto === 0) return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return `${anos}a ${resto}m`;
}
