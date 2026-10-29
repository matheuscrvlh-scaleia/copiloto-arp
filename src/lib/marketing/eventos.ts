import type { EventoWp } from "@/connectors/marketing/site";

// Agenda de eventos publicada no site (WordPress). Cada post vira um evento
// com o primeiro início e o último fim; datas e horas são as de Brasília,
// como o site grava ("aaaa-mm-dd hh:mm:ss").

export interface EventoSite {
  id: number;
  titulo: string;
  /** "aaaa-mm-dd" do primeiro dia. */
  inicio: string;
  /** "aaaa-mm-dd" do último dia (igual ao início se for de um dia). */
  fim: string;
  /** "14:00" ou "07:30 às 19:30"; null se o site não informa hora. */
  horario: string | null;
  descricao: string;
  /** Página do evento no site. */
  link: string;
  /** Link que o site mostra no evento (Instagram, ingressos…). */
  linkExterno: string | null;
  imagem: string | null;
}

const NOMEADAS: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/** O WordPress manda o título com entidades HTML ("&#8220;", "&amp;"). */
export function decodificarHtml(texto: string): string {
  return texto
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (inteira, e: string) => {
      if (e[0] !== "#") return NOMEADAS[e.toLowerCase()] ?? inteira;
      const n =
        e[1] === "x" || e[1] === "X"
          ? parseInt(e.slice(2), 16)
          : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff
        ? String.fromCodePoint(n)
        : inteira;
    })
    .trim();
}

interface Periodo {
  /** "aaaa-mm-dd hh:mm". */
  de: string;
  ate: string;
}

const DATA_HORA = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/;

function lerDataHora(v: string | null | undefined): string | null {
  const m = DATA_HORA.exec(v?.trim() ?? "");
  if (!m) return null;
  return `${m[1]} ${m[2] ?? "00:00"}`;
}

/**
 * Períodos do evento. Tipo "date": data e hora de início (e fim, se houver).
 * Tipo "array": "início_fim", um por linha ou separados por vírgula.
 */
function periodos(acf: NonNullable<EventoWp["acf"]>): Periodo[] {
  if (acf.evento_tipo === "array") {
    return (acf.evento_datas ?? "")
      .split(/[\n,;|]+/)
      .map((par) => {
        const [a, b] = par.split("_");
        const de = lerDataHora(a);
        return de ? { de, ate: lerDataHora(b) ?? de } : null;
      })
      .filter((p): p is Periodo => p !== null);
  }
  const de = lerDataHora(acf.evento_data_hora);
  if (!de) return [];
  const ate = lerDataHora(acf.evento_data_hora_fim);
  return [{ de, ate: ate && ate >= de ? ate : de }];
}

function horarioDe(ps: Periodo[]): string | null {
  const [p] = ps;
  if (!p || ps.length > 1) return null;
  const h1 = p.de.slice(11);
  const h2 = p.ate.slice(11);
  if (h1 === "00:00") return null;
  return h2 !== h1 && h2 !== "00:00" ? `${h1} às ${h2}` : h1;
}

function imagemDe(e: EventoWp): string | null {
  const [m] = e._embedded?.["wp:featuredmedia"] ?? [];
  const s = m?.media_details?.sizes;
  return (
    s?.medium_large?.source_url ?? s?.large?.source_url ?? m?.source_url ?? null
  );
}

/** Evento do site, ou null se ele não tem data. */
export function eventoDoSite(e: EventoWp): EventoSite | null {
  const ps = periodos(e.acf ?? {}).sort((a, b) => a.de.localeCompare(b.de));
  const primeiro = ps[0];
  if (!primeiro) return null;
  const fim = ps.reduce((m, p) => (p.ate > m ? p.ate : m), primeiro.ate);
  const externo = e.acf?.evento_link?.trim();
  return {
    id: e.id,
    titulo: decodificarHtml(e.title.rendered),
    inicio: primeiro.de.slice(0, 10),
    fim: fim.slice(0, 10),
    horario: horarioDe(ps),
    descricao: decodificarHtml(e.acf?.evento_descricao ?? ""),
    link: e.link,
    linkExterno: externo && /^https?:\/\//.test(externo) ? externo : null,
    imagem: imagemDe(e),
  };
}

/** Eventos com data, do mais cedo ao mais tarde. */
export function eventosDoSite(lista: EventoWp[]): EventoSite[] {
  return lista
    .map(eventoDoSite)
    .filter((e): e is EventoSite => e !== null)
    .sort(
      (a, b) =>
        a.inicio.localeCompare(b.inicio) ||
        (a.horario ?? "").localeCompare(b.horario ?? "") ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
}

/** Eventos que tocam o intervalo (evento de vários dias conta uma vez). */
export function eventosEntre(
  eventos: EventoSite[],
  de: string,
  ate: string,
): EventoSite[] {
  return eventos.filter((e) => e.fim >= de && e.inicio <= ate);
}
