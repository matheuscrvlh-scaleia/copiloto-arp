import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";

// Base do módulo Comercial: quem está logado, "hoje", os clientes do schema
// comercial e a configuração igual para todos do módulo (parâmetros, listas,
// de-para de fontes, tipos de LUC, faixas de evento e metas), lida pela
// service role e guardada no cache depois de conferir o mesmo acesso do RLS.
// Padrão em docs/arquitetura.md.

type Com = Database["comercial"];
export type Tabela<T extends keyof Com["Tables"]> = Com["Tables"][T]["Row"];
export type Parametros = Tabela<"parametros">;
export type Lista = Tabela<"listas">;
export type FonteDePara = Tabela<"fontes_de_para">;
export type TipoLuc = Tabela<"tipos_luc">;
export type FaixaEvento = Tabela<"faixas_evento">;
export type Importacao = Tabela<"importacoes">;
export type Contato = Tabela<"contatos">;
export type CensoRodada = Tabela<"censo_rodadas">;
export type CensoConvite = Tabela<"censo_convites">;
export type CensoResposta = Tabela<"censo_respostas">;
export type CensoTema = Tabela<"censo_temas">;
export type CensoSugestaoTema = Tabela<"censo_sugestao_temas">;
export type Ficha = Tabela<"fichas">;
export type FichaDados = Tabela<"ficha_dados">;
export type FichaDocumento = Tabela<"ficha_documentos">;
export type KitDocumento = Tabela<"kit_documentos">;
export type KitVersao = Tabela<"kit_versoes">;
export type Contrato = Tabela<"contratos">;
export type ContratoVersao = Tabela<"contrato_versoes">;
export type ContratoAnexo = Tabela<"contrato_anexos">;
export type PropostaEvento = Tabela<"propostas_evento">;
export type PesquisaImovel = Tabela<"pesquisa_imoveis">;
export type OcupacaoFoto = Tabela<"ocupacao_fotos">;

/** Listas de comercial.listas (o check da coluna "lista"). */
export type NomeLista =
  | "fonte_ajustada"
  | "tipo_contato"
  | "canal_contato"
  | "censo_bloco"
  | "censo_segmento"
  | "censo_expectativa"
  | "pesquisa_bairro"
  | "pesquisa_tipo"
  | "ficha_documento_pf"
  | "ficha_documento_pj"
  | "ficha_documento_fiador"
  | "evento_observacao"
  | "kit_categoria";

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

/** Cliente com a sessão, no schema comercial. */
export async function com() {
  return (await createClient()).schema("comercial");
}

/** Service role no schema comercial (só depois de conferir o acesso). */
export function comAdmin() {
  return createAdminClient().schema("comercial");
}

export interface ContextoCom {
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
export const contextoCom = cache(async (): Promise<ContextoCom> => {
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

/** Mesmo acesso que o RLS exige da configuração (core.pode_modulo). */
async function exigirModulo(): Promise<void> {
  const u = await usuarioAtual();
  if (!u.ativo || !u.permissoes.some((p) => p.startsWith("comercial.")))
    throw new Error("Sem acesso ao módulo Comercial.");
}

// ---------------------------------------------------------------------------
// Configuração (cache "referencia", invalidada pelas ações de Configurações)
// ---------------------------------------------------------------------------

export const parametros = cache(async (): Promise<Parametros> => {
  await exigirModulo();
  return parametrosDoModulo();
});

async function parametrosDoModulo(): Promise<Parametros> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.parametros);
  const { data, error } = await comAdmin()
    .from("parametros")
    .select("*")
    .eq("id", true)
    .single();
  falhar(error);
  return data;
}

/** Todas as listas (ativas e inativas), por lista e ordem. */
export const listas = cache(async (): Promise<Lista[]> => {
  await exigirModulo();
  return listasDoModulo();
});

async function listasDoModulo(): Promise<Lista[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.listas);
  const { data, error } = await comAdmin()
    .from("listas")
    .select("*")
    .order("lista")
    .order("ordem")
    .order("valor");
  falhar(error);
  return data ?? [];
}

/** Valores ativos de uma lista, na ordem da tela. */
export async function valoresDaLista(nome: NomeLista): Promise<string[]> {
  return (await listas())
    .filter((l) => l.lista === nome && l.ativo)
    .map((l) => l.valor);
}

export const fontesDePara = cache(async (): Promise<FonteDePara[]> => {
  await exigirModulo();
  return fontesDoModulo();
});

async function fontesDoModulo(): Promise<FonteDePara[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.fontesDePara);
  const { data, error } = await comAdmin()
    .from("fontes_de_para")
    .select("*")
    .order("fonte_rd");
  falhar(error);
  return data ?? [];
}

export const tiposLuc = cache(async (): Promise<TipoLuc[]> => {
  await exigirModulo();
  return tiposLucDoModulo();
});

async function tiposLucDoModulo(): Promise<TipoLuc[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.tiposLuc);
  const { data, error } = await comAdmin()
    .from("tipos_luc")
    .select("*")
    .order("ordem")
    .order("tipo");
  falhar(error);
  return data ?? [];
}

export const faixasEvento = cache(async (): Promise<FaixaEvento[]> => {
  await exigirModulo();
  return faixasDoModulo();
});

async function faixasDoModulo(): Promise<FaixaEvento[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.faixasEvento);
  const { data, error } = await comAdmin()
    .from("faixas_evento")
    .select("*")
    .order("ordem");
  falhar(error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Metas do Painel (core.metas, indicador "comercial.*", uma linha por mês)
// ---------------------------------------------------------------------------

export interface MetaCom {
  id: string;
  indicador: string;
  direcao: "maior_melhor" | "menor_melhor";
  meta: number;
  limite_atencao: number | null;
  /** "aaaa-mm-01". */
  vigente_desde: string;
}

/** Mesmo acesso que o RLS de core.metas exige para comercial.*. */
export const metasCom = cache(async (): Promise<MetaCom[]> => {
  const u = await usuarioAtual();
  if (
    !u.ativo ||
    !(
      u.permissoes.includes("comercial.painel.ver") ||
      u.permissoes.includes("comercial.painel.metas")
    )
  )
    throw new Error("Sem acesso às metas do Comercial.");
  return metasDoModulo();
});

async function metasDoModulo(): Promise<MetaCom[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.metas);
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("metas")
    .select("id, indicador, direcao, meta, limite_atencao, vigente_desde")
    .like("indicador", "comercial.%")
    .order("vigente_desde");
  falhar(error);
  return (data ?? []).map((m) => ({
    ...m,
    direcao: m.direcao as MetaCom["direcao"],
  }));
}

/** Plan do mês ("aaaa-mm-01"): só a linha daquele mês (mês sem meta = vazio). */
export async function metaCom(
  indicador: string,
  mes: string,
): Promise<MetaCom | null> {
  return (
    (await metasCom()).find(
      (m) => m.indicador === indicador && m.vigente_desde === mes,
    ) ?? null
  );
}

export type { Json };
