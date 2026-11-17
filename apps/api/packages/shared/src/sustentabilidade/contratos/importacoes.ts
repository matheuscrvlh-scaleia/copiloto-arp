import { z } from "zod";
import type { Aviso, Decisao, Periodo, TipoDeImportacao } from "../importacao";
import type {
  ContagemDeAvisos,
  StatusImportacaoSu,
} from "../importacao-historico";
import {
  type Escolhas,
  escolhasSchema,
  type TotalDoMes,
} from "../importacao-linhas";

// Contratos das importações do histórico (spec 4.10): a lista, o detalhe, a
// prévia e os três passos (enviar e ler, escolhas, confirmar ou desfazer).

/** O que fica em `importacoes.resumo` (sem reais). */
export interface ResumoGravado {
  texto: string;
  lidas: number;
  linhas: number;
  periodo: Periodo;
  conferencias: string[];
  avisos: ContagemDeAvisos;
  destino?: string;
}

export interface ImportacaoNaListaSu {
  id: string;
  tipo: TipoDeImportacao;
  status: StatusImportacaoSu;
  arquivo: string;
  resumo: ResumoGravado;
  criadoEm: string;
  criadoPor: string | null;
  confirmadoEm: string | null;
  confirmadoPor: string | null;
  desfeitoEm: string | null;
  desfeitoPor: string | null;
  minha: boolean;
}

export interface ImportacaoGravada extends ImportacaoNaListaSu {
  avisos: Aviso[];
  escolhas: Escolhas;
  substitui: string | null;
}

export interface DestinoDaPrevia {
  programas: { id: string; nome: string }[];
  formularios: { id: string; nome: string; programa_id: string }[];
  programa_id: string | null;
  formulario_id: string | null;
  /** Coluna lida → campo do formulário (null: não entra). */
  colunas: {
    coluna: string;
    rotulo: string;
    campo: string | null;
    reais: boolean;
  }[];
  /** Campos do formulário sem coluna no arquivo (ficam vazios). */
  semColuna: string[];
}

export interface PreviaSu {
  id: string;
  tipo: TipoDeImportacao;
  lidas: number;
  entram: number;
  periodo: Periodo;
  porMes: TotalDoMes[];
  porAno: TotalDoMes[];
  /** Rótulo da quantidade somada por mês (ecocopos, participantes). */
  quantidade: string | null;
  avisos: Aviso[];
  decisoes: Decisao[];
  escolhas: Escolhas;
  /** Ids das decisões ainda sem resposta. */
  pendentes: string[];
  /** Abas de orçamento de eventos que ficaram de fora. */
  ignoradas: string[];
  destino: DestinoDaPrevia | null;
  /** Contratos para o vínculo à mão (entrevistas com decisão de vínculo). */
  contratos: { id: string; rotulo: string }[];
  tabela: {
    colunas: string[];
    numeros: boolean[];
    linhas: { chave: string; celulas: string[] }[];
    total: number;
  };
  /** Valores que não casaram com o campo (a linha entra sem eles). */
  naoConvertidos: { n: number; exemplos: string[] };
  /** Totais em reais por campo (só com "Ver valores"); null sem a permissão. */
  reais: { rotulo: string; total: number }[] | null;
  /** Contagens para conferir com a planilha (entrevistas: grau, PGRS). */
  conferencias: { titulo: string; itens: { resposta: string; n: number }[] }[];
  /** Por que não dá para confirmar (além das decisões pendentes). */
  bloqueio: string | null;
}

const objeto = <T>() => z.custom<T>((v) => typeof v === "object" && v !== null);

/** GET /sustentabilidade/importacoes */
export const respostaImportacoes = z.object({
  importacoes: objeto<ImportacaoNaListaSu[]>(),
  /** "Dados de dd/mm/aaaa às hh:mm". */
  dadosDe: z.string(),
});

/**
 * GET /sustentabilidade/importacoes/:id. `previa` só enquanto é prévia (null
 * também quando o arquivo dela não pôde ser relido).
 */
export const respostaImportacao = z.object({
  importacao: objeto<ImportacaoGravada>(),
  previa: objeto<PreviaSu>().nullable(),
  /** "Dados de dd/mm/aaaa às hh:mm". */
  dadosDe: z.string(),
});
export type RespostaImportacao = z.infer<typeof respostaImportacao>;

/** POST /sustentabilidade/importacoes/envio */
export const entradaPrepararEnvio = z.object({
  tipo: z.string().max(40),
  nome: z.string().max(400),
  tamanho: z.number(),
});
export const respostaEnvioPreparado = z.union([
  z.object({ ok: z.literal(true), url: z.string(), caminho: z.string() }),
  z.object({ ok: z.literal(false), erro: z.string() }),
]);
export type EnvioPreparado = z.infer<typeof respostaEnvioPreparado>;

/** POST /sustentabilidade/importacoes */
export const entradaLerEnvio = z.object({
  tipo: z.string().max(40),
  caminho: z.string().max(400),
  nome: z.string().max(400),
  substituir: z.boolean().optional(),
});
export const respostaDoEnvio = z.union([
  z.object({ ok: z.literal(true), id: z.string() }),
  z.object({
    ok: z.literal(false),
    repetida: z.object({
      id: z.string(),
      quando: z.string(),
      texto: z.string(),
    }),
  }),
  z.object({ ok: z.literal(false), erro: z.string() }),
]);
export type RespostaDoEnvio = z.infer<typeof respostaDoEnvio>;

/** POST /sustentabilidade/importacoes/envio/descartar */
export const entradaDescartarEnvio = z.object({ caminho: z.string().max(400) });

/** PUT /sustentabilidade/importacoes/:id/escolhas */
export const entradaEscolhas = z.object({ escolhas: z.unknown() });
export { escolhasSchema };

/** Resposta das gravações que a tela trata como `EstadoAcao` (sempre 200). */
export const respostaEstado = z.object({
  ok: z.string().optional(),
  erro: z.string().optional(),
});
export type RespostaEstado = z.infer<typeof respostaEstado>;
