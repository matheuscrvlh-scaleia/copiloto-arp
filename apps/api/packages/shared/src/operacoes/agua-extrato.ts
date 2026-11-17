import { chaveDaSala, mesesAntes, salasDoTexto } from "./agua-alertas";
import { normalizar } from "./agua-formato";

// Extrato da água (spec 4.4, Tela 3): o histórico mês a mês de uma sala, de
// um cliente ou de um hidrômetro, para mostrar ao locatário ou resolver uma
// contestação. Funções puras: o servidor lê as leituras do período.

export { normalizar };

/** Até quantos meses o extrato mostra de uma vez. */
export const MESES_MAX_EXTRATO = 24;

export interface FiltroExtrato {
  /** "" = todos os blocos. */
  bloco: string;
  /** Sala, cliente ou nº do hidrômetro. */
  texto: string;
}

interface LinhaDoExtrato {
  bloco: string;
  sala: string;
  cliente: string;
  hidrometro: string;
}

/**
 * A leitura entra no extrato? Pelo nº do hidrômetro (parte dele), pela sala
 * (uma das salas citadas: "107 e 108" entra na busca por 108) ou pelo nome
 * do cliente (parte dele, sem acento).
 */
export function noExtrato(l: LinhaDoExtrato, f: FiltroExtrato): boolean {
  if (f.bloco && l.bloco !== f.bloco) return false;
  const texto = f.texto.trim();
  if (!texto) return Boolean(f.bloco);
  const codigo = texto.replace(/\s+/g, "").toUpperCase();
  if (codigo.length >= 3 && l.hidrometro.includes(codigo)) return true;
  const sala = chaveDaSala(texto);
  if (sala && texto.length <= 12 && salasDoTexto(l.sala).includes(sala))
    return true;
  const nome = normalizar(texto);
  return nome.length >= 3 && normalizar(l.cliente).includes(nome);
}

/** Meses "aaaa-mm-01" de `de` até `ate`, inclusive (no máximo o limite). */
export function mesesEntre(de: string, ate: string): string[] {
  const r: string[] = [];
  for (
    let m = ate;
    m >= de && r.length < MESES_MAX_EXTRATO;
    m = mesesAntes(m, 1)
  )
    r.unshift(m);
  return r;
}

/** Consumo somado de cada mês (meses sem leitura entram com null). */
export function consumoPorMes(
  leituras: { referencia: string; consumo: number }[],
  meses: string[],
): { referencia: string; consumo: number | null }[] {
  const soma = new Map<string, number>();
  for (const l of leituras)
    soma.set(
      l.referencia,
      (soma.get(l.referencia) ?? 0) + Math.round(l.consumo * 1000),
    );
  return meses.map((m) => {
    const v = soma.get(m);
    return { referencia: m, consumo: v === undefined ? null : v / 1000 };
  });
}

type Busca = Record<string, string | string[] | undefined>;

const mesDaUrl = (v: string) =>
  /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? `${v}-01` : null;

/**
 * Filtro do extrato pela URL (?bloco=05&q=108&de=2025-10&ate=2026-09; ?h=
 * é o nº do hidrômetro). Sem período: os 12 meses até o último importado.
 * null quando não há mês importado. `meses` vem do mais novo ao mais antigo.
 */
export function filtroDoExtrato(
  busca: Busca,
  meses: string[],
): (FiltroExtrato & { de: string; ate: string }) | null {
  const ultimo = meses[0];
  if (!ultimo) return null;
  const um = (k: string) => {
    const v = busca[k];
    return ((Array.isArray(v) ? v[0] : v) ?? "").trim();
  };
  let ate = mesDaUrl(um("ate")) ?? ultimo;
  let de = mesDaUrl(um("de")) ?? mesesAntes(ate, 11);
  if (de > ate) [de, ate] = [ate, de];
  if (mesesEntre(de, ate)[0] !== de)
    de = mesesAntes(ate, MESES_MAX_EXTRATO - 1);
  const bloco = /^\d{2}$/.test(um("bloco")) ? um("bloco") : "";
  return {
    de,
    ate,
    bloco,
    texto: (um("h") || um("q")).slice(0, 80),
  };
}
