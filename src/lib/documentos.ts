// Documentos da empresa (não de pessoas): CNPJ e CEP, guardados só com dígitos.

export const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Confere os dois dígitos verificadores do CNPJ (14 dígitos). */
export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce(
      (s, c, i) => s + Number(c) * (pesos[i] ?? 0),
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
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
