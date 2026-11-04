// CNPJ, CPF e CEP, guardados só com dígitos. A conferência é só pelos
// dígitos verificadores (sem consulta externa).

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Módulo 11 com pesos de 2 a `max`, da direita para a esquerda. */
function digito(base: string, max: number): number {
  let peso = 2;
  let soma = 0;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += Number(base[i]) * peso;
    peso = peso === max ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Os dois dígitos verificadores do CNPJ a partir dos 12 primeiros. */
export function digitosCnpj(base12: string): string {
  const d1 = digito(base12, 9);
  return `${d1}${digito(base12 + d1, 9)}`;
}

/** Os dois dígitos verificadores do CPF a partir dos 9 primeiros. */
export function digitosCpf(base9: string): string {
  const d1 = digito(base9, 11);
  return `${d1}${digito(base9 + d1, 11)}`;
}

/** Confere os dois dígitos verificadores do CNPJ (14 dígitos). */
export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  return d.endsWith(digitosCnpj(d.slice(0, 12)));
}

/** Confere os dois dígitos verificadores do CPF (11 dígitos). */
export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  return d.endsWith(digitosCpf(d.slice(0, 9)));
}

/** 12345678909 → 123.456.789-09 */
export function formatarCpf(d: string | null): string {
  if (!d || d.length !== 11) return d ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** CPF ou CNPJ pelo tamanho (só dígitos). */
export function formatarDocumento(d: string | null): string {
  return d?.length === 11 ? formatarCpf(d) : formatarCnpj(d);
}

/** 12345678000195 → 12.345.678/0001-95 */
export function formatarCnpj(d: string | null): string {
  if (!d || d.length !== 14) return d ?? "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** 28610000 → 28610-000 */
export function formatarCep(d: string | null): string {
  if (!d || d.length !== 8) return d ?? "";
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
] as const;
