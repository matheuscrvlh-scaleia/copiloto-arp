import { z } from "zod";

// Formato tirado dos exemplos da documentação
// (https://api.diariodeobra.app/documentacao/), lida em 21/10/2026; ainda não
// conferido com dados da ARP. Só os campos que usamos; o resto da resposta é
// descartado. Fotos, vídeos, anexos, comentários e e-mails ficam de fora de
// propósito (dados pessoais e arquivos que não guardamos).
//
// Conversões na entrada: datas "dd/mm/aaaa" viram "aaaa-mm-dd"; data e hora
// "dd/mm/aaaa hh:mm[:ss]" vira "aaaa-mm-ddThh:mm:ss" (horário local, sem
// fuso); horas "hh:mm" viram minutos; percentuais em texto viram número.

const DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const DATA_HORA = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})(?::(\d{2}))?$/;
const HORAS = /^(\d{1,3}):(\d{2})$/;

/** "dd/mm/aaaa" → "aaaa-mm-dd". */
export const dataBr = z
  .string()
  .regex(DATA, "data fora do formato dd/mm/aaaa")
  .transform((s) => s.replace(DATA, "$3-$2-$1"));

/** "dd/mm/aaaa hh:mm[:ss]" → "aaaa-mm-ddThh:mm:ss", horário local. */
export const dataHoraBr = z
  .string()
  .regex(DATA_HORA, "data e hora fora do formato dd/mm/aaaa hh:mm:ss")
  .transform((s) => {
    const [, d, m, a, h, min, seg] = DATA_HORA.exec(s) ?? [];
    return `${a}-${m}-${d}T${h}:${min}:${seg ?? "00"}`;
  });

/** Texto vazio conta como ausente. */
function opcional<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (v === "" ? null : v), schema.nullish());
}

const dataOpcional = opcional(dataBr);
const dataHoraOpcional = opcional(dataHoraBr);

/** "hh:mm" → minutos; vazio vira null. */
export const horasEmMinutos = z
  .string()
  .nullish()
  .transform((s, ctx) => {
    if (!s) return null;
    const m = HORAS.exec(s);
    if (!m) {
      ctx.addIssue({ code: "custom", message: `horas fora do formato: ${s}` });
      return z.NEVER;
    }
    return Number(m[1]) * 60 + Number(m[2]);
  });

/** Número que às vezes vem como texto ("18.67"). */
const numero = z
  .union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number());

/** Lista que pode faltar ou vir null: vira lista vazia. */
function lista<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .nullish()
    .transform((v) => v ?? []);
}

/** Status de obra, relatório ou atividade. Comparar pelo id: a descrição muda entre rotas. */
const status = z.object({ id: z.number().int(), descricao: z.string() });

const referencia = z.object({ _id: z.string(), descricao: z.string() });

const prazo = z.object({
  /** Dias. */
  contratual: z.number().nullish(),
  decorrido: z.number().nullish(),
  aVencer: z.number().nullish(),
});

/** GET /empresa: identifica a empresa dona do token. */
export const empresaSchema = z.object({
  _id: z.string(),
  nome: z.string(),
  log: z
    .object({
      totalObras: z.number().int().nonnegative(),
      totalRelatorios: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

/** GET /cadastros: listas usadas para traduzir ids. */
export const cadastrosSchema = z.object({
  modeloDeRelatorioGlobal: lista(referencia),
  listaMaoDeObra: z
    .object({ categorias: lista(referencia) })
    .nullish()
    .transform((v) => ({ categorias: v?.categorias ?? [] })),
  listaTiposDeOcorrencias: lista(referencia),
  listaGruposObra: lista(referencia),
  statusObra: lista(status),
  statusRelatorio: lista(status),
});

/** GET /obras: todas as obras, sem paginação. */
export const obraResumoSchema = z.object({
  _id: z.string(),
  nome: z.string(),
  status,
  totalRelatorios: z.number().int().nonnegative().nullish(),
  /** Última alteração na obra: base da sincronização incremental. */
  modified: dataHoraOpcional,
});

/** GET /obras/{obra-id}: cadastro da obra. */
export const obraSchema = z.object({
  _id: z.string(),
  nome: z.string(),
  status,
  grupo: referencia.nullish(),
  endereco: z.string().nullish(),
  numeroContrato: z.string().nullish(),
  dataInicio: dataOpcional,
  dataFim: dataOpcional,
  prazo: prazo.nullish(),
  responsavel: z.string().nullish(),
  cliente: z.string().nullish(),
  visaoGeral: z
    .object({
      total: z.object({
        relatorios: z.number().int().nullish(),
        atividades: z.number().int().nullish(),
        ocorrencias: z.number().int().nullish(),
        tarefasCronograma: z.number().int().nullish(),
      }),
    })
    .nullish(),
  modelosDeRelatorios: lista(referencia),
  created: dataHoraOpcional,
  modified: dataHoraOpcional,
});

/** GET /obras/{obra-id}/relatorios: lista dos diários (RDO) da obra. */
export const relatorioResumoSchema = z.object({
  _id: z.string(),
  data: dataBr,
  /** Só em modelos de relatório por período. */
  dataFim: dataOpcional,
  numero: z.number().int(),
  status,
  modeloDeRelatorioGlobal: referencia.nullish(),
});

const turno = z.object({
  clima: z.string().nullish(),
  /** "Praticável" ou "Impraticável". */
  condicao: z.string().nullish(),
  /** false: turno sem expediente. */
  ativo: z.boolean().nullish(),
});

const controleDeProducao = z.object({
  ativo: z.boolean().nullish(),
  unidade: z.string().nullish(),
  quantidade: z.number().nullish(),
  realizado: z.number().nullish(),
  realizadoAnterior: z.number().nullish(),
  acumulado: z.number().nullish(),
});

/** Mão de obra por função, só quantidade (sem nomes). */
const maoDeObraPadrao = z.object({
  _id: z.string(),
  descricao: z.string(),
  quantidade: z.number(),
  categoria: referencia.nullish(),
});

/** Mão de obra nominal, com horário e presença. */
const maoDeObraPersonalizada = z.object({
  _id: z.string(),
  /** Matrícula; vem null no exemplo da documentação. */
  registro: z.string().nullish(),
  nome: z.string(),
  funcao: z.string().nullish(),
  presenca: z.boolean().nullish(),
  horaInicio: z.string().nullish(),
  horaFim: z.string().nullish(),
  horasIntervalo: horasEmMinutos,
  horasTrabalhadas: horasEmMinutos,
  categoria: referencia.nullish(),
});

const atividade = z.object({
  /**
   * Id da tarefa do cronograma quando `cronograma` é true; fora dele é um id
   * curto, único só dentro do relatório.
   */
  tarefaId: z.string().nullish(),
  cronograma: z.boolean().nullish(),
  item: z.string().nullish(),
  descricao: z.string(),
  porcentagem: numero.nullish(),
  porcentagemAnterior: numero.nullish(),
  controleDeProducao: controleDeProducao.nullish(),
  status: status.nullish(),
  etapa: z
    .object({
      _id: z.string().nullish(),
      item: z.string().nullish(),
      descricao: z.string().nullish(),
    })
    .nullish(),
  horario: z.object({ segundos: z.number().nullish() }).nullish(),
});

const ocorrencia = z.object({
  /** Id curto, único só dentro do relatório. */
  _id: z.string(),
  descricao: z.string(),
  tags: lista(
    z.object({
      _id: z.string(),
      descricao: z.string(),
      checked: z.boolean().nullish(),
    }),
  ),
  tarefa: z.object({ _id: z.string().nullish() }).nullish(),
});

/** Material com quantidade em texto livre, às vezes com unidade ("10m"). */
const material = z.object({
  descricao: z.string(),
  quantidade: z.string().nullish(),
});

/** GET /obras/{obra-id}/relatorios/{relatorio-id}: o diário completo. */
export const relatorioSchema = relatorioResumoSchema.extend({
  prazo: prazo.nullish(),
  horarioDeTrabalho: z
    .object({
      expedienteInicio: z.string().nullish(),
      expedienteFim: z.string().nullish(),
      intervaloInicio: z.string().nullish(),
      intervaloFim: z.string().nullish(),
      horasTrabalhadas: horasEmMinutos,
    })
    .nullish(),
  clima: z
    .object({
      manha: turno.nullish(),
      tarde: turno.nullish(),
      noite: turno.nullish(),
      /** Formato ainda não visto (vem null no exemplo). */
      indicePluviometrico: z.union([z.number(), z.string()]).nullish(),
    })
    .nullish(),
  maoDeObra: z
    .object({
      /** Qual das duas listas vale no relatório. */
      opcaoSelecionada: z.enum(["padrao", "personalizada"]).nullish(),
      padrao: lista(maoDeObraPadrao),
      personalizada: lista(maoDeObraPersonalizada),
    })
    .nullish(),
  equipamentos: lista(
    z.object({
      _id: z.string(),
      descricao: z.string(),
      quantidade: z.number(),
    }),
  ),
  atividades: lista(atividade),
  ocorrencias: lista(ocorrencia),
  controleDeMaterial: z
    .object({ recebido: lista(material), utilizado: lista(material) })
    .nullish(),
  /** Link do PDF do relatório no Diário de Obras. */
  linkPdf: z.string().nullish(),
  created: dataHoraOpcional,
  modified: dataHoraOpcional,
});

const tarefaResumo = z.object({
  _id: z.string(),
  posicao: z.number().int().nullish(),
  item: z.string().nullish(),
  descricao: z.string(),
  porcentagem: numero,
  controleDeProducao: controleDeProducao.nullish(),
});

/** GET /obras/{obra-id}/lista-de-tarefas: etapas e tarefas do cronograma. */
export const listaDeTarefasSchema = z.object({
  totalTarefas: z.number().int(),
  totalTarefasNaoIniciada: z.number().int(),
  totalTarefasEmAndamento: z.number().int(),
  totalTarefasConcluida: z.number().int(),
  /** Percentual realizado da obra. */
  realizado: numero,
  cronograma: lista(
    z.object({
      _id: z.string(),
      posicao: z.number().int().nullish(),
      item: z.string().nullish(),
      descricao: z.string(),
      porcentagem: numero,
      tarefas: lista(tarefaResumo),
    }),
  ),
});

/** GET /obras/{obra-id}/lista-de-tarefas/{tarefa-id}: a tarefa em cada relatório. */
export const tarefaSchema = tarefaResumo.omit({ posicao: true }).extend({
  status: status.nullish(),
  relatorios: lista(
    z.object({
      _id: z.string(),
      data: dataBr,
      dataFim: dataOpcional,
      porcentagem: numero.nullish(),
      porcentagemAnterior: numero.nullish(),
      controleDeProducao: controleDeProducao.nullish(),
      horario: z.object({ segundos: z.number().nullish() }).nullish(),
    }),
  ),
});

export type Empresa = z.infer<typeof empresaSchema>;
export type Cadastros = z.infer<typeof cadastrosSchema>;
export type ObraResumo = z.infer<typeof obraResumoSchema>;
export type Obra = z.infer<typeof obraSchema>;
export type RelatorioResumo = z.infer<typeof relatorioResumoSchema>;
export type Relatorio = z.infer<typeof relatorioSchema>;
export type ListaDeTarefas = z.infer<typeof listaDeTarefasSchema>;
export type Tarefa = z.infer<typeof tarefaSchema>;
