import type {
  FacebookDia,
  InstagramDemografia,
  InstagramDia,
  InstagramPost,
  Rede,
  TikTokContaDia,
  TikTokVideo,
  YoutubeCanal,
  YoutubeDia,
  YoutubeVideo,
} from "./fontes";
import { dentro, type PeriodoMkt, somarDias } from "./periodo";

// Redes sociais (spec 4.7): uma linha por rede com seguidores, alcance e
// interações das contas orgânicas da ARP, e os posts do período. As APIs só
// dão o número de seguidores de hoje: o sistema guarda uma foto por dia e o
// histórico começa no dia da ligação. O Facebook não entrega mais alcance
// nem interações da página de forma estável: fica em branco, nunca zero nem
// estimado. Demografia é dos seguidores do Instagram, não de visitantes.

type Periodo = Pick<PeriodoMkt, "de" | "ate">;

export interface FontesRedes {
  instagram: {
    dias: InstagramDia[];
    posts: InstagramPost[];
    demografia: InstagramDemografia[];
  };
  facebook: { dias: FacebookDia[] };
  youtube: { canal: YoutubeCanal; dias: YoutubeDia[]; videos: YoutubeVideo[] };
  tiktok: { dias: TikTokContaDia[]; videos: TikTokVideo[] };
}

export const REDES: Record<
  Rede,
  { rotulo: string; cor: 1 | 2 | 3 | 4; ferramenta: string }
> = {
  instagram: { rotulo: "Instagram", cor: 1, ferramenta: "Instagram" },
  facebook: { rotulo: "Facebook", cor: 2, ferramenta: "Facebook" },
  youtube: { rotulo: "YouTube", cor: 3, ferramenta: "YouTube" },
  tiktok: { rotulo: "TikTok", cor: 4, ferramenta: "TikTok" },
};
export const LISTA_REDES = Object.keys(REDES) as Rede[];

// ---------------------------------------------------------------------------
// Seguidores pela foto diária
// ---------------------------------------------------------------------------

/** Última foto com data até `data` (inclusive); null antes do histórico. */
function fotoAte<T extends { date: string; followers_count: number }>(
  dias: T[],
  data: string,
): number | null {
  let melhor: T | null = null;
  for (const d of dias)
    if (d.date <= data && (!melhor || d.date > melhor.date)) melhor = d;
  return melhor ? melhor.followers_count : null;
}

/**
 * Seguidores da rede no fim do dia `data`. YouTube: o canal dá o número de
 * hoje e o Analytics os ganhos e perdas por dia; volta-se de hoje até a data.
 */
export function seguidoresEm(
  f: FontesRedes,
  rede: Rede,
  data: string,
): number | null {
  switch (rede) {
    case "instagram":
      return fotoAte(f.instagram.dias, data);
    case "facebook":
      return fotoAte(f.facebook.dias, data);
    case "tiktok":
      return fotoAte(f.tiktok.dias, data);
    case "youtube": {
      const dias = f.youtube.dias;
      if (!dias.some((d) => d.day <= data)) return null;
      const depois = dias
        .filter((d) => d.day > data)
        .reduce((s, d) => s + d.subscribersGained - d.subscribersLost, 0);
      return f.youtube.canal.subscriberCount - depois;
    }
  }
}

// ---------------------------------------------------------------------------
// Quadro 1: por rede
// ---------------------------------------------------------------------------

export interface RedeLinha {
  rede: Rede;
  rotulo: string;
  /** No fim do período (foto diária). */
  seguidores: number | null;
  /** Fim − início do período (YouTube: ganhos − perdas). */
  novos: number | null;
  /** O histórico começou dentro do período: "novos" conta só desde a 1ª foto. */
  parcial: boolean;
  /** Só Instagram (reach). */
  alcance: number | null;
  /** Instagram views · YouTube views · TikTok video_views. Facebook: null. */
  visualizacoes: number | null;
  /** Facebook: null (a Meta não entrega). */
  interacoes: number | null;
  /** Interações ÷ alcance (ou visualizações), em %. */
  taxa: number | null;
  /** Qual número entrou no denominador da taxa. */
  base: "alcance" | "visualizações" | null;
}

function novosPorFoto<T extends { date: string; followers_count: number }>(
  dias: T[],
  p: Periodo,
): { novos: number | null; parcial: boolean } {
  const fim = fotoAte(dias, p.ate);
  const inicio = fotoAte(dias, somarDias(p.de, -1));
  if (fim === null) return { novos: null, parcial: false };
  if (inicio !== null) return { novos: fim - inicio, parcial: false };
  // Histórico começou no meio do período: conta desde a primeira foto.
  const primeira = dias
    .filter((d) => dentro(d.date, p))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return primeira
    ? { novos: fim - primeira.followers_count, parcial: true }
    : { novos: null, parcial: false };
}

const soma = <T>(ls: T[], v: (x: T) => number) =>
  ls.reduce((s, x) => s + v(x), 0);

const taxaDe = (interacoes: number | null, base: number | null) =>
  interacoes !== null && base ? (interacoes / base) * 100 : null;

export function linhaDaRede(f: FontesRedes, rede: Rede, p: Periodo): RedeLinha {
  const rotulo = REDES[rede].rotulo;
  const seguidores = seguidoresEm(f, rede, p.ate);
  switch (rede) {
    case "instagram": {
      const dias = f.instagram.dias.filter((d) => dentro(d.date, p));
      const tem = dias.length > 0;
      const alcance = tem ? soma(dias, (d) => d.reach) : null;
      const interacoes = tem ? soma(dias, (d) => d.total_interactions) : null;
      return {
        rede,
        rotulo,
        seguidores,
        ...novosPorFoto(f.instagram.dias, p),
        alcance,
        visualizacoes: tem ? soma(dias, (d) => d.views) : null,
        interacoes,
        taxa: taxaDe(interacoes, alcance),
        base: "alcance",
      };
    }
    case "facebook":
      // Só seguidores: alcance e interações da página não vêm mais (spec 4.7).
      return {
        rede,
        rotulo,
        seguidores,
        ...novosPorFoto(f.facebook.dias, p),
        alcance: null,
        visualizacoes: null,
        interacoes: null,
        taxa: null,
        base: null,
      };
    case "youtube": {
      const dias = f.youtube.dias.filter((d) => dentro(d.day, p));
      const tem = dias.length > 0;
      const videos = f.youtube.videos.filter((v) => dentro(v.publishedAt, p));
      const visualizacoes = tem ? soma(dias, (d) => d.views) : null;
      // Curtidas + comentários dos vídeos publicados no período.
      const interacoes = tem
        ? soma(videos, (v) => v.likeCount + v.commentCount)
        : null;
      return {
        rede,
        rotulo,
        seguidores,
        novos: tem
          ? soma(dias, (d) => d.subscribersGained - d.subscribersLost)
          : null,
        parcial: false,
        alcance: null,
        visualizacoes,
        interacoes,
        taxa: taxaDe(interacoes, visualizacoes),
        base: "visualizações",
      };
    }
    case "tiktok": {
      const dias = f.tiktok.dias.filter((d) => dentro(d.date, p));
      const tem = dias.length > 0;
      const visualizacoes = tem ? soma(dias, (d) => d.video_views) : null;
      const interacoes = tem
        ? soma(dias, (d) => d.likes + d.comments + d.shares)
        : null;
      return {
        rede,
        rotulo,
        seguidores,
        ...novosPorFoto(f.tiktok.dias, p),
        alcance: null,
        visualizacoes,
        interacoes,
        taxa: taxaDe(interacoes, visualizacoes),
        base: "visualizações",
      };
    }
  }
}

export function linhasPorRede(
  f: FontesRedes,
  p: Periodo,
  redes: Rede[] = LISTA_REDES,
): RedeLinha[] {
  return redes.map((r) => linhaDaRede(f, r, p));
}

export interface TotaisRedes {
  seguidores: number;
  novos: number;
  /** Instagram pelo alcance; YouTube e TikTok pelas visualizações. */
  alcanceEVisualizacoes: number;
  interacoes: number;
  /** Interações ÷ alcance e visualizações das redes que têm os dois. */
  taxa: number | null;
}

/** Soma das redes; Facebook entra só nos seguidores (o resto é branco). */
export function somarRedes(ls: RedeLinha[]): TotaisRedes {
  let base = 0;
  let interacoesComBase = 0;
  for (const l of ls) {
    const b = l.alcance ?? l.visualizacoes;
    if (b !== null && l.interacoes !== null) {
      base += b;
      interacoesComBase += l.interacoes;
    }
  }
  return {
    seguidores: soma(ls, (l) => l.seguidores ?? 0),
    novos: soma(ls, (l) => l.novos ?? 0),
    alcanceEVisualizacoes: soma(ls, (l) => l.alcance ?? l.visualizacoes ?? 0),
    interacoes: soma(ls, (l) => l.interacoes ?? 0),
    taxa: base ? (interacoesComBase / base) * 100 : null,
  };
}

// ---------------------------------------------------------------------------
// Quadro 2: posts do período
// ---------------------------------------------------------------------------

export type TipoPost = "reels" | "carrossel" | "imagem" | "video";

export const TIPOS_POST: Record<TipoPost, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  imagem: "Imagem",
  video: "Vídeo",
};

/** media_type + media_product_type do Instagram → tipo do post. */
export function tipoDoInstagram(mediaType: string, produto: string): TipoPost {
  if (produto === "REELS") return "reels";
  if (mediaType === "CAROUSEL_ALBUM") return "carrossel";
  if (mediaType === "IMAGE") return "imagem";
  return "video";
}

export interface PostLinha {
  id: string;
  rede: Rede;
  /** ISO da publicação (timestamp / publishedAt / create_time). */
  data: string;
  tipo: TipoPost;
  /** Legenda ou título. */
  texto: string;
  /** "Abrir no Instagram"… */
  link: string;
  /** Só Instagram. */
  alcance: number | null;
  visualizacoes: number | null;
  curtidas: number;
  /** TikTok: não vem por vídeo nos campos usados. */
  comentarios: number | null;
  /** Instagram; YouTube e TikTok não entregam por vídeo nos campos usados. */
  compartilhamentos: number | null;
  /** Só Instagram. */
  salvos: number | null;
  /** Soma do que a rede entrega por post. */
  interacoes: number;
}

export function postsDoPeriodo(
  f: FontesRedes,
  p: Periodo,
  filtro: { redes?: Rede[]; tipo?: string } = {},
): PostLinha[] {
  const redes = filtro.redes ?? LISTA_REDES;
  const out: PostLinha[] = [];
  if (redes.includes("instagram"))
    for (const x of f.instagram.posts) {
      if (!dentro(x.timestamp, p)) continue;
      out.push({
        id: x.id,
        rede: "instagram",
        data: x.timestamp,
        tipo: tipoDoInstagram(x.media_type, x.media_product_type),
        texto: x.caption,
        link: x.permalink,
        alcance: x.reach,
        visualizacoes: x.views,
        curtidas: x.like_count,
        comentarios: x.comments_count,
        compartilhamentos: x.shares,
        salvos: x.saved,
        interacoes: x.like_count + x.comments_count + x.shares + x.saved,
      });
    }
  if (redes.includes("youtube"))
    for (const v of f.youtube.videos) {
      if (!dentro(v.publishedAt, p)) continue;
      out.push({
        id: v.id,
        rede: "youtube",
        data: v.publishedAt,
        tipo: "video",
        texto: v.title,
        link: `https://www.youtube.com/watch?v=${encodeURIComponent(v.id)}`,
        alcance: null,
        visualizacoes: v.viewCount,
        curtidas: v.likeCount,
        comentarios: v.commentCount,
        compartilhamentos: null,
        salvos: null,
        interacoes: v.likeCount + v.commentCount,
      });
    }
  if (redes.includes("tiktok"))
    for (const v of f.tiktok.videos) {
      if (!dentro(v.create_time, p)) continue;
      out.push({
        id: v.id,
        rede: "tiktok",
        data: v.create_time,
        tipo: "video",
        texto: v.title,
        link: v.share_url,
        alcance: null,
        visualizacoes: v.view_count,
        curtidas: v.like_count,
        comentarios: null,
        compartilhamentos: null,
        salvos: null,
        interacoes: v.like_count,
      });
    }
  return out
    .filter((x) => !filtro.tipo || x.tipo === filtro.tipo)
    .sort(
      (a, b) => b.interacoes - a.interacoes || b.data.localeCompare(a.data),
    );
}

/**
 * Engajamento ÷ alcance por tipo de conteúdo do Instagram (o único com
 * alcance por post): soma das interações ÷ soma do alcance, em %.
 */
export function engajamentoPorTipo(
  posts: PostLinha[],
): { tipo: TipoPost; posts: number; alcance: number; taxa: number }[] {
  const mapa = new Map<
    TipoPost,
    { posts: number; alcance: number; int: number }
  >();
  for (const x of posts) {
    if (x.rede !== "instagram" || x.alcance === null) continue;
    const t = mapa.get(x.tipo) ?? { posts: 0, alcance: 0, int: 0 };
    t.posts++;
    t.alcance += x.alcance;
    t.int += x.interacoes;
    mapa.set(x.tipo, t);
  }
  return [...mapa.entries()]
    .filter(([, t]) => t.alcance > 0)
    .map(([tipo, t]) => ({
      tipo,
      posts: t.posts,
      alcance: t.alcance,
      taxa: (t.int / t.alcance) * 100,
    }))
    .sort((a, b) => b.taxa - a.taxa);
}

// ---------------------------------------------------------------------------
// Quadro 3: onde estão os seguidores do Instagram
// ---------------------------------------------------------------------------

export const DEMOGRAFIA = {
  titulo: "Onde estão os seguidores do Instagram",
  aviso:
    "Seguidores do Instagram, não visitantes: mostra quem segue a conta, não quem vai ao Espaço ARP.",
};

export function demografiaInstagram(f: FontesRedes): {
  cidades: { nome: string; seguidores: number }[];
  idades: { faixa: string; seguidores: number }[];
} {
  const de = (b: "city" | "age") =>
    f.instagram.demografia.filter((d) => d.breakdown === b);
  return {
    cidades: de("city")
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((d) => ({ nome: d.dimension_value, seguidores: d.value })),
    // Faixas na ordem natural da idade.
    idades: de("age")
      .sort((a, b) => a.dimension_value.localeCompare(b.dimension_value))
      .map((d) => ({ faixa: d.dimension_value, seguidores: d.value })),
  };
}

// ---------------------------------------------------------------------------
// Gráfico e exportação
// ---------------------------------------------------------------------------

/** Seguidores no fim de cada semana; null antes do histórico. */
export function seguidoresPorSemana(
  f: FontesRedes,
  rede: Rede,
  semanas: { ate: string }[],
): (number | null)[] {
  return semanas.map((s) => seguidoresEm(f, rede, s.ate));
}

export type CelulaRedes = string | number | null;

/** "2026-10-20T19:00:00-03:00" → "20/10/2026". */
const dataDoPost = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/**
 * Relatório "Redes sociais do período": Quadro 1 e Quadro 2 na mesma
 * planilha. O cabeçalho do arquivo é o do Quadro 1; o Quadro 2 vem depois,
 * com título e cabeçalho em linhas próprias (por isso nenhuma coluna é
 * "número": a mesma coluna leva texto e número).
 */
export const COLUNAS_EXPORTAR_REDES = [
  { titulo: "Rede" },
  { titulo: "Seguidores" },
  { titulo: "Novos no período" },
  { titulo: "Alcance" },
  { titulo: "Visualizações" },
  { titulo: "Interações" },
  { titulo: "Taxa de interação (%)" },
  { titulo: "" },
  { titulo: "" },
  { titulo: "" },
  { titulo: "" },
];

export function linhasExportarRedes(
  redes: RedeLinha[],
  total: TotaisRedes,
  posts: PostLinha[],
): CelulaRedes[][] {
  const vazio = (n: number) => Array<CelulaRedes>(n).fill("");
  const out: CelulaRedes[][] = [];
  for (const l of redes)
    out.push([
      l.rotulo,
      l.seguidores,
      l.novos,
      l.alcance,
      l.visualizacoes,
      l.interacoes,
      r1(l.taxa),
      ...vazio(4),
    ]);
  out.push([
    "Total",
    total.seguidores,
    total.novos,
    null,
    null,
    total.interacoes,
    r1(total.taxa),
    ...vazio(4),
  ]);
  out.push(vazio(11));
  out.push(["Posts do período (por interações)", ...vazio(10)]);
  out.push([
    "Data",
    "Rede",
    "Tipo",
    "Post",
    "Link",
    "Alcance",
    "Visualizações",
    "Curtidas",
    "Comentários",
    "Compartilhamentos",
    "Salvos",
  ]);
  for (const x of posts)
    out.push([
      dataDoPost(x.data),
      REDES[x.rede].rotulo,
      TIPOS_POST[x.tipo],
      x.texto,
      x.link,
      x.alcance,
      x.visualizacoes,
      x.curtidas,
      x.comentarios,
      x.compartilhamentos,
      x.salvos,
    ]);
  return out;
}

// ---------------------------------------------------------------------------
// Resumo para o Painel do Marketing
// ---------------------------------------------------------------------------

export function resumoRedes(
  f: FontesRedes,
  p: Periodo,
  redes: Rede[] = LISTA_REDES,
): TotaisRedes {
  return somarRedes(linhasPorRede(f, p, redes));
}
