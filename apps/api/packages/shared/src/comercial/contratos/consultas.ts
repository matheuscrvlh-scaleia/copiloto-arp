import { z } from "zod";
import type { Empresa, Endereco } from "../../conectores/publicos";

// Consultas de CEP e CNPJ dos formulários do Comercial. Falha, entrada
// errada ou limite estourado devolvem null: a pessoa digita normalmente.
//
//   GET /api/v1/comercial/consultas/cep/:valor    → { endereco: Endereco | null }
//   GET /api/v1/comercial/consultas/cnpj/:valor   → { empresa: Empresa | null }

export const endereco = z.object({
  cep: z.string(),
  logradouro: z.string(),
  bairro: z.string(),
  cidade: z.string(),
  uf: z.string(),
}) satisfies z.ZodType<Endereco>;

export const empresa = z.object({
  cnpj: z.string(),
  razaoSocial: z.string(),
  nomeFantasia: z.string(),
  naturezaJuridica: z.string(),
  cnaePrincipal: z.string(),
  capitalSocial: z.number().nullable(),
  situacao: z.string(),
  endereco: endereco.extend({ numero: z.string(), complemento: z.string() }),
  socios: z.array(z.object({ nome: z.string(), qualificacao: z.string() })),
}) satisfies z.ZodType<Empresa>;

export const paramsConsulta = z.object({ valor: z.string().max(40) });

export const respostaCep = z.object({ endereco: endereco.nullable() });
export type RespostaCep = z.infer<typeof respostaCep>;

export const respostaCnpj = z.object({ empresa: empresa.nullable() });
export type RespostaCnpj = z.infer<typeof respostaCnpj>;
