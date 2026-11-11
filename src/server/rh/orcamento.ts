import "server-only";
import { cache } from "react";
import type { GastoDoAno } from "@/lib/rh/orcamento";
import { createClient } from "@/lib/supabase/server";
import { lerTudo } from "../supabase-paginas";

// Leituras do Planejamento orçamentário, com a sessão (RLS: vê quem tem
// rh.orcamento ou rh.orcamento.lancar). Tabelas pequenas, sem cache.

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

const rh = async () => (await createClient()).schema("rh");

export interface CategoriaDeGasto {
  id: string;
  nome: string;
  ativa: boolean;
}

/** Todas as categorias (ativas e desativadas), por nome. */
export const categoriasDeGasto = cache(
  async (): Promise<CategoriaDeGasto[]> => {
    const { data, error } = await (await rh())
      .from("categorias_gasto")
      .select("id, nome, ativa")
      .order("nome");
    falhar(error);
    return data ?? [];
  },
);

export interface OrcamentoDoAno {
  ano: number;
  valor: number;
  recebido_em: string;
  finalizado_em: string | null;
  /** Nome de quem finalizou. */
  finalizado_por: string | null;
  total_gasto: number | null;
}

/** Orçamentos recebidos do ERP, do ano mais antigo ao mais novo. */
export const orcamentosAnuais = cache(async (): Promise<OrcamentoDoAno[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("rh")
    .from("orcamentos_anuais")
    .select(
      "ano, valor, recebido_em, finalizado_em, finalizado_por, total_gasto",
    )
    .order("ano");
  falhar(error);
  const ids = [
    ...new Set(
      (data ?? [])
        .map((o) => o.finalizado_por)
        .filter((id): id is string => !!id),
    ),
  ];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: usuarios } = await supabase
      .schema("core")
      .from("usuarios")
      .select("id, nome")
      .in("id", ids);
    for (const u of usuarios ?? []) nomes.set(u.id, u.nome);
  }
  return (data ?? []).map((o) => ({
    ...o,
    valor: Number(o.valor),
    total_gasto: o.total_gasto === null ? null : Number(o.total_gasto),
    finalizado_por: o.finalizado_por
      ? (nomes.get(o.finalizado_por) ?? "Outro usuário")
      : null,
  }));
});

/** Gastos do ano, do mais recente para o mais antigo. */
export const gastosDoAno = cache(async (ano: number): Promise<GastoDoAno[]> => {
  const db = await rh();
  const linhas = await lerTudo(() =>
    db
      .from("gastos")
      .select(
        "id, data, valor, categoria_id, descricao, finalidade, observacao, categoria:categorias_gasto(nome)",
      )
      .gte("data", `${ano}-01-01`)
      .lte("data", `${ano}-12-31`)
      .order("data", { ascending: false })
      .order("id"),
  );
  return linhas.map((g) => ({
    id: g.id,
    data: g.data,
    valor: Number(g.valor),
    categoria_id: g.categoria_id,
    categoria: g.categoria?.nome ?? "—",
    descricao: g.descricao,
    finalidade: g.finalidade,
    observacao: g.observacao,
  }));
});

/** Ano do primeiro gasto lançado (null sem nenhum). */
export const primeiroAnoComGasto = cache(async (): Promise<number | null> => {
  const { data, error } = await (await rh())
    .from("gastos")
    .select("data")
    .order("data")
    .limit(1)
    .maybeSingle();
  falhar(error);
  return data ? Number(data.data.slice(0, 4)) : null;
});
