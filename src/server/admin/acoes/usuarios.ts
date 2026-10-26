"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { PERMISSOES, type Permissao } from "@/lib/permissions";
import { SENHA_PROVISORIA } from "@/lib/senha-provisoria";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import { pode, podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { registrarDepois, registrarEvento } from "@/server/logs";

// Usuários e cargos. Perfil, cargo e permissões passam pelo RLS
// (admin.usuarios) e caem em core.auditoria; o que fica no Auth (criar,
// senha, bloqueio, exclusão) usa a service role depois de conferir a
// permissão direto no banco (podeAgora). O acesso do usuário vem do cargo;
// as permissões individuais antigas só podem ser removidas.
//
// Perfil e permissões ficam no cache de usuarioAtual() (e da lista de
// pessoas do Tickets): toda gravação aqui chama invalidarAcesso().

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

/**
 * Perfil, cargo ou permissões mudaram. Cargo atinge várias pessoas e a
 * lista de pessoas do Tickets depende de todos: invalida a tag geral e,
 * quando é uma pessoa só, também a dela.
 */
function invalidarAcesso(usuarioId?: string) {
  updateTag(TAG.permissoes);
  if (usuarioId) updateTag(TAG.usuario(usuarioId));
}

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
  if (!(await podeAgora("admin.usuarios"))) return SEM_PERMISSAO;
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
  invalidarAcesso(id);
  if (error) {
    await auth.deleteUser(id);
    return erroDoBanco(error);
  }
  registrarDepois({
    modulo: "admin",
    evento: "usuario_criado",
    descricao: `Criou o usuário ${d.data.nome} (${d.data.email})`,
    usuarioId: (await usuarioAtual()).id,
    detalhes: {
      usuario_id: id,
      email: d.data.email,
      cargo_id: d.data.cargo_id,
    },
  });
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
  invalidarAcesso(d.data.id);
  refresh();
  return { ok: "Salvo." };
}

/** Inativa (bloqueia o login; o histórico continua) ou reativa. */
export async function alternarUsuario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("admin.usuarios"))) return SEM_PERMISSAO;
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
  // Já mudou no banco: invalida antes do Auth, que pode falhar.
  invalidarAcesso(d.data.id);
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
  if (!(await podeAgora("admin.usuarios"))) return SEM_PERMISSAO;
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
  invalidarAcesso(id.data);
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
  invalidarAcesso(id.data);
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

/**
 * Nova senha pelo Auth. A marca de provisória fica no app_metadata (vem no
 * token, fora do cache de permissões): nada a invalidar.
 */
export async function trocarSenha(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("admin.usuarios"))) return SEM_PERMISSAO;
  const d = novaSenha.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const eu = (await usuarioAtual()).id;
  // A senha que o administrador conhece é provisória, menos a dele mesmo.
  const provisoria = d.data.id !== eu;
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
  const alvoId = d.data.id;
  // O nome de quem teve a senha trocada só serve ao registro: depois.
  after(async () => {
    const { data: alvo } = await (await createClient())
      .schema("core")
      .from("usuarios")
      .select("nome")
      .eq("id", alvoId)
      .maybeSingle();
    await registrarEvento({
      modulo: "admin",
      evento: "senha_trocada",
      descricao: provisoria
        ? `Definiu uma senha provisória para ${alvo?.nome ?? "um usuário"}`
        : "Trocou a própria senha",
      usuarioId: eu,
      detalhes: { usuario_id: alvoId, provisoria },
    });
  });
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
  // Várias gravações: invalida mesmo se uma do meio falhar.
  try {
    const r = await gravarCargo(d.data);
    if ("erro" in r) return r;
  } finally {
    invalidarAcesso();
  }

  if (!d.data.id) redirect("/admin/usuarios/cargos");
  refresh();
  return { ok: "Salvo. Vale para todos os usuários deste cargo." };
}

async function gravarCargo(
  c: z.infer<typeof cargo>,
): Promise<{ id: string } | { erro: string }> {
  const core = (await createClient()).schema("core");
  let id = c.id;
  if (id) {
    const { error } = await core
      .from("cargos")
      .update({ nome: c.nome, descricao: c.descricao })
      .eq("id", id);
    if (error) return semOk(erroDoBanco(error));
  } else {
    const { data, error } = await core
      .from("cargos")
      .insert({ nome: c.nome, descricao: c.descricao })
      .select("id")
      .single();
    if (error) return semOk(erroDoBanco(error));
    id = data.id;
  }

  const atual = await core
    .from("cargo_permissoes")
    .select("permissao")
    .eq("cargo_id", id);
  if (atual.error) return semOk(erroDoBanco(atual.error));
  const tem = new Set(atual.data.map((p) => p.permissao));
  const querer = new Set<string>(c.permissoes);
  const conceder = [...querer].filter((p) => !tem.has(p));
  const revogar = [...tem].filter((p) => !querer.has(p));
  if (conceder.length) {
    const { error } = await core
      .from("cargo_permissoes")
      .insert(conceder.map((permissao) => ({ cargo_id: id, permissao })));
    if (error) return semOk(erroDoBanco(error));
  }
  if (revogar.length) {
    const { error } = await core
      .from("cargo_permissoes")
      .delete()
      .eq("cargo_id", id)
      .in("permissao", revogar);
    if (error) return semOk(erroDoBanco(error));
  }
  return { id };
}

/** erroDoBanco sempre devolve a mensagem de erro. */
function semOk(e: EstadoAcao): { erro: string } {
  return { erro: e.erro ?? "Não foi possível salvar. Tente de novo." };
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
  invalidarAcesso();
  refresh();
  return { ok: d.data.ativo ? "Cargo reativado." : "Cargo inativado." };
}

/** Exclui o cargo; quem o tinha fica sem cargo (e sem as permissões dele). */
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
  invalidarAcesso();
  redirect("/admin/usuarios/cargos");
}
