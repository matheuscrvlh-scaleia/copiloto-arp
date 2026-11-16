import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas da base de Operações: cadastros (hidrômetros e salas) e as
// leituras extras de Parâmetros.

export function hidrometros(tx: Tx) {
  return tx
    .selectFrom("operacoes.hidrometros as h")
    .leftJoin("operacoes.salas as s", "s.id", "h.sala_id")
    .select([
      "h.id",
      "h.numero",
      "h.bloco",
      "h.sala",
      "h.sala_id",
      "s.codigo as salaCodigo",
      "h.descricao",
      "h.observacoes",
      "h.ativo",
      "h.exemplo",
    ])
    .orderBy("h.bloco")
    .orderBy("h.numero")
    .execute();
}

/** Mês mais recente e quantos meses de leitura que vale cada hidrômetro tem. */
export function leiturasPorHidrometro(tx: Tx) {
  return tx
    .selectFrom("operacoes.agua_leituras")
    .select((eb) => [
      "hidrometro",
      eb.fn.max("referencia").as("ultima"),
      eb.fn.countAll<number>().as("meses"),
    ])
    .where("vigente", "=", true)
    .groupBy("hidrometro")
    .execute();
}

export function salas(tx: Tx) {
  return tx
    .selectFrom("operacoes.salas as s")
    .select((eb) => [
      "s.id",
      "s.codigo",
      "s.bloco",
      "s.sala",
      "s.pavimento",
      "s.armario",
      "s.projeto",
      "s.disjuntor",
      "s.rota",
      "s.observacoes",
      "s.exemplo",
      eb
        .selectFrom("operacoes.caixas as c")
        .select((e) => e.fn.countAll<number>().as("n"))
        .whereRef("c.sala_id", "=", "s.id")
        .as("caixas"),
    ])
    .orderBy("s.codigo")
    .execute();
}

export function historicoDosParametros(tx: Tx, limite: number) {
  return tx
    .selectFrom("core.auditoria")
    .select(["id", "em", "usuario_id", "antes", "depois"])
    .where("tabela", "=", "operacoes.parametros")
    .orderBy("em", "desc")
    .orderBy("id", "desc")
    .limit(limite)
    .execute();
}

/** Linhas de exemplo de uma tabela do schema operacoes (nome fixo no código). */
export async function exemplosDe(tx: Tx, tabela: string): Promise<number> {
  const r = await sql<{ n: number }>`
    select count(*)::int as n from ${sql.table(`operacoes.${tabela}`)} where exemplo
  `.execute(tx);
  return r.rows[0]?.n ?? 0;
}

export function unidadesDeEnergia(tx: Tx) {
  return tx
    .selectFrom("operacoes.energia_unidades")
    .select(["matricula", "endereco", "apelido", "papel", "ativa", "exemplo"])
    .orderBy("matricula")
    .execute();
}
