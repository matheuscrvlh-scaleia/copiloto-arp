import { CODIGOS_ALERTA, type CodigoAlerta } from "./agua-alertas";
import { alertasDoPainel, cartoesDoPainel, type LinhaDoPainel } from "./diario";
import { ROTULO_ENVIO, type SituacaoEnvio } from "./limpeza";

// Painel de Operações (spec 4.10): o resumo de cada área num cartão.
// Funções puras. As regras de cada área (alertas da água, prazo do envio da
// limpeza, prazo e desvio do Diário) NÃO são refeitas aqui: o painel recebe o
// que as funções das áreas já calcularam e só soma, para bater com as telas.
// Dinheiro em centavos inteiros.

export { mesAnterior } from "./limpeza";

/** "aaaa-mm-01" do mês de uma data "aaaa-mm-dd". */
export const mesDe = (data: string) => `${data.slice(0, 7)}-01`;

/** Reais (número ou texto do banco) → centavos inteiros (meio centavo para cima). */
export function centavos(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === "") return 0;
  return Math.round(Number(v) * 100);
}

/** Variação % de `atual` sobre `anterior` (null sem base). */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}

// ---------------------------------------------------------------------------
// Água
// ---------------------------------------------------------------------------

export interface ResumoDosAlertas {
  /** Leituras com algum alerta mais os hidrômetros que sumiram (como o cartão da tela de Água). */
  total: number;
  porTipo: Record<CodigoAlerta, number>;
  sumidos: number;
}

/**
 * Conta os alertas que a tela de Água já calculou (alertasDaLeitura e
 * sumidos, em mesDaAgua): o Painel só soma, para os números baterem.
 */
export function resumoDosAlertas(
  leituras: { alertas: { codigo: CodigoAlerta }[] }[],
  sumidos: number,
): ResumoDosAlertas {
  const porTipo = Object.fromEntries(
    CODIGOS_ALERTA.map((c) => [c, 0]),
  ) as Record<CodigoAlerta, number>;
  let comAlerta = 0;
  for (const l of leituras) {
    for (const c of new Set(l.alertas.map((a) => a.codigo))) porTipo[c]++;
    if (l.alertas.length) comAlerta++;
  }
  return { total: comAlerta + sumidos, porTipo, sumidos };
}

interface LinhaDeConsumo {
  bloco: string;
  consumo: number;
}

/** Consumo (m³) por bloco no mês e no anterior, do maior para o menor. */
export function consumoPorBloco(
  atual: LinhaDeConsumo[],
  anterior: LinhaDeConsumo[],
): { bloco: string; atual: number; anterior: number }[] {
  const blocos = new Map<string, { atual: number; anterior: number }>();
  const somar = (linhas: LinhaDeConsumo[], campo: "atual" | "anterior") => {
    for (const l of linhas) {
      const b = blocos.get(l.bloco) ?? { atual: 0, anterior: 0 };
      // Milésimos de m³ inteiros: a soma não acumula erro de ponto flutuante.
      b[campo] =
        (Math.round(b[campo] * 1000) + Math.round(Number(l.consumo) * 1000)) /
        1000;
      blocos.set(l.bloco, b);
    }
  };
  somar(atual, "atual");
  somar(anterior, "anterior");
  return [...blocos.entries()]
    .map(([bloco, v]) => ({ bloco, ...v }))
    .sort((a, b) => b.atual - a.atual || a.bloco.localeCompare(b.bloco));
}

/** Soma de m³ sem erro de ponto flutuante (milésimos inteiros). */
export const somaM3 = (valores: (number | string)[]) =>
  valores.reduce<number>((s, v) => s + Math.round(Number(v) * 1000), 0) / 1000;

// ---------------------------------------------------------------------------
// Energia: ocupação das caixas por bloco
// ---------------------------------------------------------------------------

export interface QuadroResumo {
  bloco: string;
  caixas: number;
  ocupadas: number;
  reservadas: number;
  livres: number;
  semTermo: number;
}

/** Soma os quadros de cada bloco; ocupação = ocupadas ÷ caixas. */
export function ocupacaoPorBloco(quadros: QuadroResumo[]): (QuadroResumo & {
  ocupacaoPct: number | null;
})[] {
  const blocos = new Map<string, QuadroResumo>();
  for (const q of quadros) {
    const b = blocos.get(q.bloco) ?? {
      bloco: q.bloco,
      caixas: 0,
      ocupadas: 0,
      reservadas: 0,
      livres: 0,
      semTermo: 0,
    };
    b.caixas += q.caixas;
    b.ocupadas += q.ocupadas;
    b.reservadas += q.reservadas;
    b.livres += q.livres;
    b.semTermo += q.semTermo;
    blocos.set(q.bloco, b);
  }
  return [...blocos.values()]
    .sort((a, b) => a.bloco.localeCompare(b.bloco))
    .map((b) => ({
      ...b,
      ocupacaoPct: b.caixas ? (b.ocupadas / b.caixas) * 100 : null,
    }));
}

// ---------------------------------------------------------------------------
// Rateio da limpeza
// ---------------------------------------------------------------------------

export type SituacaoRateio =
  | "enviado"
  | "historico"
  | "fechado"
  | "aberto"
  | "incompleto"
  | "atrasado";

export const ROTULO_RATEIO: Record<SituacaoRateio, string> = {
  enviado: ROTULO_ENVIO.enviado,
  historico: ROTULO_ENVIO.historico,
  fechado: "Fechado, falta enviar",
  aberto: "Aberto",
  incompleto: "Incompleto",
  atrasado: ROTULO_ENVIO.atrasado,
};

/**
 * Situação do mês no painel, a partir da situação do envio que a tela da
 * Limpeza calcula (situacaoDoEnvio: prazo com o calendário dos Chamados;
 * mês importado e não enviado é histórico, não atraso) e do status do mês.
 */
export function situacaoDoRateio(m: {
  status: "aberto" | "fechado";
  incompleto: boolean;
  envio: SituacaoEnvio;
}): SituacaoRateio {
  if (m.envio === "enviado" || m.envio === "enviado_atrasado") return "enviado";
  if (m.envio === "historico") return "historico";
  if (m.envio === "atrasado") return "atrasado";
  if (m.incompleto) return "incompleto";
  return m.status === "fechado" ? "fechado" : "aberto";
}

// ---------------------------------------------------------------------------
// Obras: previsto × realizado (financeiro) e Diário de Obra (físico)
// ---------------------------------------------------------------------------

export interface ObraFinanceira {
  orcamentoCentavos: number;
  previstoAteCentavos: number;
  realizadoCentavos: number;
}

/**
 * Saldo (orçamento − realizado) e desvio do realizado contra o previsto até
 * o mês (%). Alerta quando o desvio passa do limite de Parâmetros
 * (obras_limite_orcamento_pct), para mais ou para menos.
 */
export function situacaoFinanceira(
  o: ObraFinanceira,
  limitePct: number,
): {
  saldoCentavos: number;
  desvioPct: number | null;
  /** Realizado ÷ previsto até o mês (1 = em dia). */
  indice: number | null;
  alerta: boolean;
} {
  const desvio = variacao(o.realizadoCentavos, o.previstoAteCentavos);
  return {
    saldoCentavos: o.orcamentoCentavos - o.realizadoCentavos,
    desvioPct: desvio,
    indice: o.previstoAteCentavos
      ? o.realizadoCentavos / o.previstoAteCentavos
      : null,
    alerta: desvio !== null && Math.abs(desvio) > limitePct,
  };
}

export interface ObraNoDiario {
  id: string;
  nome: string;
  statusId: number;
  avancoPct: number | null;
  prazoPct: number | null;
  desvio: number | null;
  vencido: boolean;
  alerta: boolean;
}

// O painel só conta os alertas: o texto não aparece.
const SEM_TEXTO = { pct: String, pontos: String, data: String };

/**
 * Resumo do Diário de Obra com as mesmas contas da tela do Diário
 * (linhasDoPainel: prazoConsumido, desvioFisico, prazoVencido; alertas de
 * alertasDoPainel, incluindo dias sem relatório).
 */
export function resumoDoDiario(
  linhas: LinhaDoPainel[],
  limiteDesvio: number,
): {
  obras: ObraNoDiario[];
  emAndamento: number;
  vencidas: number;
  aAprovar: number;
  comAlerta: number;
} {
  const comAlerta = new Set(
    alertasDoPainel(linhas, limiteDesvio, SEM_TEXTO).map((a) => a.obraId),
  );
  const c = cartoesDoPainel(linhas);
  return {
    obras: linhas.map((l) => ({
      id: l.obra.id,
      nome: l.obra.nome,
      statusId: l.obra.statusId,
      avancoPct: l.obra.realizado,
      prazoPct: l.consumido,
      desvio: l.desvio,
      vencido: l.vencido,
      alerta: comAlerta.has(l.obra.id),
    })),
    emAndamento: c.emAndamento,
    vencidas: c.vencidas,
    aAprovar: c.aAprovar,
    comAlerta: comAlerta.size,
  };
}
