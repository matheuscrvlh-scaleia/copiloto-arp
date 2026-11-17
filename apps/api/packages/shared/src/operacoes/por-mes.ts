import { type Vinculo, vinculoDoMes } from "./agua-alertas";
import type { FaturaConta, UnidadeEnergia } from "./energisa-contas";
import { somaM3 } from "./painel";
import { type FonteSolar, gera, geracaoDoMes } from "./solar";

// Água e geração solar mês a mês, para outros módulos (o painel do
// Sustentabilidade). As mesmas regras das telas de Operações: leituras
// vigentes com a correção de vínculo (bloco que vale no mês) e geração pela
// fonte escolhida (fatura da unidade geradora ou inversor). Mês sem dado não
// entra na lista (nada de zero inventado).

const MES = /^\d{4}-(0[1-9]|1[0-2])-01$/;

/** Confere o período ("aaaa-mm-01", de <= até). */
export function conferirPeriodo(deMes: string, ateMes: string): void {
  if (!MES.test(deMes) || !MES.test(ateMes) || deMes > ateMes)
    throw new RangeError(`período inválido: ${deMes} a ${ateMes}`);
}

export interface AguaDoMes {
  /** aaaa-mm-01 */
  mes: string;
  m3_total: number;
  /** m³ por bloco (o bloco que vale no mês, com a correção de vínculo). */
  por_bloco: Record<string, number>;
  /** Alguma importação confirmada do mês foi marcada incompleta. */
  incompleta: boolean;
  exemplo: boolean;
}

export interface LeituraDaAgua {
  referencia: string;
  hidrometro: string;
  bloco: string;
  consumo: number | string;
  exemplo: boolean;
}

/** Soma as leituras vigentes por mês e por bloco. */
export function aguaPorMes(
  leituras: LeituraDaAgua[],
  vinculos: Vinculo[],
  importacoes: { referencia: string; incompleta: boolean }[],
): AguaDoMes[] {
  const meses = new Map<string, LeituraDaAgua[]>();
  for (const l of leituras) {
    const bloco =
      vinculoDoMes(vinculos, l.hidrometro, l.referencia)?.bloco ?? l.bloco;
    const lista = meses.get(l.referencia) ?? [];
    lista.push({ ...l, bloco });
    meses.set(l.referencia, lista);
  }
  return [...meses.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, ls]) => {
      const blocos = new Map<string, (number | string)[]>();
      for (const l of ls)
        blocos.set(l.bloco, [...(blocos.get(l.bloco) ?? []), l.consumo]);
      return {
        mes,
        m3_total: somaM3(ls.map((l) => l.consumo)),
        por_bloco: Object.fromEntries(
          [...blocos.entries()]
            .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
            .map(([b, v]) => [b, somaM3(v)]),
        ),
        incompleta: importacoes.some(
          (i) => i.referencia === mes && i.incompleta,
        ),
        exemplo: ls.some((l) => l.exemplo),
      };
    });
}

export interface SolarDoMes {
  /** aaaa-mm-01 */
  mes: string;
  /**
   * Geração (kWh): energia injetada lida nas faturas das unidades geradoras
   * ou, com o inversor, a soma dos dias lidos da Growatt.
   */
  kwh: number;
  /** Sem fator de emissão cadastrado em Operações: sempre null. */
  co2_t: null;
  /** Leitura mais recente: da fatura ou o último dia lido do inversor. */
  ultima_leitura: string | null;
  exemplo: boolean;
}

export type FaturaDaGeracao = Pick<
  FaturaConta,
  "matricula" | "referencia" | "injetada_kwh" | "exemplo"
> & { leitura_atual_data: string | null };

/**
 * Geração de cada mês (geracaoDoMes, a regra da tela de Energia solar). Só
 * os meses com geração lida; com a fonte fora da fatura da geradora, nenhum.
 */
export function solarPorMes(
  faturas: FaturaDaGeracao[],
  unidades: Map<string, Pick<UnidadeEnergia, "papel">>,
  fonte: FonteSolar,
): SolarDoMes[] {
  const meses = [...new Set(faturas.map((f) => f.referencia))].sort();
  return meses.flatMap((mes): SolarDoMes[] => {
    const doMes = faturas.filter((f) => f.referencia === mes);
    const kwh = geracaoDoMes(doMes, unidades, fonte);
    if (kwh === null) return [];
    const lidas = doMes.filter(
      (f) => gera(unidades.get(f.matricula)?.papel) && f.injetada_kwh !== null,
    );
    const datas = lidas
      .map((f) => f.leitura_atual_data)
      .filter((d): d is string => !!d)
      .sort();
    return [
      {
        mes,
        kwh: Math.round(kwh * 100) / 100,
        co2_t: null,
        ultima_leitura: datas.at(-1) ?? null,
        exemplo: lidas.some((f) => f.exemplo),
      },
    ];
  });
}

/** Geração de um mês lida do inversor (soma dos dias, feita no banco). */
export interface MesDoInversor {
  /** aaaa-mm-01 */
  mes: string;
  kwh: number;
  /** Último dia lido no mês (aaaa-mm-dd). */
  ultimo_dia: string;
}

/**
 * Geração de cada mês pelo inversor, no formato do painel: só os meses com
 * algum dia lido, em ordem.
 */
export function solarDoInversor(meses: MesDoInversor[]): SolarDoMes[] {
  return [...meses]
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map((m) => ({
      mes: m.mes,
      kwh: Math.round(m.kwh * 100) / 100,
      co2_t: null,
      ultima_leitura: m.ultimo_dia,
      exemplo: false,
    }));
}
