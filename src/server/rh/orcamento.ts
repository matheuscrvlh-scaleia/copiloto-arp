import "server-only";
import { cache } from "react";
import { formatarMes, isoLocal } from "@/lib/formato";
import { anoEmUso, filtrarGastos, type GastoDoAno } from "@/lib/rh/orcamento";
import { createClient } from "@/lib/supabase/server";
import { pode } from "../auth";
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

type Busca = Record<string, string | string[] | undefined>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * O que as abas Dashboard e Lançamentos leem igual: permissões, anos do
 * filtro, o filtro pedido (ano, mês, categoria) e os gastos do ano.
 * null: sem acesso.
 */
export async function telaDoOrcamento(params: Busca) {
  const [ve, lanca] = await Promise.all([
    pode("rh.orcamento"),
    pode("rh.orcamento.lancar"),
  ]);
  if (!ve && !lanca) return null;

  const hoje = isoLocal(new Date());
  const anoAtual = Number(hoje.slice(0, 4));
  const [orcamentos, categorias, primeiro] = await Promise.all([
    orcamentosAnuais(),
    categoriasDeGasto(),
    primeiroAnoComGasto(),
  ]);
  const padrao = anoEmUso(
    anoAtual,
    orcamentos.filter((o) => o.finalizado_em).map((o) => o.ano),
  );
  const ultimo = Math.max(padrao, ...orcamentos.map((o) => o.ano));
  const inicio = Math.min(
    padrao,
    primeiro ?? padrao,
    ...orcamentos.map((o) => o.ano),
  );
  const anos = Array.from(
    { length: ultimo - inicio + 1 },
    (_, i) => ultimo - i,
  );
  const anoPedido = Number(um(params.ano));
  const ano = anos.includes(anoPedido) ? anoPedido : padrao;
  const mesPedido = Number(um(params.mes));
  const mes = mesPedido >= 1 && mesPedido <= 12 ? mesPedido : null;
  const catPedida = um(params.cat) ?? null;
  const categoria = categorias.some((c) => c.id === catPedida)
    ? catPedida
    : null;

  const gastos = await gastosDoAno(ano);
  const orcamento = orcamentos.find((o) => o.ano === ano) ?? null;
  const nomeCategoria = categorias.find((c) => c.id === categoria)?.nome;
  const rotuloFiltro = `${mes ? formatarMes(`${ano}-${String(mes).padStart(2, "0")}-01`) : ano}${nomeCategoria ? ` · ${nomeCategoria}` : ""}`;
  return {
    lanca,
    hoje,
    anoAtual,
    anos,
    ano,
    mes,
    categoria,
    categorias,
    nomeCategoria,
    gastos,
    doFiltro: filtrarGastos(gastos, { mes, categoria }),
    orcamento,
    finalizado: !!orcamento?.finalizado_em,
    rotuloFiltro,
  };
}
