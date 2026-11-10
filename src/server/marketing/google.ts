import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { mensagemSegura } from "@/connectors/http";
import type {
  BuscaLinha,
  Ga4Linha,
  GoogleLinha,
  GoogleTermo,
} from "@/lib/marketing/fontes";
import { somarDias } from "@/lib/marketing/periodo";
import { TAG } from "../cache";
import { google, IntegracaoNaoConfigurada } from "../integracoes";
import { contextoMkt } from "./base";
import type { Leitura } from "./meta";

// Google com dados reais: Ads (campanhas e termos de pesquisa), Analytics 4
// e Search Console, lidos ao vivo das APIs e guardados no cache por uma hora
// (ou até alguém salvar ou testar a integração: updateTag). Tudo agregado da
// conta, sem dado pessoal. Produto sem id em Integrações fica vazio, com aviso.

/** 18 semanas: a janela do módulo. */
const JANELA_DIAS = 126;

export interface AnunciosGoogle {
  linhas: GoogleLinha[];
  termos: GoogleTermo[];
}

export interface SiteGoogle {
  ga4: Ga4Linha[];
  buscas: BuscaLinha[];
  /** Por que as buscas não vieram (Search Console sem propriedade ou sem acesso). */
  avisoBuscas?: string;
}

async function exigirModulo() {
  const ctx = await contextoMkt();
  if (!ctx.usuario.permissoes.some((p) => p.startsWith("marketing.")))
    throw new Error("Sem acesso ao módulo Marketing.");
  return ctx;
}

function avisoDe(produto: string, erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada)
    return `${produto}: ${erro.message}`;
  console.error(`leitura do google (${produto})`, erro);
  return `${produto} não respondeu: ${mensagemSegura(erro).slice(0, 160)}`;
}

/** Erro dentro de "use cache" sai sem a mensagem em produção: volta como dado. */
type Lido<T> = { dados: T } | { aviso: string };

async function lerAds(hoje: string): Promise<Lido<AnunciosGoogle | null>> {
  "use cache";
  cacheTag(TAG.marketing.google);
  try {
    const g = await google();
    if (!g.contaAds) {
      cacheLife("hours");
      return { dados: null };
    }
    const de = somarDias(hoje, -JANELA_DIAS);
    const login = g.loginAds || undefined;
    const [linhas, termos] = await Promise.all([
      g.api.adsCampanhasPorDia(g.contaAds, de, hoje, login),
      g.api.adsTermos(g.contaAds, de, hoje, login),
    ]);
    cacheLife("hours");
    return { dados: { linhas, termos } };
  } catch (erro) {
    cacheLife("seconds");
    return { aviso: avisoDe("Google Ads", erro) };
  }
}

/** Google Ads das últimas 18 semanas. */
export async function anunciosGoogle(): Promise<Leitura<AnunciosGoogle>> {
  const { hoje } = await exigirModulo();
  const lido = await lerAds(hoje);
  if ("aviso" in lido) return { ok: false, aviso: lido.aviso };
  if (!lido.dados)
    return {
      ok: false,
      aviso: "Google Ads: falta a conta em Integrações › Google.",
    };
  return { ok: true, dados: lido.dados, lidoEm: new Date().toISOString() };
}

async function lerSite(hoje: string): Promise<Lido<SiteGoogle | null>> {
  "use cache";
  cacheTag(TAG.marketing.google);
  try {
    const g = await google();
    if (!g.propriedadeGa4) {
      cacheLife("hours");
      return { dados: null };
    }
    const de = somarDias(hoje, -JANELA_DIAS);
    const ate = somarDias(hoje, -1);
    const [ga4, buscas] = await Promise.all([
      g.api.ga4Relatorio(g.propriedadeGa4, de, ate),
      g.siteSearchConsole
        ? g.api
            .buscas(g.siteSearchConsole, de, ate)
            .then((dados) => ({ dados }))
            .catch((erro: unknown) => ({
              aviso: avisoDe("Search Console", erro),
            }))
        : Promise.resolve({
            aviso:
              "Search Console: falta a propriedade em Integrações › Google (a conta conectada precisa ter acesso verificado ao site).",
          }),
    ]);
    cacheLife("hours");
    return {
      dados:
        "dados" in buscas
          ? { ga4, buscas: buscas.dados }
          : { ga4, buscas: [], avisoBuscas: buscas.aviso },
    };
  } catch (erro) {
    cacheLife("seconds");
    return { aviso: avisoDe("Google Analytics", erro) };
  }
}

/** GA4 e Search Console das últimas 18 semanas (até ontem). */
export async function siteGoogle(): Promise<Leitura<SiteGoogle>> {
  const { hoje } = await exigirModulo();
  const lido = await lerSite(hoje);
  if ("aviso" in lido) return { ok: false, aviso: lido.aviso };
  if (!lido.dados)
    return {
      ok: false,
      aviso: "Google Analytics: falta a propriedade em Integrações › Google.",
    };
  return { ok: true, dados: lido.dados, lidoEm: new Date().toISOString() };
}
