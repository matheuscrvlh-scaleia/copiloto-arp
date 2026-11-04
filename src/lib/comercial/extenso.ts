import { formatarNumero } from "@/lib/formato";

// Valores, áreas, prazos e datas por extenso, como nos modelos de contrato,
// distrato e proposta (spec 4.3): "2.400,00 (dois mil e quatrocentos reais)"
// e "30,50 m² (trinta metros e cinquenta centímetros quadrados)".

const UNIDADES = [
  "zero",
  "um",
  "dois",
  "três",
  "quatro",
  "cinco",
  "seis",
  "sete",
  "oito",
  "nove",
  "dez",
  "onze",
  "doze",
  "treze",
  "quatorze",
  "quinze",
  "dezesseis",
  "dezessete",
  "dezoito",
  "dezenove",
];
const DEZENAS = [
  "",
  "",
  "vinte",
  "trinta",
  "quarenta",
  "cinquenta",
  "sessenta",
  "setenta",
  "oitenta",
  "noventa",
];
const CENTENAS = [
  "",
  "cento",
  "duzentos",
  "trezentos",
  "quatrocentos",
  "quinhentos",
  "seiscentos",
  "setecentos",
  "oitocentos",
  "novecentos",
];

const feminina = (t: string) =>
  t
    .replace(/\bum$/, "uma")
    .replace(/\bdois$/, "duas")
    .replace(/entos$/, "entas");

/** 0 a 999. */
function ate999(n: number, fem: boolean): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (c)
    partes.push(
      fem ? feminina(CENTENAS[c] as string) : (CENTENAS[c] as string),
    );
  if (resto >= 20) {
    partes.push(DEZENAS[Math.floor(resto / 10)] as string);
    if (resto % 10) partes.push(unidade(resto % 10, fem));
  } else if (resto || !c) partes.push(unidade(resto, fem));
  return partes.join(" e ");
}

const unidade = (n: number, fem: boolean) => {
  const t = UNIDADES[n] as string;
  return fem ? feminina(t) : t;
};

const ESCALAS: [singular: string, plural: string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
];

/**
 * Inteiro por extenso: 2400 → "dois mil e quatrocentos". Com `feminino`,
 * "duas", "uma", "duzentas" (ex.: parcelas). Até 999 bilhões.
 */
export function numeroPorExtenso(n: number, feminino = false): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e12)
    throw new Error("Número fora do intervalo do extenso");
  if (n === 0) return "zero";
  const grupos: number[] = [];
  for (let r = n; r > 0; r = Math.floor(r / 1000)) grupos.push(r % 1000);
  const partes: { texto: string; valor: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i] as number;
    if (!g) continue;
    const [sing, plural] = ESCALAS[i] as [string, string];
    // Milhão e bilhão são masculinos: "duas mil parcelas", "dois milhões de parcelas".
    const fem = feminino && i <= 1;
    const texto =
      i === 0
        ? ate999(g, fem)
        : i === 1 && g === 1
          ? "mil"
          : `${ate999(g, i === 1 ? fem : false)} ${g === 1 ? sing : plural}`;
    partes.push({ texto, valor: g });
  }
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda.
  return partes
    .map((p, i) => {
      if (i === 0) return p.texto;
      const ultimo = i === partes.length - 1;
      const comE = ultimo && (p.valor < 100 || p.valor % 100 === 0);
      return `${comE ? "e " : ""}${p.texto}`;
    })
    .join(" ");
}

/** Divide em inteiro e centésimos sem erro de ponto flutuante. */
function partesDe(valor: number): [inteiro: number, centesimos: number] {
  const centavos = Math.round(Math.abs(valor) * 100);
  return [Math.floor(centavos / 100), centavos % 100];
}

/** "de" antes da unidade quando o número termina em milhão/bilhão redondo. */
const comDe = (n: number) => n >= 1e6 && n % 1e6 === 0;

/** 2400 → "dois mil e quatrocentos reais"; 0,5 → "cinquenta centavos". */
export function reaisPorExtenso(valor: number): string {
  if (valor < 0) throw new Error("Valor negativo não vai por extenso");
  const [reais, centavos] = partesDe(valor);
  const partes: string[] = [];
  if (reais || !centavos)
    partes.push(
      `${numeroPorExtenso(reais)}${comDe(reais) ? " de" : ""} ${reais === 1 ? "real" : "reais"}`,
    );
  if (centavos)
    partes.push(
      `${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`,
    );
  return partes.join(" e ");
}

/** "2.400,00 (dois mil e quatrocentos reais)". */
export function valorPorExtenso(valor: number): string {
  return `${formatarNumero(valor, 2)} (${reaisPorExtenso(valor)})`;
}

/** 30,5 → "trinta metros e cinquenta centímetros quadrados". */
export function metrosPorExtenso(area: number): string {
  if (area < 0) throw new Error("Área negativa não vai por extenso");
  const [m, cm] = partesDe(area);
  const partes: string[] = [];
  if (m || !cm)
    partes.push(
      `${numeroPorExtenso(m)}${comDe(m) ? " de" : ""} ${m === 1 ? "metro" : "metros"}`,
    );
  if (cm)
    partes.push(
      `${numeroPorExtenso(cm)} ${cm === 1 ? "centímetro" : "centímetros"}`,
    );
  const um = partes.length === 1 && (m === 1 || (!m && cm === 1));
  return `${partes.join(" e ")} ${um ? "quadrado" : "quadrados"}`;
}

/** "30,50 m² (trinta metros e cinquenta centímetros quadrados)". */
export function areaPorExtenso(area: number): string {
  return `${formatarNumero(area, 2)} m² (${metrosPorExtenso(area)})`;
}

/**
 * Quantidade com a unidade: (36, "mês", "meses") → "36 (trinta e seis)
 * meses"; com `feminino`, "2 (duas) parcelas".
 */
export function quantidadePorExtenso(
  n: number,
  singular: string,
  plural: string,
  feminino = false,
): string {
  return `${formatarNumero(n)} (${numeroPorExtenso(n, feminino)}) ${n === 1 ? singular : plural}`;
}

/** "36 (trinta e seis) meses". */
export const mesesPorExtenso = (n: number) =>
  quantidadePorExtenso(n, "mês", "meses");

/** "30 (trinta) dias"; com `uteis`, "30 (trinta) dias úteis". */
export const diasPorExtenso = (n: number, uteis = false) =>
  quantidadePorExtenso(
    n,
    uteis ? "dia útil" : "dia",
    uteis ? "dias úteis" : "dias",
  );

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "2026-11-04" → "4 de novembro de 2026" (dia 1 vira "1º"). */
export function dataPorExtenso(data: string): string {
  const [a, m, d] = data.slice(0, 10).split("-").map(Number) as [
    number,
    number,
    number,
  ];
  return `${d === 1 ? "1º" : d} de ${MESES[m - 1]} de ${a}`;
}
