import { fimDoMes } from "@/lib/formato";
import {
  type ConfigTurnover,
  type TaxaTurnover,
  type TipoDesligamento,
  TURNOVER_PADRAO,
  taxasDeTurnover,
  tipoDoDesligamento,
} from "./turnover";

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
  // Opcionais: linhas montadas à mão (testes) podem não trazer.
  /** Horas extras por coluna do Secullum (Ex80%, Ex100%, ExNot…). */
  extras_min?: Record<string, number>;
  /** Adicional noturno. */
  noturnas_min?: number;
  /** DSR descontado por falta. */
  dsr_debito_min?: number;
}

/** Rótulo das extras de quem tem horário sem divisão por percentual. */
export const EXTRAS_SEM_DIVISAO = "Sem divisão por %";

const PERCENTUAL = /^Ex\d+%$/;

export interface ExtrasDaLinha {
  /** Horas extras da pessoa (sem contar duas vezes). */
  total: number;
  /** O total por percentual (Ex80%, Ex100%…) e o que não tem divisão. */
  porTipo: Record<string, number>;
  /** Parte das extras feita à noite (ExNot): já está dentro do total. */
  noturnas: number;
  /** Extras de intervalo (ExInt): fora do total até a Gestora confirmar. */
  intervalo: number;
}

/**
 * Horas extras do ponto, pelas colunas que o Secullum devolve. Há dois tipos
 * de horário: os que dividem por percentual (Ex80%, Ex100%…) e os que trazem
 * só o total ("Extras"). ExNot é a parte noturna dessas mesmas horas (há
 * quem tenha Extras = ExNot), então não soma de novo.
 */
export function extrasDe(l: Pick<LinhaPonto, "extras_min">): ExtrasDaLinha {
  const e = l.extras_min ?? {};
  const porPercentual = Object.entries(e).filter(([k]) => PERCENTUAL.test(k));
  const somaPercentual = porPercentual.reduce((s, [, m]) => s + m, 0);
  const total = "Extras" in e ? (e.Extras ?? 0) : somaPercentual;
  const porTipo: Record<string, number> = Object.fromEntries(porPercentual);
  const semDivisao = Math.max(total - somaPercentual, 0);
  if (semDivisao > 0) porTipo[EXTRAS_SEM_DIVISAO] = semDivisao;
  return {
    total,
    porTipo,
    noturnas: e.ExNot ?? 0,
    intervalo: e.ExInt ?? 0,
  };
}

/** Total de horas extras da linha. */
export const somaExtras = (l: Pick<LinhaPonto, "extras_min">) =>
  extrasDe(l).total;

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
  /** Horas extras do ponto (ver extrasDe). */
  extras_min: number;
  /** As extras por percentual e "sem divisão"; somam extras_min. */
  extras_por_tipo: Record<string, number>;
  /** Parte noturna das extras (já dentro de extras_min). */
  extras_noturnas_min: number;
  /** Extras de intervalo, fora de extras_min até confirmar. */
  extras_intervalo_min: number;
  /** Adicional noturno (Not.). */
  noturnas_min: number;
  /** DSR descontado por falta. */
  dsr_debito_min: number;
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
    extras_min: 0,
    extras_por_tipo: {} as Record<string, number>,
    extras_noturnas_min: 0,
    extras_intervalo_min: 0,
    noturnas_min: 0,
    dsr_debito_min: 0,
  };
  for (const l of linhas) {
    const ex = extrasDe(l);
    t.extras_min += ex.total;
    t.extras_noturnas_min += ex.noturnas;
    t.extras_intervalo_min += ex.intervalo;
    for (const [tipo, min] of Object.entries(ex.porTipo)) {
      t.extras_por_tipo[tipo] = (t.extras_por_tipo[tipo] ?? 0) + min;
    }
    t.noturnas_min += l.noturnas_min ?? 0;
    t.dsr_debito_min += l.dsr_debito_min ?? 0;
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
  /** Tipo do desligamento (Copiloto); null para quem não saiu. */
  tipo_turnover: TipoDesligamento | null;
  /** Motivo do desligamento no Copiloto (`termination_reason`). */
  motivo_desligamento?: string | null;
  // Opcionais: o cargo vem da folha; quem não está nela não tem.
  cargo?: string | null;
  tipo_contrato?: string | null;
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
  /** Ativos no 1º dia do mês (admitidos até ele e não desligados nele). */
  inicio: number;
  fim: number;
  admissoes: number;
  desligamentos: number;
  desligamentosPorTipo: Record<TipoDesligamento, number>;
  /** Turnover Geral, pela fórmula configurada (a mesma do Copiloto). */
  turnover: number;
  /** Geral, Voluntário, Involuntário e (se separado) por Acordo. */
  taxas: TaxaTurnover[];
}

/**
 * Movimento e turnover do mês como o Copiloto RH calcula: headcount no 1º
 * dia, admissões e desligamentos com data no mês, desligamento classificado
 * pelo motivo e taxas pelas fórmulas da configuração.
 */
export function movimentoDoMes(
  colaboradores: ColaboradorQuadro[],
  competencia: string,
  config: ConfigTurnover = TURNOVER_PADRAO,
): MovimentoMes {
  const fimMes = fimDoMes(competencia);
  const inicio = ativosEm(colaboradores, competencia).length;
  const fim = ativosEm(colaboradores, fimMes).length;
  const noMes = (d: string | null) =>
    d !== null && d >= competencia && d <= fimMes;

  const admissoes = colaboradores.filter((c) => noMes(c.admissao)).length;
  const saidas = colaboradores.filter((c) => noMes(c.desligamento));
  const desligamentosPorTipo: Record<TipoDesligamento, number> = {
    voluntario: 0,
    involuntario: 0,
    acordo: 0,
  };
  for (const c of saidas) {
    const tipo =
      c.tipo_turnover ??
      tipoDoDesligamento(c.motivo_desligamento ?? null, config);
    desligamentosPorTipo[tipo] += 1;
  }
  const taxas = taxasDeTurnover(
    inicio,
    admissoes,
    desligamentosPorTipo,
    config,
  );

  return {
    competencia,
    inicio,
    fim,
    admissoes,
    desligamentos: saidas.length,
    desligamentosPorTipo,
    turnover: taxas[0]?.valor ?? 0,
    taxas,
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
