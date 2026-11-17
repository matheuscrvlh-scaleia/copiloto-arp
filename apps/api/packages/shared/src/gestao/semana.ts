import { z } from "zod";
import { somarDias } from "../os/tempo";

// "Minha semana": a página inicial de cada pessoa na Gestão, com os
// principais desafios da semana (segunda a domingo) de cada módulo que ela
// acessa. Atrasado = data antes de hoje e ainda em aberto.

export const GRUPOS_SEMANA = {
  agenda: "Agenda",
  tickets: "Tickets",
  comercial: "Comercial",
} as const;
export type GrupoSemana = keyof typeof GRUPOS_SEMANA;

export const desafioDaSemana = z.object({
  grupo: z.enum(["agenda", "tickets", "comercial"]),
  titulo: z.string(),
  detalhe: z.string(),
  /** "aaaa-mm-dd" ou null (sem data). */
  data: z.string().nullable(),
  atrasado: z.boolean(),
  href: z.string(),
});
export type DesafioDaSemana = z.infer<typeof desafioDaSemana>;

export const respostaSemana = z.object({
  hoje: z.string(),
  de: z.string(),
  ate: z.string(),
  desafios: z.array(desafioDaSemana),
});
export type RespostaSemana = z.infer<typeof respostaSemana>;

/** Segunda e domingo da semana do dia ("aaaa-mm-dd"). */
export function semanaDe(dia: string): { de: string; ate: string } {
  const [a = 0, m = 1, d = 1] = dia.split("-").map(Number);
  // 0 = domingo; a semana começa na segunda.
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  const de = somarDias(dia, -((dow + 6) % 7));
  return { de, ate: somarDias(de, 6) };
}

/** Atrasados primeiro; depois por data (sem data no fim) e título. */
export function ordenarDesafios(lista: DesafioDaSemana[]): DesafioDaSemana[] {
  return [...lista].sort(
    (a, b) =>
      Number(b.atrasado) - Number(a.atrasado) ||
      (a.data ?? "9999").localeCompare(b.data ?? "9999") ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}
