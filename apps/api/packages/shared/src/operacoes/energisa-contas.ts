// Contas da área comum (faturas da Energisa já importadas): totais do mês,
// média dos 12 meses anteriores, alerta de consumo e a série do gráfico.
// Puro: recebe as linhas de operacoes.energia_faturas (vigentes) como o
// banco devolve (reais em número, kWh em número). Somas de dinheiro em
// centavos inteiros.

/** Colunas de operacoes.energia_faturas que as telas usam. */
export interface FaturaConta {
  id: string;
  matricula: string;
  /** aaaa-mm-01 */
  referencia: string;
  vencimento: string | null;
  medidor: string | null;
  consumo_kwh: number;
  valor_consumo: number;
  compensado_kwh: number;
  valor_compensado: number;
  injetada_kwh: number | null;
  bandeira: string | null;
  valor_bandeira: number;
  iluminacao_publica: number;
  icms: number;
  pis_cofins: number;
  total: number;
  saldo_kwh: number | null;
  expirar_kwh: number | null;
  classificacao_gd: string | null;
  arquivo: string | null;
  exemplo: boolean;
}

export type Papel = "consome" | "gera" | "gera_e_consome";
export const PAPEIS: Record<Papel, string> = {
  consome: "Consome (recebe crédito)",
  gera: "Gera (usina)",
  gera_e_consome: "Gera e consome",
};

export interface UnidadeEnergia {
  matricula: string;
  apelido: string | null;
  endereco: string | null;
  classificacao: string | null;
  ligacao: string | null;
  papel: Papel;
  ativa: boolean;
  exemplo: boolean;
}

/** "Área comum do Bloco A" ou, sem apelido, a matrícula. */
export const nomeDaUnidade = (
  matricula: string,
  unidade: Pick<UnidadeEnergia, "apelido"> | undefined,
) => unidade?.apelido?.trim() || matricula;

const cents = (v: number | null | undefined) => Math.round((v ?? 0) * 100);

/** Soma em reais sem erro de ponto flutuante (via centavos). */
export function somarReais(valores: (number | null | undefined)[]): number {
  return valores.reduce<number>((s, v) => s + cents(v), 0) / 100;
}

const somarKwh = (valores: (number | null | undefined)[]) =>
  Math.round(valores.reduce<number>((s, v) => s + (v ?? 0), 0) * 100) / 100;

/** Mês (aaaa-mm-01) somado de `n` meses (negativo volta). */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Os `n` meses até `ate` (inclusive), do mais antigo para o mais novo. */
export function mesesAte(ate: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => somarMeses(ate, i - (n - 1)));
}

export interface TotaisDoMes {
  faturas: number;
  total: number;
  consumoKwh: number;
  compensadoKwh: number;
  valorCompensado: number;
  bandeira: number;
  iluminacao: number;
  /** ICMS + PIS/COFINS. */
  tributos: number;
  saldoKwh: number;
  expirarKwh: number;
}

export function totaisDoMes(faturas: FaturaConta[]): TotaisDoMes {
  return {
    faturas: faturas.length,
    total: somarReais(faturas.map((f) => f.total)),
    consumoKwh: somarKwh(faturas.map((f) => f.consumo_kwh)),
    compensadoKwh: somarKwh(faturas.map((f) => f.compensado_kwh)),
    valorCompensado: somarReais(faturas.map((f) => f.valor_compensado)),
    bandeira: somarReais(faturas.map((f) => f.valor_bandeira)),
    iluminacao: somarReais(faturas.map((f) => f.iluminacao_publica)),
    tributos: somarReais(faturas.flatMap((f) => [f.icms, f.pis_cofins])),
    saldoKwh: somarKwh(faturas.map((f) => f.saldo_kwh)),
    expirarKwh: somarKwh(faturas.map((f) => f.expirar_kwh)),
  };
}

/**
 * Média mensal do consumo de uma unidade nos 12 meses antes de `mes` (só os
 * meses com fatura). null sem nenhum mês anterior.
 */
export function mediaDaUnidade(
  faturas: Pick<FaturaConta, "matricula" | "referencia" | "consumo_kwh">[],
  matricula: string,
  mes: string,
): { media: number; meses: number } | null {
  const inicio = somarMeses(mes, -12);
  const anteriores = faturas.filter(
    (f) =>
      f.matricula === matricula && f.referencia >= inicio && f.referencia < mes,
  );
  if (!anteriores.length) return null;
  return {
    media: somarKwh(anteriores.map((f) => f.consumo_kwh)) / anteriores.length,
    meses: anteriores.length,
  };
}

/** Variação em % (null quando a base é zero). */
export const variacaoPct = (atual: number, base: number) =>
  base > 0 ? ((atual - base) / base) * 100 : null;

export interface Comparacao {
  /** Consumo do mês das unidades que têm histórico. */
  atual: number;
  /** Soma das médias dessas unidades (12 meses anteriores). */
  media: number;
  variacao: number | null;
  unidades: number;
}

/**
 * Consumo do mês contra a média dos 12 meses anteriores, unidade a unidade
 * (somando as médias): uma unidade sem fatura num mês não puxa a média
 * para baixo. Unidade sem histórico fica de fora da comparação.
 */
export function compararComMedia(
  faturas: FaturaConta[],
  doMes: FaturaConta[],
  mes: string,
): Comparacao | null {
  let atual = 0;
  let media = 0;
  let unidades = 0;
  for (const f of doMes) {
    const m = mediaDaUnidade(faturas, f.matricula, mes);
    if (!m) continue;
    atual += f.consumo_kwh;
    media += m.media;
    unidades++;
  }
  if (!unidades) return null;
  return { atual, media, variacao: variacaoPct(atual, media), unidades };
}

export interface AlertaConsumo {
  matricula: string;
  consumo: number;
  media: number;
  /** Quanto passou da média, em %. */
  acima: number;
}

/**
 * Unidades com consumo do mês acima da média dos 12 meses anteriores por
 * mais que `pct` (Parâmetros › energia_alerta_pct).
 */
export function alertasDeConsumo(
  faturas: FaturaConta[],
  doMes: FaturaConta[],
  mes: string,
  pct: number,
): AlertaConsumo[] {
  return doMes.flatMap((f) => {
    const m = mediaDaUnidade(faturas, f.matricula, mes);
    const acima = m ? variacaoPct(f.consumo_kwh, m.media) : null;
    return m && acima !== null && acima > pct
      ? [
          {
            matricula: f.matricula,
            consumo: f.consumo_kwh,
            media: m.media,
            acima,
          },
        ]
      : [];
  });
}

/** kWh de cada unidade em cada mês (null: sem fatura naquele mês). */
export function seriePorUnidade(
  faturas: FaturaConta[],
  meses: string[],
  campo: "consumo_kwh" | "compensado_kwh",
): Map<string, (number | null)[]> {
  const porUnidade = new Map<string, (number | null)[]>();
  for (const f of faturas) {
    const i = meses.indexOf(f.referencia);
    if (i < 0) continue;
    const linha = porUnidade.get(f.matricula) ?? meses.map(() => null);
    linha[i] = (linha[i] ?? 0) + f[campo];
    porUnidade.set(f.matricula, linha);
  }
  return porUnidade;
}
