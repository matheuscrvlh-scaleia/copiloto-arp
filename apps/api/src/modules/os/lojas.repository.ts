import { termoDeBusca } from "@arp/shared/os/filtro-postgrest";
import { POR_PAGINA } from "@arp/shared/os/paginacao";
import type { SituacaoLoja } from "@arp/shared/os/portal-lista";
import type { Selectable } from "kysely";
import type { Tx } from "@/infra/banco";
import type { OsLojas } from "@/infra/banco/tipos";

// Lojas (contratos de locação). Até a API do ENET, cadastro manual pela
// equipe com os.portal; depois, a sincronização grava e a tela só consulta.
// O RLS de os.lojas libera a leitura a quem usa o módulo
// (core.pode_modulo('os')): as leituras rodam com a sessão.

export type Loja = Selectable<OsLojas>;

export type LojaResumo = Pick<
  Loja,
  "id" | "luc" | "nome" | "bloco" | "situacao" | "telefone"
>;

/** Todos os contratos, resumidos (id, LUC, nome, bloco, situação, telefone). */
export function lojasDoModulo(tx: Tx): Promise<LojaResumo[]> {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "luc", "nome", "bloco", "situacao", "telefone"])
    .orderBy("luc")
    .orderBy("id")
    .execute();
}

export function lojaResumida(
  tx: Tx,
  id: string,
): Promise<LojaResumo | undefined> {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "luc", "nome", "bloco", "situacao", "telefone"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function loja(tx: Tx, id: string): Promise<Loja | undefined> {
  return tx
    .selectFrom("os.lojas")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Contratos da situação e da busca (LUC, nome, bloco, locatário ou CNPJ). */
function filtradas(tx: Tx, s: SituacaoLoja, busca: string) {
  let q = tx.selectFrom("os.lojas").selectAll();
  if (s !== "todas") q = q.where("situacao", "=", s);
  const termo = termoDeBusca(busca);
  if (termo) {
    const como = `%${termo}%`;
    q = q.where((eb) =>
      eb.or([
        eb("luc", "ilike", como),
        eb("nome", "ilike", como),
        eb("bloco", "ilike", como),
        eb("locatario", "ilike", como),
        eb("cnpj", "ilike", como),
      ]),
    );
  }
  return q;
}

const naOrdem = (q: ReturnType<typeof filtradas>) =>
  q
    .orderBy("luc")
    .orderBy("inicio", (ob) => ob.desc().nullsLast())
    .orderBy("id");

/** Uma página dos contratos (pela LUC, o mais novo primeiro) e o total. */
export async function paginaDeLojas(
  tx: Tx,
  s: SituacaoLoja,
  busca: string,
  pagina: number,
): Promise<{ lojas: Loja[]; total: number }> {
  const lojas = await naOrdem(filtradas(tx, s, busca))
    .limit(POR_PAGINA)
    .offset((Math.max(1, pagina) - 1) * POR_PAGINA)
    .execute();
  const contagem = await tx
    .selectFrom(filtradas(tx, s, busca).as("l"))
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .executeTakeFirstOrThrow();
  return { lojas, total: Number(contagem.total) };
}

/** Todos os contratos do filtro (exportar, no clique). */
export function lojasDoFiltro(
  tx: Tx,
  s: SituacaoLoja,
  busca: string,
): Promise<Loja[]> {
  return naOrdem(filtradas(tx, s, busca)).execute();
}

/** Lojas vigentes para vincular ao chamado (até 1000, pela LUC). */
export function lojasVigentes(tx: Tx) {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "luc", "nome", "situacao"])
    .where("situacao", "=", "vigente")
    .orderBy("luc")
    .limit(1000)
    .execute();
}
