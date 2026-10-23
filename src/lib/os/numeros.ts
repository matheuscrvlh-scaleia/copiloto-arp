import { type Execucao, TIPOS, type TipoChamado } from "./rotulos";

/** 1234 → "#1234" (sem ponto de milhar, como se fala o número). */
export function formatarNumeroChamado(n: number): string {
  return `#${n}`;
}

/**
 * Título do documento: "ORDEM DE SERVIÇO Nº 1234", "O.S. TERCEIRIZADO Nº
 * 1234". Outros tipos usam o próprio nome ("TAREFA Nº 12").
 */
export function rotuloOS(
  tipo: TipoChamado,
  execucao: Execucao | null,
  numero: number,
): string {
  if (tipo === "os" && execucao === "terceirizada")
    return `O.S. TERCEIRIZADO Nº ${numero}`;
  return `${TIPOS[tipo].toUpperCase()} Nº ${numero}`;
}
