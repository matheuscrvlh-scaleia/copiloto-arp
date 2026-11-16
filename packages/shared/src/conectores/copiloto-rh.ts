import { z } from "zod";

// API pública v1 (https://app.copilotorh.com.br/api-docs), lida em
// 20/10/2026. Só os campos que usamos; o resto da resposta é descartado.

export const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
});

/** GET /v1/me: empresa e escopos da credencial. */
export const meSchema = z.object({
  organization: z.object({ id: z.string(), name: z.string() }),
  scopes: z.array(z.string()),
});

export type Me = z.infer<typeof meSchema>;

export function paginaSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    pagination: z.object({
      page: z.number().int(),
      per_page: z.number().int(),
      total: z.number().int().nonnegative(),
      has_more: z.boolean(),
    }),
  });
}

export const departamentoSchema = z.object({
  id: z.string(),
  name: z.string(),
  updated_at: z.string(),
});

export const cargoSchema = z.object({
  id: z.string(),
  title: z.string(),
  parent_position_id: z.string().nullish(),
  updated_at: z.string(),
});

export const STATUS_COLABORADOR = [
  "pending",
  "active",
  "on_leave",
  "terminated",
] as const;

/**
 * Datas de admissão, desligamento e nascimento vêm como "aaaa-mm-dd".
 * Do bloco `personal` (escopo employees:personal:read) só o nascimento entra;
 * CPF, RG, contatos e endereço ficam de fora de propósito. Do bloco
 * `compensation` só o salário-base: é o valor mensal do contrato do PJ, que não
 * está na folha. O sync guarda só o dos PJ (o dos outros vem da folha).
 */
export const colaboradorSchema = z.object({
  id: z.string(),
  /** Matrícula. */
  code: z.string().nullish(),
  full_name: z.string(),
  status: z.enum(STATUS_COLABORADOR),
  employment_type: z.string().nullish(),
  contract_type: z.string().nullish(),
  hire_date: z.string().nullish(),
  termination_date: z.string().nullish(),
  termination_reason: z.string().nullish(),
  /** pediu_pra_sair, foi_demitido ou acordo_mutuo: vale antes do motivo. */
  termination_decision: z.string().nullish(),
  department: z.object({ id: z.string(), name: z.string() }).nullish(),
  position: z
    .object({ id: z.string(), title: z.string(), level: z.string().nullish() })
    .nullish(),
  updated_at: z.string(),
  personal: z.object({ birth_date: z.string().nullish() }).nullish(),
  compensation: z
    .object({
      // Número ou texto ("2000.00"); vazio é não informado.
      base_salary: z.preprocess(
        (v) =>
          typeof v === "string" ? (v.trim() === "" ? null : Number(v)) : v,
        z.number().nonnegative().nullish(),
      ),
    })
    .nullish(),
});

export type Colaborador = z.infer<typeof colaboradorSchema>;

/**
 * GET /v1/dependents (escopo employees:personal:read), a aba Dependentes do
 * perfil. Só o que o plano de saúde precisa: CPF e a marca de IR ficam de
 * fora de propósito.
 */
export const dependenteSchema = z.object({
  id: z.string(),
  employee_id: z.string(),
  full_name: z.string(),
  birth_date: z.string().nullish(),
  /** filho, conjuge, pai_mae ou outro (descrição em dependent_type_other). */
  dependent_type: z.string().nullish(),
  dependent_type_other: z.string().nullish(),
  is_health_plan_dependent: z.boolean(),
  updated_at: z.string(),
});

export type Dependente = z.infer<typeof dependenteSchema>;

// GET /v1/turnover (escopo reports:read), lido em 21/10/2026: os números da
// tela Relatórios › Turnover, pelo mesmo código. A taxa por Acordo só vem
// quando o Acordo é contado à parte (agreement_counts_as = "separate").

const taxasSchema = z.object({
  general: z.number(),
  voluntary: z.number(),
  involuntary: z.number(),
  agreement: z.coerce.number().nullable(),
});

const contagensSchema = z.object({
  terminations: z.number().int(),
  voluntary: z.number().int(),
  involuntary: z.number().int(),
  agreement: z.number().int(),
  hires: z.number().int(),
  headcount_start: z.number().int(),
  headcount_end: z.number().int(),
});

export const turnoverSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  agreement_counts_as: z.enum(["voluntary", "involuntary", "separate"]),
  rates: taxasSchema,
  counts: contagensSchema,
  monthly: z.array(
    z.object({
      month: z.string(),
      from: z.string(),
      to: z.string(),
      rates: taxasSchema,
      counts: contagensSchema,
    }),
  ),
  by_department: z.array(
    z.object({
      // Colaboradores sem departamento vêm num grupo sem departamento.
      department: z.object({ id: z.string(), name: z.string() }).nullish(),
      active: z.number().int(),
      terminations: z.number().int(),
      rate: z.number(),
    }),
  ),
});

export type Turnover = z.infer<typeof turnoverSchema>;
export type StatusColaborador = (typeof STATUS_COLABORADOR)[number];
