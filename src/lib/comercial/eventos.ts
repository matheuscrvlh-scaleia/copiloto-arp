import {
  type CalendarioUtil,
  diaEmBrasilia,
  ehDiaUtil,
  somarDias,
} from "@/lib/comercial/datas";

// Simulador e proposta de eventos (spec 4.15). Tudo vem da tabela de
// faixas e dos parâmetros: valor por dia = valor por m² da faixa × área
// (na faixa fixa, o valor do dia); valor = por dia × dias; desconto da
// condição comercial; seguranças e agentes de limpeza arredondando para
// cima. Proposta não é receita: a realizada vem do ENET.

export type TipoData = "comum" | "sazonal";
export const TIPOS_DATA: Record<TipoData, string> = {
  comum: "Dias comuns",
  sazonal: "Datas sazonais",
};

export type StatusProposta = "rascunho" | "enviada" | "fechada" | "perdida";
export const STATUS_PROPOSTA: Record<StatusProposta, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  fechada: "Fechada",
  perdida: "Perdida",
};

export interface FaixaPreco {
  ordem: number;
  nome: string;
  area_de: number;
  area_ate: number;
  fixo: boolean;
  valor_comum: number;
  valor_sazonal: number;
}

export interface RegrasEvento {
  pessoasPorSeguranca: number;
  m2PorAgente: number;
}

export interface EntradaSimulacao {
  tipo: TipoData;
  area: number;
  dias: number;
  /** Desconto da condição comercial, em %. */
  descontoPct: number;
  pessoas: number;
}

export interface Simulacao {
  faixa: FaixaPreco;
  /** Valor da faixa: por m² por dia, ou o valor do dia na faixa fixa. */
  preco: number;
  valorDia: number;
  valor: number;
  desconto: number;
  final: number;
  segurancas: number;
  agentes: number;
  /** Área acima da última faixa: usa a última e avisa. */
  acimaDaTabela: boolean;
}

const centavos = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/**
 * Faixa da área: a fixa vale até o "até" dela; as outras, de (exclusive)
 * até (inclusive). Acima da tabela, a última.
 */
export function faixaDaArea(
  faixas: FaixaPreco[],
  area: number,
): FaixaPreco | null {
  if (!(area > 0) || faixas.length === 0) return null;
  const ordenadas = [...faixas].sort((a, b) => a.ordem - b.ordem);
  const fixa = ordenadas.find((f) => f.fixo && area <= f.area_ate);
  if (fixa) return fixa;
  const porM2 = ordenadas.filter((f) => !f.fixo);
  return (
    porM2.find((f) => area > f.area_de && area <= f.area_ate) ??
    porM2.find((f) => area <= f.area_ate) ??
    porM2.at(-1) ??
    null
  );
}

export function simular(
  faixas: FaixaPreco[],
  regras: RegrasEvento,
  e: EntradaSimulacao,
): Simulacao | null {
  const faixa = faixaDaArea(faixas, e.area);
  if (!faixa || !(e.dias > 0)) return null;
  const preco = e.tipo === "sazonal" ? faixa.valor_sazonal : faixa.valor_comum;
  const valorDia = centavos(faixa.fixo ? preco : preco * e.area);
  const valor = centavos(valorDia * e.dias);
  const pct = Math.min(Math.max(e.descontoPct, 0), 100);
  const desconto = centavos((valor * pct) / 100);
  return {
    faixa,
    preco,
    valorDia,
    valor,
    desconto,
    final: centavos(valor - desconto),
    segurancas: Math.ceil(Math.max(e.pessoas, 0) / regras.pessoasPorSeguranca),
    agentes: Math.ceil(e.area / regras.m2PorAgente),
    acimaDaTabela: e.area > Math.max(...faixas.map((f) => f.area_ate)),
  };
}

/** Valores da proposta: parceria = após a condição; final = menos a 1ª edição. */
export function valoresDaProposta(
  s: Simulacao,
  descontoPrimeiraEdicao: number,
) {
  const primeira = centavos(
    Math.min(Math.max(descontoPrimeiraEdicao, 0), s.final),
  );
  return {
    valor_original: s.valor,
    valor_parceria: s.final,
    desconto_primeira_edicao: primeira,
    valor_final: centavos(s.final - primeira),
  };
}

/** O n-ésimo dia útil antes de `data` (fechamento máximo da proposta). */
export function diasUteisAntes(
  data: string,
  n: number,
  cal: CalendarioUtil,
): string {
  if (cal.diasUteis.length === 0) throw new Error("Calendário sem dias úteis");
  let d = data;
  for (let faltam = n; faltam > 0; ) {
    d = somarDias(d, -1);
    if (ehDiaUtil(d, cal)) faltam--;
  }
  return d;
}

export interface PropostaResumo {
  criado_em: string;
  status: string;
  valor_final: number;
}

/** Cartões: propostas criadas no mês, fechadas e valor fechado (da lista). */
export function resumoDasPropostas(
  propostas: PropostaResumo[],
  mes: string,
): { noMes: number; fechadas: number; valorFechado: number } {
  const fechadas = propostas.filter((p) => p.status === "fechada");
  return {
    noMes: propostas.filter(
      (p) => diaEmBrasilia(p.criado_em).slice(0, 7) === mes.slice(0, 7),
    ).length,
    fechadas: fechadas.length,
    valorFechado: centavos(fechadas.reduce((s, p) => s + p.valor_final, 0)),
  };
}
