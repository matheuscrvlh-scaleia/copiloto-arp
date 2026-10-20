import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { PERMISSOES, type Permissao } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

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
 */
export const usuarioAtual = cache(async (): Promise<Usuario> => {
  // A validação do token compara a expiração com a hora atual: tem que
  // rodar na requisição, nunca numa pré-renderização.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");

  const core = supabase.schema("core");
  const [perfil, permissoes] = await Promise.all([
    core
      .from("usuarios")
      .select("nome, email, ativo")
      .eq("id", id)
      .maybeSingle(),
    // Cargo + individuais; vazio para usuário desativado (o RLS faz o mesmo).
    core.rpc("minhas_permissoes"),
  ]);
  if (perfil.error) throw perfil.error;
  if (permissoes.error) throw permissoes.error;
  if (!perfil.data) redirect("/login");

  return {
    id,
    nome: perfil.data.nome,
    email: perfil.data.email,
    ativo: perfil.data.ativo,
    permissoes: perfil.data.ativo
      ? (permissoes.data ?? []).filter((p): p is Permissao => p in PERMISSOES)
      : [],
  };
});

export async function pode(permissao: Permissao): Promise<boolean> {
  const usuario = await usuarioAtual();
  return usuario.permissoes.includes(permissao);
}
