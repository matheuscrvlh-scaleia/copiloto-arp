import { type Insertable, sql, type Updateable } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  OsCategorias,
  OsModeloItens,
  OsParametros,
} from "@/infra/banco/tipos";

// Consultas de Tickets › Configurações: catálogo, setores e pessoas,
// terceirizados e contatos, cadastro dos modelos, parâmetros (feriados,
// técnicos e valor por minuto, categorias de ativo, metas) e o histórico do
// módulo (core.auditoria). Só SQL: quem abre o escopo é o service.

const linhas = (r: { numUpdatedRows?: bigint; numDeletedRows?: bigint }) =>
  Number(r.numUpdatedRows ?? r.numDeletedRows ?? 0n);

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/** Chamados de cada categoria (o que a pessoa vê). */
export async function chamadosPorCategoria(
  tx: Tx,
  ids: string[],
): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const r = await tx
    .selectFrom("os.chamados")
    .select((eb) => ["categoria_id", eb.fn.countAll<number>().as("total")])
    .where("categoria_id", "in", ids)
    .groupBy("categoria_id")
    .execute();
  return new Map(
    r.flatMap((l) => (l.categoria_id ? [[l.categoria_id, l.total]] : [])),
  );
}

/** Etiquetas dos últimos 1.000 chamados que têm alguma. */
export async function etiquetasRecentes(tx: Tx): Promise<string[][]> {
  const r = await tx
    .selectFrom("os.chamados")
    .select("etiquetas")
    .where("etiquetas", "<>", sql<string[]>`'{}'::text[]`)
    .orderBy("criado_em", "desc")
    .limit(1000)
    .execute();
  return r.map((c) => c.etiquetas);
}

export async function contarFilhas(tx: Tx, id: string): Promise<number> {
  const r = await tx
    .selectFrom("os.categorias")
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .where("pai_id", "=", id)
    .executeTakeFirstOrThrow();
  return r.total;
}

export async function atualizarCategoria(
  tx: Tx,
  id: string,
  linha: Updateable<OsCategorias>,
): Promise<number> {
  return linhas(
    await tx
      .updateTable("os.categorias")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

/** Mudou de setor: as subcategorias vão junto (sempre do mesmo setor). */
export async function moverFilhas(
  tx: Tx,
  paiId: string,
  setorId: string,
): Promise<void> {
  await tx
    .updateTable("os.categorias")
    .set({ setor_id: setorId })
    .where("pai_id", "=", paiId)
    .where("setor_id", "<>", setorId)
    .execute();
}

export function inserirCategoria(tx: Tx, linha: Insertable<OsCategorias>) {
  return tx
    .insertInto("os.categorias")
    .values(linha)
    .returning("id")
    .executeTakeFirstOrThrow();
}

/** Próxima posição entre as irmãs (mesmo setor e mesmo pai). */
export async function proximaOrdem(
  tx: Tx,
  setorId: string,
  paiId: string | null,
): Promise<number> {
  const r = await tx
    .selectFrom("os.categorias")
    .select("ordem")
    .where("setor_id", "=", setorId)
    .where("pai_id", paiId ? "=" : "is", paiId)
    .orderBy("ordem", "desc")
    .limit(1)
    .executeTakeFirst();
  return (r?.ordem ?? 0) + 1;
}

/** Irmãs da categoria (mesmo setor e mesmo pai), na ordem da tela. */
export function irmas(tx: Tx, setorId: string, paiId: string | null) {
  return tx
    .selectFrom("os.categorias")
    .select(["id", "ordem", "nome"])
    .where("setor_id", "=", setorId)
    .where("pai_id", paiId ? "=" : "is", paiId)
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

export async function gravarOrdem(
  tx: Tx,
  tabela: "os.categorias" | "os.setores",
  id: string,
  ordem: number,
): Promise<void> {
  await tx.updateTable(tabela).set({ ordem }).where("id", "=", id).execute();
}

/** Usos que impedem apagar a categoria (service role: conta tudo). */
export async function usosDaCategoria(tx: Tx, id: string) {
  const contar = async (
    tabela: "os.chamados" | "os.planos_preventivos" | "os.modelo_itens",
  ) =>
    (
      await tx
        .selectFrom(tabela)
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .where("categoria_id", "=", id)
        .executeTakeFirstOrThrow()
    ).total;
  return {
    chamados: await contar("os.chamados"),
    planos: await contar("os.planos_preventivos"),
    itens: await contar("os.modelo_itens"),
  };
}

export async function excluirCategoria(tx: Tx, id: string): Promise<number> {
  return linhas(
    await tx
      .deleteFrom("os.categorias")
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

// ---------------------------------------------------------------------------
// Setores e pessoas
// ---------------------------------------------------------------------------

export function membros(tx: Tx) {
  return tx
    .selectFrom("os.setor_membros")
    .select(["setor_id", "usuario_id", "gestor"])
    .execute();
}

export function ordemDosSetores(tx: Tx) {
  return tx
    .selectFrom("os.setores")
    .select(["id", "ordem"])
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

export async function atualizarSetor(
  tx: Tx,
  id: string,
  linha: { nome: string; cor: string; icone: string; ativo: boolean },
): Promise<number> {
  return linhas(
    await tx
      .updateTable("os.setores")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function inserirSetor(
  tx: Tx,
  linha: { nome: string; cor: string; icone: string; ativo: boolean },
): Promise<void> {
  const ultima = await tx
    .selectFrom("os.setores")
    .select("ordem")
    .orderBy("ordem", "desc")
    .limit(1)
    .executeTakeFirst();
  await tx
    .insertInto("os.setores")
    .values({ ...linha, ordem: (ultima?.ordem ?? 0) + 1 })
    .execute();
}

export async function incluirMembro(
  tx: Tx,
  m: { setor_id: string; usuario_id: string; gestor: boolean },
): Promise<void> {
  await tx
    .insertInto("os.setor_membros")
    .values(m)
    .onConflict((oc) =>
      oc.columns(["setor_id", "usuario_id"]).doUpdateSet({ gestor: m.gestor }),
    )
    .execute();
}

export async function marcarGestor(
  tx: Tx,
  m: { setor_id: string; usuario_id: string; gestor: boolean },
): Promise<number> {
  return linhas(
    await tx
      .updateTable("os.setor_membros")
      .set({ gestor: m.gestor })
      .where("setor_id", "=", m.setor_id)
      .where("usuario_id", "=", m.usuario_id)
      .executeTakeFirst(),
  );
}

export async function removerMembro(
  tx: Tx,
  setorId: string,
  usuarioId: string,
): Promise<number> {
  return linhas(
    await tx
      .deleteFrom("os.setor_membros")
      .where("setor_id", "=", setorId)
      .where("usuario_id", "=", usuarioId)
      .executeTakeFirst(),
  );
}

// ---------------------------------------------------------------------------
// Terceirizados e contatos
// ---------------------------------------------------------------------------

export function empresas(tx: Tx) {
  return tx
    .selectFrom("os.empresas")
    .select([
      "id",
      "nome",
      "cnpj",
      "contato",
      "telefone",
      "email",
      "servicos",
      "prazo_retorno_dias",
      "ativo",
    ])
    .orderBy("nome")
    .execute();
}

export function profissionais(tx: Tx) {
  return tx
    .selectFrom("os.profissionais")
    .select(["id", "empresa_id", "nome", "telefone", "ativo"])
    .orderBy("nome")
    .execute();
}

export function contatos(tx: Tx) {
  return tx
    .selectFrom("os.contatos")
    .select(["id", "nome", "telefone", "empresa", "observacao"])
    .orderBy("nome")
    .execute();
}

export interface LinhaEmpresa {
  nome: string;
  cnpj: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  servicos: string | null;
  prazo_retorno_dias: number | null;
  ativo: boolean;
}

export async function salvarEmpresa(
  tx: Tx,
  id: string | null,
  linha: LinhaEmpresa,
): Promise<number> {
  if (!id) {
    await tx.insertInto("os.empresas").values(linha).execute();
    return 1;
  }
  return linhas(
    await tx
      .updateTable("os.empresas")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function salvarProfissional(
  tx: Tx,
  id: string | null,
  linha: {
    empresa_id: string;
    nome: string;
    telefone: string | null;
    ativo: boolean;
  },
): Promise<number> {
  if (!id) {
    await tx.insertInto("os.profissionais").values(linha).execute();
    return 1;
  }
  return linhas(
    await tx
      .updateTable("os.profissionais")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function salvarContato(
  tx: Tx,
  id: string | null,
  linha: {
    nome: string;
    telefone: string;
    empresa: string | null;
    observacao: string | null;
  },
): Promise<number> {
  if (!id) {
    await tx.insertInto("os.contatos").values(linha).execute();
    return 1;
  }
  return linhas(
    await tx
      .updateTable("os.contatos")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function removerContato(tx: Tx, id: string): Promise<number> {
  return linhas(
    await tx.deleteFrom("os.contatos").where("id", "=", id).executeTakeFirst(),
  );
}

// ---------------------------------------------------------------------------
// Modelos (cadastro; o disparo e a leitura com itens ficam em modelos.*)
// ---------------------------------------------------------------------------

export interface CamposDoModelo {
  nome: string;
  gatilho: string;
  descricao: string | null;
}

export async function atualizarModelo(
  tx: Tx,
  id: string,
  campos: CamposDoModelo,
): Promise<number> {
  return linhas(
    await tx
      .updateTable("os.modelos")
      .set(campos)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function inserirModelo(
  tx: Tx,
  campos: CamposDoModelo,
): Promise<string> {
  const r = await tx
    .insertInto("os.modelos")
    .values(campos)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Apaga os itens do modelo que saíram da lista da tela. */
export async function apagarItensFora(
  tx: Tx,
  modeloId: string,
  manter: string[],
): Promise<void> {
  let q = tx.deleteFrom("os.modelo_itens").where("modelo_id", "=", modeloId);
  if (manter.length) q = q.where("id", "not in", manter);
  await q.execute();
}

export async function gravarItens(
  tx: Tx,
  itens: (Insertable<OsModeloItens> & { id?: string })[],
): Promise<void> {
  for (const { id, ...item } of itens) {
    if (id)
      await tx
        .insertInto("os.modelo_itens")
        .values({ id, ...item })
        .onConflict((oc) => oc.column("id").doUpdateSet(item))
        .execute();
    else await tx.insertInto("os.modelo_itens").values(item).execute();
  }
}

export async function alternarModelo(
  tx: Tx,
  id: string,
  ativo: boolean,
): Promise<number> {
  return linhas(
    await tx
      .updateTable("os.modelos")
      .set({ ativo })
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

// ---------------------------------------------------------------------------
// Parâmetros: a linha única, feriados, técnicos, categorias de ativo e metas
// ---------------------------------------------------------------------------

export async function gravarParametros(
  tx: Tx,
  linha: Updateable<OsParametros>,
): Promise<number> {
  return linhas(
    await tx
      .updateTable("os.parametros")
      .set(linha)
      .where("id", "=", 1)
      .executeTakeFirst(),
  );
}

export function feriados(tx: Tx) {
  return tx
    .selectFrom("os.feriados")
    .select(["data", "nome"])
    .orderBy("data")
    .execute();
}

export async function incluirFeriado(
  tx: Tx,
  f: { data: string; nome: string },
): Promise<void> {
  await tx
    .insertInto("os.feriados")
    .values(f)
    .onConflict((oc) => oc.column("data").doUpdateSet({ nome: f.nome }))
    .execute();
}

export async function removerFeriado(tx: Tx, data: string): Promise<number> {
  return linhas(
    await tx
      .deleteFrom("os.feriados")
      .where("data", "=", data)
      .executeTakeFirst(),
  );
}

export function tecnicos(tx: Tx) {
  return tx
    .selectFrom("os.tecnicos")
    .select(["id", "nome", "usuario_id", "setor_id", "desligado_em"])
    .orderBy("nome")
    .execute();
}

export function valoresDosTecnicos(tx: Tx) {
  return tx
    .selectFrom("os.tecnico_valores")
    .select(["id", "tecnico_id", "vigente_desde", "valor_minuto"])
    .orderBy("vigente_desde", "desc")
    .execute();
}

export async function salvarTecnico(
  tx: Tx,
  id: string | null,
  linha: {
    nome: string;
    usuario_id: string | null;
    setor_id: string | null;
    desligado_em: string | null;
  },
): Promise<number> {
  if (!id) {
    await tx.insertInto("os.tecnicos").values(linha).execute();
    return 1;
  }
  return linhas(
    await tx
      .updateTable("os.tecnicos")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function incluirVigencia(
  tx: Tx,
  v: { tecnico_id: string; vigente_desde: string; valor_minuto: number },
): Promise<void> {
  await tx.insertInto("os.tecnico_valores").values(v).execute();
}

export function corrigirVigencia(tx: Tx, id: string, valor: number) {
  return tx
    .updateTable("os.tecnico_valores")
    .set({ valor_minuto: valor })
    .where("id", "=", id)
    .returning(["tecnico_id", "vigente_desde"])
    .executeTakeFirst();
}

/** O valor seguinte do técnico (fim do período de um valor). */
export function proximaVigencia(tx: Tx, tecnicoId: string, desde: string) {
  return tx
    .selectFrom("os.tecnico_valores")
    .select("vigente_desde")
    .where("tecnico_id", "=", tecnicoId)
    .where("vigente_desde", ">", desde)
    .orderBy("vigente_desde")
    .limit(1)
    .executeTakeFirst();
}

/** OS com sessões do técnico no período (para recalcular). */
export async function ordensDoPeriodo(
  tx: Tx,
  tecnicoId: string,
  de: string,
  ate: string | null,
): Promise<string[]> {
  let q = tx
    .selectFrom("os.sessoes as s")
    .innerJoin("os.sessao_tecnicos as st", "st.sessao_id", "s.id")
    .select("s.ordem_id")
    .distinct()
    .where("st.tecnico_id", "=", tecnicoId)
    .where("s.data", ">=", de);
  if (ate) q = q.where("s.data", "<", ate);
  return (await q.execute()).map((s) => s.ordem_id);
}

/** Só some uma vigência que ainda não começou. */
export async function removerVigencia(
  tx: Tx,
  id: string,
  hoje: string,
): Promise<number> {
  return linhas(
    await tx
      .deleteFrom("os.tecnico_valores")
      .where("id", "=", id)
      .where("vigente_desde", ">", hoje)
      .executeTakeFirst(),
  );
}

export function ativoCategorias(tx: Tx) {
  return tx
    .selectFrom("os.ativo_categorias")
    .select(["id", "nome", "vida_util_padrao_anos"])
    .orderBy("nome")
    .execute();
}

export async function salvarAtivoCategoria(
  tx: Tx,
  id: string | null,
  linha: { nome: string; vida_util_padrao_anos: number | null },
): Promise<number> {
  if (!id) {
    await tx.insertInto("os.ativo_categorias").values(linha).execute();
    return 1;
  }
  return linhas(
    await tx
      .updateTable("os.ativo_categorias")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function removerAtivoCategoria(
  tx: Tx,
  id: string,
): Promise<number> {
  return linhas(
    await tx
      .deleteFrom("os.ativo_categorias")
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export interface LinhaMeta {
  setor_id: string | null;
  categoria_id: string | null;
  indicador: string;
  meta: number;
  limite_atencao: number | null;
}

export async function salvarMeta(
  tx: Tx,
  id: string | null,
  linha: LinhaMeta,
): Promise<number> {
  if (!id) {
    await tx.insertInto("os.metas").values(linha).execute();
    return 1;
  }
  return linhas(
    await tx
      .updateTable("os.metas")
      .set(linha)
      .where("id", "=", id)
      .executeTakeFirst(),
  );
}

export async function removerMeta(tx: Tx, id: string): Promise<number> {
  return linhas(
    await tx.deleteFrom("os.metas").where("id", "=", id).executeTakeFirst(),
  );
}

// ---------------------------------------------------------------------------
// Histórico (core.auditoria; o RLS libera as tabelas os.* com os.historico)
// ---------------------------------------------------------------------------

const COLUNAS_AUDITORIA = [
  "id",
  "em",
  "tabela",
  "registro_id",
  "acao",
  "usuario_id",
  "antes",
  "depois",
] as const;

/** Últimas alterações das tabelas, da mais nova para a mais antiga. */
export function ultimasAlteracoes(tx: Tx, tabelas: string[], limite: number) {
  return tx
    .selectFrom("core.auditoria")
    .select(COLUNAS_AUDITORIA)
    .where("tabela", "in", tabelas)
    .orderBy("em", "desc")
    .limit(limite)
    .execute();
}

export interface FiltroDoHistorico {
  tabela: string | null;
  usuario: string | null;
  registro: string | null;
  /** Instantes já com o fuso de Brasília. */
  de: string | null;
  ate: string | null;
  /** Busca: registro parecido, ids exatos, tabelas e autores. */
  busca: {
    termo: string;
    registros: string[];
    tabelas: string[];
    autores: string[];
  } | null;
}

function historicoFiltrado(tx: Tx, f: FiltroDoHistorico) {
  let q = tx.selectFrom("core.auditoria").where("tabela", "like", "os.%");
  if (f.tabela) q = q.where("tabela", "=", f.tabela);
  if (f.usuario) q = q.where("usuario_id", "=", f.usuario);
  if (f.registro) q = q.where("registro_id", "=", f.registro);
  if (f.de) q = q.where("em", ">=", f.de);
  if (f.ate) q = q.where("em", "<=", f.ate);
  const b = f.busca;
  if (b)
    q = q.where((eb) =>
      eb.or([
        eb("registro_id", "ilike", `%${b.termo}%`),
        ...(b.registros.length ? [eb("registro_id", "in", b.registros)] : []),
        ...(b.tabelas.length ? [eb("tabela", "in", b.tabelas)] : []),
        ...(b.autores.length ? [eb("usuario_id", "in", b.autores)] : []),
      ]),
    );
  return q;
}

export async function historico(
  tx: Tx,
  f: FiltroDoHistorico,
  pagina: { limite: number; pular: number },
) {
  const { total } = await historicoFiltrado(tx, f)
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .executeTakeFirstOrThrow();
  const lidas = await historicoFiltrado(tx, f)
    .select(COLUNAS_AUDITORIA)
    .orderBy("em", "desc")
    .limit(pagina.limite)
    .offset(pagina.pular)
    .execute();
  return { linhas: lidas, total };
}

/** Chamado e OS com o número (cada um numera na sua sequência). */
export async function idsPeloNumero(tx: Tx, numero: number): Promise<string[]> {
  const c = await tx
    .selectFrom("os.chamados")
    .select("id")
    .where("numero", "=", numero)
    .executeTakeFirst();
  const o = await tx
    .selectFrom("os.ordens")
    .select("id")
    .where("numero", "=", numero)
    .executeTakeFirst();
  return [c?.id, o?.id].filter((x): x is string => !!x);
}
