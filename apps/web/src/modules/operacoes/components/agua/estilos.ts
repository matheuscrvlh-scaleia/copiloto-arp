// Classes dos botões das telas da água (fora do "use client": um servidor
// que importa a constante de um módulo cliente recebe uma referência).

export const BOTAO_PRIMARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";
export const BOTAO_SECUNDARIO =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50";
