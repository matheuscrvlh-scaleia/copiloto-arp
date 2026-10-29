import { describe, expect, it } from "vitest";
import {
  DEMOGRAFIA,
  demografiaInstagram,
  type FontesRedes,
  linhaDaRede,
  linhasPorRede,
  postsDoPeriodo,
  resumoRedes,
  seguidoresEm,
} from "./redes";

// Plano de testes do spec (seção 8) para Redes sociais: não chamar seguidores
// do Instagram de visitantes e não inventar alcance do Facebook.

const P = { de: "2026-10-19", ate: "2026-10-25" };

const f: FontesRedes = {
  instagram: {
    dias: [
      dia("2026-10-18", 1000),
      {
        ...dia("2026-10-20", 1010),
        reach: 500,
        views: 900,
        total_interactions: 50,
      },
      {
        ...dia("2026-10-25", 1030),
        reach: 300,
        views: 600,
        total_interactions: 10,
      },
    ],
    posts: [
      {
        id: "p1",
        media_type: "VIDEO",
        media_product_type: "REELS",
        timestamp: "2026-10-21T12:00:00-03:00",
        permalink: "https://www.instagram.com/p/x/",
        caption: "Reels",
        like_count: 10,
        comments_count: 2,
        saved: 1,
        shares: 3,
        reach: 400,
        views: 800,
      },
    ],
    demografia: [
      { breakdown: "city", dimension_value: "Nova Friburgo", value: 400 },
      { breakdown: "age", dimension_value: "25-34", value: 300 },
      { breakdown: "age", dimension_value: "18-24", value: 100 },
    ],
  },
  facebook: {
    dias: [
      { date: "2026-10-18", followers_count: 2000 },
      { date: "2026-10-25", followers_count: 2004 },
    ],
  },
  youtube: {
    canal: { subscriberCount: 110, viewCount: 0, videoCount: 1 },
    dias: [
      yt("2026-10-18", 0, 0, 0),
      yt("2026-10-20", 100, 5, 1),
      yt("2026-10-26", 50, 7, 0),
    ],
    videos: [
      {
        id: "v1",
        title: "Vídeo",
        publishedAt: "2026-10-20T18:00:00-03:00",
        viewCount: 90,
        likeCount: 8,
        commentCount: 2,
      },
    ],
  },
  tiktok: {
    dias: [
      {
        date: "2026-10-22",
        followers_count: 500,
        profile_views: 1,
        video_views: 1000,
        likes: 60,
        comments: 5,
        shares: 5,
      },
    ],
    videos: [],
  },
};

function dia(date: string, followers: number) {
  return {
    date,
    followers_count: followers,
    media_count: 1,
    reach: 0,
    views: 0,
    accounts_engaged: 0,
    total_interactions: 0,
    profile_links_taps: 0,
  };
}

function yt(day: string, views: number, ganhos: number, perdas: number) {
  return {
    day,
    views,
    estimatedMinutesWatched: 0,
    averageViewDuration: 0,
    subscribersGained: ganhos,
    subscribersLost: perdas,
  };
}

describe("Redes sociais", () => {
  it("não inventar alcance do Facebook: alcance, visualizações e interações em branco", () => {
    const fb = linhaDaRede(f, "facebook", P);
    expect(fb.seguidores).toBe(2004);
    expect(fb.novos).toBe(4);
    expect(fb.alcance).toBeNull();
    expect(fb.visualizacoes).toBeNull();
    expect(fb.interacoes).toBeNull();
    expect(fb.taxa).toBeNull();
    // O total de alcance não ganha nada do Facebook.
    const so = resumoRedes(f, P, ["facebook"]);
    expect(so.alcanceEVisualizacoes).toBe(0);
    expect(so.seguidores).toBe(2004);
  });

  it("não chamar seguidores do Instagram de visitantes", () => {
    expect(DEMOGRAFIA.titulo).toContain("seguidores do Instagram");
    expect(DEMOGRAFIA.titulo.toLowerCase()).not.toContain("visitante");
    expect(DEMOGRAFIA.aviso).toContain("não visitantes");
    const d = demografiaInstagram(f);
    expect(d.cidades[0]).toEqual({ nome: "Nova Friburgo", seguidores: 400 });
    expect(d.idades.map((i) => i.faixa)).toEqual(["18-24", "25-34"]);
  });

  it("seguidores pela foto diária e novos = fim − início", () => {
    const ig = linhaDaRede(f, "instagram", P);
    expect(ig.seguidores).toBe(1030);
    expect(ig.novos).toBe(30);
    expect(ig.alcance).toBe(800);
    expect(ig.visualizacoes).toBe(1500);
    expect(ig.taxa).toBeCloseTo((60 / 800) * 100);
  });

  it("YouTube: novos = ganhos − perdas; seguidores voltando de hoje", () => {
    const y = linhaDaRede(f, "youtube", P);
    expect(y.novos).toBe(4);
    // 110 hoje, 7 ganhos depois do período.
    expect(y.seguidores).toBe(103);
    expect(y.interacoes).toBe(10);
    expect(seguidoresEm(f, "youtube", "2026-10-01")).toBeNull();
  });

  it("TikTok com o histórico começando no período conta desde a 1ª foto", () => {
    const t = linhaDaRede(f, "tiktok", P);
    expect(t.novos).toBe(0);
    expect(t.parcial).toBe(true);
    expect(t.interacoes).toBe(70);
  });

  it("posts ordenados por interações, com o tipo traduzido", () => {
    const ps = postsDoPeriodo(f, P);
    expect(ps.map((p) => p.id)).toEqual(["p1", "v1"]);
    expect(ps[0]?.tipo).toBe("reels");
    expect(postsDoPeriodo(f, P, { tipo: "carrossel" })).toHaveLength(0);
    expect(linhasPorRede(f, P)).toHaveLength(4);
  });
});
