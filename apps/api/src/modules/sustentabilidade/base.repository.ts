import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas da base do Sustentabilidade: configurações (parâmetros,
// validades por setor, coletores) e a cópia de leitura dos contratos.

export function parametros(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.parametros")
    .selectAll()
    .where("id", "=", true)
    .executeTakeFirst();
}

export function validades(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.setor_validades")
    .select(["setor", "meses"])
    .execute();
}

export function coletores(tx: Tx) {
  return tx
    .selectFrom("sustentabilidade.coletores")
    .selectAll()
    .orderBy("ordem")
    .orderBy("local")
    .execute();
}

// ---------------------------------------------------------------- contratos

export function lojas(tx: Tx) {
  return tx
    .selectFrom("os.lojas")
    .select([
      "id",
      "contrato",
      "luc",
      "nome",
      "locatario",
      "cnpj",
      "bloco",
      "situacao",
      "inicio",
      "tipo_loja",
      "ramo",
      "ativacao",
      "rescisao",
    ])
    .orderBy("id")
    .execute();
}

export interface ContratoDaLoja {
  loja_id: string;
  contrato: string | null;
  cliente_nome: string;
  cliente_doc: string | null;
  lucs: string[];
  bloco: string | null;
  tipo_loja: string | null;
  ramo: string | null;
  ativacao: string | null;
  inicio: string | null;
  rescisao: string | null;
  situacao: string;
  sincronizado_em: string;
}

/** Grava a cópia das lojas; as colunas do módulo não são tocadas. */
export async function gravarContratos(
  tx: Tx,
  linhas: ContratoDaLoja[],
): Promise<void> {
  if (!linhas.length) return;
  await tx
    .insertInto("sustentabilidade.contratos")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("loja_id").doUpdateSet((eb) => ({
        contrato: eb.ref("excluded.contrato"),
        cliente_nome: eb.ref("excluded.cliente_nome"),
        cliente_doc: eb.ref("excluded.cliente_doc"),
        lucs: eb.ref("excluded.lucs"),
        bloco: eb.ref("excluded.bloco"),
        tipo_loja: eb.ref("excluded.tipo_loja"),
        ramo: eb.ref("excluded.ramo"),
        ativacao: eb.ref("excluded.ativacao"),
        inicio: eb.ref("excluded.inicio"),
        rescisao: eb.ref("excluded.rescisao"),
        situacao: eb.ref("excluded.situacao"),
        sincronizado_em: eb.ref("excluded.sincronizado_em"),
      })),
    )
    .execute();
}

export async function ultimaSincronizacao(tx: Tx): Promise<string | null> {
  const r = await tx
    .selectFrom("sustentabilidade.contratos")
    .select("sincronizado_em")
    .where("sincronizado_em", "is not", null)
    .orderBy("sincronizado_em", "desc")
    .limit(1)
    .executeTakeFirst();
  return r?.sincronizado_em ?? null;
}

/** Trava da sincronização: uma por vez (solta com a transação). */
export async function travarSincronizacao(tx: Tx): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtext('sustentabilidade.contratos'))`.execute(
    tx,
  );
}
