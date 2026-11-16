import { z } from "zod";

// Evento do site da ARP (WordPress + ACF) como a API entrega. O conector
// (apps/api) valida com este schema; as regras do Marketing usam o tipo.

const texto = z.string().nullish();

// O ACF devolve [] quando o post não tem nenhum campo preenchido.
const acfSchema = z.preprocess(
  (v) => (Array.isArray(v) ? {} : v),
  z.object({
    evento_tipo: texto,
    evento_data_hora: texto,
    evento_data_hora_fim: texto,
    evento_datas: texto,
    evento_descricao: texto,
    evento_link: texto,
  }),
);

const imagemSchema = z.object({
  source_url: z.string().optional(),
  alt_text: z.string().optional(),
  media_details: z
    .object({
      sizes: z
        .record(z.string(), z.object({ source_url: z.string() }))
        .optional(),
    })
    .optional(),
});

export const eventoWpSchema = z.object({
  id: z.number(),
  link: z.string(),
  title: z.object({ rendered: z.string() }),
  acf: acfSchema.optional(),
  _embedded: z
    .object({
      // Imagem privada vem como erro ({ code, message }): fica sem imagem.
      "wp:featuredmedia": z.array(imagemSchema).optional(),
    })
    .optional(),
});
export type EventoWp = z.infer<typeof eventoWpSchema>;
