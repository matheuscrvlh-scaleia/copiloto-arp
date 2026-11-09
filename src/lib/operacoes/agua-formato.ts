// Rótulos, campos e formato da água: o que a tela (inclusive no navegador)
// precisa sem carregar o leitor de planilha. src/lib/operacoes/agua.ts reexporta.

export const TIPOS_AGUA = ["FATURADO", "MINIMO", "ZERO", "REFATURADO"] as const;
export type TipoAgua = (typeof TIPOS_AGUA)[number];

/** Como o tipo aparece na tela (o arquivo traz "MÍNIMO" e "0"). */
export const ROTULO_TIPO: Record<TipoAgua, string> = {
  FATURADO: "Faturado",
  MINIMO: "Mínimo",
  ZERO: "0 (sem cobrança)",
  REFATURADO: "Refaturado",
};

export const CAMPOS_AGUA = {
  referencia: { rotulo: "Referência", obrigatorio: false },
  bloco: { rotulo: "Bloco", obrigatorio: false },
  sala: { rotulo: "Sala ou unidade", obrigatorio: true },
  cliente: { rotulo: "Cliente", obrigatorio: false },
  hidrometro: { rotulo: "Nº do hidrômetro", obrigatorio: true },
  data_anterior: { rotulo: "Data da leitura anterior", obrigatorio: false },
  leitura_anterior: { rotulo: "Leitura anterior (m³)", obrigatorio: true },
  data_atual: { rotulo: "Data da leitura atual", obrigatorio: false },
  leitura_atual: { rotulo: "Leitura atual (m³)", obrigatorio: true },
  dias: { rotulo: "Dias", obrigatorio: false },
  consumo: { rotulo: "Consumo medido (m³)", obrigatorio: true },
  volume_faturado: { rotulo: "Volume faturado (m³)", obrigatorio: true },
  valor: { rotulo: "Valor faturado (R$)", obrigatorio: true },
  tipo: { rotulo: "Tipo de faturamento", obrigatorio: true },
} as const;
export type CampoAgua = keyof typeof CAMPOS_AGUA;
export const LISTA_CAMPOS = Object.keys(CAMPOS_AGUA) as CampoAgua[];

export const MESES_ABREV = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
] as const;

/** "2026-09-01" → "SET/26" (como o arquivo do parceiro escreve). */
export function rotuloMes(referencia: string): string {
  const [a, m] = referencia.split("-");
  return `${MESES_ABREV[Number(m) - 1] ?? "?"}/${a?.slice(2) ?? ""}`;
}

const m3 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 102.943 → "102,94 m³" (volumes com duas casas, spec 4.3). */
export function formatarM3(valor: number | null): string {
  return valor === null ? "—" : `${m3.format(valor)} m³`;
}

/** Leitura em formato de visor: 1632.06 → "1632,06" (sem milhar). */
export function formatarVisor(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toFixed(2).replace(".", ",");
}

/** Sem acento, minúsculo, só letras, números e espaço simples. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
