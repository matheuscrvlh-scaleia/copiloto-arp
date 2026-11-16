import type {
  BuscaLinha,
  Ga4Linha,
  GoogleLinha,
  GoogleTermo,
} from "@arp/shared/marketing/fontes";
import { somarDias } from "@arp/shared/marketing/periodo";
import { mensagemSegura } from "@/connectors/http";
import type { Contexto } from "@/contexto";
import { log } from "@/infra/log";
import {
  google,
  IntegracaoNaoConfigurada,
} from "@/modules/sync/credenciais.service";
import { exigirModulo, hoje } from "./acesso";
import { memoria, VALIDADE_LEITURA } from "./memoria";
import { JANELA_DIAS, type Leitura } from "./meta.service";

// Google com dados reais: Ads (campanhas e termos de pesquisa), Analytics 4
// e Search Console, lidos ao vivo das APIs e guardados por uma hora
// (memoria.ts; ou até alguém salvar ou testar a integração:
// esquecerLeituras("google")). Tudo agregado da conta, sem dado pessoal.
// Produto sem id em Integrações fica vazio, com aviso.

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

function avisoDe(produto: string, erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada)
    return `${produto}: ${erro.message}`;
  log.error({ err: erro }, `leitura do google (${produto})`);
  return `${produto} não respondeu: ${mensagemSegura(erro).slice(0, 160)}`;
}

/** A falha volta como dado, guardada só por segundos. */
type Lido<T> = { dados: T } | { aviso: string };

const memoriaDosAnuncios = memoria<Lido<AnunciosGoogle | null>>("google");

function lerAds(dia: string): Promise<Lido<AnunciosGoogle | null>> {
  return memoriaDosAnuncios(dia, async () => {
    try {
      const g = await google();
      if (!g.contaAds)
        return { valor: { dados: null }, validade: VALIDADE_LEITURA.horas };
      const de = somarDias(dia, -JANELA_DIAS);
      const login = g.loginAds || undefined;
      const [linhas, termos] = await Promise.all([
        g.api.adsCampanhasPorDia(g.contaAds, de, dia, login),
        g.api.adsTermos(g.contaAds, de, dia, login),
      ]);
      return {
        valor: { dados: { linhas, termos } },
        validade: VALIDADE_LEITURA.horas,
      };
    } catch (erro) {
      return {
        valor: { aviso: avisoDe("Google Ads", erro) },
        validade: VALIDADE_LEITURA.segundos,
      };
    }
  });
}

/** Google Ads das últimas 18 semanas. */
export async function anunciosGoogle(
  ctx: Contexto,
): Promise<Leitura<AnunciosGoogle>> {
  exigirModulo(ctx);
  const lido = await lerAds(hoje());
  if ("aviso" in lido) return { ok: false, aviso: lido.aviso };
  if (!lido.dados)
    return {
      ok: false,
      aviso: "Google Ads: falta a conta em Integrações › Google.",
    };
  return { ok: true, dados: lido.dados, lidoEm: new Date().toISOString() };
}

/** Aquece a memória do dia (ver aquecerMeta). */
export async function aquecerGoogle(dia: string): Promise<void> {
  await Promise.all([lerAds(dia), lerSite(dia)]);
}

const memoriaDoSite = memoria<Lido<SiteGoogle | null>>("google");

function lerSite(dia: string): Promise<Lido<SiteGoogle | null>> {
  return memoriaDoSite(dia, async () => {
    try {
      const g = await google();
      if (!g.propriedadeGa4)
        return { valor: { dados: null }, validade: VALIDADE_LEITURA.horas };
      const de = somarDias(dia, -JANELA_DIAS);
      const ate = somarDias(dia, -1);
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
      return {
        valor: {
          dados:
            "dados" in buscas
              ? { ga4, buscas: buscas.dados }
              : { ga4, buscas: [], avisoBuscas: buscas.aviso },
        },
        validade: VALIDADE_LEITURA.horas,
      };
    } catch (erro) {
      return {
        valor: { aviso: avisoDe("Google Analytics", erro) },
        validade: VALIDADE_LEITURA.segundos,
      };
    }
  });
}

/** GA4 e Search Console das últimas 18 semanas (até ontem). */
export async function siteGoogle(ctx: Contexto): Promise<Leitura<SiteGoogle>> {
  exigirModulo(ctx);
  const lido = await lerSite(hoje());
  if ("aviso" in lido) return { ok: false, aviso: lido.aviso };
  if (!lido.dados)
    return {
      ok: false,
      aviso: "Google Analytics: falta a propriedade em Integrações › Google.",
    };
  return { ok: true, dados: lido.dados, lidoEm: new Date().toISOString() };
}
