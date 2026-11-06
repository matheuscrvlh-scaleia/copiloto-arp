import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import type { Recorrencia, Visibilidade } from "@/lib/calendario";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { lerTudo } from "@/server/supabase-paginas";

// Leituras do calendário. Os tipos e as opções de público (setores, cargos,
// pessoas) são configuração igual para todos: cache pela service role,
// depois de conferir o mesmo acesso do RLS. Os itens são lidos com a
// sessão: o RLS decide quem vê cada um.

export type Tipo = Database["calendario"]["Tables"]["tipos"]["Row"];

export interface Nome {
  id: string;
  nome: string;
}

export interface OpcoesPublico {
  setores: (Nome & { cor: string })[];
  cargos: Nome[];
  /** Pessoas ativas (para escolher) e inativas (só para mostrar o nome). */
  pessoas: (Nome & { ativo: boolean })[];
}

/** O que a tela recebe de cada item (com o que a pessoa pode fazer nele). */
export interface ItemTela {
  id: string;
  tipo_id: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  inicio: string;
  fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  responsavel_id: string | null;
  concluido_em: string | null;
  recorrencia: Recorrencia | null;
  recorrencia_ate: string | null;
  visibilidade: Visibilidade;
  setores: string[];
  cargos: string[];
  usuarios: string[];
  criado_por: string | null;
  podeEditar: boolean;
  podeConcluir: boolean;
}

function exigirAcesso(u: Usuario): void {
  if (
    !u.ativo ||
    !u.permissoes.some(
      (p) => p === "calendario.ver" || p === "calendario.configurar",
    )
  )
    throw new Error("Sem acesso ao calendário.");
}

/** Tipos de item (ativos e inativos; a tela filtra), na ordem configurada. */
export const tipos = cache(async (): Promise<Tipo[]> => {
  exigirAcesso(await usuarioAtual());
  return tiposDoCalendario();
});

async function tiposDoCalendario(): Promise<Tipo[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.calendario.tipos);
  const { data, error } = await createAdminClient()
    .schema("calendario")
    .from("tipos")
    .select("*")
    .order("ordem")
    .order("nome");
  if (error) throw new Error(`Falha ao ler os tipos: ${error.message}`);
  return data ?? [];
}

/** Setores, cargos e pessoas para escolher quem vê e o responsável. */
export const opcoesDePublico = cache(async (): Promise<OpcoesPublico> => {
  exigirAcesso(await usuarioAtual());
  return publico();
});

async function publico(): Promise<OpcoesPublico> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.permissoes, TAG.os.setores);
  const admin = createAdminClient();
  const [setores, cargos, pessoas] = await Promise.all([
    admin
      .schema("os")
      .from("setores")
      .select("id, nome, cor")
      .eq("ativo", true)
      .order("ordem")
      .order("nome"),
    admin
      .schema("core")
      .from("cargos")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
    admin
      .schema("core")
      .from("usuarios")
      .select("id, nome, ativo")
      .order("nome"),
  ]);
  for (const r of [setores, cargos, pessoas])
    if (r.error) throw new Error(`Falha ao ler o público: ${r.error.message}`);
  return {
    setores: setores.data ?? [],
    cargos: cargos.data ?? [],
    pessoas: pessoas.data ?? [],
  };
}

const COLUNAS =
  "id, tipo_id, titulo, descricao, local, inicio, fim, hora_inicio, hora_fim, responsavel_id, concluido_em, recorrencia, recorrencia_ate, visibilidade, setores, cargos, usuarios, criado_por";

/**
 * Itens que a pessoa vê e que acontecem entre `de` e `ate`: os que
 * encostam no período e as séries que ainda não acabaram (a tela expande).
 */
export async function itensEntre(de: string, ate: string): Promise<ItemTela[]> {
  const [usuario, supabase, listaTipos] = await Promise.all([
    usuarioAtual(),
    createClient(),
    tipos(),
  ]);
  const linhas = await lerTudo(() =>
    supabase
      .schema("calendario")
      .from("itens")
      .select(COLUNAS)
      .lte("inicio", ate)
      .or(
        `fim.gte.${de},and(recorrencia.not.is.null,or(recorrencia_ate.is.null,recorrencia_ate.gte.${de}))`,
      )
      .order("inicio")
      .order("id"),
  );
  const tipoPorId = new Map(listaTipos.map((t) => [t.id, t]));
  const p = new Set(usuario.permissoes);
  return linhas.map((l) => {
    const meu = l.criado_por === usuario.id;
    const outroVisivel =
      p.has("calendario.editar_todos") && l.visibilidade !== "privado";
    return {
      ...l,
      recorrencia: l.recorrencia as Recorrencia | null,
      visibilidade: l.visibilidade as Visibilidade,
      // Mesma regra do RLS (update/delete) e de calendario.concluir().
      podeEditar: (meu && p.has("calendario.criar")) || outroVisivel,
      podeConcluir:
        !!tipoPorId.get(l.tipo_id)?.usa_conclusao &&
        !l.recorrencia &&
        (meu || l.responsavel_id === usuario.id || outroVisivel),
    };
  });
}
