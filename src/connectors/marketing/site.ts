import { z } from "zod";
import { ConnectorError, parseWith, requestJson } from "../http";

// Agenda de eventos do site da ARP (WordPress, tipo de post "evento" com os
// campos do ACF). Endereço público, sem login. Só leitura.

const SISTEMA = "mkt_site";
/** Trava contra endereço que nunca termina de paginar (916 eventos = 10). */
const MAX_PAGINAS = 50;
/** Páginas pedidas juntas depois da 1ª (o site leva ~1 s por página). */
const POR_LOTE = 5;

export interface SiteConfig {
  /** Endereço da lista (ex.: …/wp-json/wp/v2/evento?per_page=100). */
  endpoint: string;
  fetch?: typeof fetch;
}

const texto = z.string().nullish();

// O ACF devolve [] quando o post não tem nenhum campo preenchido.
const acfSchema = z.preprocess(
  (v) => (Array.isArray(v) ? {} : v),
  z.object({
    evento_tipo: texto,
    evento_data_hora: texto,
    evento_data_hora_fim: texto,
    evento_datas: texto,
    evento_descricao: texto,
    evento_link: texto,
  }),
);

const imagemSchema = z.object({
  source_url: z.string().optional(),
  alt_text: z.string().optional(),
  media_details: z
    .object({
      sizes: z
        .record(z.string(), z.object({ source_url: z.string() }))
        .optional(),
    })
    .optional(),
});

export const eventoWpSchema = z.object({
  id: z.number(),
  link: z.string(),
  title: z.object({ rendered: z.string() }),
  acf: acfSchema.optional(),
  _embedded: z
    .object({
      // Imagem privada vem como erro ({ code, message }): fica sem imagem.
      "wp:featuredmedia": z.array(imagemSchema).optional(),
    })
    .optional(),
});
export type EventoWp = z.infer<typeof eventoWpSchema>;

const paginaSchema = z.array(eventoWpSchema);

export function createSiteClient(config: SiteConfig) {
  const base = new URL(config.endpoint);
  const porPagina = Number(base.searchParams.get("per_page")) || 10;

  async function pagina(n: number): Promise<EventoWp[] | null> {
    const url = new URL(base);
    url.searchParams.set("page", String(n));
    try {
      const r = await requestJson(SISTEMA, url.toString(), {
        retries: 1,
        fetch: config.fetch,
      });
      return parseWith(SISTEMA, paginaSchema, r);
    } catch (erro) {
      // Página além da última: o WordPress responde 400.
      if (
        n > 1 &&
        erro instanceof ConnectorError &&
        erro.status === 400 &&
        /rest_post_invalid_page_number/.test(erro.detalhe ?? "")
      )
        return null;
      throw erro;
    }
  }

  return {
    /** Todos os eventos publicados: a 1ª página e depois lotes em paralelo. */
    async eventos(): Promise<EventoWp[]> {
      const todos: EventoWp[] = [];
      for (let n = 1; n <= MAX_PAGINAS; ) {
        const tamanho = n === 1 ? 1 : POR_LOTE;
        const paginas = await Promise.all(
          Array.from({ length: tamanho }, (_, i) => pagina(n + i)),
        );
        for (const lote of paginas) {
          if (!lote) return todos;
          todos.push(...lote);
          if (lote.length < porPagina) return todos;
        }
        n += tamanho;
      }
      return todos;
    },
  };
}
