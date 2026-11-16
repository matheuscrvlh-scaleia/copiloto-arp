import { z } from "zod";

// Token, bancos, Departamentos, Funcionarios e Calcular conferidos com a base
// da ARP em 19/10/2026. Afastamentos ainda segue o manual (2021).

export const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
});

export const bancoSchema = z.object({
  id: z.number(),
  nome: z.string(),
  razaoSocial: z.string().nullish(),
  documento: z.string().nullish(),
});

export const departamentoSchema = z.object({
  Id: z.number(),
  Descricao: z.string(),
  Nfolha: z.string().nullish(),
  Desativado: z.boolean().optional(),
});

const funcaoSchema = z.object({
  Id: z.number(),
  Descricao: z.string(),
  Desativado: z.boolean().optional(),
});

/** Datas vêm sem fuso: "aaaa-mm-ddThh:mm:ss". */
export const funcionarioSchema = z.object({
  Id: z.number(),
  Nome: z.string(),
  NumeroFolha: z.string().nullish(),
  Cpf: z.string().nullish(),
  NumeroPis: z.string().nullish(),
  Nascimento: z.string().nullish(),
  Admissao: z.string().nullish(),
  /** null = ativo. */
  Demissao: z.string().nullish(),
  Departamento: departamentoSchema.nullish(),
  Funcao: funcaoSchema.nullish(),
  MotivoDemissaoId: z.number().nullish(),
  Invisivel: z.boolean().optional(),
});

export const motivoDemissaoSchema = z.object({
  Id: z.number(),
  Descricao: z.string(),
});

// A resposta também traz Cpf e NumeroPis; ficam de fora de propósito
// (a ligação com o colaborador é pela matrícula, NumeroFolha).
export const afastamentoSchema = z.object({
  Id: z.number(),
  NumeroFolha: z.string().nullish(),
  Inicio: z.string(),
  Fim: z.string(),
  Motivo: z.string().nullish(),
  JustificativaNome: z.string().nullish(),
});

/**
 * Resposta de /Calcular: a tabela de Relatórios › Cálculos do Ponto Web.
 * As colunas dependem da configuração do ponto. Na ARP: Data, batidas,
 * Normais, Faltas, Ex80%, Ex100%, DSR, Not., Abono2-4, Atras., Carga,
 * BSaldo, BTotal, BCred., BDeb., FaltasDias… Valores em "hh:mm".
 */
export const calculoSchema = z.object({
  Colunas: z.array(z.string()),
  // Célula vazia (dia sem batida, coluna sem valor) vem como null.
  Linhas: z.array(
    z.object({ Key: z.string(), Value: z.array(z.string().nullable()) }),
  ),
  Totais: z.array(z.string()),
});

export type Banco = z.infer<typeof bancoSchema>;
export type Departamento = z.infer<typeof departamentoSchema>;
export type Funcionario = z.infer<typeof funcionarioSchema>;
export type Afastamento = z.infer<typeof afastamentoSchema>;
export type MotivoDemissao = z.infer<typeof motivoDemissaoSchema>;
export type Calculo = z.infer<typeof calculoSchema>;
