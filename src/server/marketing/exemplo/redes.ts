import type {
  FacebookDia,
  InstagramDemografia,
  InstagramDia,
  InstagramPost,
  TikTokContaDia,
  TikTokVideo,
  YoutubeCanal,
  YoutubeDia,
  YoutubeVideo,
} from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import { JANELA_DIAS } from "./anuncios";
import { sorteio } from "./sorteio";

// Redes de exemplo: foto diária de seguidores (na fase real o histórico
// começa no dia da ligação), métricas por dia e posts. O Facebook só entrega
// seguidores da página de forma estável (spec 4.7).

const LEGENDAS = [
  "Fim de semana na Rua do Relógio: programação completa",
  "1911: a fábrica que virou lugar de ser",
  "Feira autoral com 40 expositores neste sábado",
  "Bastidores do casamento de sábado no galpão",
  "Novas lojas abrindo no térreo",
  "Show acústico ao pôr do sol",
  "Dia dos pets: traga o seu",
  "Oficina de crochê para iniciantes",
  "Roteiro gastronômico do Espaço ARP",
  "108 anos de história em 60 segundos",
  "Feira de Natal: inscrições abertas para expositores",
  "Coworking com vista para a serra",
  "Cinema ao ar livre no pátio",
  "Energia de sexta-feira na Rua do Relógio",
];

export interface DadosRedes {
  instagram: {
    dias: InstagramDia[];
    posts: InstagramPost[];
    demografia: InstagramDemografia[];
  };
  facebook: { dias: FacebookDia[] };
  youtube: { canal: YoutubeCanal; dias: YoutubeDia[]; videos: YoutubeVideo[] };
  tiktok: { dias: TikTokContaDia[]; videos: TikTokVideo[] };
}

export function gerarRedes(hoje: string): DadosRedes {
  const out: DadosRedes = {
    instagram: { dias: [], posts: [], demografia: [] },
    facebook: { dias: [] },
    youtube: {
      canal: { subscriberCount: 0, viewCount: 0, videoCount: 0 },
      dias: [],
      videos: [],
    },
    tiktok: { dias: [], videos: [] },
  };
  // Seguidores no começo da janela.
  let ig = 18_420;
  let fb = 22_130;
  let yt = 1_236;
  let tt = 3_870;
  let midias = 1_412;
  let ytViews = 186_400;
  let ytVideos = 94;

  for (let i = 0; i < JANELA_DIAS; i++) {
    const data = somarDias(hoje, i - JANELA_DIAS);
    const d = diaDaSemana(data);
    const fds = d === 0 || d === 6 ? 1.35 : 1;
    const s = sorteio(`redes:${data}`);

    // Instagram: posts do dia primeiro (movem o alcance).
    const postsHoje = s.chance(d === 1 ? 0.3 : 0.75) ? 1 : 0;
    let alcancePosts = 0;
    for (let k = 0; k < postsHoje; k++) {
      const p = sorteio(`ig-post:${data}:${k}`);
      const tipo = p.pesada([
        [["VIDEO", "REELS"], 5],
        [["CAROUSEL_ALBUM", "FEED"], 3],
        [["IMAGE", "FEED"], 2],
      ] as const);
      const reels = tipo[1] === "REELS";
      const reach = Math.round(p.perto(reels ? 7_800 : 3_900, 0.55));
      const like = Math.round(reach * p.perto(reels ? 0.062 : 0.055, 0.35));
      alcancePosts += reach;
      midias++;
      out.instagram.posts.push({
        id: `ig-${data}-${k}`,
        media_type: tipo[0],
        media_product_type: tipo[1],
        timestamp: `${data}T${String(p.int(11, 20)).padStart(2, "0")}:00:00-03:00`,
        permalink: `https://www.instagram.com/p/exemplo${data.replaceAll("-", "")}${k}/`,
        caption: p.escolha(LEGENDAS),
        like_count: like,
        comments_count: Math.round(like * p.perto(0.06, 0.5)),
        saved: Math.round(
          like * p.perto(tipo[0] === "CAROUSEL_ALBUM" ? 0.22 : 0.09, 0.4),
        ),
        shares: Math.round(like * p.perto(reels ? 0.18 : 0.07, 0.4)),
        reach,
        views: Math.round(reach * p.perto(reels ? 1.9 : 1.35, 0.2)),
      });
    }
    ig += Math.round(s.perto(24 * fds, 0.6) + alcancePosts / 1400);
    const reachIg = Math.round(s.perto(5_200 * fds, 0.25) + alcancePosts * 0.6);
    const interacoes = Math.round(reachIg * s.perto(0.048, 0.2));
    out.instagram.dias.push({
      date: data,
      followers_count: ig,
      media_count: midias,
      reach: reachIg,
      views: Math.round(reachIg * s.perto(2.1, 0.15)),
      accounts_engaged: Math.round(interacoes * s.perto(0.62, 0.1)),
      total_interactions: interacoes,
      profile_links_taps: Math.round(reachIg * s.perto(0.004, 0.3)),
    });

    fb += Math.round(s.perto(3, 0.9));
    out.facebook.dias.push({ date: data, followers_count: fb });

    // YouTube: um vídeo a cada ~2 semanas.
    if (i % 13 === 4) {
      const v = sorteio(`yt:${data}`);
      ytVideos++;
      out.youtube.videos.push({
        id: `yt-${data}`,
        title: v.escolha(LEGENDAS),
        publishedAt: `${data}T18:00:00-03:00`,
        viewCount: Math.round(v.perto(1_400, 0.6)),
        likeCount: Math.round(v.perto(70, 0.5)),
        commentCount: Math.round(v.perto(9, 0.7)),
      });
    }
    const ganhos = s.contagem(2.1 * fds);
    const perdas = s.contagem(0.5);
    yt += ganhos - perdas;
    const views = Math.round(s.perto(380 * fds, 0.3));
    ytViews += views;
    out.youtube.dias.push({
      day: data,
      views,
      estimatedMinutesWatched: Math.round(views * s.perto(1.7, 0.2)),
      averageViewDuration: Math.round(s.perto(104, 0.15)),
      subscribersGained: ganhos,
      subscribersLost: perdas,
    });

    // TikTok: ~3 vídeos por semana.
    let viewsVideos = 0;
    if (s.chance(0.43)) {
      const v = sorteio(`tt:${data}`);
      const view_count = Math.round(v.perto(4_600, 0.75));
      viewsVideos = view_count;
      out.tiktok.videos.push({
        id: `tt-${data}`,
        create_time: `${data}T19:00:00-03:00`,
        title: v.escolha(LEGENDAS),
        share_url: `https://www.tiktok.com/@espacoarp/video/exemplo${data.replaceAll("-", "")}`,
        view_count,
        like_count: Math.round(view_count * v.perto(0.075, 0.35)),
      });
    }
    tt += Math.round(s.perto(9 * fds, 0.7) + viewsVideos / 900);
    const ttViews = Math.round(s.perto(1_900 * fds, 0.3) + viewsVideos * 0.55);
    out.tiktok.dias.push({
      date: data,
      followers_count: tt,
      profile_views: Math.round(ttViews * s.perto(0.035, 0.3)),
      video_views: ttViews,
      likes: Math.round(ttViews * s.perto(0.07, 0.25)),
      comments: Math.round(ttViews * s.perto(0.004, 0.4)),
      shares: Math.round(ttViews * s.perto(0.006, 0.4)),
    });
  }
  out.youtube.canal = {
    subscriberCount: yt,
    viewCount: ytViews,
    videoCount: ytVideos,
  };

  const total = ig;
  const CIDADES = [
    ["Nova Friburgo", 0.43],
    ["Rio de Janeiro", 0.12],
    ["Teresópolis", 0.05],
    ["Petrópolis", 0.04],
    ["Niterói", 0.035],
    ["Cordeiro", 0.025],
    ["Macaé", 0.02],
    ["Bom Jardim", 0.018],
    ["São Paulo", 0.015],
    ["Juiz de Fora", 0.01],
  ] as const;
  for (const [cidade, parte] of CIDADES)
    out.instagram.demografia.push({
      breakdown: "city",
      dimension_value: cidade,
      value: Math.round(total * parte),
    });
  const IDADES = [
    ["13-17", 0.03],
    ["18-24", 0.14],
    ["25-34", 0.33],
    ["35-44", 0.27],
    ["45-54", 0.13],
    ["55-64", 0.07],
    ["65+", 0.03],
  ] as const;
  for (const [faixa, parte] of IDADES)
    out.instagram.demografia.push({
      breakdown: "age",
      dimension_value: faixa,
      value: Math.round(total * parte),
    });
  return out;
}
