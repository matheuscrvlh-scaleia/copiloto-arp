import { fimDoMesDe, somarMeses } from "@/lib/comercial/datas";
import type { FontesEnet } from "@/lib/comercial/fontes";
import { ocupacaoPelosContratos, valorPorM2 } from "@/lib/comercial/painel";
import { formatarNumero } from "@/lib/formato";

// Pesquisa de mercado (spec 4.16): faixa de tamanho, o resumo por bairro
// (como a aba Resumo) e o valor por m² da ARP para comparar. Só locação.
// "Médio" é a média simples dos imóveis (valor por m² e custo por m²
// médios = média do valor de cada imóvel, como a média da coluna na
// planilha). Condomínio e IPTU em branco ficam fora da média deles.

/** Limites das faixas (parâmetro, ex. [30, 50, 80, 100]) → rótulos. */
export function faixasDeTamanho(limites: number[]): string[] {
  const l = [...limites].sort((a, b) => a - b);
  return [
    ...l.map((m) => `Até ${formatarNumero(m)} m²`),
    `Acima de ${formatarNumero(l.at(-1) ?? 0)} m²`,
  ];
}

/** "Até 30 m²" … "Acima de 100 m²" (até = inclusive). */
export function faixaDeTamanho(area: number, limites: number[]): string {
  const l = [...limites].sort((a, b) => a - b);
  const limite = l.find((m) => area <= m);
  return limite === undefined
    ? `Acima de ${formatarNumero(l.at(-1) ?? 0)} m²`
    : `Até ${formatarNumero(limite)} m²`;
}

export interface ImovelDoResumo {
  bairro: string;
  area_m2: number;
  aluguel: number;
  condominio: number | null;
  iptu: number | null;
}

export interface LinhaResumo {
  bairro: string;
  quantidade: number;
  areaMedia: number;
  aluguelMedio: number;
  condominioMedio: number | null;
  iptuMedio: number | null;
  valorM2Medio: number;
  custoTotalMedio: number;
  custoM2Medio: number;
}

const media = (v: number[]) =>
  v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;

const custo = (i: ImovelDoResumo) =>
  i.aluguel + (i.condominio ?? 0) + (i.iptu ?? 0);

/** Uma linha com as médias de um grupo de imóveis (não vazio). */
export function linhaDoResumo(
  bairro: string,
  imoveis: ImovelDoResumo[],
): LinhaResumo {
  const de = (f: (i: ImovelDoResumo) => number) => media(imoveis.map(f)) ?? 0;
  const informados = (f: (i: ImovelDoResumo) => number | null) =>
    media(imoveis.map(f).filter((v): v is number => v !== null));
  return {
    bairro,
    quantidade: imoveis.length,
    areaMedia: de((i) => i.area_m2),
    aluguelMedio: de((i) => i.aluguel),
    condominioMedio: informados((i) => i.condominio),
    iptuMedio: informados((i) => i.iptu),
    valorM2Medio: de((i) => i.aluguel / i.area_m2),
    custoTotalMedio: de(custo),
    custoM2Medio: de((i) => custo(i) / i.area_m2),
  };
}

/** Por bairro, do que tem mais imóveis para o que tem menos. */
export function resumoPorBairro(imoveis: ImovelDoResumo[]): LinhaResumo[] {
  const grupos = new Map<string, ImovelDoResumo[]>();
  for (const i of imoveis)
    grupos.set(i.bairro, [...(grupos.get(i.bairro) ?? []), i]);
  return [...grupos.entries()]
    .map(([b, lista]) => linhaDoResumo(b, lista))
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade ||
        a.bairro.localeCompare(b.bairro, "pt-BR"),
    );
}

// ---------------------------------------------------------------------------
// Período (filtro): todos, últimos 12 meses ou um ano
// ---------------------------------------------------------------------------

export const PERIODO_12_MESES = "12m";

export function dentroDoPeriodo(
  data: string,
  periodo: string,
  hoje: string,
): boolean {
  if (!periodo) return true;
  if (periodo === PERIODO_12_MESES)
    return data > somarMeses(hoje, -12) && data <= hoje;
  return /^\d{4}$/.test(periodo) ? data.startsWith(periodo) : true;
}

export function rotuloDoPeriodo(periodo: string): string {
  if (!periodo) return "Todos";
  return periodo === PERIODO_12_MESES ? "Últimos 12 meses" : periodo;
}

// ---------------------------------------------------------------------------
// Linha "ARP": o valor por m² do Painel (spec 4.10)
// ---------------------------------------------------------------------------

export interface ValorM2Arp {
  /** "aaaa-mm-01" do último mês fechado. */
  mes: string;
  faturamento: number;
  ablLocada: number;
  /** null sem ABL locada. */
  valor: number | null;
}

/**
 * Mesma regra do Painel (lib/comercial/painel): faturamento do último mês
 * fechado (contas a receber do ENET) ÷ ABL locada no fim dele, pelos
 * contratos em vigor nos tipos de LUC que contam na ocupação.
 */
export function valorM2DoPainel(
  enet: Pick<FontesEnet, "lucs" | "contratos" | "contasReceber">,
  tiposQueContam: ReadonlySet<string>,
  hoje: string,
): ValorM2Arp {
  const mes = somarMeses(`${hoje.slice(0, 7)}-01`, -1);
  const faturamento = enet.contasReceber
    .filter((c) => c.competencia === mes)
    .reduce((s, c) => s + c.valor_faturado, 0);
  const { ablLocada } = ocupacaoPelosContratos(
    enet.lucs,
    enet.contratos,
    tiposQueContam,
    fimDoMesDe(mes),
  );
  return {
    mes,
    faturamento,
    ablLocada,
    valor: valorPorM2(faturamento, ablLocada),
  };
}
