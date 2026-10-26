import { fimDoMes } from "@/lib/formato";
import { competenciasDoPeriodo, descreverPeriodo } from "@/lib/periodo";
import type { LinhaPonto } from "./calculos";

// Ponto de um período qualquer. Mês inteiro vem do total do mês
// (rh.ponto_mensal); trecho de mês vem dos dias (rh.ponto_diario), que só
// existem a partir da sincronização de 21/10/2026. Trecho sem dias guardados
// não vira zero: fica de fora e a tela avisa.

export interface TrechoDoPonto {
  competencia: string;
  de: string;
  ate: string;
}

export interface PlanoDoPonto {
  /** Até onde há dado (o ponto vai até ontem); null se nada fechou ainda. */
  efetivo: { de: string; ate: string } | null;
  /** Meses inteiros: total do mês. */
  meses: string[];
  /** Pedaços de mês: soma dos dias. */
  trechos: TrechoDoPonto[];
}

export function planejarPonto(
  periodo: { de: string; ate: string },
  ultimoDia: string,
): PlanoDoPonto {
  const ate = periodo.ate < ultimoDia ? periodo.ate : ultimoDia;
  if (ate < periodo.de) return { efetivo: null, meses: [], trechos: [] };
  const meses: string[] = [];
  const trechos: TrechoDoPonto[] = [];
  for (const c of competenciasDoPeriodo({ de: periodo.de, ate })) {
    const fimMes = fimDoMes(c);
    const de = periodo.de > c ? periodo.de : c;
    const fim = ate < fimMes ? ate : fimMes;
    // No mês corrente, o total do mês vai até o último dia fechado.
    if (de === c && (fim === fimMes || fim === ultimoDia)) meses.push(c);
    else trechos.push({ competencia: c, de, ate: fim });
  }
  return { efetivo: { de: periodo.de, ate }, meses, trechos };
}

/** Um dia do ponto, já com nome e departamento do colaborador. */
export type DiaDoPonto = Omit<LinhaPonto, "faltas_dias" | "dsr_debito_min"> & {
  data: string;
  /** Palavra no lugar das batidas (FALTA, FOLGA, FERIADO…). */
  ocorrencia?: string | null;
};

/**
 * O FaltasDias do Secullum conta os dias marcados FALTA (conferido com a
 * base da ARP em set e out/2026: 33 de 33 pessoas batem). Dia com só uma
 * parte faltada não entra.
 */
const DIA_DE_FALTA = "FALTA";

const somaMapa = (
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined,
) => {
  const r = { ...(a ?? {}) };
  for (const [k, v] of Object.entries(b ?? {})) r[k] = (r[k] ?? 0) + v;
  return r;
};

/**
 * Soma os dias de cada pessoa. O saldo do banco é o do último dia (é saldo
 * corrente, não se soma); créditos e débitos são o movimento e somam.
 * Dias de falta = dias marcados FALTA, como o FaltasDias do Secullum. DSR
 * descontado não vem por dia.
 */
export function somarDias(dias: DiaDoPonto[]): LinhaPonto[] {
  const porPessoa = new Map<string, LinhaPonto & { ultimoDia: string }>();
  for (const d of [...dias].sort((a, b) => a.data.localeCompare(b.data))) {
    const fracao =
      (d.ocorrencia ?? "").trim().toUpperCase() === DIA_DE_FALTA ? 1 : 0;
    const atual = porPessoa.get(d.colaborador_id);
    if (!atual) {
      const { data, ocorrencia: _, ...resto } = d;
      porPessoa.set(d.colaborador_id, {
        ...resto,
        abonos_min: { ...d.abonos_min },
        extras_min: { ...(d.extras_min ?? {}) },
        faltas_dias: fracao,
        dsr_debito_min: 0,
        ultimoDia: data,
      });
      continue;
    }
    atual.previstas_min += d.previstas_min;
    atual.faltas_min += d.faltas_min;
    atual.atrasos_min += d.atrasos_min;
    atual.faltas_dias += fracao;
    atual.abonos_min = somaMapa(atual.abonos_min, d.abonos_min);
    atual.extras_min = somaMapa(atual.extras_min, d.extras_min);
    atual.noturnas_min = (atual.noturnas_min ?? 0) + (d.noturnas_min ?? 0);
    atual.banco_creditos_min += d.banco_creditos_min;
    atual.banco_debitos_min += d.banco_debitos_min;
    atual.banco_saldo_min = d.banco_saldo_min;
    atual.ultimoDia = d.data;
  }
  return [...porPessoa.values()].map(({ ultimoDia: _, ...l }) => ({
    ...l,
    faltas_dias: Math.round(l.faltas_dias * 100) / 100,
  }));
}

/**
 * Uma linha de rh.ponto_dos_dias(de, ate): os dias de uma pessoa já somados
 * no banco, com a regra de somarDias. Abonos e extras vêm como pares
 * [coluna, minutos], na ordem em que somarDias criaria as chaves.
 */
export interface DiasSomados {
  colaborador_id: string;
  nome: string;
  matricula: number | null;
  departamento_id: string | null;
  departamento: string | null;
  primeiro_dia: string;
  previstas_min: number | string;
  faltas_min: number | string;
  atrasos_min: number | string;
  faltas_dias: number | string;
  abonos_min: unknown;
  extras_min: unknown;
  noturnas_min: number | string;
  banco_saldo_min: number | string;
  banco_creditos_min: number | string;
  banco_debitos_min: number | string;
}

const mapaDosPares = (v: unknown): Record<string, number> =>
  Object.fromEntries(
    (Array.isArray(v) ? (v as [string, number | string][]) : []).map(
      ([k, m]) => [k, Number(m)],
    ),
  );

/** A linha somada pelo banco no formato de somarDias (mesmos números). */
export function linhaDosDias(l: DiasSomados): LinhaPonto {
  return {
    colaborador_id: l.colaborador_id,
    nome: l.nome,
    matricula: l.matricula,
    departamento_id: l.departamento_id,
    departamento: l.departamento ?? "Sem departamento",
    previstas_min: Number(l.previstas_min),
    faltas_min: Number(l.faltas_min),
    atrasos_min: Number(l.atrasos_min),
    abonos_min: mapaDosPares(l.abonos_min),
    extras_min: mapaDosPares(l.extras_min),
    noturnas_min: Number(l.noturnas_min),
    banco_saldo_min: Number(l.banco_saldo_min),
    banco_creditos_min: Number(l.banco_creditos_min),
    banco_debitos_min: Number(l.banco_debitos_min),
    faltas_dias: Math.round(Number(l.faltas_dias) * 100) / 100,
    dsr_debito_min: 0,
  };
}

/**
 * Junta pedaços do período em ordem (meses e trechos, do mais antigo ao mais
 * novo): soma o que é movimento e fica com o saldo e o departamento do
 * pedaço mais recente de cada pessoa.
 */
export function juntarPonto(pedacos: LinhaPonto[][]): LinhaPonto[] {
  const porPessoa = new Map<string, LinhaPonto>();
  for (const pedaco of pedacos) {
    for (const l of pedaco) {
      const atual = porPessoa.get(l.colaborador_id);
      if (!atual) {
        porPessoa.set(l.colaborador_id, {
          ...l,
          abonos_min: { ...l.abonos_min },
          extras_min: { ...(l.extras_min ?? {}) },
        });
        continue;
      }
      porPessoa.set(l.colaborador_id, {
        ...atual,
        departamento_id: l.departamento_id,
        departamento: l.departamento,
        previstas_min: atual.previstas_min + l.previstas_min,
        faltas_min: atual.faltas_min + l.faltas_min,
        atrasos_min: atual.atrasos_min + l.atrasos_min,
        faltas_dias: atual.faltas_dias + l.faltas_dias,
        abonos_min: somaMapa(atual.abonos_min, l.abonos_min),
        extras_min: somaMapa(atual.extras_min, l.extras_min),
        noturnas_min: (atual.noturnas_min ?? 0) + (l.noturnas_min ?? 0),
        dsr_debito_min: (atual.dsr_debito_min ?? 0) + (l.dsr_debito_min ?? 0),
        banco_creditos_min: atual.banco_creditos_min + l.banco_creditos_min,
        banco_debitos_min: atual.banco_debitos_min + l.banco_debitos_min,
        banco_saldo_min: l.banco_saldo_min,
      });
    }
  }
  return [...porPessoa.values()];
}

export interface PontoDoPeriodo {
  linhas: LinhaPonto[];
  /** Trecho com dado (o ponto vai até ontem); null se nenhum dia fechou. */
  efetivo: { de: string; ate: string } | null;
  /** Trechos de mês sem os dias guardados: ficaram fora do total. */
  semDias: TrechoDoPonto[];
}

/** Por que o ponto do período não tem número (ou só tem uma parte). */
export function avisoDoPonto(p: PontoDoPeriodo): {
  semDado: string | null;
  parcial: string | null;
} {
  if (!p.efetivo)
    return {
      semDado:
        "O ponto do dia entra na sincronização de amanhã (6h). Escolha um período até ontem.",
      parcial: null,
    };
  const fora = p.semDias
    .map((t) => descreverPeriodo({ ...t, atalho: null }))
    .join(", ");
  if (p.linhas.length === 0)
    return {
      semDado: fora
        ? `Sem o ponto dia a dia de ${fora}: os dias só são guardados desde 21/10/2026. Para antes, escolha meses inteiros.`
        : "Sem ponto sincronizado no período.",
      parcial: null,
    };
  return {
    semDado: null,
    parcial: fora ? `Fora do total: ${fora} (sem o ponto dia a dia)` : null,
  };
}
