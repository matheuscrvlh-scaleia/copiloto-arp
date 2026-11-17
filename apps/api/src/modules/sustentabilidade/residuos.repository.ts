import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";

// Consultas das rondas dos coletores (spec 4.6) e do RCC (spec 4.7). Com a
// `tx` do `comoUsuario`: o RLS libera rondas a quem lança ronda ou vê o
// painel; notas e fatores a quem tem "RCC" ou o painel; preço e valor da
// nota só com "Ver valores" (sem ela, a junção vem nula).

// ---------------------------------------------------------------- rondas

function rondas(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.rondas as r")
    .select((eb) => [
      "r.id",
      "r.data_hora",
      "r.observacao",
      "r.exemplo",
      "r.lancado_por",
      jsonArrayFrom(
        eb
          .selectFrom("sustentabilidade.ronda_itens as i")
          .innerJoin("sustentabilidade.coletores as c", "c.id", "i.coletor_id")
          .select([
            "i.id",
            "i.coletor_id",
            "i.conteineres",
            "i.ocupacao_pct",
            "i.observacao",
            "i.foto",
            "c.local",
            "c.cor",
          ])
          .whereRef("i.ronda_id", "=", "r.id"),
      ).as("itens"),
    ]);
}

export type LinhaDaRonda = Awaited<
  ReturnType<ReturnType<typeof rondas>["execute"]>
>[number];

/** Rondas com data_hora em [inicio, fim) (instantes ISO). */
export function rondasEntre(tx: Tx, inicio: string, fim: string) {
  return rondas(tx)
    .where("r.data_hora", ">=", inicio)
    .where("r.data_hora", "<", fim)
    .orderBy("r.data_hora", "desc")
    .orderBy("r.id")
    .execute();
}

/** A ronda mais recente antes de `fim`. */
export function ultimaRondaAntes(tx: Tx, fim: string) {
  return rondas(tx)
    .where("r.data_hora", "<", fim)
    .orderBy("r.data_hora", "desc")
    .limit(1)
    .executeTakeFirst();
}

export async function inserirRonda(
  tx: Tx,
  r: {
    id: string;
    data_hora: string;
    chamado_id: string | null;
    observacao: string | null;
    foto: string | null;
    lancado_por: string;
  },
): Promise<void> {
  await tx.insertInto("sustentabilidade.rondas").values(r).execute();
}

export async function inserirItens(
  tx: Tx,
  itens: {
    ronda_id: string;
    coletor_id: string;
    conteineres: number;
    ocupacao_pct: number;
    observacao: string | null;
    foto: string | null;
  }[],
): Promise<void> {
  await tx.insertInto("sustentabilidade.ronda_itens").values(itens).execute();
}

/** Categorias "Recolhimento de coletor" ativas (raiz). */
export function categoriasDoRecolhimento(tx: Tx, nome: string) {
  return tx
    .selectFrom("os.categorias")
    .select(["id", "setor_id"])
    .where("nome", "=", nome)
    .where("pai_id", "is", null)
    .where("ativo", "=", true)
    .execute();
}

// ---------------------------------------------------------------- RCC

/** Notas (de um ano ou de todos), da mais recente. */
export function notas(tx: Tx, ano?: number) {
  let q = tx
    .selectFrom("sustentabilidade.rcc_notas as n")
    .leftJoin("sustentabilidade.rcc_nota_valores as v", "v.nota_id", "n.id")
    .select([
      "n.id",
      "n.competencia",
      "n.empresa",
      "n.numero",
      "n.pdf",
      "n.cacambas_a",
      "n.cacambas_b",
      "n.exemplo",
      "v.valor_total",
    ]);
  if (ano !== undefined)
    q = q
      .where("n.competencia", ">=", `${ano}-01-01`)
      .where("n.competencia", "<=", `${ano}-12-01`);
  return q.orderBy("n.competencia", "desc").orderBy("n.id").execute();
}

export function fatores(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.rcc_fatores")
    .select(["vigente_desde", "toneladas_por_cacamba"])
    .orderBy("vigente_desde")
    .execute();
}

export function precos(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.rcc_precos")
    .select(["vigente_desde", "preco_a", "preco_b"])
    .orderBy("vigente_desde")
    .execute();
}

export function notasDaCompetencia(tx: Tx, competencia: string) {
  return tx
    .selectFrom("sustentabilidade.rcc_notas")
    .select(["empresa", "numero"])
    .where("competencia", "=", competencia)
    .execute();
}

export async function inserirNota(
  tx: Tx,
  n: {
    id: string;
    competencia: string;
    empresa: string;
    numero: string;
    pdf: string;
    cacambas_a: number;
    cacambas_b: number;
    chamado_id: string | null;
    lancado_por: string;
  },
): Promise<void> {
  await tx.insertInto("sustentabilidade.rcc_notas").values(n).execute();
}

export async function inserirValorDaNota(
  tx: Tx,
  notaId: string,
  valor: number,
): Promise<void> {
  await tx
    .insertInto("sustentabilidade.rcc_nota_valores")
    .values({ nota_id: notaId, valor_total: valor })
    .execute();
}
