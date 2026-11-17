import { sql } from "kysely";
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

/**
 * Geração do inversor (Growatt) somada por mês, com o último dia lido; sem
 * período, todos os meses. Também é a consulta da tela de Energia solar.
 */
export function geracaoDoInversorPorMes(
  tx: Tx,
  periodo?: { deMes: string; ateMes: string },
) {
  const mes = sql<string>`to_char(date_trunc('month', dia), 'YYYY-MM-01')`;
  let q = tx
    .selectFrom("operacoes.solar_inversor_dias")
    .select([
      mes.as("mes"),
      sql<number>`sum(energia_kwh)::float8`.as("kwh"),
      sql<string>`max(dia)::text`.as("ultimo_dia"),
    ])
    .groupBy(sql`date_trunc('month', dia)`)
    .orderBy(sql`date_trunc('month', dia)`);
  if (periodo)
    q = q
      .where("dia", ">=", periodo.deMes)
      .where(
        sql<boolean>`dia < (${periodo.ateMes}::date + interval '1 month')`,
      );
  return q.execute();
}
