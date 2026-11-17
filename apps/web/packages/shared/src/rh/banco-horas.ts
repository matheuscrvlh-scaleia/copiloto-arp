import { valorDoBanco } from "./custo";

// Fechamento do ciclo do banco de horas (tarefas do RH de 06/11/2026, item 3):
// regras sem banco, usadas pela tela e pela ação que grava a lista.

export const ACOES_DO_BANCO = {
  pago: "Pago na folha",
  descontado: "Descontado",
  abonado: "Abonado",
} as const;
export type AcaoDoBanco = keyof typeof ACOES_DO_BANCO;

/** "Fechar ciclo" só a partir da data de fim (datas aaaa-mm-dd). */
export function podeFecharCiclo(hoje: string, fim: string): boolean {
  return hoje >= fim;
}

/** Saldo de cada pessoa no último dia do ponto até o fim do ciclo (BSaldo). */
export function saldosNoFim(
  dias: { colaborador_id: string; data: string; banco_saldo_min: number }[],
  inicio: string,
  fim: string,
): Map<string, number> {
  const ultimo = new Map<string, { data: string; saldo: number }>();
  for (const d of dias) {
    if (d.data < inicio || d.data > fim) continue;
    const atual = ultimo.get(d.colaborador_id);
    if (!atual || d.data > atual.data)
      ultimo.set(d.colaborador_id, {
        data: d.data,
        saldo: Number(d.banco_saldo_min),
      });
  }
  return new Map([...ultimo].map(([id, u]) => [id, u.saldo]));
}

/** Ação sugerida: crédito é pago na folha, débito é descontado. */
export function acaoSugerida(saldoMin: number): AcaoDoBanco | null {
  return saldoMin > 0 ? "pago" : saldoMin < 0 ? "descontado" : null;
}

/**
 * Valor calculado do saldo final, ao centavo: positivo × salário/hora × (1 +
 * adicional dos Parâmetros); negativo × salário/hora.
 */
export function valorCalculado(
  saldoMin: number,
  salarioHora: number | null,
  adicionalPct: number | null,
): number | null {
  const v = valorDoBanco(saldoMin, salarioHora, adicionalPct);
  return v === null ? null : Math.round(v * 100) / 100;
}

/** Rubrica do saldo do banco de horas pago na folha. */
export const RUBRICA_BANCO = 408;

/**
 * Valor realizado na folha de cada pessoa: a rubrica 408 e as do grupo
 * "banco de horas"; provento soma, desconto subtrai.
 */
export function realizadoNaFolha(
  rubricas: {
    colaborador_id: string;
    codigo: number;
    grupo: string | null;
    natureza: string;
    valor: number;
  }[],
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const r of rubricas) {
    if (r.codigo !== RUBRICA_BANCO && r.grupo !== "banco_horas") continue;
    const v = Math.abs(Number(r.valor)) * (r.natureza === "desconto" ? -1 : 1);
    mapa.set(
      r.colaborador_id,
      Math.round(((mapa.get(r.colaborador_id) ?? 0) + v) * 100) / 100,
    );
  }
  return mapa;
}

/** Diferença realizado − calculado (null se faltar um dos dois). */
export function diferencaDoFechamento(
  calculado: number | null,
  realizado: number | null,
): number | null {
  if (calculado === null || realizado === null) return null;
  return Math.round((realizado - calculado) * 100) / 100;
}
