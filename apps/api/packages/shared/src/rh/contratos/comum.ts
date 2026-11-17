import { z } from "zod";
import { esquemaTabelaDetalhe } from "../../detalhe";

// Contratos que várias telas do RH dividem: filtros, ponto, quadro, metas,
// turnover do Copiloto RH e os valores do banco de horas em R$.

const data = z.iso.date();
const competencia = z.string().regex(/^\d{4}-\d{2}-01$/);

export const departamento = z.object({ id: z.string(), nome: z.string() });
export type Departamento = z.infer<typeof departamento>;

/** ?periodo= ou ?de=&ate= (ou ?mes=, dos links antigos) e ?dep= da URL. */
export const consultaDoPeriodo = z.object({
  periodo: z.string().max(20).optional(),
  de: z.string().max(10).optional(),
  ate: z.string().max(10).optional(),
  mes: z.string().max(7).optional(),
  dep: z.string().max(36).optional(),
});
export type ConsultaDoPeriodo = z.infer<typeof consultaDoPeriodo>;

export const periodo = z.object({
  de: data,
  ate: data,
  atalho: z.enum(["hoje", "ontem", "semana", "mes", "mes_passado"]).nullable(),
});

/** Os filtros já lidos pela API (nunca confia no que veio na URL). */
export const filtrosDoPeriodo = z.object({
  periodo,
  /** Período anterior de mesmo tamanho, para as variações. */
  anterior: periodo,
  rotulo: z.string(),
  /** Competência do fim do período. */
  mes: competencia,
  /** Hoje (aaaa-mm-dd), limite das datas na tela. */
  hoje: data,
  departamento: z.string().nullable(),
  departamentos: z.array(departamento),
});
export type FiltrosDoPeriodo = z.infer<typeof filtrosDoPeriodo>;

const minutos = z.record(z.string(), z.number());

export const linhaPonto = z.object({
  colaborador_id: z.string(),
  nome: z.string(),
  matricula: z.number().nullable(),
  departamento_id: z.string().nullable(),
  departamento: z.string(),
  previstas_min: z.number(),
  faltas_min: z.number(),
  atrasos_min: z.number(),
  faltas_dias: z.number(),
  abonos_min: minutos,
  banco_saldo_min: z.number(),
  banco_creditos_min: z.number(),
  banco_debitos_min: z.number(),
  extras_min: minutos.optional(),
  noturnas_min: z.number().optional(),
  dsr_debito_min: z.number().optional(),
});

const trecho = z.object({ competencia: z.string(), de: data, ate: data });

export const pontoDoPeriodo = z.object({
  linhas: z.array(linhaPonto),
  efetivo: z.object({ de: data, ate: data }).nullable(),
  semDias: z.array(trecho),
});

/** Meta vigente no formato do semáforo. */
export const meta = z.object({
  meta: z.number(),
  limiteAtencao: z.number().nullable(),
  direcao: z.enum(["maior_melhor", "menor_melhor"]),
});

const tipoDesligamento = z.enum(["voluntario", "involuntario", "acordo"]);

export const colaboradorQuadro = z.object({
  id: z.string(),
  nome: z.string(),
  matricula: z.number().nullable(),
  departamento_id: z.string().nullable(),
  departamento: z.string(),
  admissao: z.string().nullable(),
  desligamento: z.string().nullable(),
  tipo_turnover: tipoDesligamento.nullable(),
  motivo_desligamento: z.string().nullable().optional(),
  decisao_desligamento: z.string().nullable().optional(),
  cargo: z.string().nullable().optional(),
  cargo_id: z.string().nullable().optional(),
  tipo_contrato: z.string().nullable().optional(),
});

const numerosTurnover = z.object({
  de: z.string(),
  ate: z.string(),
  taxas: z.array(
    z.object({
      tipo: z.enum(["geral", "voluntario", "involuntario", "acordo"]),
      rotulo: z.string(),
      valor: z.number(),
    }),
  ),
  turnover: z.number(),
  inicio: z.number(),
  fim: z.number(),
  admissoes: z.number(),
  desligamentos: z.number(),
  desligamentosPorTipo: z.record(tipoDesligamento, z.number()),
});

export const turnoverDoPeriodo = numerosTurnover.extend({
  acordoContaComo: z.enum(["voluntario", "involuntario", "separado"]),
  mensal: z.array(numerosTurnover.extend({ competencia: z.string() })),
  porDepartamento: z.array(
    z.object({
      nome: z.string(),
      ativos: z.number(),
      desligamentos: z.number(),
      taxa: z.number(),
    }),
  ),
});

/** Turnover direto do Copiloto RH, ou por que não veio. */
export const resultadoTurnover = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), dados: turnoverDoPeriodo }),
  z.object({ ok: z.literal(false), motivo: z.string() }),
]);
export type ResultadoTurnover = z.infer<typeof resultadoTurnover>;

/** Ciclo do banco de horas dos Parâmetros vigentes hoje. */
export const cicloVigente = z.object({
  inicio: data,
  fim: data,
  adicional: z.number(),
});

/**
 * Banco de horas positivo em R$, por departamento (exige rh.custo_pessoal).
 * `porDepartamento` vai como lista de pares (o Map da tela).
 */
export const bancoEmReais = z.object({
  valor: z.number().nullable(),
  positivo_min: z.number(),
  semSalario: z.number(),
  folha: z.string().nullable(),
  adicional: z.number().nullable(),
  porDepartamento: z.array(
    z.tuple([z.string().nullable(), z.number().nullable()]),
  ),
});
export type BancoEmReais = z.infer<typeof bancoEmReais>;

/** Salário/hora de cada pessoa (exige rh.custo_pessoal.individual). */
export const valorDaHora = z.object({
  folha: z.string().nullable(),
  adicional: z.number().nullable(),
  salarioHora: z.array(z.tuple([z.string(), z.number().nullable()])),
});

// ---------------------------------------------------------------------------
// Tabelas dos modais pedidas só ao abrir (acoes/detalhes do antigo)
// ---------------------------------------------------------------------------

export const pedidoDoQuadro = z.object({
  de: data,
  fim: data,
  foco: z.enum(["ativos", "admissoes", "desligamentos", "turnover"]),
  rotulo: z.string().max(120).optional(),
  /** Sem ele: todos os departamentos. */
  departamento: z.uuid().optional(),
});
export type PedidoDoQuadro = z.infer<typeof pedidoDoQuadro>;

export const pedidoDaMemoria = z.object({
  competencia,
  colaborador: z.uuid(),
});

export const respostaTabelas = z.object({
  tabelas: z.array(esquemaTabelaDetalhe),
});
