// Classes compartilhadas. Ficam fora dos módulos "use client": importada por
// um componente de servidor, uma constante de módulo cliente vira referência
// de cliente, e não o texto (quebra quando é concatenada).

export const classeCampo =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 disabled:bg-neutral-50 disabled:text-neutral-500";

/**
 * Tom do cartão: vidro claro (padrão), preto ou verde da marca. Os tons
 * escuro e verde redefinem as cores por dentro (globals.css, .tom-*).
 */
export const TOM = {
  claro: "vidro",
  escuro: "tom-escuro",
  verde: "tom-verde",
} as const;
export type Tom = keyof typeof TOM;
