import { z } from "zod";
import { definicaoSchema } from "../formulario/tipos";

// Contratos dos lançamentos dos programas (spec 4.8): a aba Lançamentos,
// "Lançar pela equipe", corrigir e excluir. O mesmo formulário serve à
// página do parceiro (./parceiro).

const respostas = z.record(z.string().max(100), z.unknown());

export const ORIGENS = ["equipe", "link", "importacao"] as const;
export type Origem = (typeof ORIGENS)[number];

export const ROTULO_ORIGEM: Record<Origem, string> = {
  equipe: "Equipe",
  link: "Via link",
  importacao: "Importação",
};

export const idDoLancamento = z.object({ id: z.uuid("Lançamento inválido.") });

export const lancamentoDaLista = z.object({
  id: z.string(),
  formularioId: z.string(),
  versao: z.number(),
  data: z.string(),
  origem: z.enum(ORIGENS),
  /** Comuns + em reais (sem "Ver valores", só os comuns). */
  valores: z.record(z.string(), z.unknown()),
  lancadoPor: z.string().nullable(),
  criadoEm: z.string(),
  exemplo: z.boolean(),
});
export type LancamentoDaLista = z.infer<typeof lancamentoDaLista>;

export const formularioParaLancar = z.object({
  id: z.string(),
  nome: z.string(),
  versao: z.number(),
  definicao: definicaoSchema,
});
export type FormularioParaLancar = z.infer<typeof formularioParaLancar>;

export const custoPorPessoa = z.object({
  pessoas: z.string(),
  custos: z.record(z.string(), z.number()),
});

/** Nomes já cadastrados por campo "lista de cadastro". */
export const listasDeCadastro = z.record(z.string(), z.array(z.string()));

/** GET /sustentabilidade/programas/:id/lancamentos?mes=aaaa-mm */
export const respostaLancamentos = z.object({
  lancamentos: z.array(lancamentoDaLista),
  /** Ativos e publicados (sem "Ver valores", sem os campos em reais). */
  formularios: z.array(formularioParaLancar),
  /** Definições das versões usadas na lista ("<formulário>:<versão>"). */
  definicoes: z.record(z.string(), definicaoSchema),
  listas: listasDeCadastro,
  /** Custos por pessoa do tour (só com "Ver valores"). */
  custos: custoPorPessoa.nullable(),
});
export type RespostaLancamentos = z.infer<typeof respostaLancamentos>;

/** POST /sustentabilidade/programas/:id/lancamentos */
export const entradaLancamento = z.object({
  formularioId: z.uuid(),
  versao: z.number().int().positive(),
  respostas,
  data: z.string().max(10).nullish(),
});
export type EntradaLancamento = z.infer<typeof entradaLancamento>;

/** PATCH /sustentabilidade/lancamentos/:id (a mesma versão do formulário). */
export const entradaCorrecao = z.object({
  respostas,
  data: z.string().max(10).nullish(),
});
export type EntradaCorrecao = z.infer<typeof entradaCorrecao>;

/** GET /sustentabilidade/lancamentos/:id/correcao */
export const respostaCorrecao = z.object({
  definicao: definicaoSchema,
  valores: z.record(z.string(), z.unknown()),
  data: z.string(),
  listas: listasDeCadastro,
  custos: custoPorPessoa.nullable(),
});
export type RespostaCorrecao = z.infer<typeof respostaCorrecao>;

/** Respostas e data como o formulário de lançamento manda. */
export type EnvioDoFormulario = {
  respostas: Record<string, unknown>;
  data: string | null;
};
