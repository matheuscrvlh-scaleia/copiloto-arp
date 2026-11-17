import { z } from "zod";

// Respostas da API v2 do RD Station CRM. O conector (apps/api) valida com
// estes schemas; as regras do Comercial usam os tipos.

const txt = z
  .string()
  .nullish()
  .transform((v) => v ?? "");
const num = z.coerce
  .number()
  .nullish()
  .transform((v) => (Number.isFinite(v) ? (v as number) : 0));
const id = z.union([z.string(), z.number()]).transform(String);
const idOpcional = id.nullish().transform((v) => v ?? null);

export const tokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});
export type TokensRdCrm = z.infer<typeof tokensSchema>;

/** Item de lista com id e nome (funil, etapa, usuário, fonte, campanha...). */
export const comNome = z.object({ id, name: txt });
export type ItemRdCrm = z.infer<typeof comNome>;

export const funilSchema = comNome.extend({
  stage_ids: z
    .array(id)
    .nullish()
    .transform((v) => v ?? []),
});
export type FunilRdCrm = z.infer<typeof funilSchema>;

export const campoSchema = z.object({
  id,
  slug: txt,
  label: z.string().nullish(),
  name: z.string().nullish(),
});
export type CampoRdCrm = z.infer<typeof campoSchema>;

export const contatoSchema = z.object({
  id,
  name: txt,
  job_title: z.string().nullish(),
  emails: z
    .array(z.object({ email: txt }))
    .nullish()
    .transform((v) => v ?? []),
  phones: z
    .array(z.object({ phone: txt }))
    .nullish()
    .transform((v) => v ?? []),
});
export type ContatoRdCrm = z.infer<typeof contatoSchema>;

export const negociacaoSchema = z.object({
  id,
  name: txt,
  rating: num,
  status: z.string().nullish(),
  one_time_price: num,
  recurrence_price: num,
  expected_close_date: z.string().nullish(),
  closed_at: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string().nullish(),
  pipeline_id: idOpcional,
  stage_id: idOpcional,
  owner_id: idOpcional,
  source_id: idOpcional,
  campaign_id: idOpcional,
  lost_reason_id: idOpcional,
  organization_id: idOpcional,
  contact_ids: z
    .array(id)
    .nullish()
    .transform((v) => v ?? []),
  custom_fields: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((v) => v ?? {}),
});
export type NegociacaoRdCrm = z.infer<typeof negociacaoSchema>;
