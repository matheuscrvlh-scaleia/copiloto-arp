import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { mensagemSegura } from "@/connectors/http";
import type {
  FacebookDia,
  InstagramDemografia,
  InstagramDia,
  InstagramPost,
  MetaCampanha,
  MetaInsight,
  MetaQuebra,
} from "@/lib/marketing/fontes";
import { somarDias } from "@/lib/marketing/periodo";
import { TAG } from "../cache";
import { IntegracaoNaoConfigurada, meta } from "../integracoes";
import { contextoMkt, mkt } from "./base";

// Meta com dados reais. Anúncios, posts e demografia do Instagram são lidos
// ao vivo da API e guardados no cache por uma hora (ou até alguém salvar,
// testar ou sincronizar a integração: updateTag). Seguidores e métricas
// diárias vêm da foto que a sincronização grava (server/sync/meta.ts).
// Tudo agregado da conta, sem dado pessoal.

/** 18 semanas: a janela do módulo. */
const JANELA_DIAS = 126;

export interface AnunciosMeta {
  campanhas: MetaCampanha[];
  insights: MetaInsight[];
  quebras: MetaQuebra[];
}

/** O que a Meta entregou, ou por que não entregou (aviso para a tela). */
export type Leitura<T> =
  | { ok: true; dados: T; lidoEm: string; aviso?: string }
  | { ok: false; aviso: string };

async function exigirModulo() {
  const ctx = await contextoMkt();
  if (!ctx.usuario.permissoes.some((p) => p.startsWith("marketing.")))
    throw new Error("Sem acesso ao módulo Marketing.");
  return ctx;
}

function avisoDe(erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada) return erro.message;
  console.error("leitura da meta", erro);
  return `A Meta não respondeu: ${mensagemSegura(erro).slice(0, 160)}`;
}

async function lerAnuncios(hoje: string): Promise<AnunciosMeta | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.marketing.meta);
  const { api, contaDeAnuncios: conta } = await meta();
  if (!conta) return null;
  const de = somarDias(hoje, -JANELA_DIAS);
  const [insights, plataformas, estados] = await Promise.all([
    api.insights(conta, de, hoje),
    api.quebras(conta, de, hoje, "publisher_platform"),
    api.quebras(conta, de, hoje, "region"),
  ]);
  const ids = [...new Set(insights.map((i) => i.campaign_id))];
  const campanhas = ids.length ? await api.campanhas(conta, ids) : [];
  return { campanhas, insights, quebras: [...plataformas, ...estados] };
}

/** Meta Ads das últimas 18 semanas. */
export async function anunciosMeta(): Promise<Leitura<AnunciosMeta>> {
  const { hoje } = await exigirModulo();
  try {
    const dados = await lerAnuncios(hoje);
    if (!dados)
      return {
        ok: false,
        aviso: "Meta: falta o id da conta de anúncios em Integrações.",
      };
    return { ok: true, dados, lidoEm: new Date().toISOString() };
  } catch (erro) {
    return { ok: false, aviso: avisoDe(erro) };
  }
}

export interface RedesMeta {
  instagram: {
    dias: InstagramDia[];
    posts: InstagramPost[];
    demografia: InstagramDemografia[];
  };
  facebook: { dias: FacebookDia[] };
}

async function lerInstagram(hoje: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(TAG.marketing.meta);
  const { api, instagram } = await meta();
  if (!instagram) return { posts: [], demografia: [] };
  const [posts, demografia] = await Promise.all([
    api.instagramPosts(instagram, somarDias(hoje, -JANELA_DIAS)),
    api.instagramDemografia(instagram),
  ]);
  return { posts, demografia };
}

/** Quando a última sincronização da Meta terminou; null se nunca rodou. */
async function ultimaFoto(): Promise<string | null> {
  const { data, error } = await (await mkt())
    .from("redes_dia")
    .select("atualizado_em")
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler as redes: ${error.message}`);
  return data?.atualizado_em ?? null;
}

/**
 * Instagram e Facebook: a foto diária gravada (com a sessão: RLS) e os posts
 * e a demografia ao vivo. Sem foto ainda, avisa para sincronizar.
 */
export async function redesMeta(): Promise<Leitura<RedesMeta>> {
  const { hoje } = await exigirModulo();
  const lidoEm = await ultimaFoto();
  if (!lidoEm)
    return {
      ok: false,
      aviso:
        "Instagram e Facebook: a primeira leitura ainda não rodou (Integrações › Meta › Sincronizar agora).",
    };
  const { data, error } = await (await mkt())
    .from("redes_dia")
    .select(
      "rede, dia, seguidores, alcance, visualizacoes, interacoes, contas_engajadas, toques_links",
    )
    .gte("dia", somarDias(hoje, -JANELA_DIAS))
    .order("dia");
  if (error) throw new Error(`Falha ao ler as redes: ${error.message}`);

  const dados: RedesMeta = {
    instagram: { dias: [], posts: [], demografia: [] },
    facebook: { dias: [] },
  };
  for (const d of data) {
    if (d.rede === "facebook") {
      if (d.seguidores !== null)
        dados.facebook.dias.push({
          date: d.dia,
          followers_count: d.seguidores,
        });
      continue;
    }
    dados.instagram.dias.push({
      date: d.dia,
      followers_count: d.seguidores,
      reach: d.alcance,
      views: d.visualizacoes,
      accounts_engaged: d.contas_engajadas,
      total_interactions: d.interacoes,
      profile_links_taps: d.toques_links,
    });
  }
  try {
    Object.assign(dados.instagram, await lerInstagram(hoje));
  } catch (erro) {
    // Seguidores e métricas valem mesmo sem os posts.
    return { ok: true, dados, lidoEm, aviso: avisoDe(erro) };
  }
  return { ok: true, dados, lidoEm };
}
