import type { Turnover } from "@/connectors/copiloto-rh/schemas";

// Turnover do Copiloto RH. As taxas e contagens vêm prontas da API
// (GET /v1/turnover), calculadas pelo mesmo código da tela Relatórios ›
// Turnover e com as fórmulas configuradas pela ARP lá: o Centralizador não
// recalcula (especificação, etapa 5).

/** Tipos de desligamento do Copiloto. */
export type TipoDesligamento = "voluntario" | "involuntario" | "acordo";

export const ROTULO_TURNOVER: Record<string, string> = {
  voluntario: "Voluntário (iniciativa do empregado)",
  involuntario: "Involuntário (iniciativa do empregador)",
  acordo: "Acordo (mútuo consentimento)",
  nao_classificado: "Sem classificação",
};

/** Motivos de desligamento do Copiloto (`termination_reason`). */
export const MOTIVO_DESLIGAMENTO: Record<string, string> = {
  sem_justa_causa: "Rescisão sem justa causa",
  justa_causa: "Rescisão com justa causa",
  antecipada_termo_empregador: "Antecipação de contrato pelo empregador",
  pedido_demissao: "Pedido de demissão",
  rescisao_indireta: "Rescisão indireta",
  antecipada_termo_empregado: "Antecipação de contrato pelo empregado",
  acordo_mutuo: "Acordo mútuo (Art. 484-A CLT)",
  fim_contrato: "Término de contrato a termo",
  aposentadoria_idade: "Aposentadoria por idade",
  aposentadoria_invalidez: "Aposentadoria por invalidez",
  aposentadoria_compulsoria: "Aposentadoria compulsória",
  falecimento: "Falecimento do empregado",
  forca_maior: "Força maior",
  outros: "Outros motivos",
};

/** Decisão do desligamento no Copiloto (`termination_decision`). */
export const DECISAO_DESLIGAMENTO: Record<string, string> = {
  pediu_pra_sair: "Pediu para sair",
  foi_demitido: "Foi demitido",
  acordo_mutuo: "Acordo mútuo",
};

// Motivos que o Copiloto conta como voluntários quando não há decisão (o
// padrão de lá). Só servem para o rótulo de cada pessoa nas listas: as
// contagens e taxas por tipo vêm da API, com a configuração da ARP.
const MOTIVOS_VOLUNTARIOS = new Set([
  "pedido_demissao",
  "rescisao_indireta",
  "antecipada_termo_empregado",
  "aposentadoria_idade",
  "aposentadoria_invalidez",
  "aposentadoria_compulsoria",
]);

/**
 * Tipo de um desligamento, na ordem do Copiloto: acordo mútuo (na decisão ou
 * no motivo) é acordo; depois vale a decisão; sem ela, o motivo; o resto é
 * involuntário.
 */
export function tipoDoDesligamento(
  decisao: string | null | undefined,
  motivo: string | null | undefined,
): TipoDesligamento {
  if (decisao === "acordo_mutuo" || motivo === "acordo_mutuo") return "acordo";
  if (decisao === "pediu_pra_sair") return "voluntario";
  if (decisao === "foi_demitido") return "involuntario";
  return motivo && MOTIVOS_VOLUNTARIOS.has(motivo)
    ? "voluntario"
    : "involuntario";
}

export type AcordoContaComo = "voluntario" | "involuntario" | "separado";

export interface TaxaTurnover {
  tipo: "geral" | TipoDesligamento;
  rotulo: string;
  valor: number;
}

/** Números de um período, como o Copiloto mostra. */
export interface NumerosTurnover {
  de: string;
  ate: string;
  /** Geral, Voluntário, Involuntário e, se o Acordo for à parte, por Acordo. */
  taxas: TaxaTurnover[];
  /** Turnover Geral. */
  turnover: number;
  /** Headcount no primeiro dia (o denominador das taxas). */
  inicio: number;
  fim: number;
  admissoes: number;
  desligamentos: number;
  /** Já com o Acordo somado onde a ARP configurou. */
  desligamentosPorTipo: Record<TipoDesligamento, number>;
}

export interface TurnoverDoPeriodo extends NumerosTurnover {
  acordoContaComo: AcordoContaComo;
  /** Mês a mês dentro do período (o primeiro e o último podem ser parciais). */
  mensal: (NumerosTurnover & { competencia: string })[];
  porDepartamento: {
    nome: string;
    ativos: number;
    desligamentos: number;
    taxa: number;
  }[];
}

const ACORDO: Record<Turnover["agreement_counts_as"], AcordoContaComo> = {
  voluntary: "voluntario",
  involuntary: "involuntario",
  separate: "separado",
};

function numeros(
  de: string,
  ate: string,
  rates: Turnover["rates"],
  counts: Turnover["counts"],
  acordo: AcordoContaComo,
): NumerosTurnover {
  const taxas: TaxaTurnover[] = [
    { tipo: "geral", rotulo: "Turnover Geral", valor: rates.general },
    {
      tipo: "voluntario",
      rotulo: "Turnover Voluntário",
      valor: rates.voluntary,
    },
    {
      tipo: "involuntario",
      rotulo: "Turnover Involuntário",
      valor: rates.involuntary,
    },
  ];
  if (acordo === "separado")
    taxas.push({
      tipo: "acordo",
      rotulo: "Turnover por Acordo",
      valor: rates.agreement ?? 0,
    });
  return {
    de,
    ate,
    taxas,
    turnover: rates.general,
    inicio: counts.headcount_start,
    fim: counts.headcount_end,
    admissoes: counts.hires,
    desligamentos: counts.terminations,
    desligamentosPorTipo: {
      voluntario: counts.voluntary,
      involuntario: counts.involuntary,
      acordo: counts.agreement,
    },
  };
}

/** Resposta de GET /v1/turnover no formato das telas. */
export function turnoverDaApi(t: Turnover): TurnoverDoPeriodo {
  const acordo = ACORDO[t.agreement_counts_as];
  return {
    ...numeros(t.period.from, t.period.to, t.rates, t.counts, acordo),
    acordoContaComo: acordo,
    mensal: t.monthly.map((m) => ({
      ...numeros(m.from, m.to, m.rates, m.counts, acordo),
      competencia: `${m.month}-01`,
    })),
    porDepartamento: t.by_department.map((d) => ({
      nome: d.department?.name ?? "Sem departamento",
      ativos: d.active,
      desligamentos: d.terminations,
      taxa: d.rate,
    })),
  };
}
