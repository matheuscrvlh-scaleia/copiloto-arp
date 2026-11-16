import { sql } from "kysely";
import type { Tx } from "@/infra/banco";

// Consultas do acesso. Tudo aqui roda em `banco.comoServico`: auth.users e
// auth.sessoes só existem para a service role, e no login ainda não há
// usuário. Só consultas: a regra fica no service.

export type MotivoDoFim = "saiu" | "expirou" | "reuso" | "senha" | "bloqueado";

/** Quem tem este e-mail (sem diferenciar maiúsculas), com o hash da senha. */
export function usuarioPorEmail(tx: Tx, email: string) {
  return tx
    .selectFrom("auth.users as a")
    .innerJoin("core.usuarios as u", "u.id", "a.id")
    .select([
      "a.id",
      "a.encrypted_password as hash",
      "u.ativo",
      sql<boolean>`coalesce(a.banned_until > now(), false)`.as("bloqueado"),
    ])
    .where(sql`lower(a.email)`, "=", email.toLowerCase())
    .executeTakeFirst();
}

export function hashDaSenha(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("auth.users")
    .select("encrypted_password as hash")
    .where("id", "=", usuarioId)
    .executeTakeFirst();
}

/**
 * Erros de login recentes deste e-mail: os deste IP e o total. Conta os
 * eventos `login_falhou` de core.logs (índice parcial logs_login_falhou).
 */
export async function falhasRecentes(
  tx: Tx,
  email: string,
  ip: string,
  minutos: number,
): Promise<{ doIp: number; total: number }> {
  const r = await tx
    .selectFrom("core.logs")
    .select((eb) => [
      eb.fn.countAll<number>().as("total"),
      eb.fn
        .countAll<number>()
        .filterWhere(sql`detalhes ->> 'ip'`, "=", ip)
        .as("do_ip"),
    ])
    .where("evento", "=", "login_falhou")
    .where("em", ">", sql<string>`now() - make_interval(mins => ${minutos})`)
    .where(sql`lower(detalhes ->> 'email')`, "=", email.toLowerCase())
    .executeTakeFirstOrThrow();
  return { doIp: Number(r.do_ip), total: Number(r.total) };
}

export async function criarSessao(
  tx: Tx,
  s: {
    id: string;
    usuarioId: string;
    tokenHash: string;
    duracaoMs: number;
    ip: string;
    agente: string | null;
  },
) {
  await tx
    .updateTable("auth.users")
    .set({ last_sign_in_at: sql`now()` })
    .where("id", "=", s.usuarioId)
    .execute();
  return tx
    .insertInto("auth.sessoes")
    .values({
      id: s.id,
      usuario_id: s.usuarioId,
      token_hash: s.tokenHash,
      expira_em: sql`now() + make_interval(secs => ${s.duracaoMs / 1000})`,
      ip: s.ip,
      agente: s.agente,
    })
    .returning(["criada_em", "ultimo_uso"])
    .executeTakeFirstOrThrow();
}

export interface SessaoComUsuario {
  id: string;
  usuario_id: string;
  token_hash: string;
  token_anterior_hash: string | null;
  criada_em: string;
  ultimo_uso: string;
  renovada_em: string;
  revogada: boolean;
  nome: string;
  email: string;
  ativo: boolean;
  bloqueado: boolean;
  senha_provisoria: boolean;
  permissoes: string[];
}

/**
 * A sessão, a pessoa e as permissões dela agora, numa consulta só (roda a
 * cada requisição). As permissões seguem a MESMA regra de
 * core.minhas_permissoes(): as individuais mais as do cargo, se o cargo
 * estiver ativo; nada para usuário desativado. `travar`: segura a linha da
 * sessão até o fim da transação (renovação: duas ao mesmo tempo entram em
 * fila).
 */
export async function sessaoComUsuario(
  tx: Tx,
  sessaoId: string,
  opcoes: { travar?: boolean } = {},
): Promise<SessaoComUsuario | undefined> {
  const r = await sql<SessaoComUsuario>`
    select
      s.id, s.usuario_id, s.token_hash, s.token_anterior_hash,
      s.criada_em, s.ultimo_uso, s.renovada_em,
      s.revogada_em is not null as revogada,
      u.nome, u.email, u.ativo,
      coalesce(a.banned_until > now(), false) as bloqueado,
      coalesce((a.raw_app_meta_data ->> 'senha_provisoria')::boolean, false)
        as senha_provisoria,
      array(
        select up.permissao
        from core.usuario_permissoes up
        where up.usuario_id = u.id and u.ativo
        union
        select cp.permissao
        from core.cargo_permissoes cp
        join core.cargos c on c.id = cp.cargo_id and c.ativo
        where cp.cargo_id = u.cargo_id and u.ativo
      ) as permissoes
    from auth.sessoes s
    join auth.users a on a.id = s.usuario_id
    join core.usuarios u on u.id = s.usuario_id
    where s.id = ${sessaoId}
    ${opcoes.travar ? sql`for update of s` : sql``}
  `.execute(tx);
  return r.rows[0];
}

/** Troca o token de renovação; o que valia até agora vira o "anterior". */
export async function trocarToken(
  tx: Tx,
  sessaoId: string,
  novoHash: string,
): Promise<void> {
  await tx
    .updateTable("auth.sessoes")
    .set((eb) => ({
      token_anterior_hash: eb.ref("token_hash"),
      token_hash: novoHash,
      renovada_em: sql`now()`,
    }))
    .where("id", "=", sessaoId)
    .execute();
}

export async function marcarUso(tx: Tx, sessaoId: string): Promise<string> {
  const r = await tx
    .updateTable("auth.sessoes")
    .set({ ultimo_uso: sql`now()` })
    .where("id", "=", sessaoId)
    .returning("ultimo_uso")
    .executeTakeFirstOrThrow();
  return r.ultimo_uso;
}

/** Encerra a sessão (se ainda estiver aberta). true se encerrou agora. */
export async function revogarSessao(
  tx: Tx,
  sessaoId: string,
  motivo: MotivoDoFim,
): Promise<boolean> {
  const r = await tx
    .updateTable("auth.sessoes")
    .set({ revogada_em: sql`now()`, motivo })
    .where("id", "=", sessaoId)
    .where("revogada_em", "is", null)
    .executeTakeFirst();
  return r.numUpdatedRows > 0n;
}

/** Encerra as outras sessões abertas da pessoa (troca de senha). */
export async function revogarOutrasSessoes(
  tx: Tx,
  usuarioId: string,
  menosEsta: string,
  motivo: MotivoDoFim,
): Promise<void> {
  await tx
    .updateTable("auth.sessoes")
    .set({ revogada_em: sql`now()`, motivo })
    .where("usuario_id", "=", usuarioId)
    .where("id", "<>", menosEsta)
    .where("revogada_em", "is", null)
    .execute();
}

/**
 * Grava o hash da senha. `provisoria` também marca (ou desmarca) a senha
 * provisória em raw_app_meta_data; sem ele, a marca fica como está.
 */
export async function gravarSenha(
  tx: Tx,
  usuarioId: string,
  hash: string,
  provisoria?: boolean,
): Promise<void> {
  await tx
    .updateTable("auth.users")
    .set({
      encrypted_password: hash,
      updated_at: sql`now()`,
      ...(provisoria === undefined
        ? {}
        : {
            raw_app_meta_data: sql`raw_app_meta_data || jsonb_build_object('senha_provisoria', ${provisoria}::boolean)`,
          }),
    })
    .where("id", "=", usuarioId)
    .execute();
}
