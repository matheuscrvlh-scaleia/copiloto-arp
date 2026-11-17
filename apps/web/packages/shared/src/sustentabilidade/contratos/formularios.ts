import { z } from "zod";
import { operacaoSchema } from "../editor-operacoes";
import type { IndicadoresPorCampo, Marca, Uso } from "../formulario/editor";
import { definicaoSchema } from "../formulario/tipos";

// Contratos dos formulários específicos (spec 4.13): o editor (rascunho,
// uso, versões, alterações) e a lista de formulários de um programa (4.8).

const uuid = z.uuid();
const tipo = z.enum(["questionario", "programa"]);

export const idDoFormulario = z.object({ id: z.string().max(60) });

/** GET /sustentabilidade/formularios/questionario */
export const respostaQuestionario = z.object({ id: z.string().nullable() });

export const formularioDoPrograma = z.object({
  id: z.string(),
  nome: z.string(),
  ativo: z.boolean(),
  versao_publicada: z.number(),
  /** Campos ativos (em seção ativa) no rascunho atual. */
  campos_ativos: z.number(),
  lancamentos: z.number(),
});
export type FormularioDoPrograma = z.infer<typeof formularioDoPrograma>;

/** GET /sustentabilidade/formularios?programa=<id> */
export const consultaDosFormularios = z.object({ programa: uuid });
export const respostaFormulariosDoPrograma = z.object({
  formularios: z.array(formularioDoPrograma),
});

export const versaoDoEditor = z.object({
  versao: z.number(),
  em: z.string(),
  por: z.string(),
  resumo: z.string(),
  /** Entrevistas salvas ou lançamentos nesta versão. */
  usos: z.number(),
});
export type VersaoDoEditor = z.infer<typeof versaoDoEditor>;

export const alteracaoDoEditor = z.object({
  id: z.string(),
  quando: z.string(),
  quem: z.string(),
  descricao: z.string(),
});
export type AlteracaoDoEditor = z.infer<typeof alteracaoDoEditor>;

const mapa = <T>() =>
  z.custom<T>((v) => typeof v === "object" && v !== null && !Array.isArray(v));

export const dadosEditor = z.object({
  id: z.string(),
  nome: z.string(),
  tipo,
  /** Nome do programa (formulário de programa). */
  programa: z.string().nullable(),
  ativo: z.boolean(),
  /** Formulário dos dados de exemplo (as contagens são fictícias). */
  exemplo: z.boolean(),
  versao: z.number(),
  rascunho: definicaoSchema,
  atualizadoEm: z.string(),
  /** Rascunho diferente da versão publicada. */
  alterado: z.boolean(),
  /** Alterações registradas desde a publicação (ou o descarte). */
  pendentes: z.number(),
  marcas: mapa<Record<string, Marca>>(),
  uso: mapa<Uso>(),
  indicadores: mapa<IndicadoresPorCampo>(),
  indicadoresAtivos: mapa<IndicadoresPorCampo>(),
  /** Ids de seções, perguntas e opções da versão publicada. */
  idsPublicados: z.array(z.string()),
  versoes: z.array(versaoDoEditor),
  alteracoes: z.array(alteracaoDoEditor),
  /** "Formulários específicos – excluir". */
  podeExcluir: z.boolean(),
  /** Unidades sugeridas (Parâmetros). */
  unidades: z.array(z.string()),
});
export type DadosEditor = z.infer<typeof dadosEditor>;

/**
 * GET /sustentabilidade/formularios/:id/editor. `editor` null: o formulário
 * não existe, ou (com `semAcesso`) a pessoa não pode editá-lo; a tela mostra
 * o aviso de cada caso.
 */
export const respostaEditorDados = z.object({
  editor: dadosEditor.nullable(),
  semAcesso: z.boolean(),
});

/**
 * Resposta das gravações do editor. Vem sempre com 200: além do erro, a tela
 * precisa de `podeInativar` e da lista `erros` para decidir o que oferecer.
 */
export const respostaEditor = z.object({
  ok: z.literal(true).optional(),
  erro: z.string().optional(),
  /** Não pode excluir, mas pode inativar: a tela oferece "Inativar". */
  podeInativar: z.boolean().optional(),
  /** O que mostrar depois (indicadores afetados, dependentes). */
  avisos: z.array(z.string()).optional(),
  /** Conferência antes de publicar: a lista do que corrigir. */
  erros: z.array(z.string()).optional(),
  versao: z.number().optional(),
});
export type RespostaEditor = z.infer<typeof respostaEditor>;

/** POST /sustentabilidade/formularios/:id/rascunho */
export const entradaAlterarRascunho = z.object({
  atualizadoEm: z.string().min(1),
  operacao: operacaoSchema,
});
export type EntradaAlterarRascunho = z.infer<typeof entradaAlterarRascunho>;

/** POST .../rascunho/descartar */
export const entradaVersaoOtimista = z.object({
  atualizadoEm: z.string().min(1),
});

/** POST .../rascunho/restaurar */
export const entradaRestaurar = entradaVersaoOtimista.extend({
  versao: z.number().int().positive(),
});

/** POST .../publicar */
export const entradaPublicar = entradaVersaoOtimista.extend({
  resumo: z
    .string()
    .trim()
    .min(1, "Escreva um resumo do que mudou nesta versão.")
    .max(500, "Use até 500 caracteres no resumo."),
});

/** GET .../versoes/:versao (só leitura) */
export const respostaVersao = z.object({
  definicao: definicaoSchema.optional(),
  erro: z.string().optional(),
});

export const nomeDoFormulario = z
  .string()
  .trim()
  .min(1, "Informe o nome do formulário.")
  .max(120, "Use até 120 caracteres no nome.");

/** Resposta das ações da lista de formulários do programa (sempre 200). */
export const respostaFormulario = z.object({
  ok: z.literal(true).optional(),
  erro: z.string().optional(),
  id: z.string().optional(),
});
export type RespostaFormulario = z.infer<typeof respostaFormulario>;

/** POST /sustentabilidade/formularios */
export const entradaCriarFormulario = z.object({
  programaId: z.string().max(60),
  nome: z.string().max(500),
});

/** PATCH /sustentabilidade/formularios/:id */
export const entradaAlterarFormulario = z.object({
  nome: z.string().max(500).optional(),
  ativo: z.boolean().optional(),
});
