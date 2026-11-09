import {
  type FaturaConta,
  type Papel,
  somarReais,
  type UnidadeEnergia,
} from "./energisa-contas";

// Energia solar (spec 4.13), só consulta. Os números saem das faturas da
// Energisa já importadas: compensação (itens "Energia Atv Injetada", com a
// origem oUC/mUC e o mês de geração), saldo de créditos e o que expira no
// próximo ciclo. A geração das usinas depende da fonte escolhida em
// Parâmetros (operacoes.parametros.solar_fonte); só "fatura da unidade
// geradora" já tem de onde ler (a energia injetada do medidor).

export const FONTES_SOLAR = {
  a_confirmar: "a confirmar com a Sustentabilidade",
  inversor: "portal do inversor",
  planilha: "planilha mensal",
  fatura_geradora: "fatura da unidade geradora",
} as const;
export type FonteSolar = keyof typeof FONTES_SOLAR;

export const ehFonteSolar = (v: string): v is FonteSolar => v in FONTES_SOLAR;

export const gera = (papel: Papel | undefined) =>
  papel === "gera" || papel === "gera_e_consome";

/**
 * Geração do mês (kWh) ou null quando não há de onde ler: fonte ainda a
 * confirmar, fonte ainda não ligada (inversor, planilha) ou nenhuma fatura de
 * unidade geradora com a energia injetada no mês.
 */
export function geracaoDoMes(
  doMes: FaturaConta[],
  unidades: Map<string, Pick<UnidadeEnergia, "papel">>,
  fonte: FonteSolar,
): number | null {
  if (fonte !== "fatura_geradora") return null;
  const lidas = doMes.filter(
    (f) => gera(unidades.get(f.matricula)?.papel) && f.injetada_kwh !== null,
  );
  if (!lidas.length) return null;
  return lidas.reduce((s, f) => s + (f.injetada_kwh ?? 0), 0);
}

export interface ResumoSolar {
  geracao: number | null;
  compensadoKwh: number;
  valorCompensado: number;
  saldoKwh: number;
  expirarKwh: number;
  /** Unidades com crédito a expirar no próximo ciclo. */
  aExpirar: { matricula: string; kwh: number }[];
}

export function resumoSolar(
  doMes: FaturaConta[],
  unidades: Map<string, Pick<UnidadeEnergia, "papel">>,
  fonte: FonteSolar,
): ResumoSolar {
  const soma = (v: (number | null)[]) =>
    Math.round(v.reduce<number>((s, x) => s + (x ?? 0), 0) * 100) / 100;
  return {
    geracao: geracaoDoMes(doMes, unidades, fonte),
    compensadoKwh: soma(doMes.map((f) => f.compensado_kwh)),
    valorCompensado: somarReais(doMes.map((f) => f.valor_compensado)),
    saldoKwh: soma(doMes.map((f) => f.saldo_kwh)),
    expirarKwh: soma(doMes.map((f) => f.expirar_kwh)),
    aExpirar: doMes
      .filter((f) => (f.expirar_kwh ?? 0) > 0)
      .map((f) => ({ matricula: f.matricula, kwh: f.expirar_kwh ?? 0 })),
  };
}

/** Geração (null sem fonte) e compensação de cada mês. */
export function serieSolar(
  faturas: FaturaConta[],
  meses: string[],
  unidades: Map<string, Pick<UnidadeEnergia, "papel">>,
  fonte: FonteSolar,
): { geracao: (number | null)[]; compensacao: (number | null)[] } {
  const doMes = (m: string) => faturas.filter((f) => f.referencia === m);
  return {
    geracao: meses.map((m) => geracaoDoMes(doMes(m), unidades, fonte)),
    compensacao: meses.map((m) => {
      const fs = doMes(m);
      return fs.length
        ? Math.round(fs.reduce((s, f) => s + f.compensado_kwh, 0) * 100) / 100
        : null;
    }),
  };
}

/** Item "Energia Atv Injetada" de uma fatura vigente do mês. */
export interface ItemCredito {
  matricula: string;
  origem: "oUC" | "mUC" | null;
  mes_geracao: string | null;
  quantidade: number | null;
  valor: number;
}

export interface CreditoPorOrigem {
  matricula: string;
  origem: "oUC" | "mUC" | null;
  mesGeracao: string | null;
  kwh: number;
  /** Valor compensado (positivo). */
  valor: number;
}

/** Créditos usados no mês por unidade, origem e mês de geração (kWh e R$ positivos). */
export function creditosPorOrigem(itens: ItemCredito[]): CreditoPorOrigem[] {
  const grupos = new Map<string, CreditoPorOrigem & { centavos: number }>();
  for (const i of itens) {
    const chave = `${i.matricula}|${i.origem ?? ""}|${i.mes_geracao ?? ""}`;
    const g = grupos.get(chave) ?? {
      matricula: i.matricula,
      origem: i.origem,
      mesGeracao: i.mes_geracao,
      kwh: 0,
      valor: 0,
      centavos: 0,
    };
    g.kwh += Math.abs(i.quantidade ?? 0);
    g.centavos += Math.abs(Math.round(i.valor * 100));
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .map(({ centavos, ...g }) => ({
      ...g,
      kwh: Math.round(g.kwh * 100) / 100,
      valor: centavos / 100,
    }))
    .sort(
      (a, b) =>
        a.matricula.localeCompare(b.matricula) ||
        (a.origem ?? "").localeCompare(b.origem ?? "") ||
        (b.mesGeracao ?? "").localeCompare(a.mesGeracao ?? ""),
    );
}

/** De onde vem a geração e o que falta, em português simples. */
export function situacaoDaFonte(
  fonte: FonteSolar,
  temGeradora: boolean,
  geracaoLida: boolean,
): { completa: boolean; texto: string } {
  const faturas =
    "Compensação, saldo e créditos a expirar vêm das faturas da Energisa importadas em Operações › Importações.";
  if (fonte === "a_confirmar")
    return {
      completa: false,
      texto: `Geração das usinas não informada: a fonte (portal do inversor, planilha ou fatura da unidade geradora) está a confirmar com a Sustentabilidade. ${faturas}`,
    };
  if (fonte !== "fatura_geradora")
    return {
      completa: false,
      texto: `Geração não informada: a fonte escolhida em Parâmetros (${FONTES_SOLAR[fonte]}) ainda não está ligada ao sistema. ${faturas}`,
    };
  if (!temGeradora)
    return {
      completa: false,
      texto: `Geração não informada: a fonte é a fatura da unidade geradora, mas nenhuma unidade está cadastrada como geradora (Parâmetros › Energia solar). ${faturas}`,
    };
  if (!geracaoLida)
    return {
      completa: false,
      texto: `Geração não informada neste mês: a fatura da unidade geradora não foi importada ou não traz a energia injetada. ${faturas}`,
    };
  return {
    completa: true,
    texto: `Geração = energia injetada na rede, lida do medidor na fatura da unidade geradora (não inclui o que a própria usina consumiu na hora). ${faturas}`,
  };
}
