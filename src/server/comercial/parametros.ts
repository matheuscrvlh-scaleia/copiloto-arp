import "server-only";
import { after } from "next/server";
import { cache } from "react";
import {
  type GrupoHistorico,
  type LinhaAuditoria,
  TABELAS_COM,
} from "@/lib/comercial/parametros";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";
import { nomesDeUsuarios } from "@/server/comercial/importacoes";

// Leituras extras de Comercial › Configurações: feriados cadastrados
// (os.feriados, o mesmo do Tickets) e o histórico das alterações
// (core.auditoria com a sessão: o RLS mostra comercial.* a quem tem
// comercial.parametros.editar e as metas a quem tem comercial.painel.metas).

export interface AlteracaoCom extends LinhaAuditoria {
  autor: string;
}

export const LIMITE_HISTORICO = 100;

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

const COLUNAS = "id, tabela, registro_id, acao, antes, depois, usuario_id, em";

/** Alterações do grupo, da mais nova para a mais antiga. */
export const historicoCom = cache(
  async (
    grupo: GrupoHistorico | null = null,
    limite = LIMITE_HISTORICO,
  ): Promise<AlteracaoCom[]> => {
    const core = (await createClient()).schema("core");
    const tabelas = Object.keys(TABELAS_COM).filter(
      (t) => t !== "core.metas" && (!grupo || TABELAS_COM[t]?.grupo === grupo),
    );
    const consultas = [
      core
        .from("auditoria")
        .select(COLUNAS)
        .in("tabela", tabelas)
        .order("em", { ascending: false })
        .order("id", { ascending: false })
        .limit(limite),
    ];
    if (!grupo || grupo === "parametros")
      consultas.push(
        core
          .from("auditoria")
          .select(COLUNAS)
          .eq("tabela", "core.metas")
          .or(
            "depois->>indicador.like.comercial.*,antes->>indicador.like.comercial.*",
          )
          .order("em", { ascending: false })
          .order("id", { ascending: false })
          .limit(limite),
      );
    const resultados = await Promise.all(consultas);
    for (const r of resultados)
      if (r.error)
        throw new Error(`Falha ao ler o histórico: ${r.error.message}`);
    const linhas = resultados
      .flatMap((r) => r.data ?? [])
      .sort((a, b) => b.em.localeCompare(a.em) || b.id - a.id)
      .slice(0, limite);
    const pode =
      (await podeAgora("comercial.parametros.editar")) ||
      (await podeAgora("comercial.painel.metas"));
    const nomes = pode
      ? await nomesDeUsuarios(
          linhas.map((l) => l.usuario_id).filter((id): id is string => !!id),
        )
      : new Map<string, string>();
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

/** Feriados cadastrados (os.feriados), por data. */
export async function feriadosCadastrados(): Promise<
  { data: string; nome: string }[]
> {
  const { data, error } = await (await createClient())
    .schema("os")
    .from("feriados")
    .select("data, nome")
    .order("data");
  if (error) throw new Error(`Falha ao ler os feriados: ${error.message}`);
  return data ?? [];
}

/** Registro no log do servidor depois de responder (não atrasa a ação). */
export function logComercial(
  evento: string,
  usuarioId: string | null,
  detalhes: Record<string, unknown> = {},
): void {
  after(() =>
    console.info(
      JSON.stringify({
        modulo: "comercial",
        evento,
        usuario: usuarioId,
        ...detalhes,
      }),
    ),
  );
}
