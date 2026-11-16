import type {
  FaixaEvento,
  FonteDePara,
  Lista,
  MetaCom,
  Momento,
  NomeListaCom,
  Parametros,
  TipoLuc,
} from "@arp/shared/comercial/contratos/base";
import { dadosDe } from "@arp/shared/comercial/formato";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Permissao } from "@arp/shared/permissions";
import { type Contexto, exigir, pode } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import * as repo from "./base.repository";

// Base do módulo Comercial: quem está logado, "hoje" e a configuração igual
// para todos do módulo (parâmetros, listas, de-para de fontes, tipos de LUC,
// faixas de evento e metas), lida pela service role depois de conferir o
// mesmo acesso do RLS (core.pode_modulo). Os services dos recursos (e os da
// parte B: censo, fichas, kit, eventos, pesquisa) partem daqui.

export interface ContextoCom extends Momento {
  ctx: Contexto;
  pode: (p: Permissao) => boolean;
}

/** Permissões desta requisição, "hoje" em Brasília e o "Dados de…". */
export function contextoCom(ctx: Contexto, agora = new Date()): ContextoCom {
  return {
    ctx,
    pode: (p) => pode(ctx, p),
    hoje: hojeEmBrasilia(agora),
    dadosDe: dadosDe(agora),
  };
}

/** Mesmo acesso que o RLS exige da configuração (core.pode_modulo). */
export function exigirModulo(ctx: Contexto): void {
  if (![...ctx.permissoes].some((p) => p.startsWith("comercial.")))
    throw new ErroDePermissao("Sem acesso ao módulo Comercial.");
}

/** Pelo menos uma das permissões, conferida agora no banco. */
export async function exigirUma(
  ctx: Contexto,
  permissoes: Permissao[],
): Promise<void> {
  for (const p of permissoes) {
    try {
      await exigir(ctx, p);
      return;
    } catch (e) {
      if (!(e instanceof ErroDePermissao)) throw e;
    }
  }
  throw new ErroDePermissao();
}

/** true se a pessoa tem a permissão agora (core.pode no banco). */
export async function podeAgora(
  ctx: Contexto,
  permissao: Permissao,
): Promise<boolean> {
  try {
    await exigir(ctx, permissao);
    return true;
  } catch (e) {
    if (e instanceof ErroDePermissao) return false;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export async function parametros(ctx: Contexto): Promise<Parametros> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.parametros(tx));
}

/** Todas as listas (ativas e inativas), por lista e ordem. */
export async function listas(ctx: Contexto): Promise<Lista[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.listas(tx));
}

/** Valores ativos de uma lista, na ordem da tela. */
export function valoresDaLista(todas: Lista[], nome: NomeListaCom): string[] {
  return todas.filter((l) => l.lista === nome && l.ativo).map((l) => l.valor);
}

export async function fontesDePara(ctx: Contexto): Promise<FonteDePara[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.fontesDePara(tx));
}

export async function tiposLuc(ctx: Contexto): Promise<TipoLuc[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.tiposLuc(tx));
}

export async function faixasEvento(ctx: Contexto): Promise<FaixaEvento[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.faixasEvento(tx));
}

/** Mesmo acesso que o RLS de core.metas exige para comercial.*. */
export async function metasCom(ctx: Contexto): Promise<MetaCom[]> {
  if (
    !pode(ctx, "comercial.painel.ver") &&
    !pode(ctx, "comercial.painel.metas")
  )
    throw new ErroDePermissao("Sem acesso às metas do Comercial.");
  return banco.comoServico((tx) => repo.metas(tx));
}

// ---------------------------------------------------------------------------
// Nomes de quem alterou, enviou, registrou
// ---------------------------------------------------------------------------

/**
 * Nome de cada pessoa. Primeiro pela sessão; os que o RLS de core.usuarios
 * esconde (quem não administra só vê a si mesmo) vêm pela service role, só
 * para ids que a pessoa já leu pelo RLS e depois de conferir no banco
 * `podeVer` (uma das permissões, ou a regra dada).
 */
export async function nomesDeUsuarios(
  ctx: Contexto,
  ids: (string | null | undefined)[],
  podeVer: Permissao[] | (() => Promise<boolean>),
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const nomes = new Map<string, string>();
  if (!unicos.length) return nomes;
  const daSessao = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.nomesDeUsuarios(tx, unicos),
  );
  for (const u of daSessao) nomes.set(u.id, u.nome);
  const faltam = unicos.filter((i) => !nomes.has(i));
  if (!faltam.length || !(await liberado(ctx, podeVer))) return nomes;
  const doServico = await banco.comoServico((tx) =>
    repo.nomesDeUsuarios(tx, faltam),
  );
  for (const u of doServico) nomes.set(u.id, u.nome);
  return nomes;
}

async function liberado(
  ctx: Contexto,
  podeVer: Permissao[] | (() => Promise<boolean>),
): Promise<boolean> {
  if (typeof podeVer === "function") return podeVer();
  for (const p of podeVer) if (await podeAgora(ctx, p)) return true;
  return false;
}
