import { describe, expect, it } from "vitest";
import {
  type ContaPublica,
  linhaBenchmark,
  linkAnunciosGoogle,
  linkAnunciosMeta,
} from "./benchmark";

const post = (id: string, dia: string, curtidas: number, comentarios = 0) => ({
  id,
  timestamp: `${dia}T15:00:00+0000`,
  permalink: `https://instagram.com/p/${id}`,
  caption: "",
  media_type: "IMAGE",
  like_count: curtidas,
  comments_count: comentarios,
});

const conta = (
  posts: ReturnType<typeof post>[],
  total = 100,
): ContaPublica => ({
  username: "outro",
  name: "Outro Espaço",
  followers_count: 5000,
  media_count: total,
  media: { data: posts },
});

const P = { de: "2026-11-01", ate: "2026-11-07" };

describe("linha do benchmark", () => {
  it("conta só os posts do período e ordena os melhores por curtidas + comentários", () => {
    const l = linhaBenchmark(
      conta([
        post("a", "2026-11-06", 10, 5),
        post("b", "2026-11-03", 40, 1),
        post("c", "2026-11-02", 20, 30),
        post("d", "2026-10-20", 999),
      ]),
      P,
      2,
    );
    expect(l.postsNoPeriodo).toBe(3);
    expect(l.curtidas).toBe(70);
    expect(l.comentarios).toBe(36);
    expect(l.interacoesPorPost).toBeCloseTo(106 / 3);
    expect(l.melhores.map((m) => m.id)).toEqual(["c", "b"]);
    expect(l.postsNoMinimo).toBe(false);
  });

  it("avisa quando os posts lidos acabam dentro do período", () => {
    const l = linhaBenchmark(
      conta([post("a", "2026-11-05", 1), post("b", "2026-11-02", 1)]),
      P,
    );
    expect(l.postsNoMinimo).toBe(true);
  });

  it("sem post no período, sem média", () => {
    expect(linhaBenchmark(conta([], 0), P).interacoesPorPost).toBeNull();
  });
});

describe("links das bibliotecas de anúncios", () => {
  it("Meta busca pelo nome; Google pelo domínio do site", () => {
    expect(linkAnunciosMeta("Espaço X")).toContain("q=Espa%C3%A7o+X");
    expect(linkAnunciosGoogle("https://www.exemplo.com.br/agenda")).toBe(
      "https://adstransparency.google.com/?region=BR&domain=exemplo.com.br",
    );
    expect(linkAnunciosGoogle(null)).toBeNull();
    expect(linkAnunciosGoogle("não é link")).toBeNull();
  });
});
