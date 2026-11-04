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
import { type DadosSite, gerarSite } from "./exemplo/site";
import { anunciosMeta, redesMeta } from "./meta";
import { rdReal } from "./rd";

// Dados das ferramentas, nos campos das APIs (lib/marketing/fontes.ts).
// Reais: Meta (anúncios, Instagram e Facebook), RD Station e Asana. Ainda
// de exemplo (mockup, spec seção 6), até serem ligados: Google (Ads,
// YouTube, GA4, Search Console, Perfil da Empresa) e TikTok. Nas telas, os
// reais e os de exemplo se somam. As telas conferem a permissão (Protegido)
// antes de chamar; nada daqui vai para o navegador sem passar pela tela.

const anunciosDoDia = memo(gerarAnuncios);
const rdDoDia = memo((hoje) => gerarRd(hoje, anunciosDoDia(hoje)));
const siteDoDia = memo((hoje) => gerarSite(hoje, anunciosDoDia(hoje)));
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
}

/** Meta Ads (real) com Google Ads e TikTok Ads (de exemplo), dia a dia. */
export const dadosAnuncios = cache(async (): Promise<DadosAnuncios> => {
  const [exemplo, meta] = await Promise.all([
    hoje().then(anunciosDoDia),
    anunciosMeta(),
  ]);
  const dadosMeta = meta.ok
    ? meta.dados
    : { campanhas: [], insights: [], quebras: [] };
  return {
    meta: dadosMeta,
    google: exemplo.google,
    tiktok: exemplo.tiktok,
    campanhas: [
      ...dadosMeta.campanhas.map((c) => ({
        id: c.campaign_id,
        plataforma: "meta" as const,
        nome: c.campaign_name,
        tipo: c.objective,
        situacao: c.effective_status,
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
 * campanha): os reais do RD casam com as campanhas reais da Meta; os de
 * exemplo entram só nas campanhas de exemplo do Google e do TikTok. Lead
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

/** Google Analytics 4 e Search Console. */
export const dadosSite = cache(
  async (): Promise<DadosSite> => siteDoDia(await hoje()),
);

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
