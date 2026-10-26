import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { PERMISSOES, type Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { TAG } from "./cache";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  permissoes: Permissao[];
}

/**
 * Usuário logado e suas permissões, uma vez por renderização.
 * Sem sessão, vai para /login. Lê cookies: use dentro de <Suspense>.
 *
 * O token é validado a cada requisição; o perfil e as permissões vêm do
 * cache (tag "permissoes" e "usuario:<id>", que as telas de usuários e
 * cargos invalidam). O RLS continua conferindo tudo no banco.
 */
export const usuarioAtual = cache(async (): Promise<Usuario> => {
  // A validação do token compara a expiração com a hora atual: tem que
  // rodar na requisição, nunca numa pré-renderização.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");

  const usuario = await usuarioPorId(id);
  if (!usuario) redirect("/login");
  return usuario;
});

// Não exportar: o id só pode vir do token validado acima.
async function usuarioPorId(id: string): Promise<Usuario | null> {
  "use cache";
  cacheLife("sessao");
  cacheTag(TAG.permissoes, TAG.usuario(id));

  // Mesma regra de core.minhas_permissoes(): individuais + as do cargo,
  // se o cargo estiver ativo; nada para usuário desativado.
  const core = createAdminClient().schema("core");
  const perfil = await core
    .from("usuarios")
    .select("nome, email, ativo, cargo_id")
    .eq("id", id)
    .maybeSingle();
  if (perfil.error) throw perfil.error;
  if (!perfil.data) return null;
  const { nome, email, ativo, cargo_id } = perfil.data;
  if (!ativo) return { id, nome, email, ativo, permissoes: [] };

  const [individuais, doCargo] = await Promise.all([
    core.from("usuario_permissoes").select("permissao").eq("usuario_id", id),
    cargo_id
      ? core
          .from("cargo_permissoes")
          .select("permissao, cargos!inner(ativo)")
          .eq("cargo_id", cargo_id)
          .eq("cargos.ativo", true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (individuais.error) throw individuais.error;
  if (doCargo.error) throw doCargo.error;

  const todas = new Set(
    [...(individuais.data ?? []), ...(doCargo.data ?? [])].map(
      (p) => p.permissao,
    ),
  );
  return {
    id,
    nome,
    email,
    ativo,
    permissoes: [...todas].filter((p): p is Permissao => p in PERMISSOES),
  };
}

/** Permissão de quem está logado (do cache da sessão). Para telas. */
export async function pode(permissao: Permissao): Promise<boolean> {
  const usuario = await usuarioAtual();
  return usuario.permissoes.includes(permissao);
}

/**
 * Permissão conferida agora no banco, sem cache. Use em Server Actions e
 * Route Handlers antes de gravar ou ler com a service role (que ignora o
 * RLS): quem acabou de perder o acesso não passa nem por um minuto.
 */
export async function podeAgora(permissao: Permissao): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return false;
  const { data: ok, error } = await supabase
    .schema("core")
    .rpc("pode", { p: permissao });
  if (error) throw error;
  return ok === true;
}
