"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { PERMISSOES, type Permissao } from "@/lib/permissions";
import { SENHA_PROVISORIA } from "@/lib/senha-provisoria";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import { pode, usuarioAtual } from "@/server/auth";

// Usuários e cargos. Perfil, cargo e permissões passam pelo RLS
// (admin.usuarios) e caem em core.auditoria; o que fica no Auth (criar,
// senha, bloqueio, exclusão) usa a service role depois de conferir a
// permissão. O acesso do usuário vem do cargo; as permissões individuais
// antigas só podem ser removidas.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para gerenciar usuários.",
};

const ROTULOS = {
  nome: "Nome",
  email: "E-mail",
  senha: "Senha",
  confirmacao: "Confirmação",
  cargo_id: "Cargo",
  descricao: "Descrição",
};

const permissoes = z.array(
  z.string().refine((p): p is Permissao => p in PERMISSOES, "desconhecida"),
);
const cargoId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.uuid().nullable(),
);
const senha = z
  .string()
  .min(10, "mínimo de 10 caracteres")
  .max(72, "máximo de 72 caracteres");
const alternancia = z.object({
  id: z.uuid(),
  ativo: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Bloqueio no Auth: desativado não entra mais (o RLS já corta os dados). */
const BLOQUEIO = "876000h";

function erroDoAuth(error: { code?: string; message: string }): EstadoAcao {
  if (
    error.code === "email_exists" ||
    /already been registered/i.test(error.message)
  )
    return { erro: "Já existe um usuário com esse e-mail." };
  if (error.code === "weak_password")
    return { erro: "Senha fraca: use letras, números e símbolos." };
  return { erro: "O Auth recusou a operação. Tente de novo." };
}

// ---------------------------------------------------------------------------

const novoUsuario = z.object({
  nome: z.string().trim().min(2, "informe o nome"),
  email: z.email("e-mail inválido").trim().toLowerCase(),
  senha,
  cargo_id: cargoId,
});

export async function criarUsuario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = novoUsuario.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);

  const auth = createAdminClient().auth.admin;
  const criado = await auth.createUser({
    email: d.data.email,
    password: d.data.senha,
    email_confirm: true,
    user_metadata: { nome: d.data.nome },
    app_metadata: { [SENHA_PROVISORIA]: true },
  });
  if (criado.error) return erroDoAuth(criado.error);
  const id = criado.data.user.id;

  // O perfil nasce pelo trigger; o cargo entra com a sessão de quem criou
  // (auditoria). Se falhar, desfaz o usuário do Auth.
  const { error } = await (await createClient())
    .schema("core")
    .from("usuarios")
    .update({ nome: d.data.nome, cargo_id: d.data.cargo_id })
    .eq("id", id);
  if (error) {
    await auth.deleteUser(id);
    return erroDoBanco(error);
  }
  redirect(`/admin/usuarios/${id}?criado=1`);
}

// ---------------------------------------------------------------------------

const edicao = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(2, "informe o nome"),
  cargo_id: cargoId,
});

export async function salvarUsuario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = edicao.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { error } = await (await createClient())
    .schema("core")
    .from("usuarios")
    .update({ nome: d.data.nome, cargo_id: d.data.cargo_id })
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Salvo." };
}

/** Inativa (bloqueia o login; o histórico continua) ou reativa. */
export async function alternarUsuario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = alternancia.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Usuário inválido." };
  if (d.data.id === (await usuarioAtual()).id && !d.data.ativo)
    return { erro: "Você não pode inativar o seu próprio acesso." };

  const { error } = await (await createClient())
    .schema("core")
    .from("usuarios")
    .update({ ativo: d.data.ativo })
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  const r = await createAdminClient().auth.admin.updateUserById(d.data.id, {
    ban_duration: d.data.ativo ? "none" : BLOQUEIO,
  });
  if (r.error) return erroDoAuth(r.error);
  refresh();
  return { ok: d.data.ativo ? "Acesso reativado." : "Usuário inativado." };
}

/**
 * Exclui de vez. O perfil sai com a sessão de quem excluiu (auditoria e
 * trava do último administrador); depois sai do Auth. O que a pessoa fez
 * continua no histórico, sem o nome.
 */
export async function excluirUsuario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  if (id.data === (await usuarioAtual()).id)
    return { erro: "Você não pode excluir a si mesmo." };

  const { data, error } = await (await createClient())
    .schema("core")
    .from("usuarios")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data.length) return { erro: "Usuário não encontrado." };
  const r = await createAdminClient().auth.admin.deleteUser(id.data);
  if (r.error) return erroDoAuth(r.error);
  redirect("/admin/usuarios");
}

/** Tira as permissões dadas direto à pessoa; fica só o que vem do cargo. */
export async function removerIndividuais(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Usuário inválido." };
  const { error } = await (await createClient())
    .schema("core")
    .from("usuario_permissoes")
    .delete()
    .eq("usuario_id", id.data);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Removidas. O acesso agora vem só do cargo." };
}

// ---------------------------------------------------------------------------

// Confirmação só para a própria senha; a provisória fica à vista na tela.
const novaSenha = z
  .object({ id: z.uuid(), senha, confirmacao: z.string().optional() })
  .refine((v) => v.confirmacao === undefined || v.senha === v.confirmacao, {
    path: ["confirmacao"],
    message: "as senhas não conferem",
  });

export async function trocarSenha(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = novaSenha.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  // A senha que o administrador conhece é provisória, menos a dele mesmo.
  const provisoria = d.data.id !== (await usuarioAtual()).id;
  if (!provisoria && d.data.confirmacao === undefined)
    return { erro: "Confirmação: repita a nova senha." };
  const { error } = await createAdminClient().auth.admin.updateUserById(
    d.data.id,
    {
      password: d.data.senha,
      app_metadata: { [SENHA_PROVISORIA]: provisoria },
    },
  );
  if (error) return erroDoAuth(error);
  return {
    ok: provisoria
      ? "Senha trocada. Passe a senha à pessoa; no próximo acesso ela define uma nova."
      : "Senha trocada.",
  };
}

// ---------------------------------------------------------------------------

const cargo = z.object({
  id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
  nome: z.string().trim().min(2, "informe o nome"),
  descricao: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(200, "máximo de 200 caracteres").nullable(),
  ),
  permissoes,
});

export async function salvarCargo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = cargo.safeParse({
    ...Object.fromEntries(form),
    permissoes: valores(form, "permissoes"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const core = (await createClient()).schema("core");

  let id = d.data.id;
  if (id) {
    const { error } = await core
      .from("cargos")
      .update({ nome: d.data.nome, descricao: d.data.descricao })
      .eq("id", id);
    if (error) return erroDoBanco(error);
  } else {
    const { data, error } = await core
      .from("cargos")
      .insert({ nome: d.data.nome, descricao: d.data.descricao })
      .select("id")
      .single();
    if (error) return erroDoBanco(error);
    id = data.id;
  }

  const atual = await core
    .from("cargo_permissoes")
    .select("permissao")
    .eq("cargo_id", id);
  if (atual.error) return erroDoBanco(atual.error);
  const tem = new Set(atual.data.map((p) => p.permissao));
  const querer = new Set<string>(d.data.permissoes);
  const conceder = [...querer].filter((p) => !tem.has(p));
  const revogar = [...tem].filter((p) => !querer.has(p));
  if (conceder.length) {
    const { error } = await core
      .from("cargo_permissoes")
      .insert(conceder.map((permissao) => ({ cargo_id: id, permissao })));
    if (error) return erroDoBanco(error);
  }
  if (revogar.length) {
    const { error } = await core
      .from("cargo_permissoes")
      .delete()
      .eq("cargo_id", id)
      .in("permissao", revogar);
    if (error) return erroDoBanco(error);
  }

  if (!d.data.id) redirect("/admin/usuarios/cargos");
  refresh();
  return { ok: "Salvo. Vale para todos os usuários deste cargo." };
}

/** Inativo: some da escolha e para de dar permissão a quem já o tem. */
export async function alternarCargo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = alternancia.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Cargo inválido." };
  const { error } = await (await createClient())
    .schema("core")
    .from("cargos")
    .update({ ativo: d.data.ativo })
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: d.data.ativo ? "Cargo reativado." : "Cargo inativado." };
}

export async function apagarCargo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Cargo inválido." };
  const { error } = await (await createClient())
    .schema("core")
    .from("cargos")
    .delete()
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  redirect("/admin/usuarios/cargos");
}
