import "server-only";
import { cache } from "react";
import type { FontesAnuncios, Plataforma } from "@/lib/marketing/anuncios";
import type { FontesRedes } from "@/lib/marketing/redes";
import { memo } from "@/lib/sorteio";
import { contextoMkt, locatarios, temasEcodigos } from "./base";
import { gerarAnuncios } from "./exemplo/anuncios";
import { type DadosRd, gerarRd } from "./exemplo/rd";
import { gerarRedes } from "./exemplo/redes";
import { type DadosReputacao, gerarReputacao } from "./exemplo/reputacao";
import { anunciosGoogle, type SiteGoogle, siteGoogle } from "./google";
import { anunciosMeta, redesMeta } from "./meta";
import { rdReal } from "./rd";

// Dados das ferramentas, nos campos das APIs (lib/marketing/fontes.ts).
// Reais: Meta (anúncios, Instagram e Facebook), Google (Ads, GA4 e Search
// Console), RD Station e Asana. Ainda de exemplo (mockup, spec seção 6), até
// serem ligados: YouTube, Perfil da Empresa e TikTok. Nas telas, os reais e
// os de exemplo se somam. Fonte real que falha fica vazia, com aviso: nunca
// volta ao exemplo. As telas conferem a permissão (Protegido)
// antes de chamar; nada daqui vai para o navegador sem passar pela tela.

const anunciosDoDia = memo(gerarAnuncios);
const rdDoDia = memo((hoje) => gerarRd(hoje, anunciosDoDia(hoje)));
const redesDoDia = memo(gerarRedes);
const reputacaoDoDia = memo((chave) => {
  const { hoje, locais, temas } = JSON.parse(chave) as {
    hoje: string;
    locais: Parameters<typeof gerarReputacao>[1];
    temas: string[];
  };
  return gerarReputacao(hoje, locais, temas);
});

async function hoje() {
  return (await contextoMkt()).hoje;
}

export interface CampanhaRef {
  id: string;
  plataforma: Plataforma;
  nome: string;
  /** objective, advertising_channel_type ou objective_type. */
  tipo: string;
  situacao: string | null;
}

export interface DadosAnuncios extends FontesAnuncios {
  /** As campanhas das três plataformas (detalhe da campanha). */
  campanhas: CampanhaRef[];
  /** A Meta foi lida da API (senão, Meta fica vazia e avisoMeta diz por quê). */
  metaReal: boolean;
  avisoMeta?: string;
  /** O Google Ads foi lido da API (senão, fica vazio e avisoGoogle diz por quê). */
  googleReal: boolean;
  avisoGoogle?: string;
}

/** Meta Ads e Google Ads (reais) com TikTok Ads (de exemplo), dia a dia. */
export const dadosAnuncios = cache(async (): Promise<DadosAnuncios> => {
  const [exemplo, meta, google] = await Promise.all([
    hoje().then(anunciosDoDia),
    anunciosMeta(),
    anunciosGoogle(),
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
    tiktok: exemplo.tiktok,
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
      ...exemplo.campanhas.map(({ id, plataforma, nome, tipo, situacao }) => ({
        id,
        plataforma,
        nome,
        tipo,
        situacao,
      })),
    ],
    metaReal: meta.ok,
    ...(meta.ok ? {} : { avisoMeta: meta.aviso }),
    googleReal: google.ok,
    ...(google.ok ? {} : { avisoGoogle: google.aviso }),
  };
});

/**
 * RD Station: contatos, conversões e landing pages. Os reais (com lidoEm)
 * depois da primeira sincronização; antes dela, os de exemplo.
 */
export const dadosRd = cache(
  async (): Promise<DadosRd> => (await rdReal()) ?? rdDoDia(await hoje()),
);

/**
 * Leads para o custo por lead dos anúncios (traffic_campaign = nome da
 * campanha): os reais do RD casam com as campanhas reais da Meta e do Google;
 * os de exemplo entram só nas campanhas de exemplo do TikTok. Lead
 * real com investimento de exemplo daria um custo por lead que não existe.
 */
export const dadosRdDosAnuncios = cache(async (): Promise<DadosRd> => {
  const h = await hoje();
  const [real, exemplo] = [await rdReal(), rdDoDia(h)];
  const deExemplo = new Set(anunciosDoDia(h).campanhas.map((c) => c.nome));
  const conversoes = exemplo.conversoes.filter((c) =>
    deExemplo.has(c.traffic_campaign),
  );
  if (!real) return { ...exemplo, conversoes };
  return {
    ...real,
    conversoes: [...real.conversoes, ...conversoes].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
  };
});

export interface DadosSite extends SiteGoogle {
  /** O GA4 foi lido da API (senão, fica vazio e avisoSite diz por quê). */
  siteReal: boolean;
  avisoSite?: string;
}

/** Google Analytics 4 e Search Console (reais). */
export const dadosSite = cache(async (): Promise<DadosSite> => {
  const site = await siteGoogle();
  return site.ok
    ? { ...site.dados, siteReal: true }
    : { ga4: [], buscas: [], siteReal: false, avisoSite: site.aviso };
});

export interface DadosRedes extends FontesRedes {
  /** Instagram e Facebook lidos da Meta (senão, vazios e avisoMeta diz por quê). */
  metaReal: boolean;
  avisoMeta?: string;
}

/**
 * Instagram e Facebook (reais, da Meta) com YouTube e TikTok (de exemplo),
 * das contas da ARP.
 */
export const dadosRedes = cache(async (): Promise<DadosRedes> => {
  const [exemplo, meta] = await Promise.all([
    hoje().then(redesDoDia),
    redesMeta(),
  ]);
  return {
    instagram: meta.ok
      ? meta.dados.instagram
      : { dias: [], posts: [], demografia: [] },
    facebook: meta.ok ? meta.dados.facebook : { dias: [] },
    youtube: exemplo.youtube,
    tiktok: exemplo.tiktok,
    metaReal: meta.ok,
    ...(meta.aviso ? { avisoMeta: meta.aviso } : {}),
  };
});

/** Asana: lido ao vivo (asana.ts), não é de exemplo. */
export { dadosAsana } from "./asana";

/**
 * Google Perfil da Empresa: a ARP e os locatários ativos de Configurações, com
 * o tema de cada avaliação na lista cadastrada.
 */
export const dadosReputacao = cache(async (): Promise<DadosReputacao> => {
  const [h, lista, { temas }] = await Promise.all([
    hoje(),
    locatarios(),
    temasEcodigos(),
  ]);
  return reputacaoDoDia(
    JSON.stringify({
      hoje: h,
      locais: lista
        .filter((l) => l.ativo)
        .map((l) => ({
          id: l.id,
          nome: l.nome,
          forma_acesso: l.forma_acesso,
          perfil_url: l.perfil_url,
        })),
      temas: temas.filter((t) => t.ativo).map((t) => t.nome),
    }),
  );
});
