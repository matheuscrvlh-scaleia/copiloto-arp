import { z } from "zod";
import { lerValorBr } from "@/lib/formato";
import { valoresDoTexto } from "./listas";

// Construtores dos campos digitados nos formulários de parâmetros.

/** Valor digitado ("1.234,5", "45") → número; vazio → undefined. */
export function numeroDigitado(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  const n = lerValorBr(String(v ?? ""));
  return n === null ? undefined : n;
}

export const texto = (max: number, falta = "obrigatório") =>
  z
    .string({ message: falta })
    .trim()
    .min(1, falta)
    .max(max, `até ${max} letras`);
export const textoLivre = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : ""),
    z.string().max(max, `até ${max} letras`),
  );
export const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().max(max, `até ${max} letras`).nullable(),
  );
export const marcado = z.preprocess(
  (v) => v === "on" || v === true,
  z.boolean(),
);
export const inteiro = (min: number, max: number) =>
  z.preprocess(
    numeroDigitado,
    z
      .number({ message: "informe um número" })
      .int("sem casas decimais")
      .min(min, `no mínimo ${min}`)
      .max(max, `no máximo ${max}`),
  );
export const decimal = (min: number, max: number, { maiorQue = false } = {}) =>
  z.preprocess(
    numeroDigitado,
    z
      .number({ message: "informe um número" })
      .finite("informe um número")
      .refine((n) => (maiorQue ? n > min : n >= min), {
        message: maiorQue ? `maior que ${min}` : `no mínimo ${min}`,
      })
      .refine((n) => n <= max, { message: `no máximo ${max}` })
      .transform((n) => Math.round(n * 100) / 100),
  );
export const linhas = (maxItens: number, maxLetras: number) =>
  z.preprocess(
    (v) => valoresDoTexto(typeof v === "string" ? v : ""),
    z
      .array(
        z.string().max(maxLetras, `cada linha com até ${maxLetras} letras`),
      )
      .max(maxItens, `até ${maxItens} linhas`),
  );
