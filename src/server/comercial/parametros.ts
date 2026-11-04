import "server-only";
import { cache } from "react";
import {
  type GrupoHistorico,
  type LinhaAuditoria,
  TABELAS_COM,
} from "@/lib/comercial/parametros";
import { EVENTOS } from "@/lib/historico";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { registrarDepois } from "@/server/logs";
import { feriados } from "@/server/os/configuracoes";

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
    const nomes = await nomesDeUsuarios(
      linhas.map((l) => l.usuario_id),
      ["comercial.parametros.editar", "comercial.painel.metas"],
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

/** Feriados de Nova Friburgo (os.feriados, o leitor do Tickets), por data. */
export async function feriadosCadastrados(): Promise<
  { data: string; nome: string }[]
> {
  return (await feriados()).map((f) => ({ data: f.data, nome: f.nome }));
}

const O_QUE_MUDOU: Record<string, string> = {
  parametros_salvos: "parâmetros",
  lista_salva: "lista",
  de_para_salvo: "de-para de fontes",
  de_para_incluido: "de-para de fontes",
  de_para_removido: "de-para de fontes",
  tipos_luc_salvos: "tipos de LUC",
  tipo_luc_incluido: "tipos de LUC",
  faixa_evento_salva: "faixas de evento",
  faixa_evento_incluida: "faixas de evento",
  faixa_evento_removida: "faixas de evento",
  feriado_incluido: "feriados",
  feriado_removido: "feriados",
};

/** Evento no histórico do sistema, depois de responder (não atrasa a ação). */
export function logComercial(
  evento: string,
  usuarioId: string | null,
  detalhes: Record<string, unknown> = {},
): void {
  const exemplos = evento === "exemplos_removidos";
  registrarDepois({
    modulo: "comercial",
    evento: exemplos
      ? "comercial_exemplos_removidos"
      : "comercial_configuracao",
    descricao: exemplos
      ? EVENTOS.comercial_exemplos_removidos
      : `Configurações do Comercial: ${O_QUE_MUDOU[evento] ?? evento}`,
    usuarioId,
    detalhes: { acao: evento, ...(detalhes as Record<string, Json>) },
  });
}
