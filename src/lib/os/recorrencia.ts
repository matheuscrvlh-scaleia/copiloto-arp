import { formatarData } from "@/lib/formato";
import { diaDaSemana, somarDias, ultimoDiaDoMes } from "./tempo";

// Recorrência de tarefas e preventivas. Datas em aaaa-mm-dd (Brasília).
// `depoisDe` é a última ocorrência (ou o início): a próxima vem estritamente
// depois dela, e os intervalos contam a partir dela.

export interface Recorrencia {
  frequencia: "diaria" | "semanal" | "mensal" | "cada_n_dias" | "cada_n_meses";
  /** A cada quantos dias/semanas/meses (padrão 1). */
  intervalo?: number;
  /** Semanal: 0 = dom … 6 = sáb (padrão: o dia da semana de `depoisDe`). */
  dias_semana?: number[];
  /** Mensal: dia do mês; 31 em mês curto vira o último dia. */
  dia_mes?: number;
  /** Última data possível (inclusive). */
  fim?: string | null;
}

export type Frequencia = Recorrencia["frequencia"];

const passo = (r: Recorrencia) => Math.max(1, Math.floor(r.intervalo ?? 1));

/** Dia `dia` do mês, ou o último se o mês for mais curto. */
function diaNoMes(ano: number, mes: number, dia: number): string {
  const d = Math.min(dia, ultimoDiaDoMes(ano, mes));
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function proximaMensal(r: Recorrencia, depoisDe: string): string {
  const [a, m, d] = depoisDe.split("-").map(Number) as [number, number, number];
  const dia = r.dia_mes ?? d;
  // Ainda dá neste mês (ex.: começou dia 3 e a regra é dia 5).
  const nesteMes = diaNoMes(a, m, dia);
  if (nesteMes > depoisDe) return nesteMes;
  const total = a * 12 + (m - 1) + passo(r);
  return diaNoMes(Math.floor(total / 12), (total % 12) + 1, dia);
}

function proximaSemanal(r: Recorrencia, depoisDe: string): string {
  const dias = r.dias_semana?.length ? r.dias_semana : [diaDaSemana(depoisDe)];
  let d = depoisDe;
  // No máximo uma volta completa do intervalo.
  for (let i = 0; i < 7 * passo(r) + 7; i++) {
    d = somarDias(d, 1);
    // Virou a semana (segunda): pula as semanas do intervalo.
    if (diaDaSemana(d) === 1 && passo(r) > 1)
      d = somarDias(d, 7 * (passo(r) - 1));
    if (dias.includes(diaDaSemana(d))) return d;
  }
  return d;
}

/** Próxima data depois de `depoisDe`; null se passar do fim. */
export function proximaData(r: Recorrencia, depoisDe: string): string | null {
  let d: string;
  switch (r.frequencia) {
    case "diaria":
    case "cada_n_dias":
      d = somarDias(depoisDe, passo(r));
      break;
    case "semanal":
      d = proximaSemanal(r, depoisDe);
      break;
    case "mensal":
    case "cada_n_meses":
      d = proximaMensal(r, depoisDe);
      break;
  }
  return r.fim && d > r.fim ? null : d;
}

/** `inicio` já é uma ocorrência? (diária e a cada N dias contam a partir dele) */
function ocorreEm(r: Recorrencia, data: string): boolean {
  switch (r.frequencia) {
    case "diaria":
    case "cada_n_dias":
      return true;
    case "semanal":
      return (
        !r.dias_semana?.length || r.dias_semana.includes(diaDaSemana(data))
      );
    case "mensal":
    case "cada_n_meses": {
      if (r.dia_mes === undefined) return true;
      const [a, m] = data.split("-").map(Number) as [number, number];
      return diaNoMes(a, m, r.dia_mes) === data;
    }
  }
}

const MAXIMO = 1000;

/** Todas as datas de `inicio` a `ate` (inclusive). */
export function datasEntre(
  r: Recorrencia,
  inicio: string,
  ate: string,
): string[] {
  const datas: string[] = [];
  const limite = r.fim && r.fim < ate ? r.fim : ate;
  let d: string | null = ocorreEm(r, inicio) ? inicio : proximaData(r, inicio);
  while (d && d <= limite && datas.length < MAXIMO) {
    datas.push(d);
    d = proximaData(r, d);
  }
  return datas;
}

const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** ["seg", "qua", "sex"] → "seg, qua e sex". */
function lista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`;
}

/** "Toda semana, seg e qua", "Todo mês, dia 5", "A cada 15 dias"… */
export function descreverRecorrencia(r: Recorrencia): string {
  const n = passo(r);
  let texto: string;
  switch (r.frequencia) {
    case "diaria":
    case "cada_n_dias":
      texto = n === 1 ? "Todo dia" : `A cada ${n} dias`;
      break;
    case "semanal": {
      const dias = [...new Set(r.dias_semana ?? [])]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => DIAS_CURTOS[d] ?? "");
      texto = n === 1 ? "Toda semana" : `A cada ${n} semanas`;
      if (dias.length) texto += `, ${lista(dias)}`;
      break;
    }
    case "mensal":
    case "cada_n_meses":
      texto = n === 1 ? "Todo mês" : `A cada ${n} meses`;
      if (r.dia_mes !== undefined) texto += `, dia ${r.dia_mes}`;
      break;
  }
  return r.fim ? `${texto}, até ${formatarData(r.fim)}` : texto;
}
