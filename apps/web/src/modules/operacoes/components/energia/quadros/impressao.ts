// Fora do módulo "use client": o servidor precisa do texto, não de uma
// referência de cliente.
/** CSS de impressão: só o desenho do quadro, com o título, em A4 deitado. */
export const CSS_IMPRIMIR_MAPA = `
@media print {
  @page { size: A4 landscape; margin: 10mm; }
  body * { visibility: hidden !important; }
  #folha-do-mapa, #folha-do-mapa * { visibility: visible !important; }
  #folha-do-mapa { position: absolute; inset: 0 auto auto 0; width: 100%; }
  #folha-do-mapa [role=grid] { overflow: visible !important; }
  #folha-do-mapa a { transform: none !important; }
}
`;
