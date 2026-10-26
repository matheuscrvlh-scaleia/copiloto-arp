import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import {
  type Filtravel,
  totalForaDoIntervalo,
} from "@/lib/os/filtro-postgrest";
import { intervalo } from "@/lib/os/paginacao";
import { buscaDeLojas, type SituacaoLoja } from "@/lib/os/portal-lista";
import { usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { os, osAdmin, type Tabela } from "./base";

// Lojas (contratos de locação). Até a API do ENET, cadastro manual pela
// equipe com os.portal; depois, a sincronização grava e a tela só consulta.
// A lista curta (id, LUC, nome, bloco, situação, telefone) é igual para todos do
// módulo e vem do cache: quem grava em os.lojas chama updateTag(TAG.os.lojas).

export type Loja = Tabela<"lojas">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler as lojas: ${erro.message}`);
}

export type LojaResumo = Pick<
  Loja,
  "id" | "luc" | "nome" | "bloco" | "situacao" | "telefone"
>;

/**
 * Todos os contratos, resumidos, do cache. Mesmo acesso do RLS de os.lojas
 * (core.pode_modulo('os')): usuário ativo com alguma permissão os.*.
 */
export const lojasDoModulo = cache(async (): Promise<LojaResumo[]> => {
  const u = await usuarioAtual();
  if (!u.ativo || !u.permissoes.some((p) => p.startsWith("os.")))
    throw new Error("Sem acesso ao módulo Tickets.");
  return lojasEmCache();
});

// Não exportar: lê pela service role (quem chama já conferiu o acesso).
async function lojasEmCache(): Promise<LojaResumo[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.lojas);
  const db = osAdmin();
  const lista: LojaResumo[] = [];
  // De mil em mil (o PostgREST corta em mil): com o histórico, passa disso.
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db
      .from("lojas")
      .select("id, luc, nome, bloco, situacao, telefone")
      .order("luc")
      .order("id")
      .range(de, de + 999);
    falhar(error);
    lista.push(...(data ?? []));
    if ((data ?? []).length < 1000) return lista;
  }
}

export async function loja(id: string): Promise<Loja | null> {
  const { data, error } = await (await os())
    .from("lojas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  return data;
}

function filtrarLojas<Q extends Filtravel<Q>>(
  q: Q,
  s: SituacaoLoja,
  busca: string,
): Q {
  let r = s === "todas" ? q : q.eq("situacao", s);
  const texto = buscaDeLojas(busca, true);
  if (texto) r = r.or(texto);
  return r;
}

/** Uma página dos contratos (pela LUC, o mais novo primeiro) e o total. */
export async function paginaDeLojas(
  s: SituacaoLoja,
  busca: string,
  pagina: number,
): Promise<{ lojas: Loja[]; total: number }> {
  const { de, ate } = intervalo(pagina);
  const { data, error, count } = await filtrarLojas(
    (await os()).from("lojas").select("*", { count: "exact" }),
    s,
    busca,
  )
    .order("luc")
    .order("inicio", { ascending: false, nullsFirst: false })
    .order("id")
    .range(de, ate);
  if (error) {
    const total = totalForaDoIntervalo(error);
    if (total !== null) return { lojas: [], total };
    falhar(error);
  }
  return { lojas: data ?? [], total: count ?? 0 };
}

/** Todos os contratos do filtro (exportar, no clique), de mil em mil. */
export async function lojasDoFiltro(
  s: SituacaoLoja,
  busca: string,
): Promise<Loja[]> {
  const db = await os();
  const lista: Loja[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await filtrarLojas(
      db.from("lojas").select("*"),
      s,
      busca,
    )
      .order("luc")
      .order("inicio", { ascending: false, nullsFirst: false })
      .order("id")
      .range(de, de + 999);
    falhar(error);
    lista.push(...(data ?? []));
    if ((data ?? []).length < 1000) return lista;
  }
}
