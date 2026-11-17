import { z } from "zod";

// Formato tirado dos exemplos da documentação oficial v1.0.4
// (https://api.diariodeobra.app/documentacao/), lida em 21/10/2026 e de novo
// em 09/11/2026; ainda não conferido com dados da ARP. Só os campos que as
// telas usam; o resto da resposta é descartado. Fotos, vídeos e anexos: só
// os endereços (as telas mostram direto do aplicativo, sem copiar o
// arquivo). E-mails de usuários ficam de fora de propósito (a tela não usa).
//
// Conversões na entrada: datas "dd/mm/aaaa" viram "aaaa-mm-dd"; data e hora
// "dd/mm/aaaa hh:mm[:ss]" vira "aaaa-mm-ddThh:mm:ss" (horário local, sem
// fuso); horas "hh:mm" viram minutos; percentuais em texto viram número;
// texto vazio vira null; endereço que não é http(s) vira null.

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
const texto = opcional(z.string());

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

/**
 * Endereço de foto, vídeo, anexo ou PDF no aplicativo. Só http(s): qualquer
 * outro esquema (javascript:, data:) vira null e nunca chega a um link.
 */
export const link = z
  .string()
  .nullish()
  .transform((v) => {
    const t = v?.trim();
    return t && /^https?:\/\/\S+$/i.test(t) ? t : null;
  });

/** Número que às vezes vem como texto ("18.67"). */
const numero = z
  .union([z.number(), z.string().trim().min(1)])
  .pipe(z.coerce.number());

const inteiro = z.number().int().nullish();

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

/** Foto do relatório (galeria, atividade ou ocorrência). */
const foto = z.object({
  descricao: texto,
  url: link,
  urlMiniatura: link,
  /** Tarefa ou ocorrência a que a foto pertence ("" na galeria geral). */
  tarefaId: texto,
  ocorrenciaId: texto,
});

const video = z.object({
  url: link,
  /** Quadro de capa. */
  urlFoto: link,
  /** "mm:ss". */
  duracao: texto,
  descricao: texto,
});

const anexo = z.object({
  descricao: texto,
  extensao: texto,
  /** Bytes. */
  tamanho: z.number().nullish(),
  url: link,
});

/** Horário de uma atividade ou ocorrência; `segundos` é a duração. */
const horario = z.object({
  inicio: texto,
  fim: texto,
  total: texto,
  segundos: z.number().nullish(),
  descricao: texto,
});

/** GET /empresa: identifica a empresa dona do token. */
export const empresaSchema = z.object({
  _id: z.string(),
  nome: z.string(),
  razaoSocial: texto,
  cpfCnpj: texto,
  logoUrl: link,
  log: z
    .object({
      totalObras: z.number().int().nonnegative(),
      totalUsuarios: inteiro,
      totalRelatorios: z.number().int().nonnegative().optional(),
      totalFotos: inteiro,
      totalVideos: inteiro,
      ultimoAcesso: dataHoraOpcional,
      ultimoRelatorio: dataHoraOpcional,
    })
    .optional(),
});

/** GET /cadastros: listas usadas para traduzir ids e montar filtros. */
export const cadastrosSchema = z.object({
  usuarios: lista(
    z.object({
      _id: z.string(),
      nome: z.string(),
      cargo: texto,
      perfil: status.nullish(),
      ativo: z.boolean().nullish(),
    }),
  ),
  modeloDeRelatorioGlobal: lista(referencia),
  listaMaoDeObra: z
    .object({ categorias: lista(referencia) })
    .nullish()
    .transform((v) => ({ categorias: v?.categorias ?? [] })),
  listaEquipamentos: lista(referencia),
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
  totalFotos: z.number().int().nonnegative().nullish(),
  /** Última alteração na obra: base da sincronização incremental. */
  modified: dataHoraOpcional,
});

/** GET /obras/{obra-id}: cadastro da obra. */
export const obraSchema = z.object({
  _id: z.string(),
  nome: z.string(),
  fotoUrl: link,
  status,
  grupo: referencia.nullish(),
  endereco: texto,
  numeroContrato: texto,
  dataInicio: dataOpcional,
  dataFim: dataOpcional,
  prazo: prazo.nullish(),
  responsavel: texto,
  /** "Contratante" ou "Contratada": o papel da empresa na obra. */
  tipoContratanteContratada: texto,
  cliente: texto,
  observacao: texto,
  visaoGeral: z
    .object({
      total: z
        .object({
          relatorios: inteiro,
          fotos: inteiro,
          atividades: inteiro,
          ocorrencias: inteiro,
          comentarios: inteiro,
          anexosRelatorio: inteiro,
          usuariosAcesso: inteiro,
          anexosObra: inteiro,
          tarefasCronograma: inteiro,
          videos: inteiro,
        })
        .nullish(),
      ultimasFotos: lista(foto),
      ultimosRelatorios: lista(
        z.object({
          _id: z.string(),
          data: dataBr,
          numero: z.number().int(),
          totalFotos: inteiro,
          status,
        }),
      ),
      ultimosVideos: lista(video),
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
  diaDaSemana: texto,
  numero: z.number().int(),
  status,
  obra: z.object({ _id: z.string(), nome: z.string() }).nullish(),
  modeloDeRelatorioGlobal: referencia.nullish(),
  criadoPor: z
    .object({
      /** Origem: "app-web", "app-android", "app-ios". */
      appIss: texto,
      dataHora: dataHoraOpcional,
      usuario: z.object({ _id: texto, nome: texto, cargo: texto }).nullish(),
    })
    .nullish(),
});

const turno = z.object({
  clima: texto,
  /** "Praticável" ou "Impraticável". */
  condicao: texto,
  /** false: turno sem expediente. */
  ativo: z.boolean().nullish(),
});

const controleDeProducao = z.object({
  ativo: z.boolean().nullish(),
  unidade: texto,
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
  registro: texto,
  nome: z.string(),
  funcao: texto,
  presenca: z.boolean().nullish(),
  horaInicio: texto,
  horaFim: texto,
  horasIntervalo: horasEmMinutos,
  horasTrabalhadas: horasEmMinutos,
  categoria: referencia.nullish(),
});

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const STATUS_TAREFA_POR_TEXTO: Record<string, number> = {
  "nao iniciada": 1,
  "em andamento": 2,
  concluida: 3,
};

/**
 * Status da atividade. Nas atividades não iniciadas a API manda o id em texto
 * ({"id":"Não Iniciada"}, visto na ARP em 10/11/2026): vira o número da
 * tarefa; texto desconhecido fica sem status, sem derrubar o relatório.
 */
const statusDaAtividade = z
  .object({ id: z.union([z.number(), z.string()]), descricao: z.string() })
  .transform((s) => {
    const id =
      typeof s.id === "number"
        ? s.id
        : /^\d+$/.test(s.id.trim())
          ? Number(s.id)
          : STATUS_TAREFA_POR_TEXTO[normalizar(s.id)];
    return id === undefined ? null : { id, descricao: s.descricao };
  });

const atividade = z.object({
  /**
   * Id da tarefa do cronograma quando `cronograma` é true; fora dele é um id
   * curto, único só dentro do relatório.
   */
  tarefaId: texto,
  cronograma: z.boolean().nullish(),
  item: texto,
  descricao: z.string(),
  observacao: texto,
  porcentagem: numero.nullish(),
  porcentagemAnterior: numero.nullish(),
  controleDeProducao: controleDeProducao.nullish(),
  status: statusDaAtividade.nullish(),
  etapa: z.object({ _id: texto, item: texto, descricao: texto }).nullish(),
  horario: horario.nullish(),
  fotos: lista(foto),
  videos: lista(video),
});

const ocorrencia = z.object({
  /** Id curto, único só dentro do relatório. */
  _id: z.string(),
  descricao: z.string(),
  /** Tipos de ocorrência; só os com `checked` valem. */
  tags: lista(
    z.object({
      _id: z.string(),
      descricao: z.string(),
      checked: z.boolean().nullish(),
    }),
  ),
  horario: horario.nullish(),
  tarefa: z.object({ _id: texto, descricao: texto }).nullish(),
  fotos: lista(foto),
  videos: lista(video),
});

/** Material com quantidade em texto livre, às vezes com unidade ("10m"). */
const material = z.object({
  descricao: z.string(),
  quantidade: texto,
});

/** GET /obras/{obra-id}/relatorios/{relatorio-id}: o diário completo. */
export const relatorioSchema = relatorioResumoSchema
  // No detalhe, "obra" vem com outro formato e "criadoPor" não vem: valem os da lista.
  .omit({ obra: true, criadoPor: true })
  .extend({
    prazo: prazo.nullish(),
    horarioDeTrabalho: z
      .object({
        expedienteInicio: texto,
        expedienteFim: texto,
        intervaloInicio: texto,
        intervaloFim: texto,
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
    comentarios: lista(
      z.object({
        descricao: z.string(),
        dataHora: dataHoraOpcional,
        usuario: z.object({ nome: texto }).nullish(),
      }),
    ),
    galeriaDeFotos: lista(foto),
    videos: lista(video),
    anexos: lista(anexo),
    /** Link do PDF do relatório no Diário de Obra. */
    linkPdf: link,
    created: dataHoraOpcional,
    modified: dataHoraOpcional,
  });

const tarefaResumo = z.object({
  _id: z.string(),
  posicao: z.number().int().nullish(),
  item: texto,
  descricao: z.string(),
  porcentagem: numero,
  controleDeProducao: controleDeProducao.nullish(),
  totalFotos: inteiro,
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
      item: texto,
      descricao: z.string(),
      porcentagem: numero,
      tarefas: lista(tarefaResumo),
    }),
  ),
});

/**
 * Ocorrências da tarefa num relatório: o formato não aparece na
 * documentação (vem vazio no exemplo). Aceita texto ou objeto com
 * "descricao"; o que não for nenhum dos dois é ignorado.
 */
const ocorrenciasDaTarefa = z
  .array(z.unknown())
  .nullish()
  .transform((v) =>
    (v ?? []).flatMap((o) => {
      if (typeof o === "string" && o.trim()) return [{ descricao: o.trim() }];
      const r = z.object({ descricao: z.string().min(1) }).safeParse(o);
      return r.success ? [r.data] : [];
    }),
  );

/** GET /obras/{obra-id}/lista-de-tarefas/{tarefa-id}: a tarefa em cada relatório. */
export const tarefaSchema = tarefaResumo
  .omit({ posicao: true, totalFotos: true })
  .extend({
    /** Texto ("3h e 30min"). */
    totalHoras: texto,
    status: status.nullish(),
    relatorios: lista(
      z.object({
        _id: z.string(),
        data: dataBr,
        dataFim: dataOpcional,
        observacao: texto,
        porcentagem: numero.nullish(),
        porcentagemAnterior: numero.nullish(),
        controleDeProducao: controleDeProducao.nullish(),
        horario: horario.nullish(),
        ocorrencias: ocorrenciasDaTarefa,
        fotos: lista(foto),
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
export type Foto = z.infer<typeof foto>;
export type Video = z.infer<typeof video>;
export type Anexo = z.infer<typeof anexo>;
