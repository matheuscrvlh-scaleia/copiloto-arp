import { z } from "zod";

// Contratos das Obras — previsto e realizado (spec 4.9): a lista com a
// revisão vigente, uma obra com as revisões e o realizado, a importação do
// orçamento (prévia, escolha, confirmação) e o realizado lançado na tela.

const instante = z.string();
const valorMes = z.object({ mes: z.string(), centavos: z.number() });

export const avisoOrcamento = z.object({
  nivel: z.enum(["erro", "aviso", "info"]),
  mensagem: z.string(),
  linha: z.number().optional(),
});

export const revisao = z.object({
  id: z.string(),
  codigo: z.string(),
  data: z.string().nullable(),
  titulo: z.string().nullable(),
  /** Soma das etapas, em centavos. */
  total: z.number(),
  /** Total escrito na planilha, em centavos. */
  totalArquivo: z.number().nullable(),
  vigente: z.boolean(),
  exemplo: z.boolean(),
  importacaoId: z.string().nullable(),
  /** "confirmada", "previa"… (null: sem importação). */
  status: z.string().nullable(),
  avisos: z.array(avisoOrcamento),
  importadaEm: instante.nullable(),
});
export type Revisao = z.infer<typeof revisao>;

const obraBase = z.object({
  id: z.string(),
  nome: z.string(),
  responsavel: z.string().nullable(),
  ativa: z.boolean(),
  exemplo: z.boolean(),
  diarioObraId: z.string().nullable(),
});

export const obraLinha = obraBase.extend({
  vigente: revisao.nullable(),
  previsto: z.array(valorMes),
  realizado: z.array(valorMes),
  /** Data do último lançamento (ou da importação) do realizado. */
  ultimoLancamento: instante.nullable(),
});
export type ObraLinha = z.infer<typeof obraLinha>;

/** GET /operacoes/obras */
export const respostaObras = z.object({ obras: z.array(obraLinha) });

export const lancamento = z.object({
  id: z.string(),
  etapa: z.string(),
  mes: z.string(),
  centavos: z.number(),
  descricao: z.string().nullable(),
  /** Caminho no bucket "operacoes". */
  anexo: z.string().nullable(),
  /** Link temporário para abrir o anexo. */
  link: z.string().nullable(),
  origem: z.enum(["tela", "planilha"]),
  exemplo: z.boolean(),
  lancadoPor: z.string(),
  lancadoEm: instante,
});
export type Lancamento = z.infer<typeof lancamento>;

export const etapaDaRevisao = z.object({
  revisaoId: z.string(),
  ordem: z.number(),
  nome: z.string(),
  observacao: z.string().nullable(),
  previsto: z.array(valorMes),
});
export type EtapaDaRevisao = z.infer<typeof etapaDaRevisao>;

/** GET /operacoes/obras/:id */
export const respostaDadosDaObra = z.object({
  obra: obraBase,
  /** Todas as revisões (confirmadas e a prévia), da mais nova à mais velha. */
  revisoes: z.array(revisao),
  etapas: z.array(etapaDaRevisao),
  lancamentos: z.array(lancamento),
  limites: z.object({ desvioPontos: z.number(), orcamentoPct: z.number() }),
});
export type DadosDaObra = z.infer<typeof respostaDadosDaObra>;

const idENome = z.object({ id: z.string(), nome: z.string() });

/** GET /operacoes/obras/para-importar e /operacoes/obras/diario-para-vincular */
export const respostaListaDeObras = z.object({ obras: z.array(idENome) });

/** GET /operacoes/obras/ligada/:diarioObraId */
export const respostaObraLigada = z.object({ obra: idENome.nullable() });

// ---------------------------------------------------------------------------
// Importação do orçamento (EstadoOrcamento, sem o erro: erro é resposta 4xx)
// ---------------------------------------------------------------------------

const mes = z.string();

const colunaDeMes = z.object({
  coluna: z.string(),
  texto: z.string(),
  lido: mes.nullable(),
  mes: mes.nullable(),
  realizado: z.boolean(),
  problema: z.enum(["repetido", "fora_de_ordem", "ilegivel"]).nullable(),
  sugestao: mes.nullable(),
  escolhido: z.boolean(),
  deduzido: z.boolean(),
  antes: mes.nullable(),
  depois: mes.nullable(),
});

const previaOrcamento = z.object({
  importacaoId: z.string(),
  obraId: z.string(),
  obraNome: z.string(),
  obraNova: z.boolean(),
  codigo: z.string(),
  revisaoVigente: z.string().nullable(),
  data: z.string().nullable(),
  titulo: z.string().nullable(),
  arquivo: z.string(),
  etapas: z.array(
    z.object({
      nome: z.string(),
      observacao: z.string().nullable(),
      de: mes.nullable(),
      ate: mes.nullable(),
      previsto: z.number(),
      realizado: z.number(),
    }),
  ),
  totalArquivo: z.number().nullable(),
  totalEtapas: z.number(),
  diferenca: z.number().nullable(),
  totalRealizado: z.number(),
  realizadoAte: mes.nullable(),
  realizadoImportado: z.boolean(),
  colunasEscolhidas: z.array(
    z.object({ coluna: z.string(), texto: z.string(), mes }),
  ),
  avisos: z.array(avisoOrcamento),
});

/** POST /operacoes/obras/orcamento (multipart), confirmar e descartar */
export const respostaEstadoOrcamento = z.object({
  escolher: z
    .object({
      arquivo: z.string(),
      obraLida: z.string().nullable(),
      precisaObra: z.boolean(),
      revisao: z.string().nullable(),
      etapas: z.number(),
      colunas: z.array(colunaDeMes),
    })
    .optional(),
  previa: previaOrcamento.optional(),
  confirmado: z
    .object({ obraId: z.string(), obraNome: z.string(), codigo: z.string() })
    .optional(),
  descartado: z.boolean().optional(),
});

/** PATCH /operacoes/obras/:id (dados da obra e vínculo com o Diário) */
export const entradaDadosDaObra = z.record(z.string(), z.unknown());
