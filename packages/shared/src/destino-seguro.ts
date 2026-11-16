/**
 * Só aceita caminho interno ("/rh"), nunca outro site ("//x.com"); senão,
 * `padrao`. Recusa espaço, controle e barra invertida em qualquer ponto: o
 * navegador apaga tab e quebra de linha da URL, e "/\t/x.com" vira "//x.com".
 */
export function destinoSeguro(next: unknown, padrao = "/"): string {
  return typeof next === "string" &&
    /^\/(?![/\\])[^\s\p{Cc}\\]*$/u.test(next) &&
    next !== "/"
    ? next
    : padrao;
}
