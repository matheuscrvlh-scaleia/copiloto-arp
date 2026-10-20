"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { PERMISSOES, type Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import { pode, usuarioAtual } from "@/server/auth";

// Usuários e cargos. Perfil, cargo e permissões passam pelo RLS
// (admin.usuarios) e caem em core.auditoria; o que fica no Auth (criar,
// senha, bloqueio) usa a service role depois de conferir a permissão.

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

/** Deixa as permissões individuais do usuário iguais a `novas`. */
async function sincronizarPermissoes(
  usuarioId: string,
  novas: string[],
): Promise<EstadoAcao | null> {
  const supabase = await createClient();
  const eu = await usuarioAtual();
  const tabela = supabase.schema("core").from("usuario_permissoes");
  const atual = await tabela.select("permissao").eq("usuario_id", usuarioId);
  if (atual.error) return erroDoBanco(atual.error);
  const tem = new Set(atual.data.map((p) => p.permissao));
  const querer = new Set(novas);
  // Concede antes de revogar: a trava do último administrador olha o resultado.
  const conceder = [...querer].filter((p) => !tem.has(p));
  const revogar = [...tem].filter((p) => !querer.has(p));
  if (conceder.length) {
    const { error } = await supabase
      .schema("core")
      .from("usuario_permissoes")
      .insert(
        conceder.map((permissao) => ({
          usuario_id: usuarioId,
          permissao,
          concedida_por: eu.id,
        })),
      );
    if (error) return erroDoBanco(error);
  }
  if (revogar.length) {
    const { error } = await supabase
      .schema("core")
      .from("usuario_permissoes")
      .delete()
      .eq("usuario_id", usuarioId)
      .in("permissao", revogar);
    if (error) return erroDoBanco(error);
  }
  return null;
}

// ---------------------------------------------------------------------------

const novoUsuario = z.object({
  nome: z.string().trim().min(2, "informe o nome"),
  email: z.email("e-mail inválido").trim().toLowerCase(),
  senha,
  cargo_id: cargoId,
  permissoes,
});

export async function criarUsuario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = novoUsuario.safeParse({
    ...Object.fromEntries(form),
    permissoes: valores(form, "permissoes"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS);

  const auth = createAdminClient().auth.admin;
  const criado = await auth.createUser({
    email: d.data.email,
    password: d.data.senha,
    email_confirm: true,
    user_metadata: { nome: d.data.nome },
  });
  if (criado.error) return erroDoAuth(criado.error);
  const id = criado.data.user.id;

  // O perfil nasce pelo trigger; cargo e permissões entram com a sessão de
  // quem criou (auditoria). Se falhar, desfaz o usuário do Auth.
  const { error } = await (await createClient())
    .schema("core")
    .from("usuarios")
    .update({ nome: d.data.nome, cargo_id: d.data.cargo_id })
    .eq("id", id);
  const falha = error
    ? erroDoBanco(error)
    : await sincronizarPermissoes(id, d.data.permissoes);
  if (falha) {
    await auth.deleteUser(id);
    return falha;
  }
  redirect(`/admin/usuarios/${id}?criado=1`);
}

// ---------------------------------------------------------------------------

const edicao = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(2, "informe o nome"),
  cargo_id: cargoId,
  ativo: z.preprocess((v) => v === "on", z.boolean()),
  permissoes,
});

export async function salvarUsuario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("admin.usuarios"))) return SEM_PERMISSAO;
  const d = edicao.safeParse({
    ...Object.fromEntries(form),
    permissoes: valores(form, "permissoes"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const eu = await usuarioAtual();
  if (d.data.id === eu.id && !d.data.ativo)
    return { erro: "Você não pode desativar o seu próprio acesso." };

  const supabase = await createClient();
  const antes = await supabase
    .schema("core")
    .from("usuarios")
    .select("ativo")
    .eq("id", d.data.id)
    .maybeSingle();
  if (antes.error) return erroDoBanco(antes.error);
  if (!antes.data) return { erro: "Usuário não encontrado." };

  // Permissões antes do cargo/situação: quem ganha algo não fica sem nada
  // no meio do caminho.
  const falha = await sincronizarPermissoes(d.data.id, d.data.permissoes);
  if (falha) return falha;
  const { error } = await supabase
    .schema("core")
    .from("usuarios")
    .update({
      nome: d.data.nome,
      cargo_id: d.data.cargo_id,
      ativo: d.data.ativo,
    })
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);

  if (antes.data.ativo !== d.data.ativo) {
    const r = await createAdminClient().auth.admin.updateUserById(d.data.id, {
      ban_duration: d.data.ativo ? "none" : BLOQUEIO,
    });
    if (r.error) return erroDoAuth(r.error);
  }
  refresh();
  return {
    ok:
      antes.data.ativo === d.data.ativo
        ? "Salvo."
        : d.data.ativo
          ? "Salvo. O acesso foi reativado."
          : "Salvo. O acesso foi bloqueado.",
  };
}

// ---------------------------------------------------------------------------

const novaSenha = z
  .object({ id: z.uuid(), senha, confirmacao: z.string() })
  .refine((v) => v.senha === v.confirmacao, {
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
  const { error } = await createAdminClient().auth.admin.updateUserById(
    d.data.id,
    { password: d.data.senha },
  );
  if (error) return erroDoAuth(error);
  return { ok: "Senha trocada. Passe a nova senha ao usuário." };
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
