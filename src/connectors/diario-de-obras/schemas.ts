import { z } from "zod";

// Só os campos que usamos; o resto da resposta é descartado.

/** GET /empresa: identifica a empresa dona do token. */
export const empresaSchema = z.object({
  _id: z.string(),
  nome: z.string(),
  log: z.object({ totalObras: z.number().int().nonnegative() }).optional(),
});

export type Empresa = z.infer<typeof empresaSchema>;
