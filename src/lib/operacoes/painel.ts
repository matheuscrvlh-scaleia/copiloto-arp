import { type CalendarioUtil, somarDiasUteis } from "@/lib/comercial/datas";
import { ultimoDiaDoMes } from "@/lib/os/tempo";

// Painel de Operações (spec 4.10): as contas que resumem cada área num
// cartão. Funções puras: o servidor lê as tabelas (com o RLS de quem vê) e a
// tela só mostra. Dinheiro em centavos inteiros; percentuais com uma casa.

/** "aaaa-mm-01" do mês anterior. */
export function mesAnterior(referencia: string): string {
  const [a, m] = referencia.split("-").map(Number) as [number, number];
  const ano = m === 1 ? a - 1 : a;
  const mes = m === 1 ? 12 : m - 1;
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

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

export interface LeituraPainel {
  bloco: string;
  hidrometro: string;
  consumo: number;
  leitura_anterior: number | null;
  leitura_atual: number | null;
  foto: string | null;
}

export const ALERTAS_AGUA = {
  limite: "Consumo acima do limite",
  regressiva: "Leitura zerada ou menor que a anterior",
  sem_foto: "Leitura sem foto",
  sumido: "Hidrômetro do mês anterior que não veio",
} as const;
export type AlertaAgua = keyof typeof ALERTAS_AGUA;

/**
 * Alertas da água que dá para conferir só com as leituras (spec 4.4):
 * acima do limite, leitura regressiva ou zerada, sem foto e hidrômetro que
 * sumiu. O total conta leituras com algum alerta mais os sumidos.
 */
export function alertasDaAgua(
  atual: LeituraPainel[],
  anterior: LeituraPainel[],
  limiteM3: number,
): { total: number; porTipo: Record<AlertaAgua, number> } {
  const porTipo: Record<AlertaAgua, number> = {
    limite: 0,
    regressiva: 0,
    sem_foto: 0,
    sumido: 0,
  };
  let comAlerta = 0;
  for (const l of atual) {
    const tipos: AlertaAgua[] = [];
    if (Number(l.consumo) > limiteM3) tipos.push("limite");
    if (
      l.leitura_atual !== null &&
      (Number(l.leitura_atual) === 0 ||
        (l.leitura_anterior !== null &&
          Number(l.leitura_atual) < Number(l.leitura_anterior)))
    )
      tipos.push("regressiva");
    if (!l.foto) tipos.push("sem_foto");
    for (const t of tipos) porTipo[t]++;
    if (tipos.length) comAlerta++;
  }
  const deAgora = new Set(atual.map((l) => l.hidrometro));
  porTipo.sumido = new Set(
    anterior.map((l) => l.hidrometro).filter((h) => !deAgora.has(h)),
  ).size;
  return { total: comAlerta + porTipo.sumido, porTipo };
}

/** Consumo (m³) por bloco no mês e no anterior, do maior para o menor. */
export function consumoPorBloco(
  atual: Pick<LeituraPainel, "bloco" | "consumo">[],
  anterior: Pick<LeituraPainel, "bloco" | "consumo">[],
): { bloco: string; atual: number; anterior: number }[] {
  const blocos = new Map<string, { atual: number; anterior: number }>();
  const somar = (
    linhas: Pick<LeituraPainel, "bloco" | "consumo">[],
    campo: "atual" | "anterior",
  ) => {
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

/**
 * Total do rateio (spec 4.8): área comum (funcionários × valor por
 * funcionário + extras) mais os blocos (participação × rateados × valor por
 * funcionário). As participações somam 100%, então o total é valor por
 * funcionário × (área comum + rateados) + extras. Calculado em centavos com
 * o valor por funcionário sem arredondar, e arredondado uma vez no fim (como
 * a planilha). null: falta valor base ou funcionários.
 */
export function totalDoRateio(m: {
  valorBase: number | string | null;
  funcBase: number | null;
  funcAreaComum: number | null;
  funcRateados: number | null;
  extras: (number | string)[];
}): number | null {
  if (
    m.valorBase === null ||
    !m.funcBase ||
    m.funcAreaComum === null ||
    m.funcRateados === null
  )
    return null;
  const base = centavos(m.valorBase);
  const extras = m.extras.reduce<number>((s, v) => s + centavos(v), 0);
  return (
    Math.round((base * (m.funcAreaComum + m.funcRateados)) / m.funcBase) +
    extras
  );
}

/** Dias da semana que contam como dia útil no prazo do rateio (seg. a sex.). */
export const DIAS_UTEIS_PADRAO = [1, 2, 3, 4, 5] as const;

/** Prazo do envio ao Financeiro: o N-ésimo dia útil do mês seguinte. */
export function prazoDoEnvio(
  referencia: string,
  diaUtil: number,
  cal: CalendarioUtil,
): string {
  const [a, m] = referencia.split("-").map(Number) as [number, number];
  const fim = `${a}-${String(m).padStart(2, "0")}-${String(ultimoDiaDoMes(a, m)).padStart(2, "0")}`;
  return somarDiasUteis(fim, diaUtil, cal);
}

export type SituacaoRateio =
  | "enviado"
  | "fechado"
  | "aberto"
  | "incompleto"
  | "atrasado";

export const ROTULO_RATEIO: Record<SituacaoRateio, string> = {
  enviado: "Enviado ao Financeiro",
  fechado: "Fechado, falta enviar",
  aberto: "Aberto",
  incompleto: "Incompleto",
  atrasado: "Prazo de envio vencido",
};

/** Situação do mês do rateio no painel (vencido sem envio vira alerta). */
export function situacaoDoRateio(m: {
  status: "aberto" | "fechado";
  incompleto: boolean;
  enviado: boolean;
  prazo: string;
  hoje: string;
}): SituacaoRateio {
  if (m.enviado) return "enviado";
  if (m.hoje > m.prazo) return "atrasado";
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

/** Status das obras no Diário de Obra (status.id). */
export const STATUS_OBRA_DIARIO: Record<number, string> = {
  1: "Não iniciada",
  2: "Paralisada",
  3: "Em andamento",
  4: "Concluída",
};
export const OBRA_CONCLUIDA = 4;
export const OBRA_PARALISADA = 2;
/** Status do relatório aprovado (os outros esperam aprovação). */
export const RELATORIO_APROVADO = 4;

export interface ObraDiario {
  status_id: number;
  realizado: number | string | null;
  prazo_contratual: number | null;
  prazo_decorrido: number | null;
  prazo_a_vencer: number | null;
  data_fim: string | null;
}

/**
 * Avanço físico × prazo consumido (spec 4.9): desvio em pontos (avanço −
 * prazo consumido; abaixo do limite de Parâmetros é alerta) e prazo vencido
 * (não concluída e sem dias a vencer, ou fim antes de hoje).
 */
export function situacaoDoDiario(
  o: ObraDiario,
  hoje: string,
  limiteDesvio: number,
): {
  avancoPct: number | null;
  prazoPct: number | null;
  desvio: number | null;
  vencido: boolean;
  alerta: boolean;
} {
  const avanco = o.realizado === null ? null : Number(o.realizado);
  const prazo =
    o.prazo_contratual && o.prazo_decorrido !== null
      ? Math.min((o.prazo_decorrido / o.prazo_contratual) * 100, 100)
      : null;
  const desvio = avanco !== null && prazo !== null ? avanco - prazo : null;
  const vencido =
    o.status_id !== OBRA_CONCLUIDA &&
    (o.prazo_a_vencer === 0 || (!!o.data_fim && o.data_fim < hoje));
  return {
    avancoPct: avanco,
    prazoPct: prazo,
    desvio,
    vencido,
    alerta:
      vencido ||
      o.status_id === OBRA_PARALISADA ||
      (o.status_id !== OBRA_CONCLUIDA &&
        desvio !== null &&
        desvio < limiteDesvio),
  };
}
