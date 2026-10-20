/** Só aceita caminho interno ("/rh"), nunca outro site ("//x.com"); senão, `padrao`. */
export function destinoSeguro(next: unknown, padrao = "/"): string {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) && next !== "/"
    ? next
    : padrao;
}
