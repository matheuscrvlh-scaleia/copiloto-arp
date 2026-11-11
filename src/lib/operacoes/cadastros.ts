import { z } from "zod";

// Cadastros de Operações: hidrômetro (número, bloco, sala e a sala da
// energia, se houver) e sala da energia (código BLxx-sala). Os limites
// seguem os checks das tabelas (20261111170000 e 20261109160000).

const texto = (max: number, rotulo: string) =>
  z
    .string()
    .trim()
    .max(max, `${rotulo}: até ${max} letras.`)
    .optional()
    .transform((v) => v || null);

const bloco = z
  .string()
  .trim()
  .transform((v) => v.padStart(2, "0"))
  .pipe(z.string().regex(/^\d{2}$/, "Bloco: dois dígitos (ex.: 05)."));

const idOpcional = z
  .string()
  .optional()
  .transform((v) => v || null)
  .pipe(z.uuid("Registro inválido.").nullable());

export const esquemaHidrometro = z.object({
  id: idOpcional,
  numero: z
    .string()
    .trim()
    .min(1, "Informe o número do hidrômetro.")
    .max(40, "Número: até 40 letras.")
    .transform((v) => v.toUpperCase()),
  bloco,
  sala: z.string().trim().max(40, "Sala: até 40 letras.").default(""),
  sala_id: idOpcional,
  descricao: texto(120, "Cliente ou uso"),
  observacoes: texto(500, "Observações"),
  ativo: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
export type HidrometroForm = z.infer<typeof esquemaHidrometro>;

export const esquemaSala = z.object({
  id: idOpcional,
  bloco,
  sala: z
    .string()
    .trim()
    .min(1, "Informe a sala (ex.: 311 ou 101-102).")
    .max(40, "Sala: até 40 letras."),
  pavimento: texto(40, "Pavimento"),
  armario: texto(40, "Armário"),
  projeto: texto(80, "Projeto"),
  disjuntor: texto(40, "Disjuntor"),
  rota: texto(40, "Rota"),
  observacoes: texto(500, "Observações"),
});
export type SalaForm = z.infer<typeof esquemaSala>;

/** Código da sala da energia, como na carga: BL04-311. */
export const codigoDaSala = (bloco: string, sala: string) =>
  `BL${bloco}-${sala}`;
