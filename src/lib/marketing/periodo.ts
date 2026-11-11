import { formatarData } from "@/lib/formato";

// Período das telas do Marketing (spec 4.3): atalhos próprios (o padrão é a
// semana passada, de segunda a domingo) ou datas escolhidas, sempre na URL
// (?periodo=semana_passada ou ?de=…&ate=…). A comparação é contra o período
// anterior de mesmo tamanho. Datas em "aaaa-mm-dd" com aritmética em UTC:
// nada aqui depende do fuso do servidor.

export const ATALHOS_MKT = [
  { valor: "semana_passada", rotulo: "Semana passada" },
  { valor: "esta_semana", rotulo: "Esta semana" },
  { valor: "fim_de_semana", rotulo: "Último fim de semana" },
  { valor: "ultimos_30", rotulo: "Últimos 30 dias" },
  { valor: "mes", rotulo: "Este mês" },
  { valor: "mes_passado", rotulo: "Mês passado" },
  { valor: "ultimas_12_semanas", rotulo: "Últimas 12 semanas" },
] as const;

export type AtalhoMkt = (typeof ATALHOS_MKT)[number]["valor"];

export interface PeriodoMkt {
  /** aaaa-mm-dd, inclusive. */
  de: string;
  /** aaaa-mm-dd, inclusive. */
  ate: string;
  /** null: datas escolhidas à mão. */
  atalho: AtalhoMkt | null;
}

const DIA_MS = 86_400_000;
const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const utc = (d: string) => {
  const [a, m, dia] = d.split("-").map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, dia);
};
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** "aaaa-mm-dd" que existe de verdade. */
export function dataMktValida(v: unknown): v is string {
  return typeof v === "string" && DATA.test(v) && iso(utc(v)) === v;
}

export function somarDias(data: string, dias: number): string {
  return iso(utc(data) + dias * DIA_MS);
}

/** Dias de `de` até `ate`, contando os dois. */
export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / DIA_MS) + 1;
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(data: string): number {
  return new Date(utc(data)).getUTCDay();
}

/** Segunda-feira da semana da data. */
export function segundaDa(data: string): string {
  return somarDias(data, -((diaDaSemana(data) + 6) % 7));
}

/** Todas as datas do período, em ordem. */
export function datasDo(p: Pick<PeriodoMkt, "de" | "ate">): string[] {
  const n = diasEntre(p.de, p.ate);
  return Array.from({ length: Math.max(n, 0) }, (_, i) => somarDias(p.de, i));
}

export function dentro(data: string, p: Pick<PeriodoMkt, "de" | "ate">) {
  const d = data.slice(0, 10);
  return d >= p.de && d <= p.ate;
}

export function periodoDoAtalhoMkt(
  atalho: AtalhoMkt,
  hoje: string,
): PeriodoMkt {
  const segunda = segundaDa(hoje);
  const [a, m] = hoje.split("-").map(Number) as [number, number];
  const mes = (ano: number, mm: number) =>
    `${ano}-${String(mm).padStart(2, "0")}-01`;
  switch (atalho) {
    case "semana_passada":
      return {
        de: somarDias(segunda, -7),
        ate: somarDias(segunda, -1),
        atalho,
      };
    case "esta_semana":
      return { de: segunda, ate: hoje, atalho };
    case "fim_de_semana": {
      // Último sábado e domingo já fechados (num domingo, o anterior).
      const domingo =
        diaDaSemana(hoje) === 0 ? somarDias(hoje, -7) : somarDias(segunda, -1);
      return { de: somarDias(domingo, -1), ate: domingo, atalho };
    }
    case "ultimos_30":
      return { de: somarDias(hoje, -29), ate: hoje, atalho };
    case "mes":
      return { de: mes(a, m), ate: hoje, atalho };
    case "mes_passado": {
      const de = m === 1 ? mes(a - 1, 12) : mes(a, m - 1);
      return { de, ate: somarDias(mes(a, m), -1), atalho };
    }
    case "ultimas_12_semanas":
      return {
        de: somarDias(segunda, -84),
        ate: somarDias(segunda, -1),
        atalho,
      };
  }
}

const ehAtalho = (v: unknown): v is AtalhoMkt =>
  ATALHOS_MKT.some((a) => a.valor === v);

/**
 * Período da URL. Sem nada (ou inválido), o padrão da tela. Datas no futuro
 * param em hoje; de > ate troca a ordem.
 */
export function lerPeriodoMkt(
  busca: Record<string, string | string[] | undefined>,
  padrao: AtalhoMkt,
  hoje: string,
): PeriodoMkt {
  const um = (k: string) => {
    const v = busca[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const atalho = um("periodo");
  if (ehAtalho(atalho)) return periodoDoAtalhoMkt(atalho, hoje);
  const de = um("de");
  const ate = um("ate");
  if (dataMktValida(de) && dataMktValida(ate)) {
    const [x, y] = de <= ate ? [de, ate] : [ate, de];
    return { de: x, ate: y > hoje ? hoje : y, atalho: null };
  }
  return periodoDoAtalhoMkt(padrao, hoje);
}

/** Período anterior de mesmo tamanho (ex.: a semana antes da semana). */
export function anteriorMkt(p: PeriodoMkt): PeriodoMkt {
  const n = diasEntre(p.de, p.ate);
  return { de: somarDias(p.de, -n), ate: somarDias(p.de, -1), atalho: null };
}

/** O mesmo período um ano antes (29/02 vira 28/02). */
export function anoAnteriorMkt(p: PeriodoMkt): PeriodoMkt {
  const menos = (d: string) => {
    const a = String(Number(d.slice(0, 4)) - 1);
    const md = d.slice(5) === "02-29" ? "02-28" : d.slice(5);
    return `${a}-${md}`;
  };
  return { de: menos(p.de), ate: menos(p.ate), atalho: null };
}

/** Com o que a tela compara: o período anterior ou o do ano passado. */
export const COMPARACOES = [
  { valor: "ano", rotulo: "Mesmo período do ano passado" },
] as const;

/** "20/10/2026 a 26/10/2026" (um dia só: "20/10/2026"). */
export function descreverPeriodoMkt(p: Pick<PeriodoMkt, "de" | "ate">): string {
  return p.de === p.ate
    ? formatarData(p.de)
    : `${formatarData(p.de)} a ${formatarData(p.ate)}`;
}

/** Configurações da URL que reproduzem o período. */
export function paramsDoPeriodoMkt(p: PeriodoMkt): Record<string, string> {
  return p.atalho ? { periodo: p.atalho } : { de: p.de, ate: p.ate };
}

/**
 * As últimas `n` semanas (segunda a domingo) até a semana que contém `ate`,
 * da mais antiga para a mais recente. Para os gráficos de 12 semanas.
 */
export function semanasAte(
  ate: string,
  n: number,
): { de: string; ate: string; rotulo: string }[] {
  const ultima = segundaDa(ate);
  return Array.from({ length: n }, (_, i) => {
    const de = somarDias(ultima, -7 * (n - 1 - i));
    return {
      de,
      ate: somarDias(de, 6),
      rotulo: `${de.slice(8, 10)}/${de.slice(5, 7)}`,
    };
  });
}

/** Os últimos `n` meses ("aaaa-mm-01") até o mês de `ate`. */
export function mesesAte(ate: string, n: number): string[] {
  const [a, m] = ate.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => {
    const k = a * 12 + (m - 1) - (n - 1 - i);
    return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`;
  });
}

/**
 * Linha de filtros escrita (spec 4.3), igual na tela, no Excel e no PDF:
 * "Período: 01/10/2026 a 21/10/2026; Plataforma: Todas; Interesse: Locação".
 */
export function linhaDeFiltros(
  itens: { rotulo: string; valor: string }[],
): string {
  return itens.map((i) => `${i.rotulo}: ${i.valor}`).join("; ");
}

/** Variação % contra o anterior; null sem base. */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (!Number.isFinite(anterior) || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}
