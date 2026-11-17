import { dentro, type PeriodoMkt } from "./periodo";

// Reputação › Benchmark: a ARP lado a lado com espaços parecidos, pelos
// números públicos do Instagram (seguidores, posts no período e os posts com
// mais curtidas e comentários). Alcance das outras contas não vem: não
// aparece. Anúncios das referências não entram no sistema: só o botão que
// abre a biblioteca de anúncios em outra aba.

export interface PostPublico {
  id: string;
  timestamp: string;
  permalink: string;
  caption: string;
  media_type: string;
  like_count: number;
  comments_count: number;
}

export interface ContaPublica {
  username: string;
  name: string;
  followers_count: number;
  media_count: number;
  media: { data: PostPublico[] };
}

export interface LinhaBenchmark {
  postsNoPeriodo: number;
  /** Os posts lidos acabaram dentro do período: pode haver mais. */
  postsNoMinimo: boolean;
  curtidas: number;
  comentarios: number;
  /** (curtidas + comentários) ÷ posts do período. */
  interacoesPorPost: number | null;
  melhores: PostPublico[];
}

/** Os números do período a partir dos posts mais recentes lidos. */
export function linhaBenchmark(
  conta: ContaPublica,
  p: Pick<PeriodoMkt, "de" | "ate">,
  melhores = 3,
): LinhaBenchmark {
  const posts = conta.media.data;
  const doPeriodo = posts.filter((m) => dentro(m.timestamp.slice(0, 10), p));
  const maisAntigo = posts.at(-1)?.timestamp.slice(0, 10);
  const curtidas = doPeriodo.reduce((s, m) => s + m.like_count, 0);
  const comentarios = doPeriodo.reduce((s, m) => s + m.comments_count, 0);
  return {
    postsNoPeriodo: doPeriodo.length,
    postsNoMinimo:
      posts.length > 0 &&
      posts.length < conta.media_count &&
      maisAntigo !== undefined &&
      maisAntigo >= p.de,
    curtidas,
    comentarios,
    interacoesPorPost: doPeriodo.length
      ? (curtidas + comentarios) / doPeriodo.length
      : null,
    melhores: [...doPeriodo]
      .sort(
        (a, b) =>
          b.like_count + b.comments_count - (a.like_count + a.comments_count),
      )
      .slice(0, melhores),
  };
}

/** Biblioteca de anúncios da Meta, buscando pelo nome. */
export function linkAnunciosMeta(nome: string): string {
  const q = new URLSearchParams({
    active_status: "all",
    ad_type: "all",
    country: "BR",
    q: nome,
    search_type: "keyword_unordered",
  });
  return `https://www.facebook.com/ads/library/?${q}`;
}

/** Central de Transparência de Anúncios do Google, pelo domínio do site. */
export function linkAnunciosGoogle(site: string | null): string | null {
  if (!site) return null;
  try {
    const dominio = new URL(site).hostname.replace(/^www\./, "");
    return `https://adstransparency.google.com/?region=BR&domain=${encodeURIComponent(dominio)}`;
  } catch {
    return null;
  }
}
