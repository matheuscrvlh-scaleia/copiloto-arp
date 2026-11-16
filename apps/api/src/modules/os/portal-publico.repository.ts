import { sql } from "kysely";
import type { Tx } from "@/infra/banco";
import type { OsStatusChamado } from "@/infra/banco/tipos";

// Consultas do portal do lojista (service role: o service confere a sessão
// da loja antes). Tudo o que lê pedido filtra pela loja da sessão e por
// origem = 'portal', e só sai o que o lojista pode ver.

// ---------------------------------------------------------------------------
// Sessão e entrada
// ---------------------------------------------------------------------------

export function sessaoPeloToken(tx: Tx, hash: string) {
  return tx
    .selectFrom("os.portal_sessoes as s")
    .innerJoin("os.lojas as l", "l.id", "s.loja_id")
    .select([
      "s.id",
      "s.ultimo_acesso_em",
      "s.encerrado_em",
      "s.expira_em",
      "l.id as loja_id",
      "l.nome",
      "l.luc",
      "l.bloco",
      "l.situacao",
    ])
    .where("s.token", "=", hash)
    .executeTakeFirst();
}

export async function marcarAcesso(
  tx: Tx,
  sessaoId: string,
  agora: Date,
): Promise<void> {
  await tx
    .updateTable("os.portal_sessoes")
    .set({ ultimo_acesso_em: agora.toISOString() })
    .where("id", "=", sessaoId)
    .execute();
}

export async function contarTentativas(
  tx: Tx,
  ip: string,
  desde: Date,
): Promise<number> {
  const r = await tx
    .selectFrom("os.portal_tentativas")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("ip", "=", ip)
    .where("criado_em", ">=", desde.toISOString())
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

/** Guarda a tentativa errada e apaga as de antes de `limpar`. */
export async function registrarTentativa(
  tx: Tx,
  ip: string,
  limpar: Date,
): Promise<void> {
  await tx.insertInto("os.portal_tentativas").values({ ip }).execute();
  await tx
    .deleteFrom("os.portal_tentativas")
    .where("criado_em", "<", limpar.toISOString())
    .execute();
}

/** Lojas de contrato vigente com o documento (só dígitos). */
export function lojasDoCnpj(tx: Tx, cnpj: string) {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "nome", "luc", "bloco"])
    .where("cnpj", "=", cnpj)
    .where("situacao", "=", "vigente")
    .orderBy("luc")
    .execute();
}

export async function inserirSessao(
  tx: Tx,
  s: { lojaId: string; hash: string; agora: Date; expira: Date },
): Promise<void> {
  await tx
    .insertInto("os.portal_sessoes")
    .values({
      loja_id: s.lojaId,
      token: s.hash,
      criado_em: s.agora.toISOString(),
      expira_em: s.expira.toISOString(),
      ultimo_acesso_em: s.agora.toISOString(),
    })
    .execute();
}

export async function encerrarSessao(tx: Tx, hash: string): Promise<void> {
  await tx
    .updateTable("os.portal_sessoes")
    .set({ encerrado_em: sql`now()` })
    .where("token", "=", hash)
    .where("encerrado_em", "is", null)
    .execute();
}

// ---------------------------------------------------------------------------
// Catálogo e agenda
// ---------------------------------------------------------------------------

/** Categorias marcadas "Aparece no portal", ativas e de setor ativo. */
export function categoriasDoPortal(tx: Tx) {
  return tx
    .selectFrom("os.categorias as c")
    .innerJoin("os.setores as s", "s.id", "c.setor_id")
    .select([
      "c.id",
      "c.nome",
      "c.icone",
      "c.orientacao_portal",
      "c.campos",
      "c.setor_id",
      "c.agenda_id",
      "s.nome as setor",
    ])
    .where("c.no_portal", "=", true)
    .where("c.ativo", "=", true)
    .where("s.ativo", "=", true)
    .orderBy("c.ordem")
    .orderBy("c.nome")
    .execute();
}

export function agenda(tx: Tx, id: string) {
  return tx
    .selectFrom("os.agendas")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Pedidos da loja
// ---------------------------------------------------------------------------

/** Só o que o lojista pode ver do chamado. */
function pedidos(tx: Tx, lojaId: string) {
  return tx
    .selectFrom("os.chamados as c")
    .leftJoin("os.setores as s", "s.id", "c.setor_id")
    .leftJoin("os.categorias as k", "k.id", "c.categoria_id")
    .select([
      "c.id",
      "c.numero",
      "c.titulo",
      "c.descricao",
      "c.status",
      "c.aguardando_tipo",
      "c.campos",
      "c.solicitante_nome",
      "c.criado_em",
      "c.atualizado_em",
      "c.primeira_resposta_em",
      "c.iniciado_em",
      "c.concluido_em",
      "c.fechado_em",
      "c.cancelado_em",
      "c.avaliacao",
      "c.avaliacao_comentario",
      "c.avaliado_em",
      "s.nome as setor",
      "k.nome as categoria",
      "k.icone",
      "k.campos as campos_da_categoria",
    ])
    .where("c.loja_id", "=", lojaId)
    .where("c.origem", "=", "portal");
}

/** Pedidos que a loja fez pelo portal, do mais novo. */
export function pedidosDaLoja(tx: Tx, lojaId: string) {
  return pedidos(tx, lojaId)
    .orderBy("c.criado_em", "desc")
    .limit(200)
    .execute();
}

export function pedidoDaLoja(tx: Tx, lojaId: string, id: string) {
  return pedidos(tx, lojaId).where("c.id", "=", id).executeTakeFirst();
}

/** Um pedido da loja, com o setor e o responsável (para avisar). */
export function pedidoParaAcao(tx: Tx, lojaId: string, id: string) {
  return tx
    .selectFrom("os.chamados")
    .select([
      "id",
      "numero",
      "titulo",
      "status",
      "aguardando_tipo",
      "setor_id",
      "responsavel_id",
      "avaliacao",
      "solicitante_nome",
    ])
    .where("id", "=", id)
    .where("loja_id", "=", lojaId)
    .where("origem", "=", "portal")
    .executeTakeFirst();
}

/** A conversa: só os eventos marcados para o lojista. */
export function eventosVisiveis(tx: Tx, chamadoId: string) {
  return tx
    .selectFrom("os.eventos")
    .select(["id", "tipo", "texto", "dados", "em"])
    .where("chamado_id", "=", chamadoId)
    .where("visivel_lojista", "=", true)
    .orderBy("em")
    .execute();
}

export function anexosVisiveis(tx: Tx, chamadoId: string) {
  return tx
    .selectFrom("os.anexos")
    .select([
      "id",
      "nome",
      "path",
      "mime",
      "tamanho",
      "enviado_por",
      "categoria",
      "em",
      "evento_id",
    ])
    .where("chamado_id", "=", chamadoId)
    .where("visivel_lojista", "=", true)
    .orderBy("em")
    .execute();
}

export function horariosDoPedido(tx: Tx, chamadoId: string) {
  return tx
    .selectFrom("os.agendamentos as g")
    .leftJoin("os.agendas as a", "a.id", "g.agenda_id")
    .select([
      "g.id",
      "g.agenda_id",
      "g.inicio",
      "g.fim",
      "g.status",
      "a.nome as agenda",
    ])
    .where("g.chamado_id", "=", chamadoId)
    .where("g.status", "<>", "cancelado")
    .orderBy("g.inicio")
    .execute();
}

/** Laudos de vistoria da loja liberados para o lojista. */
export function documentosDaLoja(tx: Tx, lojaId: string) {
  return tx
    .selectFrom("os.anexos as a")
    .innerJoin("os.vistorias as v", "v.id", "a.vistoria_id")
    .select(["a.id", "a.nome", "a.path", "a.em"])
    .where("a.categoria", "=", "laudo")
    .where("a.visivel_lojista", "=", true)
    .where("v.loja_id", "=", lojaId)
    .orderBy("a.em", "desc")
    .execute();
}

/** Quantos pedidos e mensagens a loja mandou desde `desde` (anti-abuso). */
export async function enviosDesde(
  tx: Tx,
  lojaId: string,
  desde: Date,
): Promise<{ pedidos: number; mensagens: number }> {
  const pedidos = await tx
    .selectFrom("os.chamados")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("loja_id", "=", lojaId)
    .where("origem", "=", "portal")
    .where("criado_em", ">=", desde.toISOString())
    .executeTakeFirstOrThrow();
  const mensagens = await tx
    .selectFrom("os.eventos as e")
    .innerJoin("os.chamados as c", "c.id", "e.chamado_id")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("c.loja_id", "=", lojaId)
    .where(sql<boolean>`e.dados->>'portal' = 'true'`)
    .where("e.em", ">=", desde.toISOString())
    .executeTakeFirstOrThrow();
  return {
    pedidos: Number(pedidos.total),
    mensagens: Number(mensagens.total),
  };
}

// ---------------------------------------------------------------------------
// Gravações do lojista
// ---------------------------------------------------------------------------

export async function inserirAnexoDoLojista(
  tx: Tx,
  a: {
    chamadoId: string;
    eventoId: number | null;
    nome: string;
    path: string;
    mime: string;
    tamanho: number;
    enviadoPorNome: string;
  },
): Promise<void> {
  await tx
    .insertInto("os.anexos")
    .values({
      chamado_id: a.chamadoId,
      evento_id: a.eventoId,
      categoria: a.mime.startsWith("image/") ? "foto" : "anexo",
      nome: a.nome,
      path: a.path,
      mime: a.mime,
      tamanho: a.tamanho,
      visivel_lojista: true,
      enviado_por_nome: a.enviadoPorNome,
    })
    .execute();
}

export async function ligarAgendamento(
  tx: Tx,
  agendamentoId: string,
  chamadoId: string,
): Promise<void> {
  await tx
    .updateTable("os.agendamentos")
    .set({ chamado_id: chamadoId })
    .where("id", "=", agendamentoId)
    .execute();
}

export function situacaoDoPedido(tx: Tx, id: string) {
  return tx
    .selectFrom("os.chamados")
    .select(["status", "aguardando_tipo"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function mudarStatus(
  tx: Tx,
  id: string,
  de: OsStatusChamado | null,
  patch: { status: OsStatusChamado; ultimo_motivo_reabertura?: string },
): Promise<void> {
  let q = tx.updateTable("os.chamados").set(patch).where("id", "=", id);
  if (de) q = q.where("status", "=", de);
  await q.execute();
}

export async function gravarAvaliacao(
  tx: Tx,
  id: string,
  a: { nota: number; comentario: string | null; em: Date; fechar: boolean },
): Promise<void> {
  await tx
    .updateTable("os.chamados")
    .set({
      avaliacao: a.nota,
      avaliacao_comentario: a.comentario,
      avaliado_em: a.em.toISOString(),
      ...(a.fechar ? { status: "fechado" as const } : {}),
    })
    .where("id", "=", id)
    .where("avaliacao", "is", null)
    .execute();
}

export function agendamentoDoPedido(tx: Tx, id: string, chamadoId: string) {
  return tx
    .selectFrom("os.agendamentos")
    .select(["id", "agenda_id", "inicio", "status"])
    .where("id", "=", id)
    .where("chamado_id", "=", chamadoId)
    .executeTakeFirst();
}

export async function cancelarAgendamento(
  tx: Tx,
  id: string,
  observacao: string,
): Promise<void> {
  await tx
    .updateTable("os.agendamentos")
    .set({ status: "cancelado", observacao })
    .where("id", "=", id)
    .execute();
}
