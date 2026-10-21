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
 * CPF, RG, contatos e endereço ficam de fora de propósito. O bloco
 * `compensation` (salário) também: o salário vem da folha.
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
  department: z.object({ id: z.string(), name: z.string() }).nullish(),
  position: z
    .object({ id: z.string(), title: z.string(), level: z.string().nullish() })
    .nullish(),
  updated_at: z.string(),
  personal: z.object({ birth_date: z.string().nullish() }).nullish(),
});

export type Colaborador = z.infer<typeof colaboradorSchema>;
export type StatusColaborador = (typeof STATUS_COLABORADOR)[number];
