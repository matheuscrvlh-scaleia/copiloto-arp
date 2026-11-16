import type {
  EntradaAgenda,
  EntradaLoja,
} from "@arp/shared/os/contratos/portal";
import { termoDeBusca } from "@arp/shared/os/filtro-postgrest";
import { POR_PAGINA } from "@arp/shared/os/paginacao";
import type { FiltroPortal } from "@arp/shared/os/portal-lista";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas da tela interna do Portal lojista. Rodam com a sessão de quem
// está logado (RLS: os.portal para lojas e sessões, os.portal_agenda para
// agendas); as duas funções das ações dos modelos rodam no escopo do disparo.

// ---------------------------------------------------------------------------
// Acesso das lojas
// ---------------------------------------------------------------------------

/** Encerra as sessões abertas da loja e devolve as que encerrou. */
export function encerrarSessoesDaLoja(
  tx: Tx,
  lojaId: string,
  usuarioId: string | null,
) {
  return tx
    .updateTable("os.portal_sessoes")
    .set({ encerrado_em: sql`now()`, encerrado_por: usuarioId })
    .where("loja_id", "=", lojaId)
    .where("encerrado_em", "is", null)
    .where("expira_em", ">", sql<string>`now()`)
    .returning("id")
    .execute();
}

export function lojaParaOPortal(tx: Tx, id: string) {
  return tx
    .selectFrom("os.lojas")
    .select(["nome", "situacao", "cnpj", "enet_id"])
    .where("id", "=", id)
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Links das lojas
// ---------------------------------------------------------------------------

export interface Recorte {
  f: FiltroPortal | null;
  busca: string;
  /** Primeiro instante do mês (ISO). */
  mes: string;
  /** Início da janela da avaliação média (ISO). */
  desdeDaMedia: string;
}

/** Lojas vigentes do cartão e da busca (LUC, nome ou bloco). */
function lojasVigentes(tx: Tx, r: Recorte) {
  let q = tx.selectFrom("os.lojas as l").where("l.situacao", "=", "vigente");
  const termo = termoDeBusca(r.busca);
  if (termo) {
    const como = `%${termo}%`;
    q = q.where((eb) =>
      eb.or([
        eb("l.luc", "ilike", como),
        eb("l.nome", "ilike", como),
        eb("l.bloco", "ilike", como),
      ]),
    );
  }
  switch (r.f) {
    case "entraram":
      return q.where((eb) =>
        eb.exists(
          eb
            .selectFrom("os.portal_sessoes as ps")
            .select("ps.id")
            .whereRef("ps.loja_id", "=", "l.id"),
        ),
      );
    case "sem_cnpj":
      return q.where("l.cnpj", "is", null);
    case "pedidos":
      return q.where((eb) =>
        eb.exists(
          eb
            .selectFrom("os.chamados as c")
            .select("c.id")
            .whereRef("c.loja_id", "=", "l.id")
            .where("c.origem", "=", "portal")
            .where("c.criado_em", ">=", r.mes),
        ),
      );
    case "avaliadas":
      return q.where((eb) =>
        eb.exists(
          eb
            .selectFrom("os.chamados as c")
            .select("c.id")
            .whereRef("c.loja_id", "=", "l.id")
            .where("c.origem", "=", "portal")
            .where("c.avaliacao", "is not", null)
            .where("c.avaliado_em", ">=", r.desdeDaMedia),
        ),
      );
    default:
      return q;
  }
}

const COLUNAS_LOJA = [
  "l.id",
  "l.luc",
  "l.nome",
  "l.bloco",
  "l.telefone",
  "l.cnpj",
] as const;

export async function contarLojas(tx: Tx, r: Recorte): Promise<number> {
  const linha = await lojasVigentes(tx, r)
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .executeTakeFirstOrThrow();
  return Number(linha.total);
}

/** Uma página das lojas vigentes, pela LUC. */
export function paginaDeLojas(tx: Tx, r: Recorte, pagina: number) {
  return lojasVigentes(tx, r)
    .select(COLUNAS_LOJA)
    .orderBy("l.luc")
    .orderBy("l.id")
    .limit(POR_PAGINA)
    .offset((Math.max(1, pagina) - 1) * POR_PAGINA)
    .execute();
}

/** Todas as lojas do filtro (exportar, no clique). */
export function todasAsLojas(tx: Tx, r: Recorte) {
  return lojasVigentes(tx, r)
    .select(COLUNAS_LOJA)
    .orderBy("l.luc")
    .orderBy("l.id")
    .execute();
}

export function sessoesDasLojas(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.portal_sessoes")
    .select(["loja_id", "ultimo_acesso_em", "encerrado_em", "expira_em"])
    .where("loja_id", "in", ids)
    .execute();
}

/** Pedidos do portal no mês, por loja. */
export function pedidosNoMesPorLoja(tx: Tx, ids: string[], mes: string) {
  return tx
    .selectFrom("os.chamados")
    .select((eb) => ["loja_id", eb.fn.countAll<number>().as("total")])
    .where("loja_id", "in", ids)
    .where("origem", "=", "portal")
    .where("criado_em", ">=", mes)
    .groupBy("loja_id")
    .execute();
}

export async function contarPedidosNoMes(tx: Tx, mes: string): Promise<number> {
  const r = await tx
    .selectFrom("os.chamados")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("origem", "=", "portal")
    .where("criado_em", ">=", mes)
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

/** Notas do portal desde `desde` (só loja e nota: poucas por mês). */
export function notasRecentes(tx: Tx, desde: string) {
  return tx
    .selectFrom("os.chamados")
    .select(["loja_id", "avaliacao"])
    .where("origem", "=", "portal")
    .where("avaliacao", "is not", null)
    .where("avaliado_em", ">=", desde)
    .limit(5000)
    .execute();
}

// ---------------------------------------------------------------------------
// Lojas (contratos)
// ---------------------------------------------------------------------------

type DadosDaLoja = Omit<EntradaLoja, "id">;

export async function inserirLoja(tx: Tx, loja: DadosDaLoja): Promise<void> {
  await tx.insertInto("os.lojas").values(loja).execute();
}

export async function atualizarLoja(
  tx: Tx,
  id: string,
  loja: DadosDaLoja,
): Promise<void> {
  await tx.updateTable("os.lojas").set(loja).where("id", "=", id).execute();
}

// ---------------------------------------------------------------------------
// Agendas, bloqueios e horários
// ---------------------------------------------------------------------------

type DadosDaAgenda = Omit<EntradaAgenda, "id">;

export async function inserirAgenda(tx: Tx, a: DadosDaAgenda): Promise<void> {
  await tx.insertInto("os.agendas").values(a).execute();
}

export async function atualizarAgenda(
  tx: Tx,
  id: string,
  a: DadosDaAgenda,
): Promise<void> {
  await tx.updateTable("os.agendas").set(a).where("id", "=", id).execute();
}

/** Horários marcados da agenda que cruzam o período (ISO). */
export function marcadosNoPeriodo(
  tx: Tx,
  agendaId: string,
  inicio: string,
  fim: string,
) {
  return tx
    .selectFrom("os.agendamentos")
    .select(["id", "chamado_id", "inicio"])
    .where("agenda_id", "=", agendaId)
    .where("status", "=", "marcado")
    .where("inicio", "<", fim)
    .where("fim", ">", inicio)
    .execute();
}

export async function inserirBloqueio(
  tx: Tx,
  b: {
    agenda_id: string;
    inicio: string;
    fim: string;
    motivo: string;
    criado_por: string;
  },
): Promise<void> {
  await tx.insertInto("os.agenda_bloqueios").values(b).execute();
}

export async function removerBloqueio(tx: Tx, id: string): Promise<void> {
  await tx.deleteFrom("os.agenda_bloqueios").where("id", "=", id).execute();
}

export function agendamento(tx: Tx, id: string) {
  return tx
    .selectFrom("os.agendamentos")
    .select(["id", "agenda_id", "chamado_id", "loja_id", "status"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function cancelarAgendamento(
  tx: Tx,
  id: string,
  observacao: string,
) {
  return tx
    .updateTable("os.agendamentos")
    .set({ status: "cancelado", observacao })
    .where("id", "=", id)
    .where("status", "<>", "cancelado")
    .returning(["chamado_id", "inicio"])
    .executeTakeFirst();
}
