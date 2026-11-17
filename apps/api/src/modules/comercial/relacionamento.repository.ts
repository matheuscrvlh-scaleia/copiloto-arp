import type { ContatoDoSac } from "@arp/shared/comercial/sac-asana";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do Relacionamento: contatos com locatários e, para os
// aniversários de sócio, nome e nascimento das pessoas das fichas usadas
// em contrato (nada de CPF, endereço ou documento).

const COLUNAS = [
  "id",
  "data",
  "locatario_enet_id",
  "locatario_nome",
  "contrato_enet_id",
  "luc",
  "bloco",
  "tipo",
  "canal",
  "descricao",
  "precisa_outro_setor",
  "nps",
  "asana_url",
  "registrado_por",
  "registrado_em",
  "exemplo",
] as const;

export interface FiltroContatos {
  /** "aaaa-mm-dd" ou null (sem limite). */
  de: string | null;
  tipo: string;
  bloco: string;
  cliente: string;
}

/** Contatos do período, o mais recente primeiro. */
export function contatos(tx: Tx, f: FiltroContatos) {
  let q = tx.selectFrom("comercial.contatos").select(COLUNAS);
  if (f.de) q = q.where("data", ">=", f.de);
  if (f.tipo) q = q.where("tipo", "=", f.tipo);
  if (f.bloco) q = q.where("bloco", "=", f.bloco);
  if (f.cliente) q = q.where("locatario_enet_id", "=", f.cliente);
  return q
    .orderBy("data", "desc")
    .orderBy("registrado_em", "desc")
    .orderBy("id")
    .execute();
}

export function contato(tx: Tx, id: string) {
  return tx
    .selectFrom("comercial.contatos")
    .select(COLUNAS)
    .where("id", "=", id)
    .executeTakeFirst();
}

export interface LinhaContato {
  locatario_enet_id: string | null;
  locatario_nome: string;
  contrato_enet_id: string | null;
  luc: string | null;
  bloco: string | null;
  data: string;
  tipo: string;
  canal: string;
  descricao: string;
  precisa_outro_setor: boolean;
  nps: number | null;
}

export function incluirContato(tx: Tx, linha: LinhaContato) {
  return tx
    .insertInto("comercial.contatos")
    .values(linha)
    .returning("id")
    .executeTakeFirstOrThrow();
}

/** O RLS só deixa mudar o próprio registro: nenhuma linha = de outra pessoa. */
export function alterarContato(tx: Tx, id: string, linha: LinhaContato) {
  return tx
    .updateTable("comercial.contatos")
    .set(linha)
    .where("id", "=", id)
    .returning("id")
    .execute();
}

export function excluirContato(tx: Tx, id: string) {
  return tx
    .deleteFrom("comercial.contatos")
    .where("id", "=", id)
    .returning("id")
    .execute();
}

/** Fichas PJ e PF usadas em contrato (`exemplo` false: só as reais). */
export function fichasUsadas(tx: Tx, comExemplo: boolean) {
  let q = tx
    .selectFrom("comercial.fichas")
    .select(["id", "nome", "luc"])
    .where("situacao", "=", "usada")
    .where("tipo", "in", ["pj", "pf"]);
  if (!comExemplo) q = q.where("exemplo", "=", false);
  return q.orderBy("id").execute();
}

/** Nome e nascimento de cada pessoa da ficha (lista `respostas.pessoas`). */
export function pessoasDasFichas(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("comercial.ficha_dados")
    .select([
      "ficha_id",
      sql<unknown>`(
        select coalesce(jsonb_agg(jsonb_build_object('nome', p ->> 'nome', 'nascimento', p ->> 'nascimento') order by n), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(respostas -> 'pessoas') = 'array' then respostas -> 'pessoas' else '[]'::jsonb end) with ordinality as e(p, n)
      )`.as("pessoas"),
    ])
    .where("ficha_id", "in", ids)
    .orderBy("ficha_id")
    .execute();
}

export function lucsDosContratosDasFichas(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("comercial.contratos")
    .select(["id", "ficha_id", "lucs"])
    .where("tipo", "=", "contrato")
    .where("ficha_id", "in", ids)
    .orderBy("id")
    .execute();
}

/**
 * Registros do SAC (Asana): inclui os novos e atualiza os já lidos, pela
 * tarefa. Só a rotina grava (service role); sem "registrado por".
 */
export function gravarContatosDoSac(tx: Tx, linhas: ContatoDoSac[]) {
  return tx
    .insertInto("comercial.contatos")
    .values(linhas)
    .onConflict((oc) =>
      oc
        .column("asana_gid")
        .where("asana_gid", "is not", null)
        .doUpdateSet((eb) => ({
          asana_url: eb.ref("excluded.asana_url"),
          data: eb.ref("excluded.data"),
          locatario_nome: eb.ref("excluded.locatario_nome"),
          luc: eb.ref("excluded.luc"),
          bloco: eb.ref("excluded.bloco"),
          tipo: eb.ref("excluded.tipo"),
          canal: eb.ref("excluded.canal"),
          descricao: eb.ref("excluded.descricao"),
          precisa_outro_setor: eb.ref("excluded.precisa_outro_setor"),
        })),
    )
    .execute();
}
