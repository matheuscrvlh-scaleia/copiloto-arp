// Lançar nota do RCC (spec 4.7): validação da entrada e a prévia calculada ao
// digitar, com o fator e o preço vigentes na competência. Funções puras; a
// gravação fica em src/server/sustentabilidade/acoes/rcc.ts.

import { z } from "zod";
import { lerValorBr } from "../formato";
import { calcularNota, fatorVigente } from "./rcc";
import type { FatorDoRcc, PrecoDoRcc } from "./rcc-lista";

/** PDF da nota: até 15 MB. */
export const PDF_MAX_BYTES = 15 * 1024 * 1024;

/** O arquivo começa como PDF ("%PDF"), pelos primeiros bytes. */
export function ehPdf(inicio: Uint8Array): boolean {
  return String.fromCharCode(...Array.from(inicio.slice(0, 4))) === "%PDF";
}

/** "2026-11" → "2026-11-01"; outro formato → null. */
export function competenciaDoMes(mes: string): string | null {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? `${mes}-01` : null;
}

const contagem = (rotulo: string) =>
  z
    .number(`Informe as caçambas de classe ${rotulo}.`)
    .int(`Caçambas de classe ${rotulo}: use um número inteiro.`)
    .min(0, `Caçambas de classe ${rotulo} não pode ser negativo.`)
    .max(9999, `Caçambas de classe ${rotulo}: número alto demais.`);

export const esquemaNotaRcc = z
  .object({
    /** "aaaa-mm", do campo mês. */
    competencia: z
      .string()
      .refine((v) => competenciaDoMes(v) !== null, "Escolha a competência."),
    empresa: z.string().trim().min(1, "Escolha a empresa coletora.").max(120),
    numero: z.string().trim().min(1, "Informe o número da nota.").max(40),
    /** Caminho do PDF já enviado. */
    pdf: z.string().min(1, "Anexe o PDF da nota.").max(400),
    cacambasA: contagem("A"),
    cacambasB: contagem("B"),
    /** Valor total da nota, como digitado ("1.234,56"); vazio = não informa. */
    valorTotal: z
      .string()
      .trim()
      .max(30)
      .transform((v, ctx) => {
        const n = lerValorBr(v);
        if (n === null) return null;
        if (!Number.isFinite(n) || n < 0 || n > 99_999_999_999) {
          ctx.addIssue({
            code: "custom",
            message: "Valor total da nota: digite um valor como 1.234,56.",
          });
          return z.NEVER;
        }
        return Math.round(n * 100) / 100;
      }),
    /** A competência já tem nota e a pessoa confirmou mesmo assim. */
    confirmarDuplicada: z.boolean().default(false),
  })
  .refine((v) => v.cacambasA + v.cacambasB > 0, {
    path: ["cacambasA"],
    message: "Informe ao menos uma caçamba: A + B tem de ser maior que zero.",
  });

export type EntradaDaNotaRcc = z.input<typeof esquemaNotaRcc>;

export interface PreviaDaNota {
  toneladasA: number | null;
  toneladasB: number | null;
  toneladasTotal: number | null;
  pctReciclado: number | null;
  valorEconomizado: number | null;
  /** Toneladas por caçamba vigente na competência; null se nenhum vale ainda. */
  toneladasPorCacamba: number | null;
  /** Início da vigência do fator usado. */
  fatorDesde: string | null;
}

/**
 * Prévia ao digitar. Sem fator vigente na competência, tudo null (nunca zero).
 * `precos` null = sem permissão de valores.
 */
export function previaDaNota(
  p: { competencia: string; cacambasA: number; cacambasB: number },
  fatores: readonly FatorDoRcc[],
  precos: readonly PrecoDoRcc[] | null,
): PreviaDaNota {
  const competencia = competenciaDoMes(p.competencia) ?? p.competencia;
  const fator = fatorVigente(fatores, competencia);
  if (!fator)
    return {
      toneladasA: null,
      toneladasB: null,
      toneladasTotal: null,
      pctReciclado: null,
      valorEconomizado: null,
      toneladasPorCacamba: null,
      fatorDesde: null,
    };
  const preco = precos ? fatorVigente(precos, competencia) : null;
  return {
    ...calcularNota(p, fator, preco),
    toneladasPorCacamba: fator.toneladasPorCacamba,
    fatorDesde: fator.vigenteDesde,
  };
}
