const numero = new Intl.NumberFormat("pt-BR");

/** 1234.5 → "1.234,5" (até `casas` decimais). */
export function formatarNumero(valor: number, casas = 0): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

/** 1234.5 → "R$ 1.234,50"; com casas = 0, "R$ 1.235". */
export function formatarMoeda(valor: number | null, casas = 2): string {
  return valor === null ? "—" : `R$ ${formatarNumero(valor, casas)}`;
}

/**
 * Valor digitado em reais → número: "1.234,56", "R$ 57,50", "1234.5" ou
 * "1234". Vazio → null; texto que não é número → NaN (o formulário recusa).
 */
export function lerValorBr(texto: string): number | null {
  const t = texto.replace(/R\$|\s/g, "");
  if (t === "") return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$|^-?\d+,\d+$/.test(t))
    return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return Number.NaN;
}

/** 6.523 → "6,5%". */
export function formatarPct(valor: number | null, casas = 1): string {
  return valor === null ? "—" : `${formatarNumero(valor, casas)}%`;
}

/** Minutos → "12h30", "-141h00", "1.234h05". */
export function formatarHoras(minutos: number): string {
  const sinal = minutos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = String(abs % 60).padStart(2, "0");
  return `${sinal}${numero.format(h)}h${m}`;
}

/** Saldo de horas com o sinal também no positivo: "+16h49", "-3h10", "0h00". */
export function formatarSaldoHoras(minutos: number): string {
  return `${Math.round(minutos) > 0 ? "+" : ""}${formatarHoras(minutos)}`;
}

const MESES = [
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
];

/** "2026-10-01" ou "2026-10" → "out/2026". */
export function formatarMes(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

/** "2026-10-19" → "19/10/2026". */
export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Date → "aaaa-mm-dd" no horário local. */
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Competência (dia 1) do mês da data. */
export function competenciaDe(d: Date): string {
  return isoLocal(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** "aaaa-mm" do parâmetro da URL → "aaaa-mm-01", ou null se inválido. */
export function competenciaDaUrl(
  valor: string | string[] | undefined,
): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? `${v}-01` : null;
}

/** As `n` competências até `ate` (inclusive), da mais antiga para a mais nova. */
export function ultimasCompetencias(ate: string, n: number): string[] {
  const [a, m] = ate.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) =>
    competenciaDe(new Date(a, m - 1 - (n - 1 - i), 1)),
  );
}

/** Último dia do mês da competência ("2026-02-01" → "2026-02-28"). */
export function fimDoMes(competencia: string): string {
  const [a, m] = competencia.split("-").map(Number) as [number, number];
  return isoLocal(new Date(a, m, 0));
}

const dataHora = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Timestamp do banco → "20/10/2026 10:05", no horário de Brasília. */
export function formatarDataHora(iso: string): string {
  return dataHora.format(new Date(iso)).replace(",", "");
}

/** "Maria da Silva" → "MS". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (
    (partes[0]?.[0] ?? "") +
    (partes.length > 1 ? (partes.at(-1)?.[0] ?? "") : "")
  ).toUpperCase();
}
