import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do rateio da limpeza (spec 4.8) usadas pelo Painel: a lista dos
// meses com o que a conta precisa. Com a sessão (RLS: operacoes.limpeza.ver
// ou .fechar). A parte B (tela da Limpeza) completa este arquivo.

/** Meses do rateio, do mais novo ao mais antigo, com o status da importação. */
export function meses(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_meses as m")
    .leftJoin("operacoes.importacoes as i", "i.id", "m.importacao_id")
    .select([
      "m.referencia",
      "m.importacao_id",
      "m.valor_base",
      "m.base_composicao",
      "m.func_base",
      "m.func_area_comum",
      "m.func_rateados",
      "m.regra_bl04",
      "m.status",
      "m.incompleto",
      "m.origem",
      "m.valores_planilha",
      "m.fechado_em",
      "m.enviado_em",
      "m.exemplo",
      "i.status as importacao_status",
    ])
    .orderBy("m.referencia", "desc")
    .execute();
}

export function extras(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_extras")
    .select(["id", "referencia", "valor"])
    .orderBy("referencia")
    .orderBy("id")
    .execute();
}

export function minutos(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_minutos")
    .select(["referencia", "bloco", "limpeza", "manutencao"])
    .orderBy("referencia")
    .orderBy("bloco")
    .execute();
}

/** Itens do contrato que entram na conferência. */
export function contratoDaConferencia(tx: Tx) {
  return tx
    .selectFrom("operacoes.limpeza_contrato")
    .select(["id", "referencia", "valor", "entra_conferencia"])
    .where("entra_conferencia", "=", true)
    .orderBy("referencia")
    .orderBy("id")
    .execute();
}

/** Dias úteis e feriados (Parâmetros dos Chamados). Service role: quem chama confere. */
export async function calendarioDosChamados(tx: Tx) {
  const p = await tx
    .selectFrom("os.parametros")
    .select("dias_uteis")
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
  const f = await tx.selectFrom("os.feriados").select("data").execute();
  return { diasUteis: p.dias_uteis, feriados: f.map((x) => x.data) };
}

// ---------------------------------------------------------------------------
// Tela da Limpeza (parte B): um mês, as gravações e a importação do histórico.
// Com a sessão: o banco confere operacoes.limpeza.fechar e o RLS deixa mudar
// só o mês aberto. Na leitura do Financeiro (mês enviado), a service role.
// ---------------------------------------------------------------------------

/** O mês com as colunas que a tela, o PDF e o Excel usam. */
export function mes(tx: Tx, ref: string) {
  return tx
    .selectFrom("operacoes.limpeza_meses as m")
    .leftJoin("operacoes.importacoes as i", "i.id", "m.importacao_id")
    .select([
      "m.referencia",
      "m.importacao_id",
      "m.apontamento",
      "m.valor_base",
      "m.base_composicao",
      "m.func_base",
      "m.func_area_comum",
      "m.func_rateados",
      "m.regra_bl04",
      "m.status",
      "m.incompleto",
      "m.origem",
      "m.valores_planilha",
      "m.fechado_por",
      "m.fechado_em",
      "m.reaberto_por",
      "m.reaberto_em",
      "m.reaberto_motivo",
      "m.enviado_por",
      "m.enviado_em",
      "m.exemplo",
      "m.criado_por",
      "m.criado_em",
      "m.atualizado_em",
      "i.status as importacao_status",
    ])
    .where("m.referencia", "=", ref)
    .executeTakeFirst();
}
export type LinhaDoMes = NonNullable<Awaited<ReturnType<typeof mes>>>;

export function extrasDoMes(tx: Tx, ref: string) {
  return tx
    .selectFrom("operacoes.limpeza_extras")
    .select(["descricao", "quantidade", "valor_unitario", "valor"])
    .where("referencia", "=", ref)
    .orderBy("ordem")
    .execute();
}

export function minutosDoMes(tx: Tx, ref: string) {
  return tx
    .selectFrom("operacoes.limpeza_minutos")
    .select(["referencia", "bloco", "limpeza", "manutencao"])
    .where("referencia", "=", ref)
    .orderBy("bloco")
    .execute();
}

export function contratoDoMes(tx: Tx, ref: string) {
  return tx
    .selectFrom("operacoes.limpeza_contrato")
    .select(["descricao", "valor", "entra_conferencia"])
    .where("referencia", "=", ref)
    .orderBy("ordem")
    .execute();
}

export function equipeDoMes(tx: Tx, ref: string) {
  return tx
    .selectFrom("operacoes.limpeza_equipe")
    .select([
      "ordem",
      "nome",
      "funcao",
      "grupo",
      "blocos",
      "turno",
      "minutos_dia",
    ])
    .where("referencia", "=", ref)
    .orderBy("ordem")
    .execute();
}

export function anexosDoMes(tx: Tx, ref: string) {
  return tx
    .selectFrom("operacoes.limpeza_anexos")
    .select(["id", "nome", "tipo", "enviado_em", "enviado_por"])
    .where("referencia", "=", ref)
    .orderBy("enviado_em", "desc")
    .execute();
}

/** Os últimos meses antes de `ref` (para copiar o anterior que vale). */
export function mesesAntes(tx: Tx, ref: string) {
  return tx
    .selectFrom("operacoes.limpeza_meses as m")
    .leftJoin("operacoes.importacoes as i", "i.id", "m.importacao_id")
    .select([
      "m.referencia",
      "m.importacao_id",
      "i.status as importacao_status",
    ])
    .where("m.referencia", "<", ref)
    .orderBy("m.referencia", "desc")
    .limit(24)
    .execute();
}

export async function existe(tx: Tx, ref: string): Promise<boolean> {
  const r = await tx
    .selectFrom("operacoes.limpeza_meses")
    .select("referencia")
    .where("referencia", "=", ref)
    .executeTakeFirst();
  return !!r;
}

export async function referenciasExistentes(tx: Tx, refs: string[]) {
  if (!refs.length) return [];
  const r = await tx
    .selectFrom("operacoes.limpeza_meses")
    .select("referencia")
    .where("referencia", "in", refs)
    .execute();
  return r.map((x) => x.referencia);
}

/** operacoes.limpeza_salvar: mês e filhos numa transação. */
export async function salvar(tx: Tx, ref: string, dados: unknown) {
  await sql`select operacoes.limpeza_salvar(p_ref => ${ref}::date, p_dados => ${JSON.stringify(dados)}::jsonb)`.execute(
    tx,
  );
}

export async function fechar(tx: Tx, ref: string) {
  await sql`select operacoes.limpeza_fechar(p_ref => ${ref}::date)`.execute(tx);
}

export async function reabrir(tx: Tx, ref: string, motivo: string) {
  await sql`select operacoes.limpeza_reabrir(p_ref => ${ref}::date, p_motivo => ${motivo})`.execute(
    tx,
  );
}

export async function enviar(tx: Tx, ref: string) {
  await sql`select operacoes.limpeza_enviar(p_ref => ${ref}::date)`.execute(tx);
}

export function inserirAnexos(
  tx: Tx,
  linhas: { referencia: string; nome: string; caminho: string; tipo: string }[],
) {
  return tx.insertInto("operacoes.limpeza_anexos").values(linhas).execute();
}

export function removerAnexo(tx: Tx, id: string) {
  return tx
    .deleteFrom("operacoes.limpeza_anexos")
    .where("id", "=", id)
    .returning("caminho")
    .execute();
}

export function anexo(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.limpeza_anexos")
    .select(["caminho", "nome"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** operacoes.limpeza_gravar_previa: os meses lidos na importação em prévia. */
export async function gravarPrevia(tx: Tx, importacao: string, meses: unknown) {
  await sql`select operacoes.limpeza_gravar_previa(p_importacao => ${importacao}, p_meses => ${JSON.stringify(meses)}::jsonb)`.execute(
    tx,
  );
}

/** A prévia do histórico que a pessoa deixou aberta. */
export function previaAberta(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["id", "resumo", "avisos", "bate", "arquivos", "status"])
    .where("tipo", "=", "limpeza")
    .where("status", "=", "previa")
    .where("criado_por", "=", usuarioId)
    .orderBy("criado_em", "desc")
    .limit(1)
    .executeTakeFirst();
}

export function statusDaImportacao(tx: Tx, id: string) {
  return tx
    .selectFrom("operacoes.importacoes")
    .select(["arquivos", "status"])
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Usuários ativos com a permissão (direta ou do cargo ativo). Service role. */
export async function usuariosComPermissao(tx: Tx, p: string) {
  const r = await tx
    .selectFrom("core.usuarios as u")
    .select("u.id")
    .where("u.ativo", "=", true)
    .where((eb) =>
      eb.or([
        eb.exists(
          eb
            .selectFrom("core.usuario_permissoes as up")
            .select("up.usuario_id")
            .whereRef("up.usuario_id", "=", "u.id")
            .where("up.permissao", "=", p),
        ),
        eb.exists(
          eb
            .selectFrom("core.cargo_permissoes as cp")
            .innerJoin("core.cargos as c", "c.id", "cp.cargo_id")
            .select("cp.cargo_id")
            .whereRef("cp.cargo_id", "=", "u.cargo_id")
            .where("cp.permissao", "=", p)
            .where("c.ativo", "=", true),
        ),
      ]),
    )
    .execute();
  return r.map((u) => u.id);
}
