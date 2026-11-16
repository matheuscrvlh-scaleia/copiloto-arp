import { type Insertable, type Selectable, sql, type Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  OsAnexos,
  OsChamados,
  OsDestinatarios,
  OsEventos,
  OsStatusChamado,
} from "@/infra/banco/tipos";
import { type Alvo, chaveDo, donoDo, ehOrdem } from "./alvo";
import type { Chamado } from "./base.repository";

// Consultas do chamado e da OS (leitura inteira, gravações do ciclo, filhas
// comuns: destinos, linha do tempo, anexos, participantes). O id é único
// entre os.chamados e os.ordens; o tipo do alvo decide a tabela.

export type Destinatario = Selectable<OsDestinatarios>;
export type Evento = Selectable<OsEventos>;
export type Anexo = Selectable<OsAnexos>;
/** O que as ações mudam (colunas comuns ao chamado e à OS). */
export type Patch = Updateable<OsChamados>;

/** O chamado ou a OS inteira, se a pessoa pode vê-la (RLS). */
export async function lerChamado(
  tx: Tx,
  id: string,
): Promise<Chamado | undefined> {
  const c = await tx
    .selectFrom("os.chamados")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
  if (c) return c;
  return tx
    .selectFrom("os.ordens")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export function inserirChamado(
  tx: Tx,
  linha: Insertable<OsChamados> & { id: string },
) {
  // A OS tem as mesmas colunas (e o tipo dela é sempre 'os').
  const { tipo, ...resto } = linha;
  return tipo === "os"
    ? tx.insertInto("os.ordens").values(resto).execute()
    : tx.insertInto("os.chamados").values(linha).execute();
}

export async function numeroDe(tx: Tx, alvo: Alvo): Promise<number> {
  const linha = ehOrdem(alvo)
    ? await tx
        .selectFrom("os.ordens")
        .select("numero")
        .where("id", "=", alvo.id)
        .executeTakeFirst()
    : await tx
        .selectFrom("os.chamados")
        .select("numero")
        .where("id", "=", alvo.id)
        .executeTakeFirst();
  return linha?.numero ?? 0;
}

/**
 * Altera o chamado ou a OS; com `se`, só quando o status (ou a marca de
 * atualização) ainda é o que foi lido. Devolve quantas linhas mudaram.
 */
export async function atualizar(
  tx: Tx,
  alvo: Alvo,
  patch: Patch,
  se: { status?: OsStatusChamado; atualizadoEm?: string } = {},
): Promise<number> {
  const { status, atualizadoEm } = se;
  if (ehOrdem(alvo)) {
    let q = tx.updateTable("os.ordens").set(patch).where("id", "=", alvo.id);
    if (status) q = q.where("status", "=", status);
    if (atualizadoEm) q = q.where("atualizado_em", "=", atualizadoEm);
    return (await q.returning("id").execute()).length;
  }
  let q = tx.updateTable("os.chamados").set(patch).where("id", "=", alvo.id);
  if (status) q = q.where("status", "=", status);
  if (atualizadoEm) q = q.where("atualizado_em", "=", atualizadoEm);
  return (await q.returning("id").execute()).length;
}

/** Número digitado → id do chamado, se a pessoa o vê. */
export async function idPeloNumero(
  tx: Tx,
  numero: number,
): Promise<string | undefined> {
  const linha = await tx
    .selectFrom("os.chamados")
    .select("id")
    .where("numero", "=", numero)
    .executeTakeFirst();
  return linha?.id;
}

// ---------------------------------------------------------------------------
// Destinos
// ---------------------------------------------------------------------------

/** Quantos destinatários o chamado tem (vários: cada um conclui o seu). */
export async function contarDestinos(tx: Tx, alvo: Alvo): Promise<number> {
  const r = await tx
    .selectFrom("os.destinatarios")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where(chaveDo(alvo), "=", alvo.id)
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

export function destinosDo(tx: Tx, alvo: Alvo): Promise<Destinatario[]> {
  return tx
    .selectFrom("os.destinatarios")
    .selectAll()
    .where(chaveDo(alvo), "=", alvo.id)
    .orderBy("ordem")
    .execute();
}

export function destinatario(
  tx: Tx,
  id: string,
): Promise<Destinatario | undefined> {
  return tx
    .selectFrom("os.destinatarios")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function inserirDestinos(
  tx: Tx,
  linhas: Insertable<OsDestinatarios>[],
): Promise<void> {
  if (linhas.length)
    await tx.insertInto("os.destinatarios").values(linhas).execute();
}

export async function atualizarDestino(
  tx: Tx,
  id: string,
  patch: Updateable<OsDestinatarios>,
): Promise<void> {
  await tx
    .updateTable("os.destinatarios")
    .set(patch)
    .where("id", "=", id)
    .execute();
}

/** Reabrir: os destinos voltam a andar (em ordem, só o último). */
export async function reabrirDestinos(
  tx: Tx,
  alvo: Alvo,
  soOrdem?: number,
): Promise<void> {
  let q = tx
    .updateTable("os.destinatarios")
    .set({ status: "em_andamento" })
    .where(chaveDo(alvo), "=", alvo.id);
  if (soOrdem !== undefined) q = q.where("ordem", "=", soOrdem);
  await q.execute();
}

/** Andamento dos avisos de vários destinos (uma lista de chamados). */
export function destinosDosChamados(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.destinatarios")
    .select([
      "chamado_id",
      "status",
      "setor_id",
      "usuario_id",
      "titulo",
      "ordem",
    ])
    .where("chamado_id", "in", ids)
    .orderBy("ordem")
    .execute();
}

// ---------------------------------------------------------------------------
// Linha do tempo, anexos e participantes
// ---------------------------------------------------------------------------

const doDono = (id: string) =>
  sql<boolean>`(chamado_id = ${id} or ordem_id = ${id})`;

export function eventosDo(tx: Tx, id: string): Promise<Evento[]> {
  return tx
    .selectFrom("os.eventos")
    .selectAll()
    .where(doDono(id))
    .orderBy("em", "asc")
    .execute();
}

export function anexosDo(tx: Tx, id: string): Promise<Anexo[]> {
  return tx
    .selectFrom("os.anexos")
    .selectAll()
    .where(doDono(id))
    .orderBy("em", "asc")
    .execute();
}

export function destinosDoId(tx: Tx, id: string): Promise<Destinatario[]> {
  return tx
    .selectFrom("os.destinatarios")
    .selectAll()
    .where(doDono(id))
    .orderBy("ordem")
    .execute();
}

export async function seguidoresDoId(tx: Tx, id: string): Promise<string[]> {
  const linhas = await tx
    .selectFrom("os.participantes")
    .select("usuario_id")
    .where(doDono(id))
    .execute();
  return linhas.map((p) => p.usuario_id);
}

export async function inserirAnexo(
  tx: Tx,
  alvo: Alvo,
  a: {
    eventoId: number | null;
    categoria: "foto" | "anexo";
    nome: string;
    path: string;
    mime: string | null;
    tamanho: number;
    visivelLojista: boolean;
    enviadoPor: string;
  },
): Promise<string> {
  const r = await tx
    .insertInto("os.anexos")
    .values({
      ...donoDo(alvo),
      evento_id: a.eventoId,
      categoria: a.categoria,
      nome: a.nome,
      path: a.path,
      mime: a.mime,
      tamanho: a.tamanho,
      visivel_lojista: a.visivelLojista,
      enviado_por: a.enviadoPor,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function deixarDeSeguir(
  tx: Tx,
  alvo: Alvo,
  usuarioId: string,
): Promise<void> {
  await tx
    .deleteFrom("os.participantes")
    .where(chaveDo(alvo), "=", alvo.id)
    .where("usuario_id", "=", usuarioId)
    .execute();
}

// ---------------------------------------------------------------------------
// O que o detalhe mostra ao lado do chamado
// ---------------------------------------------------------------------------

const CURTO = ["id", "numero", "titulo", "status", "tipo"] as const;

/** O chamado ligado (a OS aponta para ele). */
export function chamadoCurto(tx: Tx, id: string) {
  return tx
    .selectFrom("os.chamados")
    .select(CURTO)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** As OS ligadas a um chamado (as que a pessoa vê). */
export function ordensDoChamado(tx: Tx, id: string) {
  return tx
    .selectFrom("os.ordens")
    .select(CURTO)
    .where("vinculado_a_id", "=", id)
    .orderBy("numero")
    .execute();
}

export function lojaDoChamado(tx: Tx, id: string) {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "luc", "nome", "telefone"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export interface AtivoParaVincular {
  id: string;
  codigo: string;
  nome: string;
  local: string;
}

/** Ativos pelo RPC de vínculo (quem abre pode não ter acesso a Ativos). */
export async function ativosParaVincular(
  tx: Tx,
  id?: string,
): Promise<AtivoParaVincular[]> {
  const r = id
    ? await sql<AtivoParaVincular>`
        select id, codigo, nome, local from os.ativos_para_vincular()
        where id = ${id}`.execute(tx)
    : await sql<AtivoParaVincular>`
        select id, codigo, nome, local from os.ativos_para_vincular()`.execute(
        tx,
      );
  return r.rows;
}

export function vistoriaCurta(tx: Tx, id: string) {
  return tx
    .selectFrom("os.vistorias")
    .select(["id", "codigo", "loja_id", "bloco", "unidade"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export function ambienteDaVistoria(tx: Tx, id: string, vistoriaId: string) {
  return tx
    .selectFrom("os.vistoria_ambientes")
    .select(["id", "titulo", "descricao"])
    .where("id", "=", id)
    .where("vistoria_id", "=", vistoriaId)
    .executeTakeFirst();
}

/** Contatos salvos para o WhatsApp. */
export function contatosSalvos(tx: Tx) {
  return tx
    .selectFrom("os.contatos")
    .select(["id", "nome", "telefone", "empresa"])
    .orderBy("nome")
    .limit(500)
    .execute();
}

// ---------------------------------------------------------------------------
// Categoria criada no "Novo chamado" e terceirizado rápido
// ---------------------------------------------------------------------------

/** Próxima posição entre as categorias de cima do setor. */
export async function proximaOrdemDeCategoria(
  tx: Tx,
  setorId: string,
): Promise<number> {
  const linha = await tx
    .selectFrom("os.categorias")
    .select("ordem")
    .where("setor_id", "=", setorId)
    .where("pai_id", "is", null)
    .orderBy("ordem", "desc")
    .limit(1)
    .executeTakeFirst();
  return (linha?.ordem ?? 0) + 1;
}

export function inserirCategoriaSimples(
  tx: Tx,
  c: {
    nome: string;
    setor_id: string;
    icone: string;
    tipo_padrao: "tarefa" | "solicitacao" | "os" | "aviso";
    precisa_confirmacao: boolean;
    ordem: number;
  },
) {
  return tx
    .insertInto("os.categorias")
    .values(c)
    .returning(["id", "prioridade_padrao"])
    .executeTakeFirstOrThrow();
}

/** Empresa terceirizada criada no "Novo chamado" (só o cadastro simples). */
export async function inserirEmpresa(
  tx: Tx,
  e: {
    nome: string;
    cnpj: string | null;
    contato: string | null;
    telefone: string | null;
    email: string | null;
    servicos: string | null;
  },
): Promise<void> {
  await tx.insertInto("os.empresas").values(e).execute();
}
