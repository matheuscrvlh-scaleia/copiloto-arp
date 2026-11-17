import type { Tx } from "@/infra/banco";

// Consultas de água e geração solar mês a mês para o painel do
// Sustentabilidade (só m³ e kWh: nada em reais nem foto).

export function leiturasDeAgua(tx: Tx, deMes: string, ateMes: string) {
  return tx
    .selectFrom("operacoes.agua_leituras")
    .select(["referencia", "hidrometro", "bloco", "consumo", "exemplo"])
    .where("vigente", "=", true)
    .where("referencia", ">=", deMes)
    .where("referencia", "<=", ateMes)
    .orderBy("id")
    .execute();
}

export function vinculosAte(tx: Tx, ateMes: string) {
  return tx
    .selectFrom("operacoes.agua_vinculos")
    .select(["hidrometro", "desde", "bloco", "sala"])
    .where("desde", "<=", ateMes)
    .orderBy("id")
    .execute();
}

export function importacoesDeAgua(tx: Tx, deMes: string, ateMes: string) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["referencia", "incompleta"])
    .where("tipo", "=", "agua")
    .where("status", "=", "confirmada")
    .where("referencia", ">=", deMes)
    .where("referencia", "<=", ateMes)
    .execute();
}

export async function fonteSolar(tx: Tx): Promise<string> {
  const p = await tx
    .selectFrom("operacoes.parametros")
    .select("solar_fonte")
    .where("id", "=", true)
    .executeTakeFirstOrThrow();
  return p.solar_fonte;
}

export function papeisDasUnidades(tx: Tx) {
  return tx
    .selectFrom("operacoes.energia_unidades")
    .select(["matricula", "papel"])
    .execute();
}

export function faturasDaGeracao(tx: Tx, deMes: string, ateMes: string) {
  return tx
    .selectFrom("operacoes.energia_faturas")
    .select([
      "matricula",
      "referencia",
      "injetada_kwh",
      "leitura_atual_data",
      "exemplo",
    ])
    .where("vigente", "=", true)
    .where("referencia", ">=", deMes)
    .where("referencia", "<=", ateMes)
    .orderBy("id")
    .execute();
}
