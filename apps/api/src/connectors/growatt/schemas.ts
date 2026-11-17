import { z } from "zod";

// Respostas da OpenAPI v1 da Growatt (openapi.growatt.com/v1). Formato
// conferido com a usina do Espaço ARP em 17/11/2026. A API responde HTTP 200
// mesmo no erro: vale o error_code do corpo (0 = ok). Energia em kWh e
// potência em kW, quase sempre como texto ("209.2").

/** Envelope de toda resposta; `data` vem "" no erro. */
export const envelopeSchema = z.object({
  error_code: z.number(),
  error_msg: z.string().default(""),
  data: z.unknown(),
});

/** Número que pode vir como texto; "" ou ausente vira null. */
const numero = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: `número inválido: ${v}` });
      return z.NEVER;
    }
    return n;
  });

/** GET plant/details */
export const detalhesSchema = z.object({
  name: z.string(),
  peak_power: numero,
  create_date: z.string().optional(),
  city: z.string().optional(),
});
export type DetalhesDaUsina = z.infer<typeof detalhesSchema>;

/** GET plant/data: os números de agora. */
export const agoraSchema = z.object({
  current_power: numero,
  today_energy: numero,
  monthly_energy: numero,
  yearly_energy: numero,
  total_energy: numero,
  /** "aaaa-mm-dd hh:mm:ss", no fuso da usina. */
  last_update_time: z.string().nullable().optional(),
  timezone: z.string().optional(),
});
export type AgoraDaUsina = z.infer<typeof agoraSchema>;

/** GET plant/energy: a energia de cada dia (time_unit=day). */
export const energiaSchema = z.object({
  energys: z
    .array(
      z.object({
        date: z.union([z.string(), z.number()]).transform(String),
        energy: numero,
      }),
    )
    .default([]),
});

/** GET plant/list: só a contagem (o token pode ver usinas de outros clientes). */
export const listaSchema = z.object({
  count: z.number().optional(),
  plants: z.array(z.unknown()).default([]),
});
