import "server-only";
import {
  type Filtravel,
  totalForaDoIntervalo,
} from "@/lib/os/filtro-postgrest";
import { intervalo } from "@/lib/os/paginacao";
import { buscaDeLojas, type SituacaoLoja } from "@/lib/os/portal-lista";
import { os, type Tabela } from "./base";

// Lojas (contratos de locação). Até a API do ENET, cadastro manual pela
// equipe com os.portal; depois, a sincronização grava e a tela só consulta.

export type Loja = Tabela<"lojas">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler as lojas: ${erro.message}`);
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
