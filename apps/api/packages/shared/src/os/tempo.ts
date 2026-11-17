// Datas e horas do negócio. A ARP fica em Nova Friburgo (America/Sao_Paulo),
// que está em UTC−3 fixo desde 2019 (sem horário de verão). O servidor roda em
// UTC, então nada aqui usa getHours/getDate: tudo passa pelo deslocamento fixo.
// "aaaa-mm-dd" e "HH:MM" são sempre horário de Brasília; instantes são Date.

const FUSO_MIN = -180;
const MS_MIN = 60_000;
export const MS_DIA = 86_400_000;

/** Instante → data e hora de Brasília ("2026-10-21", "08:05"). */
export function paraBrasilia(d: Date): { data: string; hora: string } {
  const iso = new Date(d.getTime() + FUSO_MIN * MS_MIN).toISOString();
  return { data: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/** "aaaa-mm-dd" de hoje em Brasília (às 22h UTC−3 o UTC já virou o dia). */
export function hojeEmBrasilia(agora: Date): string {
  return paraBrasilia(agora).data;
}

/** Data e hora de Brasília → instante. */
export function deBrasilia(data: string, hora = "00:00"): Date {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  const minutos = minutosDoDia(hora);
  return new Date(Date.UTC(a, m - 1, d) + (minutos - FUSO_MIN) * MS_MIN);
}

/** "08:30" → 510. */
export function minutosDoDia(hora: string): number {
  const [h, m] = hora.split(":").map(Number) as [number, number];
  return h * 60 + (m || 0);
}

/** 510 → "08:30" (passa da meia-noite dá a volta). */
export function horaDosMinutos(minutos: number): string {
  const m = ((Math.floor(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const utc = (data: string) => {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, d);
};

/** "2026-12-31" + 1 → "2027-01-01". */
export function somarDias(data: string, n: number): string {
  return new Date(utc(data) + n * MS_DIA).toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(data: string): number {
  return new Date(utc(data)).getUTCDay();
}

/** Dias de `de` até `ate` (negativo se `ate` vem antes). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / MS_DIA);
}

/** Último dia do mês (mes de 1 a 12). */
export function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Texto do banco → instante. "aaaa-mm-dd" sozinho é o início do dia em
 * Brasília; o resto (timestamp ISO) vai direto.
 */
export function instante(v: string | Date): Date {
  if (v instanceof Date) return v;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? deBrasilia(v) : new Date(v);
}
