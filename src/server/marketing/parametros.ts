import "server-only";
import { cache } from "react";
import { type LinhaAuditoria, TABELAS_MKT } from "@/lib/marketing/parametros";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";

// Leituras extras de Configurações do Marketing: o histórico das alterações
// (core.auditoria, com a sessão: o RLS mostra marketing.* e core.metas a
// quem tem marketing.parametros) e o nome de quem alterou.

export interface AlteracaoMkt extends LinhaAuditoria {
  /** Nome de quem alterou (core.usuarios). */
  autor: string;
}

/** Quantas alterações a aba Histórico mostra. */
export const LIMITE_HISTORICO = 100;

const TABELAS = Object.keys(TABELAS_MKT).filter((t) =>
  t.startsWith("marketing."),
);

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

/**
 * Alterações das Configurações do Marketing, da mais nova para a mais antiga:
 * os cadastros marketing.* (a marca tem histórico próprio) e as metas
 * marketing.* de core.metas.
 */
export const historicoMkt = cache(
  async (limite = LIMITE_HISTORICO): Promise<AlteracaoMkt[]> => {
    const core = (await createClient()).schema("core");
    const colunas =
      "id, tabela, registro_id, acao, antes, depois, usuario_id, em";
    const [cadastros, metas] = await Promise.all([
      core
        .from("auditoria")
        .select(colunas)
        .in("tabela", TABELAS)
        .order("em", { ascending: false })
        .order("id", { ascending: false })
        .limit(limite),
      core
        .from("auditoria")
        .select(colunas)
        .eq("tabela", "core.metas")
        .or(
          "depois->>indicador.like.marketing.*,antes->>indicador.like.marketing.*",
        )
        .order("em", { ascending: false })
        .order("id", { ascending: false })
        .limit(limite),
    ]);
    if (cadastros.error)
      throw new Error(`Falha ao ler o histórico: ${cadastros.error.message}`);
    if (metas.error)
      throw new Error(`Falha ao ler o histórico: ${metas.error.message}`);
    const linhas = [...(cadastros.data ?? []), ...(metas.data ?? [])]
      .sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id)
      .slice(0, limite);
    const nomes = await nomesDeQuemAlterou(
      linhas.map((l) => l.usuario_id).filter((id): id is string => !!id),
    );
    return linhas.map((l) => ({
      ...l,
      antes: objeto(l.antes),
      depois: objeto(l.depois),
      autor: l.usuario_id
        ? (nomes.get(l.usuario_id) ?? "Usuário removido")
        : "Sistema (carga inicial)",
    }));
  },
);

/**
 * Nomes de quem alterou. O RLS de core.usuarios só mostra o próprio nome a
 * quem não é administrador: lê pela service role, só os nomes dos ids do
 * histórico, depois de conferir marketing.parametros no banco.
 */
async function nomesDeQuemAlterou(ids: string[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids)];
  const nomes = new Map<string, string>();
  if (!unicos.length || !(await podeAgora("marketing.parametros")))
    return nomes;
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", unicos);
  if (error) console.error("nomes do histórico do marketing", error);
  for (const u of data ?? []) nomes.set(u.id, u.nome);
  return nomes;
}

/** Uma alteração (para o "Voltar"), lida com a sessão (RLS). */
export async function alteracaoMkt(id: number): Promise<LinhaAuditoria | null> {
  const { data, error } = await (await createClient())
    .schema("core")
    .from("auditoria")
    .select("id, tabela, registro_id, acao, antes, depois, usuario_id, em")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o histórico: ${error.message}`);
  if (!data) return null;
  return { ...data, antes: objeto(data.antes), depois: objeto(data.depois) };
}
