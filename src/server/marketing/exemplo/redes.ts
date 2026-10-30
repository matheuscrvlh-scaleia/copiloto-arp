import type {
  TikTokContaDia,
  TikTokVideo,
  YoutubeCanal,
  YoutubeDia,
  YoutubeVideo,
} from "@/lib/marketing/fontes";
import { diaDaSemana, somarDias } from "@/lib/marketing/periodo";
import { JANELA_DIAS } from "./anuncios";
import { sorteio } from "./sorteio";

// Redes de exemplo do YouTube e do TikTok (Instagram e Facebook são reais:
// server/marketing/meta.ts): foto diária de seguidores, métricas por dia e
// vídeos. Saem daqui quando Google e TikTok forem ligados.

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

export interface RedesDeExemplo {
  youtube: { canal: YoutubeCanal; dias: YoutubeDia[]; videos: YoutubeVideo[] };
  tiktok: { dias: TikTokContaDia[]; videos: TikTokVideo[] };
}

export function gerarRedes(hoje: string): RedesDeExemplo {
  const out: RedesDeExemplo = {
    youtube: {
      canal: { subscriberCount: 0, viewCount: 0, videoCount: 0 },
      dias: [],
      videos: [],
    },
    tiktok: { dias: [], videos: [] },
  };
  // Seguidores no começo da janela.
  let yt = 1_236;
  let tt = 3_870;
  let ytViews = 186_400;
  let ytVideos = 94;

  for (let i = 0; i < JANELA_DIAS; i++) {
    const data = somarDias(hoje, i - JANELA_DIAS);
    const d = diaDaSemana(data);
    const fds = d === 0 || d === 6 ? 1.35 : 1;
    const s = sorteio(`redes:${data}`);

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

  return out;
}
