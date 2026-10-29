import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { metaVigente } from "@/lib/indicadores";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";

// Base do módulo Marketing: quem está logado, "hoje", os cadastros de
// Configurações (configuração igual para todos do módulo: lida pela service
// role e guardada no cache, depois de conferir o mesmo acesso do RLS) e as
// metas. Padrão em docs/arquitetura.md.

type Mkt = Database["marketing"];
export type Tabela<T extends keyof Mkt["Tables"]> = Mkt["Tables"][T]["Row"];
export type Parametros = Tabela<"parametros">;
export type Locatario = Tabela<"locatarios">;
export type LandingPage = Tabela<"landing_pages">;
export type RegraAlerta = Tabela<"regras_alerta">;
export type Tema = Tabela<"temas">;
export type CodigoRonda = Tabela<"ronda_codigos">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

/** Cliente com a sessão, no schema marketing. */
export async function mkt() {
  return (await createClient()).schema("marketing");
}

/** Service role no schema marketing (só depois de conferir o acesso). */
export function mktAdmin() {
  return createAdminClient().schema("marketing");
}

export interface ContextoMkt {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: string;
  /**
   * Quando os dados foram atualizados ("Dados de dd/mm/aaaa às hh:mm"). No
   * mockup, a sincronização diária das 06h de hoje.
   */
  dadosDe: string;
}

/** Usuário, permissões e a data de hoje. Lê a sessão: use em <Suspense>. */
export const contextoMkt = cache(async (): Promise<ContextoMkt> => {
  const usuario = await usuarioAtual();
  await connection();
  const hoje = hojeEmBrasilia(new Date());
  const [a, m, d] = hoje.split("-");
  return {
    usuario,
    pode: (p) => usuario.permissoes.includes(p),
    hoje,
    dadosDe: `Dados de ${d}/${m}/${a} às 06:00`,
  };
});

function usaOModulo(u: Usuario): boolean {
  return u.ativo && u.permissoes.some((p) => p.startsWith("marketing."));
}

/** Mesmo acesso que o RLS exige dos cadastros (core.pode_modulo). */
async function exigirModulo(): Promise<void> {
  if (!usaOModulo(await usuarioAtual()))
    throw new Error("Sem acesso ao módulo Marketing.");
}

// ---------------------------------------------------------------------------
// Cadastros de Configurações (cache "referencia", invalidados pelas ações)
// ---------------------------------------------------------------------------

export const parametros = cache(async (): Promise<Parametros> => {
  await exigirModulo();
  return parametrosDoModulo();
});

async function parametrosDoModulo(): Promise<Parametros> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.marketing.parametros);
  const { data, error } = await mktAdmin()
    .from("parametros")
    .select("*")
    .eq("id", true)
    .single();
  falhar(error);
  return data;
}

/** Locatários monitorados (ativos e inativos), por nome. */
export const locatarios = cache(async (): Promise<Locatario[]> => {
  await exigirModulo();
  return locatariosDoModulo();
});

async function locatariosDoModulo(): Promise<Locatario[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.marketing.locatarios);
  const { data, error } = await mktAdmin()
    .from("locatarios")
    .select("*")
    .order("nome");
  falhar(error);
  return data ?? [];
}

export const landingPages = cache(async (): Promise<LandingPage[]> => {
  await exigirModulo();
  return landingPagesDoModulo();
});

async function landingPagesDoModulo(): Promise<LandingPage[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.marketing.landingPages);
  const { data, error } = await mktAdmin()
    .from("landing_pages")
    .select("*")
    .order("nome");
  falhar(error);
  return data ?? [];
}

export const regrasAlerta = cache(async (): Promise<RegraAlerta[]> => {
  await exigirModulo();
  return regrasDoModulo();
});

async function regrasDoModulo(): Promise<RegraAlerta[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.marketing.regras);
  const { data, error } = await mktAdmin().from("regras_alerta").select("*");
  falhar(error);
  return data ?? [];
}

/** Temas e códigos da ronda (mudam junto com os parâmetros). */
export const temasEcodigos = cache(
  async (): Promise<{ temas: Tema[]; codigos: CodigoRonda[] }> => {
    await exigirModulo();
    return temasEcodigosDoModulo();
  },
);

async function temasEcodigosDoModulo() {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.marketing.parametros);
  const [temas, codigos] = await Promise.all([
    mktAdmin().from("temas").select("*").order("ordem").order("nome"),
    mktAdmin().from("ronda_codigos").select("*").order("codigo"),
  ]);
  falhar(temas.error);
  falhar(codigos.error);
  return { temas: temas.data ?? [], codigos: codigos.data ?? [] };
}

// ---------------------------------------------------------------------------
// Metas (core.metas, indicador "marketing.*")
// ---------------------------------------------------------------------------

export const INDICADORES_MKT = {
  "marketing.avaliacoes_novas_arp": {
    nome: "Avaliações novas da ARP no mês",
    direcao: "maior_melhor",
    unidade: "quantidade",
  },
  "marketing.nota_media_arp": {
    nome: "Nota média da ARP",
    direcao: "maior_melhor",
    unidade: "nota",
  },
  "marketing.leads_mes": {
    nome: "Leads do mês no RD",
    direcao: "maior_melhor",
    unidade: "quantidade",
  },
  "marketing.custo_por_lead": {
    nome: "Custo por lead",
    direcao: "menor_melhor",
    unidade: "reais",
  },
} as const;

export type IndicadorMkt = keyof typeof INDICADORES_MKT;

export interface MetaMkt {
  id: string;
  indicador: string;
  direcao: "maior_melhor" | "menor_melhor";
  meta: number;
  limite_atencao: number | null;
  /** O mesmo limite, no formato de lib/indicadores (status()). */
  limiteAtencao: number | null;
  vigente_desde: string;
}

export const metasMkt = cache(async (): Promise<MetaMkt[]> => {
  await exigirModulo();
  return metasDoModulo();
});

async function metasDoModulo(): Promise<MetaMkt[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.marketing.metas);
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("metas")
    .select("id, indicador, direcao, meta, limite_atencao, vigente_desde")
    .like("indicador", "marketing.%")
    .order("vigente_desde");
  falhar(error);
  return (data ?? []).map((m) => ({
    ...m,
    direcao: m.direcao as MetaMkt["direcao"],
    limiteAtencao: m.limite_atencao,
  }));
}

/** Meta que vale no mês ("aaaa-mm-01"): a última com vigência até ele. */
export async function metaMkt(
  indicador: IndicadorMkt,
  mes: string,
): Promise<MetaMkt | null> {
  return metaVigente(await metasMkt(), indicador, mes);
}

// ---------------------------------------------------------------------------
// Filtros lembrados (core.preferencias, chave "marketing.filtros.<tela>")
// ---------------------------------------------------------------------------

type Busca = Record<string, string | string[] | undefined>;

/**
 * Filtros que valem na tela: os da URL; sem nenhum, os últimos que a pessoa
 * usou (a barra os coloca na URL). "?limpar=1" volta ao padrão.
 */
export async function filtrosDaTela(
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
    .eq("chave", `marketing.filtros.${tela}`)
    .maybeSingle();
  if (error) {
    console.error("preferências do marketing", error);
    return { busca, lembrado: null };
  }
  const texto = typeof data?.valor === "string" ? data.valor : "";
  if (!texto) return { busca, lembrado: null };
  return {
    busca: Object.fromEntries(new URLSearchParams(texto)),
    lembrado: texto,
  };
}

export type { Json };
