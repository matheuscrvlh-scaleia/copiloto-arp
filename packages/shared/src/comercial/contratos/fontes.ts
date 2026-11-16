import { z } from "zod";
import type {
  EnetCliente,
  EnetContrato,
  EnetLuc,
  EnetSocio,
  RdContatoCrm,
  RdOportunidade,
} from "../fontes";

// Registros do RD Station CRM e do ENET (../fontes.ts) como schema Zod: a
// oportunidade gravada pela sincronização é JSON no banco e passa por aqui
// antes de ser usada; os do ENET vão nas respostas das telas.

const ref = z.object({ _id: z.string(), name: z.string() });

export const rdContatoCrm = z.object({
  name: z.string(),
  title: z.string().nullable(),
  emails: z.array(z.object({ email: z.string() })),
  phones: z.array(z.object({ phone: z.string() })),
}) satisfies z.ZodType<RdContatoCrm>;

export const rdOportunidade = z.object({
  _id: z.string(),
  name: z.string(),
  organization: ref.nullable(),
  rating: z.number(),
  deal_pipeline: ref,
  deal_stage: ref,
  win: z.boolean().nullable(),
  deal_lost_reason: ref.nullable(),
  deal_lost_note: z.string().nullable(),
  amount_unique: z.number(),
  amount_montly: z.number(),
  hold: z.boolean(),
  created_at: z.string(),
  first_activity_at: z.string().nullable(),
  last_activity_at: z.string().nullable(),
  next_task: z.object({ date: z.string(), subject: z.string() }).nullable(),
  prediction_date: z.string().nullable(),
  closed_at: z.string().nullable(),
  deal_source: ref.nullable(),
  campaign: ref.nullable(),
  user: ref,
  deal_custom_fields: z.array(
    z.object({
      custom_field: z.object({ _id: z.string(), label: z.string() }),
      value: z.string().nullable(),
    }),
  ),
  contacts: z.array(rdContatoCrm),
}) satisfies z.ZodType<RdOportunidade>;

export const enetLuc = z.object({
  numero: z.string(),
  data_inicio: z.string(),
  tipo_loja: z.string(),
  abl: z.number(),
  area_util: z.number(),
  status: z.enum(["Locado", "Vago"]),
  local: z.string(),
  piso: z.string(),
  rua: z.string(),
  situacao: z.string(),
}) satisfies z.ZodType<EnetLuc>;

export const enetContrato = z.object({
  codigo: z.string(),
  luc: z.string(),
  cliente: z.string(),
  locatario: z.string(),
  data_inicio: z.string(),
  data_termino: z.string().nullable(),
  prazo: z.enum(["Determinado", "Indeterminado"]),
  valor_aluguel: z.number(),
  indice: z.enum(["IGPM", "IPCA"]),
  mes_reajuste: z.number(),
  data_rescisao: z.string().nullable(),
}) satisfies z.ZodType<EnetContrato>;

export const enetSocio = z.object({
  nome: z.string(),
  cpf: z.string(),
  data_nascimento: z.string().nullable(),
}) satisfies z.ZodType<EnetSocio>;

export const enetCliente = z.object({
  codigo: z.string(),
  nome: z.string(),
  cpf_cnpj: z.string(),
  tipo_pessoa: z.enum(["PF", "PJ"]),
  socios: z.array(enetSocio),
  atividade: z.string(),
}) satisfies z.ZodType<EnetCliente>;
