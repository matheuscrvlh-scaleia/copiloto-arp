import { z } from "zod";
import { filtrosDoPeriodo, linhaPonto, pontoDoPeriodo } from "./comum";

// Funcionários: lista, perfil (ponto, folha, custo, benefícios) e "fora do
// ponto". Folha, rubricas e custo só vão para quem tem
// rh.custo_pessoal.individual; benefícios, para quem tem rh.beneficios.

const data = z.iso.date();
const minutos = z.record(z.string(), z.number());

export const funcionario = z.object({
  id: z.string(),
  nome: z.string(),
  matricula: z.number().nullable(),
  departamento_id: z.string().nullable(),
  departamento: z.string(),
  cargo: z.string().nullable(),
  tipo_contrato: z.string().nullable(),
  nascimento: z.string().nullable(),
  admissao: z.string().nullable(),
  desligamento: z.string().nullable(),
  situacao: z.enum(["ativo", "afastado", "a_admitir", "desligado"]),
  /** Ligado ao ponto (Secullum); todos vêm do Copiloto RH. */
  noPonto: z.boolean(),
  /** No Secullum, mas o RH tirou do ponto (não conta nas telas). */
  foraDoPonto: z.boolean(),
  /** Afastamento do ponto que cobre hoje (o primeiro, se houver mais de um). */
  afastamentoHoje: z
    .object({ inicio: data, fim: data, motivo: z.string().nullable() })
    .nullable(),
});
export type Funcionario = z.infer<typeof funcionario>;

/** GET /rh/funcionarios */
export const respostaFuncionarios = z.object({
  funcionarios: z.array(funcionario),
});

export const perfil = funcionario.extend({
  motivoDesligamento: z.string().nullable(),
});
export type Perfil = z.infer<typeof perfil>;

const totaisDoPonto = {
  colaborador_id: z.string(),
  previstas_min: z.number(),
  faltas_min: z.number(),
  atrasos_min: z.number(),
  faltas_dias: z.number(),
  abonos_min: minutos,
  banco_saldo_min: z.number(),
  banco_creditos_min: z.number(),
  banco_debitos_min: z.number(),
  extras_min: minutos,
  noturnas_min: z.number(),
  dsr_debito_min: z.number(),
};

/** Totais do ponto da pessoa num mês. */
export const pontoDoMes = z.object({
  ...totaisDoPonto,
  competencia: z.string(),
  normais_min: z.number(),
});
export type PontoDoMes = z.infer<typeof pontoDoMes>;

export const diaDoPonto = z.object({
  data: z.string(),
  batidas: z.array(z.string().nullable()),
  ocorrencia: z.string().nullable(),
  previstas_min: z.number(),
  normais_min: z.number(),
  faltas_min: z.number(),
  atrasos_min: z.number(),
  abonos_min: minutos,
  extras_min: minutos,
  noturnas_min: z.number(),
  banco_saldo_min: z.number(),
  banco_creditos_min: z.number(),
  banco_debitos_min: z.number(),
});
export type DiaDoPonto = z.infer<typeof diaDoPonto>;

export const pontoDoFuncionario = pontoDoPeriodo.extend({
  /** Totais do período (a linha da pessoa), ou null sem dado. */
  total: linhaPonto.nullable(),
  /** Horas trabalhadas (Normais), que o total do período não traz. */
  normais_min: z.number(),
  /** Os dias do período que têm batidas guardadas. */
  dias: z.array(diaDoPonto),
});

export const afastamento = z.object({
  inicio: z.string(),
  fim: z.string(),
  motivo: z.string().nullable(),
  justificativa: z.string().nullable(),
});
export type Afastamento = z.infer<typeof afastamento>;

export const beneficioDoFuncionario = z.object({
  nome: z.string(),
  tipo: z.string(),
  desde: z.string(),
  ate: z.string().nullable(),
  /** Valor mensal: o manual da pessoa ou o padrão do benefício. */
  valor: z.number().nullable(),
  /** O valor foi digitado para a pessoa (não muda com a faixa). */
  manual: z.boolean(),
  /** Valor varia por mês: `valor` é o último lançado. */
  porMes: z.boolean(),
});

/** Vem do Copiloto RH (aba Dependentes do perfil). */
export const dependente = z.object({
  nome: z.string(),
  nascimento: z.string().nullable(),
  parentesco: z.string().nullable(),
  tem_plano: z.boolean(),
  tem_odonto: z.boolean(),
});

export const beneficiosDoFuncionario = z.object({
  beneficios: z.array(beneficioDoFuncionario),
  dependentes: z.array(dependente),
});
export type BeneficiosDoFuncionario = z.infer<typeof beneficiosDoFuncionario>;

export const folhaDoFuncionario = z.object({
  folha_id: z.string(),
  competencia: z.string(),
  /** Protótipo: salário trocado por R$ 2.000,00 na importação. */
  ficticia: z.boolean(),
  status: z.string(),
  situacao: z.string(),
  tipo_contrato: z.string(),
  cargo: z.string().nullable(),
  horas_mes_min: z.number().nullable(),
  salario: z.number().nullable(),
  base_inss: z.number().nullable(),
  base_fgts: z.number().nullable(),
  valor_fgts: z.number().nullable(),
  liquido: z.number().nullable(),
});
export type FolhaDoFuncionario = z.infer<typeof folhaDoFuncionario>;

export const rubricaDoFuncionario = z.object({
  codigo: z.number(),
  descricao: z.string(),
  grupo: z.string(),
  natureza: z.enum(["provento", "desconto", "informativa"]),
  referencia: z.number().nullable(),
  valor: z.number(),
});
export type RubricaDoFuncionario = z.infer<typeof rubricaDoFuncionario>;

export const custoDoMes = z.object({
  competencia: z.string(),
  colaborador_id: z.string(),
  departamento_id: z.string().nullable(),
  tipo_contrato: z.string(),
  remuneracao: z.number(),
  encargos: z.number(),
  provisao_13: z.number(),
  provisao_ferias: z.number(),
  multa_rescisoria: z.number(),
  provisoes: z.number(),
  beneficios: z.number(),
  rescisao: z.number(),
  reembolsos: z.number(),
  custo_total: z.number(),
  custo_hora: z.number().nullable(),
  salario_hora: z.number().nullable(),
  jornada_min: z.number().nullable(),
  valor_informado: z.boolean(),
  memoria: z.object({
    linhas: z.array(
      z.object({ rotulo: z.string(), valor: z.number(), regra: z.string() }),
    ),
    pendencias: z.array(z.string()),
  }),
});
export type CustoDoMes = z.infer<typeof custoDoMes>;

/** GET /rh/funcionarios/:id (com os filtros do período) */
export const respostaPerfil = z.object({
  funcionario: perfil,
  filtros: filtrosDoPeriodo,
  ponto: pontoDoFuncionario,
  /** Ponto mês a mês, do mais recente para o mais antigo. */
  mensal: z.array(pontoDoMes),
  afastamentos: z.array(afastamento),
  /** null: sem rh.beneficios. */
  beneficios: beneficiosDoFuncionario.nullable(),
  /** rh.custo_pessoal.individual */
  verSalario: z.boolean(),
  /** Folha do mês do fim do período (ou a última antes, ou a última). */
  folha: folhaDoFuncionario.nullable(),
  rubricas: z.array(rubricaDoFuncionario),
  /** Custo mês a mês, do mais recente (vazio sem verSalario). */
  custos: z.array(custoDoMes),
  /** Adicional do banco vigente no mês (só com verSalario). */
  adicional: z.number().nullable(),
  /** rh.parametros: tirar do ponto ou voltar. */
  editar: z.boolean(),
});
export type RespostaPerfil = z.infer<typeof respostaPerfil>;

/** POST /rh/funcionarios/:id/fora-do-ponto */
export const entradaForaDoPonto = z.object({ fora: z.enum(["sim", "nao"]) });
