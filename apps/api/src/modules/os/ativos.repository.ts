import type { FiltroAtivos } from "@arp/shared/os/ativos-lista";
import { termoDeBusca } from "@arp/shared/os/filtro-postgrest";
import {
  type Expression,
  type ExpressionBuilder,
  type Insertable,
  type Selectable,
  type SqlBool,
  sql,
  type Updateable,
} from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  DB,
  JsonValue,
  OsAtivoCategorias,
  OsAtivos,
  OsPlanosPreventivos,
  OsSituacaoAtivo,
} from "@/infra/banco/tipos";

// Consultas dos ativos: lista, sinal de troca, ficha, cadastro, planos
// preventivos, anexos e categorias. Só SQL: quem abre o escopo é o service
// (as telas leem pela sessão; o RLS confere os.ativos/os.ativos_gerenciar).

export type Ativo = Selectable<OsAtivos>;
export type CategoriaAtivo = Selectable<OsAtivoCategorias>;
export type Plano = Selectable<OsPlanosPreventivos>;

// ---------------------------------------------------------------------------
// Resumo, sinal e preventivas atrasadas
// ---------------------------------------------------------------------------

export interface LinhaDoResumo {
  ativo_id: string;
  custo_periodo: number;
  custo_total: number;
  corretivas_periodo: number;
  preventivas_periodo: number;
  os_abertas: number;
  ultima_os: string | null;
}

/** Manutenção por ativo desde `desde` e desde sempre (os.resumo_ativos). */
export async function resumos(
  tx: Tx,
  desde: string,
  ativoId?: string,
): Promise<LinhaDoResumo[]> {
  const r = ativoId
    ? await sql<LinhaDoResumo>`
        select * from os.resumo_ativos(p_desde => ${desde}::date)
        where ativo_id = ${ativoId}`.execute(tx)
    : await sql<LinhaDoResumo>`
        select * from os.resumo_ativos(p_desde => ${desde}::date)`.execute(tx);
  return r.rows;
}

/** As colunas do cálculo do sinal, de todos os ativos (poucas colunas). */
export function colunasDoSinal(tx: Tx) {
  return tx
    .selectFrom("os.ativos")
    .select([
      "id",
      "situacao",
      "bloco",
      "valor_reposicao",
      "compra_data",
      "vida_util_anos",
    ])
    .orderBy("id")
    .execute();
}

/**
 * Preventivas atrasadas por ativo: OS de plano ainda abertas com o prazo
 * vencido (costumam ser poucas).
 */
export function atrasadasPorAtivo(tx: Tx, agoraIso: string) {
  return tx
    .selectFrom("os.ordens")
    .select((eb) => ["ativo_id", eb.fn.countAll<number>().as("atrasadas")])
    .where("plano_id", "is not", null)
    .where("ativo_id", "is not", null)
    .where("status", "in", ["aberto", "em_andamento", "aguardando"])
    .where("prazo", "<", agoraIso)
    .groupBy("ativo_id")
    .execute();
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

type EbAtivos = ExpressionBuilder<DB, "os.ativos">;

const vazio = (eb: EbAtivos, coluna: "bloco" | "area") =>
  eb.or([eb(coluna, "is", null), eb(coluna, "=", "")]);

/** Cadastro sem os dados do sinal de troca (o mesmo critério da ficha). */
export function cadastroIncompleto(eb: EbAtivos): Expression<SqlBool> {
  return eb.or([
    eb("categoria_id", "is", null),
    eb.and([vazio(eb, "bloco"), eb("loja_id", "is", null), vazio(eb, "area")]),
    eb("compra_data", "is", null),
    eb("valor_reposicao", "is", null),
    eb("valor_reposicao", "=", 0),
    eb("vida_util_anos", "is", null),
  ]);
}

/** Filtros da lista que o banco resolve (todos menos o sinal). */
export function filtroDosAtivos(f: FiltroAtivos, comAtraso: string[]) {
  return (eb: EbAtivos): Expression<SqlBool> => {
    const e: Expression<SqlBool>[] = [];
    if (f.situacao === "") e.push(eb("situacao", "<>", "baixado"));
    else if (f.situacao !== "todas")
      e.push(eb(sql<string>`situacao::text`, "=", f.situacao));
    if (f.cat === "sem") e.push(eb("categoria_id", "is", null));
    else if (f.cat) e.push(eb(sql<string>`categoria_id::text`, "=", f.cat));
    if (f.local === "sem") e.push(vazio(eb, "bloco"));
    else if (f.local) e.push(eb("bloco", "=", f.local));
    if (f.incompleto) e.push(cadastroIncompleto(eb));
    if (f.preventiva)
      e.push(
        comAtraso.length ? eb("id", "in", comAtraso) : sql<boolean>`false`,
      );
    const termo = termoDeBusca(f.q);
    if (termo) {
      const como = `%${termo}%`;
      e.push(
        eb.or([
          eb("codigo", "ilike", como),
          eb("nome", "ilike", como),
          eb("numero_serie", "ilike", como),
          eb("fabricante", "ilike", como),
          eb("modelo", "ilike", como),
        ]),
      );
    }
    return eb.and(e);
  };
}

export function idsDoFiltro(tx: Tx, f: FiltroAtivos, comAtraso: string[]) {
  return tx
    .selectFrom("os.ativos")
    .select("id")
    .where(filtroDosAtivos(f, comAtraso))
    .orderBy("codigo")
    .orderBy("id")
    .execute();
}

export async function contarDoFiltro(
  tx: Tx,
  f: FiltroAtivos,
  comAtraso: string[],
): Promise<number> {
  const r = await tx
    .selectFrom("os.ativos")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where(filtroDosAtivos(f, comAtraso))
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

export function trechoDoFiltro(
  tx: Tx,
  f: FiltroAtivos,
  comAtraso: string[],
  p: { limite: number; pular: number },
) {
  return tx
    .selectFrom("os.ativos")
    .selectAll()
    .where(filtroDosAtivos(f, comAtraso))
    .orderBy("codigo")
    .orderBy("id")
    .limit(p.limite)
    .offset(p.pular)
    .execute();
}

export async function ativosPorId(tx: Tx, ids: string[]): Promise<Ativo[]> {
  if (!ids.length) return [];
  return tx
    .selectFrom("os.ativos")
    .selectAll()
    .where("id", "in", ids)
    .execute();
}

/** Contagem dos cartões do topo. */
export async function contarAtivos(
  tx: Tx,
  filtro: (eb: EbAtivos) => Expression<SqlBool>,
): Promise<number> {
  const r = await tx
    .selectFrom("os.ativos")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where(filtro)
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

/** A próxima data dos planos ativos de cada ativo da página. */
export function proximasPreventivas(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.planos_preventivos")
    .select((eb) => ["ativo_id", eb.fn.min("proxima_data").as("proxima")])
    .where("ativo", "=", true)
    .where("ativo_id", "in", ids)
    .groupBy("ativo_id")
    .execute();
}

export function lojasPorId(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.lojas")
    .select(["id", "luc", "nome", "bloco"])
    .where("id", "in", ids)
    .execute();
}

// ---------------------------------------------------------------------------
// Categorias e empresas
// ---------------------------------------------------------------------------

export function categoriasDeAtivo(tx: Tx) {
  return tx
    .selectFrom("os.ativo_categorias")
    .select(["id", "nome", "vida_util_padrao_anos"])
    .orderBy("nome")
    .execute();
}

export function ativosPorCategoria(tx: Tx) {
  return tx
    .selectFrom("os.ativos")
    .select((eb) => ["categoria_id", eb.fn.countAll<number>().as("total")])
    .where("categoria_id", "is not", null)
    .groupBy("categoria_id")
    .execute();
}

const COLUNAS_EMPRESA = [
  "id",
  "nome",
  "contato",
  "telefone",
  "email",
  "ativo",
] as const;

export function empresas(tx: Tx) {
  return tx
    .selectFrom("os.empresas")
    .select(COLUNAS_EMPRESA)
    .orderBy("nome")
    .orderBy("id")
    .execute();
}

export function empresa(tx: Tx, id: string) {
  return tx
    .selectFrom("os.empresas")
    .select(COLUNAS_EMPRESA)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Blocos usados nos ativos (sugestões do campo). */
export async function blocosUsados(tx: Tx): Promise<string[]> {
  const linhas = await tx
    .selectFrom("os.ativos")
    .select("bloco")
    .where("bloco", "is not", null)
    .execute();
  return linhas.map((a) => a.bloco?.trim() ?? "").filter(Boolean);
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

export function ativo(tx: Tx, id: string): Promise<Ativo | undefined> {
  return tx
    .selectFrom("os.ativos")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

const COLUNAS_OS = [
  "id",
  "numero",
  "tipo",
  "titulo",
  "status",
  "prazo",
  "criado_em",
  "concluido_em",
  "aguardando_min",
  "causa_falha",
  "categoria_id",
] as const;

/** As OS do ativo (as que a pessoa vê). */
export function ordensDoAtivo(tx: Tx, id: string) {
  return tx
    .selectFrom("os.ordens")
    .select([...COLUNAS_OS, "plano_id"])
    .where("ativo_id", "=", id)
    .orderBy("criado_em", "desc")
    .limit(1000)
    .execute();
}

/** Os chamados ligados ao ativo (os que a pessoa vê). */
export function chamadosDoAtivo(tx: Tx, id: string) {
  return tx
    .selectFrom("os.chamados")
    .select(COLUNAS_OS)
    .where("ativo_id", "=", id)
    .orderBy("criado_em", "desc")
    .limit(1000)
    .execute();
}

export function situacoesDoAtivo(tx: Tx, id: string) {
  return tx
    .selectFrom("os.ativo_situacoes")
    .select(["situacao", "desde", "ate"])
    .where("ativo_id", "=", id)
    .orderBy("desde")
    .execute();
}

export function planosDoAtivo(tx: Tx, id: string) {
  return tx
    .selectFrom("os.planos_preventivos")
    .selectAll()
    .where("ativo_id", "=", id)
    .orderBy("ativo", "desc")
    .orderBy("proxima_data")
    .execute();
}

export function anexosDoAtivo(tx: Tx, id: string) {
  return tx
    .selectFrom("os.anexos")
    .select([
      "id",
      "nome",
      "categoria",
      "mime",
      "tamanho",
      "em",
      "path",
      "enviado_por",
    ])
    .where("ativo_id", "=", id)
    .orderBy("em", "desc")
    .execute();
}

/** Custo total de cada OS (só com os.custos; o RLS confere). */
export async function custosDasOS(
  tx: Tx,
  ids: string[],
): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const linhas = await tx
    .selectFrom("os.os_custos")
    .select(["ordem_id", "custo_total"])
    .where("ordem_id", "in", ids)
    .execute();
  const mapa = new Map<string, number>();
  for (const c of linhas)
    if (c.custo_total !== null) mapa.set(c.ordem_id, Number(c.custo_total));
  return mapa;
}

/** Ativos da página de etiquetas, com a loja (código, nome e local). */
export function ativosParaEtiqueta(tx: Tx) {
  return tx
    .selectFrom("os.ativos as a")
    .leftJoin("os.lojas as l", "l.id", "a.loja_id")
    .select([
      "a.id",
      "a.codigo",
      "a.nome",
      "a.bloco",
      "a.area",
      "a.ponto",
      "a.situacao",
      "l.luc",
      "l.nome as loja_nome",
    ])
    .orderBy("a.codigo")
    .execute();
}

// ---------------------------------------------------------------------------
// Gravações (pela sessão: o RLS confere os.ativos_gerenciar)
// ---------------------------------------------------------------------------

export async function inserirAtivo(
  tx: Tx,
  valores: Insertable<OsAtivos>,
): Promise<string> {
  const r = await tx
    .insertInto("os.ativos")
    .values(valores)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Devolve o id se a linha mudou (sem linha: não existe ou o RLS barrou). */
export async function atualizarAtivo(
  tx: Tx,
  id: string,
  valores: Updateable<OsAtivos>,
): Promise<string | undefined> {
  const r = await tx
    .updateTable("os.ativos")
    .set(valores)
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();
  return r?.id;
}

export async function pausarPlanosDoAtivo(tx: Tx, ativoId: string) {
  await tx
    .updateTable("os.planos_preventivos")
    .set({ ativo: false })
    .where("ativo_id", "=", ativoId)
    .execute();
}

export async function inserirAnexoDoAtivo(
  tx: Tx,
  a: {
    ativoId: string;
    categoria: string;
    nome: string;
    path: string;
    mime: string | null;
    tamanho: number;
    usuario: { id: string; nome: string };
  },
): Promise<string> {
  const r = await tx
    .insertInto("os.anexos")
    .values({
      ativo_id: a.ativoId,
      categoria: a.categoria,
      nome: a.nome,
      path: a.path,
      mime: a.mime,
      tamanho: a.tamanho,
      enviado_por: a.usuario.id,
      enviado_por_nome: a.usuario.nome,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Remove o anexo do ativo; devolve os caminhos para apagar do disco. */
export async function removerAnexoDoAtivo(tx: Tx, id: string) {
  return tx
    .deleteFrom("os.anexos")
    .where("id", "=", id)
    .where("ativo_id", "is not", null)
    .returning("path")
    .execute();
}

export function plano(tx: Tx, id: string): Promise<Plano | undefined> {
  return tx
    .selectFrom("os.planos_preventivos")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

export interface ValoresDoPlano {
  ativo_id: string;
  titulo: string;
  descricao: string | null;
  proxima_data: string;
  antecedencia_dias: number | null;
  setor_id: string;
  categoria_id: string | null;
  responsavel_id: string | null;
  frequencia_dias: number | null;
  frequencia_meses: number | null;
  checklist: JsonValue[];
}

export async function salvarPlano(
  tx: Tx,
  id: string | null,
  v: ValoresDoPlano,
): Promise<void> {
  const valores = { ...v, checklist: JSON.stringify(v.checklist) };
  if (id)
    await tx
      .updateTable("os.planos_preventivos")
      .set(valores)
      .where("id", "=", id)
      .execute();
  else await tx.insertInto("os.planos_preventivos").values(valores).execute();
}

export async function alternarPlano(tx: Tx, id: string, ativo: boolean) {
  await tx
    .updateTable("os.planos_preventivos")
    .set({ ativo })
    .where("id", "=", id)
    .execute();
}

export async function excluirPlano(tx: Tx, id: string) {
  await tx.deleteFrom("os.planos_preventivos").where("id", "=", id).execute();
}

/**
 * Avança o plano só se ninguém mexeu na data enquanto isso (outra rodada,
 * "Gerar agora" ou edição do plano). true: avançou.
 */
export async function avancarPlano(
  tx: Tx,
  id: string,
  de: string,
  para: string,
): Promise<boolean> {
  const r = await tx
    .updateTable("os.planos_preventivos")
    .set({ proxima_data: para })
    .where("id", "=", id)
    .where("proxima_data", "=", de)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function salvarCategoriaDeAtivo(
  tx: Tx,
  id: string | null,
  v: { nome: string; vida_util_padrao_anos: number | null },
) {
  if (id)
    await tx
      .updateTable("os.ativo_categorias")
      .set(v)
      .where("id", "=", id)
      .execute();
  else await tx.insertInto("os.ativo_categorias").values(v).execute();
}

export async function excluirCategoriaDeAtivo(tx: Tx, id: string) {
  await tx.deleteFrom("os.ativo_categorias").where("id", "=", id).execute();
}

// ---------------------------------------------------------------------------
// Preventivas (rotina e "Gerar agora")
// ---------------------------------------------------------------------------

export type AtivoDaPreventiva = Pick<
  Ativo,
  "id" | "nome" | "codigo" | "bloco" | "area" | "ponto" | "loja_id" | "situacao"
>;

const COLUNAS_DA_PREVENTIVA = [
  "id",
  "nome",
  "codigo",
  "bloco",
  "area",
  "ponto",
  "loja_id",
  "situacao",
] as const;

/** Os planos ativos (todos), na ordem do id. */
export function planosAtivos(tx: Tx): Promise<Plano[]> {
  return tx
    .selectFrom("os.planos_preventivos")
    .selectAll()
    .where("ativo", "=", true)
    .orderBy("id")
    .execute();
}

/** Os ativos dos planos, com o que a OS preventiva usa. */
export function ativosDaPreventiva(
  tx: Tx,
  ids: string[],
): Promise<AtivoDaPreventiva[]> {
  if (!ids.length) return Promise.resolve([]);
  return tx
    .selectFrom("os.ativos")
    .select(COLUNAS_DA_PREVENTIVA)
    .where("id", "in", ids)
    .execute();
}

export type { OsSituacaoAtivo };
