import type { Tx } from "@/infra/banco";
import type { LinhaContato, LinhaConversao } from "./rd-station.regras";

// Gravações da sincronização do RD Station Marketing (schema marketing).

export function gravarLandingPages(
  tx: Tx,
  linhas: {
    identificador: string;
    dia: string;
    nome: string;
    visitas: number;
    conversoes: number;
  }[],
) {
  return tx
    .insertInto("marketing.rd_landing_pages_dia")
    .values(linhas)
    .onConflict((oc) =>
      oc.columns(["identificador", "dia"]).doUpdateSet((eb) => ({
        nome: eb.ref("excluded.nome"),
        visitas: eb.ref("excluded.visitas"),
        conversoes: eb.ref("excluded.conversoes"),
      })),
    )
    .execute();
}

/** uuid → última conversão de cada contato guardado. */
export function contatos(tx: Tx) {
  return tx
    .selectFrom("marketing.rd_contatos")
    .select(["uuid", "ultima_conversao"])
    .execute();
}

export function gravarContatos(tx: Tx, linhas: LinhaContato[]) {
  return tx
    .insertInto("marketing.rd_contatos")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("uuid").doUpdateSet((eb) => ({
        nome: eb.ref("excluded.nome"),
        email: eb.ref("excluded.email"),
        telefone: eb.ref("excluded.telefone"),
        cidade: eb.ref("excluded.cidade"),
        uf: eb.ref("excluded.uf"),
        tags: eb.ref("excluded.tags"),
        etapa: eb.ref("excluded.etapa"),
        criado_em: eb.ref("excluded.criado_em"),
        ultima_conversao: eb.ref("excluded.ultima_conversao"),
        atualizado_em: eb.ref("excluded.atualizado_em"),
      })),
    )
    .execute();
}

export function gravarConversoes(tx: Tx, linhas: LinhaConversao[]) {
  return tx
    .insertInto("marketing.rd_conversoes")
    .values(linhas)
    .onConflict((oc) =>
      oc.column("id").doUpdateSet((eb) => ({
        contato_uuid: eb.ref("excluded.contato_uuid"),
        identificador: eb.ref("excluded.identificador"),
        convertido_em: eb.ref("excluded.convertido_em"),
        origem: eb.ref("excluded.origem"),
        meio: eb.ref("excluded.meio"),
        campanha: eb.ref("excluded.campanha"),
      })),
    )
    .execute();
}
