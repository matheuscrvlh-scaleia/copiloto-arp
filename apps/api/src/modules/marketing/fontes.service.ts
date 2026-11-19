import type {
  DadosAnuncios,
  DadosRd,
  DadosRedes,
  DadosReputacao,
  DadosSite,
} from "@arp/shared/marketing/contratos/fontes";
import type { Contexto } from "@/contexto";
import { exigirModulo } from "./acesso";
import { anunciosGoogle, siteGoogle } from "./google.service";
import { anunciosMeta, redesMeta } from "./meta.service";
import { rdReal } from "./rd.service";

// Dados das ferramentas, nos campos das APIs (@arp/shared/marketing/fontes).
// Reais: Meta (anúncios, Instagram e Facebook), Google (Ads, GA4 e Search
// Console), RD Station e Asana (asana.service.ts). YouTube, Perfil da Empresa
// e TikTok ainda não foram ligados: vêm vazios (sem dado de exemplo). Fonte
// real que falha fica vazia, com aviso. Todas exigem acesso ao módulo.

/** Meta Ads e Google Ads, dia a dia; TikTok Ads vazio (não ligado). */
export async function dadosAnuncios(ctx: Contexto): Promise<DadosAnuncios> {
  exigirModulo(ctx);
  const [meta, google] = await Promise.all([
    anunciosMeta(ctx),
    anunciosGoogle(ctx),
  ]);
  const dadosMeta = meta.ok
    ? meta.dados
    : { campanhas: [], insights: [], quebras: [] };
  const dadosGoogle = google.ok ? google.dados : { linhas: [], termos: [] };
  // As linhas são por campanha e dia: uma entrada por campanha.
  const doGoogle = new Map(
    dadosGoogle.linhas.map((l) => [l.campaign.id, l.campaign]),
  );
  return {
    meta: dadosMeta,
    google: dadosGoogle,
    tiktok: { campanhas: [], linhas: [] },
    campanhas: [
      ...dadosMeta.campanhas.map((c) => ({
        id: c.campaign_id,
        plataforma: "meta" as const,
        nome: c.campaign_name,
        tipo: c.objective,
        situacao: c.effective_status,
      })),
      ...[...doGoogle.values()].map((c) => ({
        id: c.id,
        plataforma: "google" as const,
        nome: c.name,
        tipo: c.advertising_channel_type,
        situacao: c.status,
      })),
    ],
    metaReal: meta.ok,
    ...(meta.ok ? {} : { avisoMeta: meta.aviso }),
    googleReal: google.ok,
    ...(google.ok ? {} : { avisoGoogle: google.aviso }),
  };
}

/**
 * RD Station: contatos, conversões e landing pages, depois da primeira
 * sincronização; antes dela, vazio (sem lidoEm).
 */
export async function dadosRd(ctx: Contexto): Promise<DadosRd> {
  exigirModulo(ctx);
  return (
    (await rdReal(ctx)) ?? { contatos: [], conversoes: [], landingPages: [] }
  );
}

/** Leads para o custo por lead dos anúncios: os mesmos do RD. */
export const dadosRdDosAnuncios = dadosRd;

/** Google Analytics 4 e Search Console (reais). */
export async function dadosSite(ctx: Contexto): Promise<DadosSite> {
  exigirModulo(ctx);
  const site = await siteGoogle(ctx);
  return site.ok
    ? { ...site.dados, siteReal: true }
    : { ga4: [], buscas: [], siteReal: false, avisoSite: site.aviso };
}

/** Instagram e Facebook (reais, da Meta); YouTube e TikTok vazios (não ligados). */
export async function dadosRedes(ctx: Contexto): Promise<DadosRedes> {
  exigirModulo(ctx);
  const meta = await redesMeta(ctx);
  return {
    instagram: meta.ok
      ? meta.dados.instagram
      : { dias: [], posts: [], demografia: [] },
    facebook: meta.ok ? meta.dados.facebook : { dias: [] },
    youtube: {
      canal: { subscriberCount: 0, viewCount: 0, videoCount: 0 },
      dias: [],
      videos: [],
    },
    tiktok: { dias: [], videos: [] },
    metaReal: meta.ok,
    ...(meta.aviso ? { avisoMeta: meta.aviso } : {}),
  };
}

/** Google Perfil da Empresa: ainda não ligado, vem vazio. */
export function dadosReputacao(ctx: Contexto): DadosReputacao {
  exigirModulo(ctx);
  return { locais: [], avaliacoes: [], temas: [] };
}
