import { z } from "zod";
import { parseWith, requestJson } from "./http";

// RD Station CRM (API v1): token da instância na query, só leitura. É outro
// produto que o RD Station Marketing: o acesso OAuth do Marketing não abre o
// CRM. Limite de 120 chamadas por minuto; as oportunidades vêm de 200 em 200.

const SISTEMA = "rd_crm";
const API_URL = "https://crm.rdstation.com/api/v1";
const POR_PAGINA = 200;
/** Teto de páginas por leitura (200 × 100 = 20 mil oportunidades). */
const MAX_PAGINAS = 100;

export interface RdCrmConfig {
  token: string;
  fetch?: typeof fetch;
}

const txt = z
  .string()
  .nullish()
  .transform((v) => v ?? "");
const num = z.coerce
  .number()
  .nullish()
  .transform((v) => (Number.isFinite(v) ? (v as number) : 0));
const id = z.union([z.string(), z.number()]).transform(String);

/** {_id, name}; o RD manda _id ou id, conforme o recurso. */
const ref = z
  .object({ _id: id.optional(), id: id.optional(), name: txt })
  .transform((r) => ({ _id: r._id ?? r.id ?? "", name: r.name }));

const funisSchema = z.array(
  z
    .object({
      _id: id.optional(),
      id: id.optional(),
      name: txt,
      deal_stages: z
        .array(
          z
            .object({ _id: id.optional(), id: id.optional(), name: txt })
            .transform((e) => ({ _id: e._id ?? e.id ?? "", name: e.name })),
        )
        .nullish()
        .transform((v) => v ?? []),
    })
    .transform((f) => ({
      _id: f._id ?? f.id ?? "",
      name: f.name,
      deal_stages: f.deal_stages,
    })),
);
export type RdCrmFunil = z.infer<typeof funisSchema>[number];

const valorCampo = z
  .unknown()
  .transform((v) =>
    v === null || v === undefined
      ? null
      : Array.isArray(v)
        ? v.map(String).join(", ")
        : String(v),
  );

const oportunidadeSchema = z.object({
  _id: id.optional(),
  id: id.optional(),
  name: txt,
  organization: ref.nullish(),
  rating: num,
  deal_pipeline: ref.nullish(),
  deal_stage: ref.and(z.object({ deal_pipeline_id: id.nullish() })).nullish(),
  win: z.boolean().nullish(),
  deal_lost_reason: ref.nullish(),
  deal_lost_note: z.string().nullish(),
  amount_unique: num,
  amount_montly: num,
  hold: z.boolean().nullish(),
  created_at: z.string(),
  last_activity_at: z.string().nullish(),
  next_task: z.object({ date: z.string().nullish(), subject: txt }).nullish(),
  prediction_date: z.string().nullish(),
  closed_at: z.string().nullish(),
  deal_source: ref.nullish(),
  campaign: ref.nullish(),
  user: ref.nullish(),
  deal_custom_fields: z
    .array(
      z.object({
        custom_field: z.object({ _id: id.optional(), label: txt }).nullish(),
        value: valorCampo,
      }),
    )
    .nullish(),
  contacts: z
    .array(
      z.object({
        name: txt,
        title: z.string().nullish(),
        emails: z
          .array(z.object({ email: txt }))
          .nullish()
          .transform((v) => v ?? []),
        phones: z
          .array(z.object({ phone: txt }))
          .nullish()
          .transform((v) => v ?? []),
      }),
    )
    .nullish(),
});
export type RdCrmOportunidade = z.infer<typeof oportunidadeSchema>;

const paginaSchema = z.object({
  total: z.coerce.number().nullish(),
  has_more: z.boolean().nullish(),
  deals: z.array(oportunidadeSchema),
});

export function createRdCrmClient(config: RdCrmConfig) {
  const ler = (caminho: string, query: Record<string, string | number> = {}) =>
    requestJson(SISTEMA, `${API_URL}${caminho}`, {
      query: { ...query, token: config.token },
      retries: 2,
      fetch: config.fetch,
    });

  /** Uma página de oportunidades (o total vem junto). */
  const pagina = async (n: number, limite = POR_PAGINA) =>
    parseWith(
      SISTEMA,
      paginaSchema,
      await ler("/deals", { page: n, limit: limite }),
    );

  return {
    pagina,
    async funis(): Promise<RdCrmFunil[]> {
      return parseWith(SISTEMA, funisSchema, await ler("/deal_pipelines"));
    },
    /** Todas as oportunidades de todos os funis. */
    async oportunidades(): Promise<RdCrmOportunidade[]> {
      const out: RdCrmOportunidade[] = [];
      for (let p = 1; p <= MAX_PAGINAS; p++) {
        const r = await pagina(p);
        out.push(...r.deals);
        if (!r.has_more || r.deals.length < POR_PAGINA) return out;
      }
      return out;
    },
  };
}
