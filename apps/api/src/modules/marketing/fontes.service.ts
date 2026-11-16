import type {
  DadosAnuncios,
  DadosRd,
  DadosRedes,
  DadosReputacao,
  DadosSite,
} from "@arp/shared/marketing/contratos/fontes";
import { memo } from "@arp/shared/sorteio";
import type { Contexto } from "@/contexto";
import { exigirModulo, hoje } from "./acesso";
import * as base from "./base.service";
import { gerarAnuncios } from "./exemplo/anuncios";
import { gerarRd } from "./exemplo/rd";
import { gerarRedes } from "./exemplo/redes";
import { gerarReputacao, type LocatarioParaExemplo } from "./exemplo/reputacao";
import { anunciosGoogle, siteGoogle } from "./google.service";
import { anunciosMeta, redesMeta } from "./meta.service";
import { rdReal } from "./rd.service";

// Dados das ferramentas, nos campos das APIs (@arp/shared/marketing/fontes).
// Reais: Meta (anúncios, Instagram e Facebook), Google (Ads, GA4 e Search
// Console), RD Station e Asana (asana.service.ts). Ainda de exemplo
// (mockup, spec seção 6), até serem ligados: YouTube, Perfil da Empresa e
// TikTok. Nas telas, os reais e os de exemplo se somam. Fonte real que
// falha fica vazia, com aviso: nunca volta ao exemplo. Todas exigem acesso
// ao módulo.

const anunciosDoDia = memo(gerarAnuncios);
const rdDoDia = memo((dia) => gerarRd(dia, anunciosDoDia(dia)));
const redesDoDia = memo(gerarRedes);
/** Reputação de exemplo, gerada uma vez por dia, locatários e temas. */
const reputacoes = new Map<string, DadosReputacao>();
function reputacaoDoDia(
  dia: string,
  locais: LocatarioParaExemplo[],
  temas: string[],
): DadosReputacao {
  const chave = JSON.stringify([dia, locais, temas]);
  const pronta = reputacoes.get(chave);
  if (pronta) return pronta;
  if (reputacoes.size > 4) reputacoes.clear();
  const nova = gerarReputacao(dia, locais, temas);
  reputacoes.set(chave, nova);
  return nova;
}

/** Meta Ads e Google Ads (reais) com TikTok Ads (de exemplo), dia a dia. */
export async function dadosAnuncios(ctx: Contexto): Promise<DadosAnuncios> {
  exigirModulo(ctx);
  const [exemplo, meta, google] = await Promise.all([
    anunciosDoDia(hoje()),
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
}

/**
 * RD Station: contatos, conversões e landing pages. Os reais (com lidoEm)
 * depois da primeira sincronização; antes dela, os de exemplo.
 */
export async function dadosRd(ctx: Contexto): Promise<DadosRd> {
  exigirModulo(ctx);
  return (await rdReal(ctx)) ?? rdDoDia(hoje());
}

/**
 * Leads para o custo por lead dos anúncios (traffic_campaign = nome da
 * campanha): os reais do RD casam com as campanhas reais da Meta e do Google;
 * os de exemplo entram só nas campanhas de exemplo do TikTok. Lead
 * real com investimento de exemplo daria um custo por lead que não existe.
 */
export async function dadosRdDosAnuncios(ctx: Contexto): Promise<DadosRd> {
  exigirModulo(ctx);
  const dia = hoje();
  const [real, exemplo] = [await rdReal(ctx), rdDoDia(dia)];
  const deExemplo = new Set(anunciosDoDia(dia).campanhas.map((c) => c.nome));
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
}

/** Google Analytics 4 e Search Console (reais). */
export async function dadosSite(ctx: Contexto): Promise<DadosSite> {
  exigirModulo(ctx);
  const site = await siteGoogle(ctx);
  return site.ok
    ? { ...site.dados, siteReal: true }
    : { ga4: [], buscas: [], siteReal: false, avisoSite: site.aviso };
}

/**
 * Instagram e Facebook (reais, da Meta) com YouTube e TikTok (de exemplo),
 * das contas da ARP.
 */
export async function dadosRedes(ctx: Contexto): Promise<DadosRedes> {
  exigirModulo(ctx);
  const [exemplo, meta] = await Promise.all([
    redesDoDia(hoje()),
    redesMeta(ctx),
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
}

/**
 * Google Perfil da Empresa: a ARP e os locatários ativos de Configurações, com
 * o tema de cada avaliação na lista cadastrada.
 */
export async function dadosReputacao(ctx: Contexto): Promise<DadosReputacao> {
  const lista = await base.locatarios(ctx);
  const { temas } = await base.temasECodigos(ctx);
  return reputacaoDoDia(
    hoje(),
    lista
      .filter((l) => l.ativo)
      .map((l) => ({
        id: l.id,
        nome: l.nome,
        forma_acesso: l.forma_acesso,
        perfil_url: l.perfil_url,
      })),
    temas.filter((t) => t.ativo).map((t) => t.nome),
  );
}
