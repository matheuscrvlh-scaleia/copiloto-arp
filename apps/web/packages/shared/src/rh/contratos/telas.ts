import { z } from "zod";
import { esquemaDetalhe } from "../../detalhe";
import {
  bancoEmReais,
  cicloVigente,
  colaboradorQuadro,
  filtrosDoPeriodo,
  meta,
  pedidoDoQuadro,
  pontoDoPeriodo,
  resultadoTurnover,
  turnoverDoPeriodo,
  valorDaHora,
} from "./comum";

// Respostas das telas Quadro e turnover, Jornada, Fechamento do banco de
// horas e Painel de RH.

// ---------------------------------------------------------------------------
// Quadro e turnover (rh.quadro)
// ---------------------------------------------------------------------------

/** GET /rh/quadro */
export const respostaQuadro = z.object({
  filtros: filtrosDoPeriodo,
  /** Todos, desde sempre (o turnover olha os desligados), menos os sócios. */
  colaboradores: z.array(colaboradorQuadro),
  metaTurnover: meta.nullable(),
  /** Do período do filtro. */
  turnover: resultadoTurnover,
  /** Dos 12 meses até o fim do período. */
  turnover12: resultadoTurnover,
});
export type RespostaQuadro = z.infer<typeof respostaQuadro>;

// ---------------------------------------------------------------------------
// Jornada (rh.jornada)
// ---------------------------------------------------------------------------

/** GET /rh/jornada */
export const respostaJornada = z.object({
  filtros: filtrosDoPeriodo,
  ponto: pontoDoPeriodo,
  /** Ponto do período anterior, para as variações. */
  anterior: pontoDoPeriodo,
  metaAbs: meta.nullable(),
  /** null: sem rh.custo_pessoal ou sem folha calculada. */
  reais: bancoEmReais.nullable(),
  /** null: sem rh.custo_pessoal.individual. */
  hora: valorDaHora.nullable(),
  ciclo: cicloVigente.nullable(),
});
export type RespostaJornada = z.infer<typeof respostaJornada>;

// ---------------------------------------------------------------------------
// Fechamento do banco de horas (rh.jornada; a lista pede o custo individual)
// ---------------------------------------------------------------------------

export const cicloDoBanco = z.object({
  id: z.string(),
  inicio: z.string(),
  fim: z.string(),
  finalizado_em: z.string().nullable(),
  /** Nome de quem finalizou. */
  finalizado_por: z.string().nullable(),
  total_saldo_min: z.number().nullable(),
  total_calculado: z.number().nullable(),
  total_realizado: z.number().nullable(),
});
export type CicloDoBanco = z.infer<typeof cicloDoBanco>;

export const linhaDoFechamento = z.object({
  colaborador_id: z.string(),
  nome: z.string(),
  departamento: z.string(),
  saldo_min: z.number(),
  salario_hora: z.number().nullable(),
  valor_calculado: z.number().nullable(),
  acao: z.string().nullable(),
  /** O gravado (editado ou guardado ao finalizar); null: ainda o da folha. */
  valor_realizado: z.number().nullable(),
  /** Rubrica 408 e grupo "banco de horas" nas folhas do mês do fim e do seguinte. */
  realizado_folha: z.number().nullable(),
});
export type LinhaDoFechamento = z.infer<typeof linhaDoFechamento>;

export const consultaDoFechamento = z.object({
  aba: z.string().max(20).optional(),
  ciclo: z.string().max(36).optional(),
});

/** GET /rh/banco-de-horas?aba=&ciclo= */
export const respostaFechamento = z.object({
  /** rh.custo_pessoal.individual: sem ela, nada mais vem. */
  individual: z.boolean(),
  /** rh.parametros: fechar, editar e finalizar. */
  parametros: z.boolean(),
  ciclo: cicloVigente.nullable(),
  /** O ciclo vigente já pode ser fechado (a partir da data de fim). */
  liberado: z.boolean(),
  /** Ciclos fechados (em revisão ou finalizados), do mais novo ao mais antigo. */
  ciclos: z.array(cicloDoBanco),
  /** Lista do ciclo aberto (aba atual) ou do escolhido (anteriores). */
  linhas: z.array(linhaDoFechamento),
});
export type RespostaFechamento = z.infer<typeof respostaFechamento>;

/** POST /rh/banco-de-horas/fechar */
export const entradaFecharCiclo = z.object({
  refazer: z.string().max(1).optional(),
});

/**
 * PATCH /rh/banco-de-horas/ciclos/:id: os campos do formulário como vieram
 * (acao_<id> e realizado_<id>), lidos como no antigo.
 */
export const entradaSalvarFechamento = z.record(
  z.string().max(60),
  z.string().max(40),
);

// ---------------------------------------------------------------------------
// Painel de RH (rh.painel): a API manda pronto o que a tela desenha, com os
// detalhes já filtrados pelas permissões de quem vê.
// ---------------------------------------------------------------------------

/** Detalhe cujas tabelas (lista de pessoas do quadro) vêm ao abrir. */
export const detalheDoPainel = esquemaDetalhe.extend({
  carga: pedidoDoQuadro.optional(),
});
export type DetalheDoPainel = z.infer<typeof detalheDoPainel>;

export const itemGrafico = z.object({
  chave: z.string(),
  rotulo: z.string(),
  valor: z.number(),
  texto: z.string(),
  titulo: z.string().optional(),
  detalhe: z.string().optional(),
  destaque: z.boolean().optional(),
});

const variacao = z.object({
  texto: z.string(),
  sentido: z.enum(["bom", "ruim", "neutro"]),
});

const totaisCusto = z.object({
  colaboradores: z.number(),
  remuneracao: z.number(),
  encargos: z.number(),
  provisoes: z.number(),
  beneficios: z.number(),
  rescisao: z.number(),
  reembolsos: z.number(),
  custo_total: z.number(),
  sem_valor: z.number(),
});

/** GET /rh/painel */
export const respostaPainel = z.object({
  filtros: filtrosDoPeriodo,
  metas: z.object({
    absenteismo: meta.nullable(),
    banco: meta.nullable(),
    custo: meta.nullable(),
    turnover: meta.nullable(),
  }),
  custo: z.object({
    podeVer: z.boolean(),
    motivo: z.string(),
    totais: totaisCusto.nullable(),
    competencia: z.string().nullable(),
    rotulo: z.string(),
    semFaturamento: z.array(z.string()),
    ficticia: z.boolean(),
    serie: z.array(itemGrafico).optional(),
    variacao: variacao.optional(),
    sobreReceita: z.number().nullable(),
    origemTotal: esquemaDetalhe.nullable(),
    origemReceita: esquemaDetalhe.nullable(),
  }),
  ponto: z.object({
    semDado: z.string().nullable(),
    parcial: z.string().nullable(),
    /** Há linhas de ponto no recorte. */
    comLinhas: z.boolean(),
    /** Trecho com dado (o ponto vai até ontem). */
    de: z.string(),
    ate: z.string(),
    absenteismo: z.number().nullable(),
    absenteismoAnterior: z.number().nullable(),
    banco_positivo_min: z.number(),
    banco_saldo_min: z.number(),
    textoBanco: z.string(),
    origemAbsenteismo: esquemaDetalhe,
    origemBanco: esquemaDetalhe,
    setores: z.array(
      z.object({
        chave: z.string(),
        departamento_id: z.string().nullable(),
        departamento: z.string(),
        colaboradores: z.number(),
        absenteismo: z.number().nullable(),
        faltas_min: z.number(),
        atrasos_min: z.number(),
        origem: esquemaDetalhe,
      }),
    ),
  }),
  quadro: z.object({
    ativos: z.number(),
    ativosAnterior: z.number(),
    evolucao: z.array(itemGrafico),
    /** Detalhe de cada mês da evolução, pela chave. */
    detalhesEvolucao: z.record(z.string(), detalheDoPainel),
    movimento: z.object({
      admissoes: z.number(),
      desligamentos: z.number(),
    }),
    turnover: turnoverDoPeriodo
      .pick({ turnover: true, taxas: true })
      .nullable(),
    semTurnover: z.string().nullable(),
    origemAtivos: detalheDoPainel,
    origemAdmissoes: detalheDoPainel,
    origemDesligamentos: detalheDoPainel,
    origemTurnover: detalheDoPainel,
  }),
});
export type RespostaPainel = z.infer<typeof respostaPainel>;
