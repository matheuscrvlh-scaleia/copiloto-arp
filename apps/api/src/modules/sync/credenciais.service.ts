import {
  INTEGRACOES,
  type Sistema,
  separarSegredos,
} from "@arp/shared/integracoes";
import { env } from "@/config/env";
import {
  type ClaudeConfig,
  createClaudeClient,
} from "@/connectors/claude/client";
import {
  type CopilotoRhConfig,
  createCopilotoRhClient,
} from "@/connectors/copiloto-rh/client";
import {
  createDiarioDeObrasClient,
  type DiarioDeObrasConfig,
} from "@/connectors/diario-de-obras/client";
import {
  createGrowattClient,
  type GrowattConfig,
} from "@/connectors/growatt/client";
import { createGoogleClient } from "@/connectors/marketing/google";
import { createMetaClient } from "@/connectors/marketing/meta";
import { createRdStationClient } from "@/connectors/marketing/rd-station";
import {
  createSecullumClient,
  type SecullumConfig,
} from "@/connectors/secullum/client";
import { createWpsClient, type WpsConfig } from "@/connectors/wps/client";
import { type Contexto, exigir } from "@/contexto";
import { ErroDePermissao } from "@/erros";
import { banco } from "@/infra/banco";
import type { JsonValue } from "@/infra/banco/tipos";
import { cifrar, decifrar } from "@/infra/cofre";
import * as repo from "./credenciais.repository";

// Credenciais das integrações. Valem as salvas na tela (Administração ›
// Integrações ou, as do Marketing e do Sustentabilidade, Configurações ›
// Integrações de cada módulo);
// sem elas, as variáveis de ambiente (.env). Lidas com a service role: quem
// chama é a rotina (sem pessoa) ou um service que já conferiu podeConfigurar.

const TELA_DO_MODULO = {
  admin: "Administração › Configurações › Integrações",
  marketing: "Marketing › Configurações › Integrações",
  sustentabilidade: "Administração › Configurações › Integrações",
} as const;

/** Permissão que configura as integrações de cada módulo (além do admin). */
const PERMISSAO_DO_MODULO = {
  marketing: "marketing.parametros",
  sustentabilidade: "sustentabilidade.parametros",
} as const;

/**
 * Quem pode configurar: admin.integracoes em todas; marketing.parametros nas
 * do Marketing; sustentabilidade.parametros nas do Sustentabilidade. O banco
 * confere a mesma regra (core.pode_integracao).
 */
export async function podeConfigurar(
  ctx: Contexto,
  sistema: Sistema,
): Promise<boolean> {
  if (await podeAgora(ctx, "admin.integracoes")) return true;
  const { modulo } = INTEGRACOES[sistema];
  return modulo !== "admin" && podeAgora(ctx, PERMISSAO_DO_MODULO[modulo]);
}

async function podeAgora(
  ctx: Contexto,
  permissao:
    | "admin.integracoes"
    | (typeof PERMISSAO_DO_MODULO)[keyof typeof PERMISSAO_DO_MODULO],
): Promise<boolean> {
  try {
    await exigir(ctx, permissao);
    return true;
  } catch (erro) {
    if (erro instanceof ErroDePermissao) return false;
    throw erro;
  }
}

export interface Credencial {
  parametros: Record<string, unknown>;
  segredo: string;
}

export class IntegracaoNaoConfigurada extends Error {
  constructor(sistema: Sistema, detalhe: string) {
    super(`${INTEGRACOES[sistema].nome}: ${detalhe}`);
    this.name = "IntegracaoNaoConfigurada";
  }
}

const objeto = (v: JsonValue): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};

/** Credencial salva na tela, já decifrada; null se não houver. */
export async function credencialSalva(
  sistema: Sistema,
): Promise<(Credencial & { ativa: boolean }) | null> {
  const linha = await banco.comoServico((tx) => repo.credencial(tx, sistema));
  if (!linha) return null;
  return {
    parametros: objeto(linha.parametros),
    segredo: decifrar(linha.segredo_cifrado, sistema),
    ativa: linha.ativa,
  };
}

/** A credencial em uso: a salva (se ativa) ou a do ambiente. */
export async function credencialEmUso(sistema: Sistema): Promise<Credencial> {
  const salva = await credencialSalva(sistema);
  if (salva) {
    if (!salva.ativa)
      throw new IntegracaoNaoConfigurada(sistema, "integração desativada");
    return salva;
  }
  const doAmbiente = DO_AMBIENTE[sistema]?.() ?? null;
  if (!doAmbiente)
    throw new IntegracaoNaoConfigurada(
      sistema,
      `cadastre o acesso em ${TELA_DO_MODULO[INTEGRACOES[sistema].modulo]}`,
    );
  return doAmbiente;
}

/** Guarda o segredo novo (cifrado) de uma credencial já salva. */
export async function trocarSegredo(
  sistema: Sistema,
  segredo: string,
): Promise<void> {
  const cifrado = cifrar(segredo, sistema);
  await banco.comoServico((tx) => repo.trocarSegredo(tx, sistema, cifrado));
}

const DO_AMBIENTE: Partial<Record<Sistema, () => Credencial | null>> = {
  secullum() {
    if (!env.SECULLUM_USUARIO || !env.SECULLUM_SENHA || !env.SECULLUM_BANCO_ID)
      return null;
    return {
      parametros: {
        usuario: env.SECULLUM_USUARIO,
        banco_id: env.SECULLUM_BANCO_ID,
      },
      segredo: env.SECULLUM_SENHA,
    };
  },
  wps() {
    if (
      !env.WPS_BASE_URL ||
      !env.WPS_USUARIO ||
      !env.WPS_SENHA ||
      !env.WPS_ESTACIONAMENTO_ID
    )
      return null;
    return {
      parametros: {
        base_url: env.WPS_BASE_URL,
        usuario: env.WPS_USUARIO,
        estacionamento_id: env.WPS_ESTACIONAMENTO_ID,
      },
      segredo: env.WPS_SENHA,
    };
  },
  copiloto_rh() {
    if (
      !env.COPILOTO_RH_BASE_URL ||
      !env.COPILOTO_RH_USUARIO ||
      !env.COPILOTO_RH_SENHA
    )
      return null;
    return {
      parametros: {
        base_url: env.COPILOTO_RH_BASE_URL,
        usuario: env.COPILOTO_RH_USUARIO,
      },
      segredo: env.COPILOTO_RH_SENHA,
    };
  },
  claude() {
    if (!env.ANTHROPIC_API_KEY) return null;
    return {
      parametros: { modelo: env.CLAUDE_MODELO ?? "" },
      segredo: env.ANTHROPIC_API_KEY,
    };
  },
};

/** Há credencial completa nas variáveis de ambiente? (Nunca devolve valores.) */
export function temNoAmbiente(sistema: Sistema): boolean {
  return (DO_AMBIENTE[sistema]?.() ?? null) !== null;
}

// ---------------------------------------------------------------------------
// Configuração de cada conector a partir da credencial
// ---------------------------------------------------------------------------

export function configSecullum({
  parametros,
  segredo,
}: Credencial): SecullumConfig {
  const p = INTEGRACOES.secullum.parametros.parse(parametros);
  return {
    usuario: String(p.usuario),
    senha: segredo,
    bancoId: String(p.banco_id),
  };
}

export function configWps({ parametros, segredo }: Credencial): WpsConfig {
  const p = INTEGRACOES.wps.parametros.parse(parametros);
  return {
    baseUrl: String(p.base_url),
    usuario: String(p.usuario),
    senha: segredo,
    estacionamentoId: Number(p.estacionamento_id),
  };
}

export function configDiario({ segredo }: Credencial): DiarioDeObrasConfig {
  return { token: segredo };
}

export function configCopiloto({
  parametros,
  segredo,
}: Credencial): CopilotoRhConfig {
  const p = INTEGRACOES.copiloto_rh.parametros.parse(parametros);
  return {
    baseUrl: String(p.base_url),
    usuario: String(p.usuario),
    senha: segredo,
  };
}

export function configGrowatt({
  parametros,
  segredo,
}: Credencial): GrowattConfig {
  const p = INTEGRACOES.sus_growatt.parametros.parse(parametros);
  return {
    baseUrl: String(p.base_url),
    token: segredo,
    usinaId: Number(p.usina_id),
  };
}

export function configClaude({
  parametros,
  segredo,
}: Credencial): ClaudeConfig {
  const p = INTEGRACOES.claude.parametros.parse(parametros);
  return { apiKey: segredo, modelo: String(p.modelo) };
}

/** IA (Claude) com a credencial em uso. As telas que usam a IA chamam esta. */
export async function claude() {
  return createClaudeClient(configClaude(await credencialEmUso("claude")));
}

export async function growatt() {
  return createGrowattClient(
    configGrowatt(await credencialEmUso("sus_growatt")),
  );
}

export async function secullum() {
  return createSecullumClient(
    configSecullum(await credencialEmUso("secullum")),
  );
}

export async function wps() {
  return createWpsClient(configWps(await credencialEmUso("wps")));
}

export async function diarioDeObras() {
  return createDiarioDeObrasClient(
    configDiario(await credencialEmUso("diario_de_obras")),
  );
}

export async function copilotoRh() {
  return createCopilotoRhClient(
    configCopiloto(await credencialEmUso("copiloto_rh")),
  );
}

/** RD Station Marketing com o acesso salvo em Administração › Configurações › Integrações. */
export async function rdStation() {
  const def = INTEGRACOES.mkt_rd_station;
  const c = await credencialEmUso("mkt_rd_station");
  const p = def.parametros.parse(c.parametros);
  const s = separarSegredos(def, c.segredo);
  if (!s.client_secret || !s.refresh_token)
    throw new IntegracaoNaoConfigurada(
      "mkt_rd_station",
      "falta clicar em Conectar com o RD Station",
    );
  return createRdStationClient({
    clientId: String(p.client_id),
    clientSecret: s.client_secret,
    refreshToken: s.refresh_token,
  });
}

/**
 * Meta com o acesso salvo em Marketing › Configurações › Integrações, e os
 * ids preenchidos ("" no que a ARP não usa).
 */
export async function meta() {
  const def = INTEGRACOES.mkt_meta;
  const c = await credencialEmUso("mkt_meta");
  const p = def.parametros.parse(c.parametros);
  const s = separarSegredos(def, c.segredo);
  if (!s.segredo)
    throw new IntegracaoNaoConfigurada("mkt_meta", "falta o token de acesso");
  return {
    api: createMetaClient({ sistema: "mkt_meta", token: s.segredo }),
    contaDeAnuncios: String(p.ad_account_id ?? ""),
    pagina: String(p.page_id ?? ""),
    instagram: String(p.instagram_id ?? ""),
  };
}

/**
 * Google com o acesso salvo (Conectar com o Google) e os ids de cada produto
 * ("" no que a ARP não usa).
 */
export async function google() {
  const def = INTEGRACOES.mkt_google;
  const c = await credencialEmUso("mkt_google");
  const p = def.parametros.parse(c.parametros);
  const s = separarSegredos(def, c.segredo);
  if (!s.refresh_token)
    throw new IntegracaoNaoConfigurada(
      "mkt_google",
      "falta clicar em Conectar com o Google",
    );
  const id = (k: string) => String(p[k] ?? "").trim();
  return {
    api: createGoogleClient({
      sistema: "mkt_google",
      clientId: id("client_id"),
      clientSecret: s.client_secret ?? "",
      refreshToken: s.refresh_token,
    }),
    contaAds: id("customer_id").replace(/-/g, ""),
    loginAds: id("login_customer_id").replace(/-/g, ""),
    propriedadeGa4: id("property_id"),
    siteSearchConsole: id("site_url"),
  };
}
