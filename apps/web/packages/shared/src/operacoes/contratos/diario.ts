import { z } from "zod";
import type {
  Anexo,
  Foto,
  ListaDeTarefas,
  Obra,
  Relatorio,
  Video,
} from "../../conectores/diario-de-obras";
import { resumoSchema } from "../diario";

// Contratos do Diário de Obra (cópia do aplicativo, spec 4.9): o estado da
// consulta, as obras, os relatórios e os pedaços do relatório completo. A
// ficha, o cronograma e o relatório são o JSON que a sincronização gravou
// depois de passar pelo schema do conector: aqui só se confere que é um
// objeto (ou uma lista).

const objeto = <T>() =>
  z.custom<T>((v) => v !== null && typeof v === "object" && !Array.isArray(v));
const lista = <T>() => z.custom<T[]>((v) => Array.isArray(v));

export const estadoDoDiario = z.object({
  /** Há token salvo em Administração › Configurações › Integrações (e ativo). */
  configurado: z.boolean(),
  /** Token salvo, mas a integração foi desativada. */
  desativado: z.boolean(),
  /** Última consulta que terminou bem. */
  ultima: z
    .object({
      em: z.string(),
      avisos: z.array(z.string()),
      pendente: z.boolean(),
    })
    .nullable(),
  /** A última consulta falhou depois da última boa. */
  falha: z.object({ em: z.string(), erro: z.string() }).nullable(),
  /** Consulta em andamento (início). */
  rodando: z.string().nullable(),
  /** Ainda há obras de exemplo (fictícias). */
  exemplo: z.boolean(),
  /** Último relatório lançado no aplicativo (de /empresa). */
  ultimoRelatorioNoApp: z.string().nullable(),
});
export type EstadoDiario = z.infer<typeof estadoDoDiario>;

/** GET /operacoes/diario/estado */
export const respostaEstadoDoDiario = z.object({ estado: estadoDoDiario });

export const obraDoDiario = z.object({
  id: z.string(),
  nome: z.string(),
  statusId: z.number(),
  grupo: z.string().nullable(),
  responsavel: z.string().nullable(),
  dataInicio: z.string().nullable(),
  dataFim: z.string().nullable(),
  prazo: z.object({
    contratual: z.number().nullable(),
    decorrido: z.number().nullable(),
    aVencer: z.number().nullable(),
  }),
  realizado: z.number().nullable(),
  tarefas: z
    .object({
      total: z.number(),
      naoIniciada: z.number(),
      emAndamento: z.number(),
      concluida: z.number(),
    })
    .nullable(),
  ficha: objeto<Obra>().nullable(),
  exemplo: z.boolean(),
});

export const relatorioDaLista = z.object({
  id: z.string(),
  obraId: z.string(),
  numero: z.number(),
  data: z.string(),
  dataFim: z.string().nullable(),
  statusId: z.number(),
});

/** GET /operacoes/diario/obras: as obras e as datas de todos os relatórios */
export const respostaObrasDoDiario = z.object({
  obras: z.array(obraDoDiario),
  relatorios: z.array(relatorioDaLista),
});

/** GET /operacoes/diario/obras/:id: a obra com o cronograma */
export const respostaObraDoDiario = z.object({
  obra: obraDoDiario.extend({
    cronograma: objeto<ListaDeTarefas>().nullable(),
  }),
});

export const linhaRelatorio = z.object({
  id: z.string(),
  obraId: z.string(),
  obra: z.string(),
  numero: z.number(),
  data: z.string(),
  dataFim: z.string().nullable(),
  statusId: z.number(),
  modelo: z.string().nullable(),
  modeloId: z.string().nullable(),
  autor: z.string().nullable(),
  autorCargo: z.string().nullable(),
  autorId: z.string().nullable(),
  app: z.string().nullable(),
  criadoNoApp: z.string().nullable(),
  resumo: resumoSchema.nullable(),
  exemplo: z.boolean(),
});
export type LinhaRelatorio = z.infer<typeof linhaRelatorio>;

/** GET /operacoes/diario/relatorios?de=&ate=&obra=&status=&modelo=&autor= */
export const respostaRelatorios = z.object({
  relatorios: z.array(linhaRelatorio),
});

/** Filtros da lista (status: um ou mais ids, separados por vírgula). */
export const buscaDosRelatorios = z.object({
  de: z.iso.date(),
  ate: z.iso.date(),
  obra: z.string().max(64).optional(),
  status: z.string().max(40).optional(),
  modelo: z.string().max(64).optional(),
  autor: z.string().max(64).optional(),
});

const opcao = z.object({ valor: z.string(), rotulo: z.string() });

/** GET /operacoes/diario/relatorios/opcoes */
export const respostaOpcoesDosRelatorios = z.object({
  modelos: z.array(opcao),
  autores: z.array(opcao),
});

/** GET /operacoes/diario/relatorios/:id */
export const respostaRelatorioCompleto = z.object({
  relatorio: linhaRelatorio.extend({
    dados: objeto<Relatorio>().nullable(),
    detalhadoEm: z.string().nullable(),
  }),
});

export const PARTES_DO_RELATORIO = [
  "ocorrencias",
  "equipamentos",
  "material",
  "galeria",
  "videos",
  "anexos",
  "atividades",
] as const;
export type ParteDoRelatorio = (typeof PARTES_DO_RELATORIO)[number];

/** GET /operacoes/diario/obras/:id/partes?partes=a,b&de=&ate= */
export const buscaDasPartes = z.object({
  partes: z.string().max(200),
  de: z.iso.date().optional(),
  ate: z.iso.date().optional(),
});

export const partesDoRelatorio = z.object({
  id: z.string(),
  numero: z.number(),
  data: z.string(),
  ocorrencias: lista<Relatorio["ocorrencias"][number]>(),
  equipamentos: lista<Relatorio["equipamentos"][number]>(),
  material: objeto<NonNullable<Relatorio["controleDeMaterial"]>>().nullable(),
  galeria: lista<Foto>(),
  videos: lista<Video>(),
  anexos: lista<Anexo>(),
  atividades: lista<Relatorio["atividades"][number]>(),
});
export type PartesDoRelatorio = z.infer<typeof partesDoRelatorio>;

export const respostaPartesDosRelatorios = z.object({
  partes: z.array(partesDoRelatorio),
});
