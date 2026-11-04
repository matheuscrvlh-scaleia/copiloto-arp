import "server-only";

import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";

/**
 * Nome de cada pessoa (quem alterou, enviou, registrou). Primeiro pela
 * sessão; os que o RLS de core.usuarios esconde (quem não administra só vê a
 * si mesmo) vêm pela service role, só para ids que a pessoa já leu pelo RLS
 * e depois de conferir no banco `podeVer` (uma das permissões, ou a regra
 * dada).
 */
export async function nomesDeUsuarios(
  ids: (string | null | undefined)[],
  podeVer: Permissao[] | (() => Promise<boolean>),
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const nomes = new Map<string, string>();
  if (!unicos.length) return nomes;
  const sessao = await (await createClient())
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", unicos);
  if (sessao.error) console.error("nomes de usuários (sessão)", sessao.error);
  for (const u of sessao.data ?? []) nomes.set(u.id, u.nome);
  const faltam = unicos.filter((i) => !nomes.has(i));
  if (!faltam.length || !(await liberado(podeVer))) return nomes;
  const admin = await createAdminClient()
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", faltam);
  if (admin.error) console.error("nomes de usuários", admin.error);
  for (const u of admin.data ?? []) nomes.set(u.id, u.nome);
  return nomes;
}

/**
 * Usuários ativos com a permissão (individual ou do cargo ativo), a mesma
 * regra de core.pode, que só responde pelo usuário logado. Service role:
 * só para rotinas do servidor (lembretes do cron), nunca para a tela.
 */
export async function usuariosComPermissao(p: Permissao): Promise<string[]> {
  const core = createAdminClient().schema("core");
  const [usuarios, individuais, doCargo] = await Promise.all([
    core.from("usuarios").select("id, cargo_id").eq("ativo", true),
    core.from("usuario_permissoes").select("usuario_id").eq("permissao", p),
    core
      .from("cargo_permissoes")
      .select("cargo_id, cargos!inner(ativo)")
      .eq("permissao", p)
      .eq("cargos.ativo", true),
  ]);
  for (const r of [usuarios, individuais, doCargo])
    if (r.error) throw new Error(`Permissões: ${r.error.message}`);
  const sim = new Set((individuais.data ?? []).map((x) => x.usuario_id));
  const cargos = new Set((doCargo.data ?? []).map((x) => x.cargo_id));
  return (usuarios.data ?? [])
    .filter(
      (u) => sim.has(u.id) || (u.cargo_id !== null && cargos.has(u.cargo_id)),
    )
    .map((u) => u.id);
}

async function liberado(
  podeVer: Permissao[] | (() => Promise<boolean>),
): Promise<boolean> {
  if (typeof podeVer === "function") return podeVer();
  for (const p of podeVer) if (await podeAgora(p)) return true;
  return false;
}
