import { SENHA_PROVISORIA } from "@arp/shared/senha-provisoria";
import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas de usuários e cargos. Perfil, cargo e permissões (schema core)
// rodam em `banco.comoUsuario`: o RLS confere admin.usuarios, a auditoria
// registra quem mexeu e o banco trava o último administrador. O que fica em
// auth.users e auth.sessoes só existe para a service role.

/** Bloqueio do login de quem foi inativado (o RLS já corta os dados). */
const BLOQUEIO_HORAS = 876_000;

const PERFIL = [
  "id",
  "nome",
  "email",
  "ativo",
  "cargo_id",
  "criado_em",
] as const;

export function perfis(tx: Tx) {
  return tx
    .selectFrom("core.usuarios")
    .select(PERFIL)
    .orderBy("nome")
    .execute();
}

export function perfil(tx: Tx, id: string) {
  return tx
    .selectFrom("core.usuarios")
    .select(PERFIL)
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Permissões individuais (fora as do cargo), de todos ou de uma pessoa. */
export function permissoesIndividuais(tx: Tx, usuarioId?: string) {
  const consulta = tx
    .selectFrom("core.usuario_permissoes")
    .select(["usuario_id", "permissao"]);
  return (
    usuarioId ? consulta.where("usuario_id", "=", usuarioId) : consulta
  ).execute();
}

/** Data do último login (fica em auth.users), de todos ou de uma pessoa. */
export function ultimosAcessos(tx: Tx, usuarioId?: string) {
  const consulta = tx
    .selectFrom("auth.users")
    .select(["id", "last_sign_in_at"]);
  return (
    usuarioId ? consulta.where("id", "=", usuarioId) : consulta
  ).execute();
}

/**
 * Cria o login com a senha provisória. O gatilho `criar_usuario` cria o
 * perfil em core.usuarios (o nome vai em raw_user_meta_data).
 */
export async function criarLogin(
  tx: Tx,
  u: { email: string; hash: string; nome: string },
): Promise<string> {
  const r = await tx
    .insertInto("auth.users")
    .values({
      email: u.email,
      encrypted_password: u.hash,
      raw_user_meta_data: JSON.stringify({ nome: u.nome }),
      raw_app_meta_data: JSON.stringify({ [SENHA_PROVISORIA]: true }),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Tira o login (e, em cascata, o perfil e as sessões). */
export async function excluirLogin(tx: Tx, id: string): Promise<void> {
  await tx.deleteFrom("auth.users").where("id", "=", id).execute();
}

/** Bloqueia ou libera o login. */
export async function bloquearLogin(
  tx: Tx,
  id: string,
  bloquear: boolean,
): Promise<void> {
  await tx
    .updateTable("auth.users")
    .set({
      banned_until: bloquear
        ? sql`now() + make_interval(hours => ${BLOQUEIO_HORAS})`
        : null,
      updated_at: sql`now()`,
    })
    .where("id", "=", id)
    .execute();
}

/** Encerra todas as sessões abertas da pessoa. */
export async function encerrarSessoes(
  tx: Tx,
  usuarioId: string,
  motivo: "senha" | "bloqueado",
): Promise<void> {
  await tx
    .updateTable("auth.sessoes")
    .set({ revogada_em: sql`now()`, motivo })
    .where("usuario_id", "=", usuarioId)
    .where("revogada_em", "is", null)
    .execute();
}

/** true se a pessoa existe (e o RLS deixou alterar). */
export async function atualizarPerfil(
  tx: Tx,
  id: string,
  dados: { nome?: string; cargo_id?: string | null; ativo?: boolean },
): Promise<boolean> {
  const r = await tx
    .updateTable("core.usuarios")
    .set(dados)
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

export async function excluirPerfil(tx: Tx, id: string): Promise<boolean> {
  const r = await tx
    .deleteFrom("core.usuarios")
    .where("id", "=", id)
    .executeTakeFirst();
  return r.numDeletedRows > 0n;
}

export async function removerIndividuais(
  tx: Tx,
  usuarioId: string,
): Promise<void> {
  await tx
    .deleteFrom("core.usuario_permissoes")
    .where("usuario_id", "=", usuarioId)
    .execute();
}

// ---------------------------------------------------------------------------
// Cargos
// ---------------------------------------------------------------------------

export function cargos(tx: Tx) {
  return tx
    .selectFrom("core.cargos")
    .select(["id", "nome", "descricao", "ativo"])
    .orderBy("nome")
    .execute();
}

/** As "Programa – lançar" de core.permissoes (o RLS deixa todo logado ler). */
export function permissoesDePrograma(tx: Tx, prefixo: string) {
  return tx
    .selectFrom("core.permissoes")
    .select(["codigo", "descricao"])
    .where("codigo", "like", `${prefixo}%`)
    .orderBy("descricao")
    .execute();
}

/** Dos códigos pedidos, os que existem em core.permissoes. */
export async function permissoesExistentes(
  tx: Tx,
  codigos: string[],
): Promise<string[]> {
  if (codigos.length === 0) return [];
  const r = await tx
    .selectFrom("core.permissoes")
    .select("codigo")
    .where("codigo", "in", codigos)
    .execute();
  return r.map((p) => p.codigo);
}

export function permissoesDosCargos(tx: Tx) {
  return tx
    .selectFrom("core.cargo_permissoes")
    .select(["cargo_id", "permissao"])
    .execute();
}

export function usuariosPorCargo(tx: Tx) {
  return tx
    .selectFrom("core.usuarios")
    .select((eb) => ["cargo_id", eb.fn.countAll<number>().as("usuarios")])
    .where("cargo_id", "is not", null)
    .groupBy("cargo_id")
    .execute();
}

export async function criarCargo(
  tx: Tx,
  c: { nome: string; descricao: string | null },
): Promise<string> {
  const r = await tx
    .insertInto("core.cargos")
    .values(c)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function atualizarCargo(
  tx: Tx,
  id: string,
  dados: { nome?: string; descricao?: string | null; ativo?: boolean },
): Promise<void> {
  await tx.updateTable("core.cargos").set(dados).where("id", "=", id).execute();
}

export async function permissoesDoCargo(
  tx: Tx,
  cargoId: string,
): Promise<string[]> {
  const r = await tx
    .selectFrom("core.cargo_permissoes")
    .select("permissao")
    .where("cargo_id", "=", cargoId)
    .execute();
  return r.map((p) => p.permissao);
}

export async function concederAoCargo(
  tx: Tx,
  cargoId: string,
  permissoes: string[],
): Promise<void> {
  if (permissoes.length === 0) return;
  await tx
    .insertInto("core.cargo_permissoes")
    .values(permissoes.map((permissao) => ({ cargo_id: cargoId, permissao })))
    .execute();
}

export async function revogarDoCargo(
  tx: Tx,
  cargoId: string,
  permissoes: string[],
): Promise<void> {
  if (permissoes.length === 0) return;
  await tx
    .deleteFrom("core.cargo_permissoes")
    .where("cargo_id", "=", cargoId)
    .where("permissao", "in", permissoes)
    .execute();
}

export async function excluirCargo(tx: Tx, id: string): Promise<void> {
  await tx.deleteFrom("core.cargos").where("id", "=", id).execute();
}
