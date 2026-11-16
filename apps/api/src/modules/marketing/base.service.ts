import type {
  LandingPage,
  Locatario,
  MetaMkt,
  Parametros,
  Referencia,
  RegraAlerta,
  TemasECodigos,
} from "@arp/shared/marketing/contratos/base";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import { exigirModulo } from "./acesso";
import * as repo from "./base.repository";

// Base do Marketing: os cadastros de Configurações (configuração igual para
// todos do módulo) e as metas. Lidos pela service role depois de conferir o
// mesmo acesso do RLS (alguma permissão marketing.*).

export async function parametros(ctx: Contexto): Promise<Parametros> {
  exigirModulo(ctx);
  const p = await banco.comoServico((tx) => repo.parametros(tx));
  if (!p) throw new Error("marketing.parametros sem a linha única");
  return p;
}

/** Locatários monitorados (ativos e inativos), por nome. */
export async function locatarios(ctx: Contexto): Promise<Locatario[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.locatarios(tx));
}

export async function landingPages(ctx: Contexto): Promise<LandingPage[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.landingPages(tx));
}

export async function regrasAlerta(ctx: Contexto): Promise<RegraAlerta[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.regrasAlerta(tx));
}

/** Referências do Benchmark (ativas e inativas), por nome. */
export async function referencias(ctx: Contexto): Promise<Referencia[]> {
  exigirModulo(ctx);
  return banco.comoServico((tx) => repo.referencias(tx));
}

/** Temas e códigos da ronda (mudam junto com os parâmetros). */
export async function temasECodigos(ctx: Contexto): Promise<TemasECodigos> {
  exigirModulo(ctx);
  return banco.comoServico(async (tx) => ({
    temas: await repo.temas(tx),
    codigos: await repo.codigosRonda(tx),
  }));
}

/** Metas marketing.* de core.metas, por vigência. */
export async function metas(ctx: Contexto): Promise<MetaMkt[]> {
  exigirModulo(ctx);
  const linhas = await banco.comoServico((tx) => repo.metas(tx));
  return linhas.map((m) => ({ ...m, limiteAtencao: m.limite_atencao }));
}
