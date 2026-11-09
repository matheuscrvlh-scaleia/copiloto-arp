import "server-only";
import { createClient } from "@/lib/supabase/server";

// Filtros lembrados de cada pessoa por tela (spec 4.3), em core.preferencias
// com a chave "<modulo>.filtros.<tela>" (RLS: só as da própria pessoa). Os
// Tickets têm os seus em server/os/preferencias.ts.

export type Busca = Record<string, string | string[] | undefined>;

export const MODULOS_COM_FILTROS = [
  "marketing",
  "comercial",
  "operacoes",
] as const;
export type ModuloComFiltros = (typeof MODULOS_COM_FILTROS)[number];

export const chaveDosFiltros = (modulo: ModuloComFiltros, tela: string) =>
  `${modulo}.filtros.${tela}`;

/**
 * Filtros que valem na tela: os da URL; sem nenhum, os últimos que a pessoa
 * usou (a barra os coloca na URL). "?limpar=1" volta ao padrão. Lê a
 * sessão: use em <Suspense>.
 */
export async function filtrosLembrados(
  modulo: ModuloComFiltros,
  tela: string,
  busca: Busca,
): Promise<{ busca: Busca; lembrado: string | null }> {
  const chaves = Object.keys(busca).filter((k) => busca[k] !== undefined);
  if (chaves.length > 0) return { busca, lembrado: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("core")
    .from("preferencias")
    .select("valor")
    .eq("chave", chaveDosFiltros(modulo, tela))
    .maybeSingle();
  if (error) {
    console.error(`preferências do ${modulo}`, error);
    return { busca, lembrado: null };
  }
  const texto = typeof data?.valor === "string" ? data.valor : "";
  if (!texto) return { busca, lembrado: null };
  return {
    busca: Object.fromEntries(new URLSearchParams(texto)),
    lembrado: texto,
  };
}
