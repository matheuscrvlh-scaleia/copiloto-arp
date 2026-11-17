import { z } from "zod";
import { numeroBr } from "./agua-conta";
import { TIPOS_AGUA } from "./agua-formato";

// Correção de uma leitura da água já importada (tela da importação): os
// campos que vêm do arquivo, validados como na leitura da planilha. Valor
// em reais só entra para quem também vê reais (a ação confere).

const numero = (rotulo: string, casas: number, obrigatorio = false) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) {
        if (obrigatorio) {
          ctx.addIssue({ code: "custom", message: `Informe ${rotulo}.` });
          return z.NEVER;
        }
        return null;
      }
      const n = numeroBr(v);
      if (n === null || n < 0) {
        ctx.addIssue({
          code: "custom",
          message: `${rotulo}: número inválido.`,
        });
        return z.NEVER;
      }
      return Math.round(n * 10 ** casas) / 10 ** casas;
    });

const data = (rotulo: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        ctx.addIssue({ code: "custom", message: `${rotulo}: data inválida.` });
        return z.NEVER;
      }
      return v;
    });

export const esquemaLeitura = z
  .object({
    id: z.uuid("Leitura inválida."),
    bloco: z
      .string()
      .trim()
      .regex(/^\d{1,2}$/, "Bloco com 2 dígitos (ex.: 05).")
      .transform((b) => b.padStart(2, "0")),
    sala: z.string().trim().max(120, "Sala com até 120 letras."),
    cliente: z.string().trim().max(200, "Cliente com até 200 letras."),
    hidrometro: z
      .string()
      .trim()
      .min(1, "Informe o número do hidrômetro.")
      .max(40, "Hidrômetro com até 40 letras.")
      .transform((h) => h.toUpperCase()),
    data_anterior: data("Data anterior"),
    leitura_anterior: numero("a leitura anterior", 3),
    data_atual: data("Data atual"),
    leitura_atual: numero("a leitura atual", 3),
    dias: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v?.trim()) return null;
        const n = Number(v);
        if (!Number.isInteger(n) || n < 0 || n > 400) {
          ctx.addIssue({ code: "custom", message: "Dias: número inválido." });
          return z.NEVER;
        }
        return n;
      }),
    consumo: numero("o consumo", 3, true),
    volume_faturado: numero("o volume faturado", 3, true),
    tipo: z.enum(TIPOS_AGUA, "Escolha o tipo de faturamento."),
    valor: numero("o valor", 2),
  })
  .superRefine((l, ctx) => {
    if (l.data_anterior && l.data_atual && l.data_anterior > l.data_atual)
      ctx.addIssue({
        code: "custom",
        message: "A data anterior não pode ser depois da atual.",
      });
  });

export type LeituraEditada = z.output<typeof esquemaLeitura>;

/** Primeira mensagem de erro do formulário. */
export const primeiroErro = (e: z.ZodError) =>
  e.issues[0]?.message ?? "Dados inválidos.";
