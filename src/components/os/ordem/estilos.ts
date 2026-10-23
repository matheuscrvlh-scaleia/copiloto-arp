// Classes do bloco da OS. Fora dos módulos "use client" para servirem nos
// dois lados (ver src/components/estilos.ts).

export const rotulo =
  "flex flex-col gap-1 text-xs font-medium text-neutral-600";

export const botao = {
  primario:
    "inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-60",
  secundario:
    "inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-wait disabled:opacity-60",
  perigo:
    "inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-400 disabled:cursor-wait disabled:opacity-60",
  icone:
    "grid size-8 shrink-0 place-items-center rounded-full text-neutral-500 transition hover:bg-white hover:text-neutral-900 disabled:opacity-50",
} as const;

/** Quadro de uma parte do bloco (Tempo, Materiais, Custos…). */
export const quadro = "vidro rounded-[1.75rem] p-5 md:p-6";

/** Título de cada quadro, no mesmo tom do detalhe do chamado. */
export const titulo =
  "text-xs font-semibold tracking-[0.14em] text-neutral-500 uppercase";

export const aviso = {
  atencao: "rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900",
  erro: "rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700",
  ok: "rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700",
  neutro:
    "rounded-2xl bg-neutral-900/[0.04] px-4 py-3 text-sm text-neutral-600",
} as const;

/** Pílula de escolha (técnicos, profissionais) feita com checkbox. */
export const pilulaEscolha =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-400 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-neutral-900/10";
