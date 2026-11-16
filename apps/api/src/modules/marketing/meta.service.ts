import type {
  FacebookDia,
  InstagramDemografia,
  InstagramDia,
  InstagramPost,
  MetaCampanha,
  MetaInsight,
  MetaQuebra,
} from "@arp/shared/marketing/fontes";
import { somarDias } from "@arp/shared/marketing/periodo";
import { mensagemSegura } from "@/connectors/http";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  IntegracaoNaoConfigurada,
  meta,
} from "@/modules/sync/credenciais.service";
import { exigirModulo, hoje } from "./acesso";
import * as repo from "./fontes.repository";
import { memoria, VALIDADE_LEITURA } from "./memoria";

// Meta com dados reais. Anúncios, posts e demografia do Instagram são lidos
// ao vivo da API e guardados por uma hora (memoria.ts; ou até alguém salvar,
// testar ou sincronizar a integração: esquecerLeituras("meta")). Seguidores
// e métricas diárias vêm da foto que a sincronização grava. Tudo agregado da
// conta, sem dado pessoal.

/** 18 semanas: a janela do módulo. */
export const JANELA_DIAS = 126;

export interface AnunciosMeta {
  campanhas: MetaCampanha[];
  insights: MetaInsight[];
  quebras: MetaQuebra[];
}

/** O que a ferramenta entregou, ou por que não entregou (aviso para a tela). */
export type Leitura<T> =
  | { ok: true; dados: T; lidoEm: string; aviso?: string }
  | { ok: false; aviso: string };

function avisoDe(erro: unknown): string {
  if (erro instanceof IntegracaoNaoConfigurada) return erro.message;
  log.error({ err: erro }, "leitura da meta");
  return `A Meta não respondeu: ${mensagemSegura(erro).slice(0, 160)}`;
}

/** A falha volta como dado, guardada só por segundos. */
type Lido<T> = { dados: T } | { aviso: string };

const memoriaDosAnuncios = memoria<Lido<AnunciosMeta | null>>("meta");

function lerAnuncios(dia: string): Promise<Lido<AnunciosMeta | null>> {
  return memoriaDosAnuncios(dia, async () => {
    try {
      const { api, contaDeAnuncios: conta } = await meta();
      if (!conta)
        return { valor: { dados: null }, validade: VALIDADE_LEITURA.horas };
      const de = somarDias(dia, -JANELA_DIAS);
      const [insights, plataformas, estados] = await Promise.all([
        api.insights(conta, de, dia),
        api.quebras(conta, de, dia, "publisher_platform"),
        api.quebras(conta, de, dia, "region"),
      ]);
      const ids = [...new Set(insights.map((i) => i.campaign_id))];
      const campanhas = ids.length ? await api.campanhas(conta, ids) : [];
      return {
        valor: {
          dados: { campanhas, insights, quebras: [...plataformas, ...estados] },
        },
        validade: VALIDADE_LEITURA.horas,
      };
    } catch (erro) {
      return {
        valor: { aviso: avisoDe(erro) },
        validade: VALIDADE_LEITURA.segundos,
      };
    }
  });
}

/**
 * Aquece a memória do dia (rotina das 00h10 e das 07h50): a chave tem
 * "hoje", então sem isso a primeira pessoa do dia esperaria a leitura ao vivo.
 */
export async function aquecerMeta(dia: string): Promise<void> {
  await Promise.all([lerAnuncios(dia), lerInstagram(dia)]);
}

/** Meta Ads das últimas 18 semanas. */
export async function anunciosMeta(
  ctx: Contexto,
): Promise<Leitura<AnunciosMeta>> {
  exigirModulo(ctx);
  const lido = await lerAnuncios(hoje());
  if ("aviso" in lido) return { ok: false, aviso: lido.aviso };
  if (!lido.dados)
    return {
      ok: false,
      aviso: "Meta: falta o id da conta de anúncios em Integrações.",
    };
  return { ok: true, dados: lido.dados, lidoEm: new Date().toISOString() };
}

export interface RedesMeta {
  instagram: {
    dias: InstagramDia[];
    posts: InstagramPost[];
    demografia: InstagramDemografia[];
  };
  facebook: { dias: FacebookDia[] };
}

const memoriaDoInstagram =
  memoria<Lido<{ posts: InstagramPost[]; demografia: InstagramDemografia[] }>>(
    "meta",
  );

function lerInstagram(
  dia: string,
): Promise<
  Lido<{ posts: InstagramPost[]; demografia: InstagramDemografia[] }>
> {
  return memoriaDoInstagram(dia, async () => {
    try {
      const { api, instagram } = await meta();
      if (!instagram)
        return {
          valor: { dados: { posts: [], demografia: [] } },
          validade: VALIDADE_LEITURA.horas,
        };
      const [posts, demografia] = await Promise.all([
        api.instagramPosts(instagram, somarDias(dia, -JANELA_DIAS)),
        api.instagramDemografia(instagram),
      ]);
      return {
        valor: { dados: { posts, demografia } },
        validade: VALIDADE_LEITURA.horas,
      };
    } catch (erro) {
      return {
        valor: { aviso: avisoDe(erro) },
        validade: VALIDADE_LEITURA.segundos,
      };
    }
  });
}

/**
 * Instagram e Facebook: a foto diária gravada (com a sessão: RLS) e os posts
 * e a demografia ao vivo. Sem foto ainda, avisa para sincronizar.
 */
export async function redesMeta(ctx: Contexto): Promise<Leitura<RedesMeta>> {
  exigirModulo(ctx);
  const dia = hoje();
  const lidas = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const ultima = await repo.ultimaFotoDasRedes(tx);
    if (!ultima) return null;
    return {
      lidoEm: ultima.atualizado_em,
      linhas: await repo.redesDesde(tx, somarDias(dia, -JANELA_DIAS)),
    };
  });
  if (!lidas)
    return {
      ok: false,
      aviso:
        "Instagram e Facebook: a primeira leitura ainda não rodou (Integrações › Meta › Sincronizar agora).",
    };

  const dados: RedesMeta = {
    instagram: { dias: [], posts: [], demografia: [] },
    facebook: { dias: [] },
  };
  for (const d of lidas.linhas) {
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
  const lido = await lerInstagram(dia);
  // Seguidores e métricas valem mesmo sem os posts.
  if ("aviso" in lido)
    return { ok: true, dados, lidoEm: lidas.lidoEm, aviso: lido.aviso };
  Object.assign(dados.instagram, lido.dados);
  return { ok: true, dados, lidoEm: lidas.lidoEm };
}
