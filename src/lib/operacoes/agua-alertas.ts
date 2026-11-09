import { formatarNumero } from "@/lib/formato";
import { formatarM3 } from "./agua-formato";

// Alertas das leituras de água (spec 4.4) e a ligação com o locatário do
// ENET. Funções puras: o servidor lê as leituras, o histórico, os vínculos
// corrigidos e os contratos, e a tela só mostra o resultado. Limites vêm de
// Parâmetros (agua_limite_m3, agua_variacao_*).

export const ALERTAS = {
  limite: {
    rotulo: "Acima do limite",
    descricao: "Consumo do mês acima do limite de Parâmetros",
  },
  regressiva: {
    rotulo: "Leitura regressiva",
    descricao:
      "Leitura atual zerada ou menor que a anterior (virada do relógio ou troca)",
  },
  consumo_zero: {
    rotulo: "Consumo zero",
    descricao: "Consumo zero num hidrômetro que vinha consumindo",
  },
  variacao: {
    rotulo: "Variação",
    descricao: "Consumo muito acima ou abaixo da média dos últimos meses",
  },
  sem_foto: {
    rotulo: "Sem foto",
    descricao: "Leitura sem a foto do visor",
  },
  sem_locatario: {
    rotulo: "Sala sem locatário",
    descricao:
      "Cobrança para um locatário, mas a sala não tem contrato vigente no ENET",
  },
  cliente_difere: {
    rotulo: "Cliente ≠ ENET",
    descricao: "Cliente do faturamento diferente do locatário vigente no ENET",
  },
} as const;
export type CodigoAlerta = keyof typeof ALERTAS;
export const CODIGOS_ALERTA = Object.keys(ALERTAS) as CodigoAlerta[];

export interface Alerta {
  codigo: CodigoAlerta;
  /** Explicação com os números da leitura. */
  texto: string;
}

export interface ParametrosAlerta {
  limiteM3: number;
  variacaoPct: number;
  variacaoMeses: number;
  variacaoMinM3: number;
}

export interface LeituraParaAlerta {
  hidrometro: string;
  referencia: string;
  cliente: string;
  leituraAnterior: number | null;
  leituraAtual: number | null;
  consumo: number;
  temFoto: boolean;
}

/** Consumo de meses anteriores de um hidrômetro. */
export interface ConsumoDoMes {
  referencia: string;
  consumo: number;
}

/** "2026-09-01" − n meses → "2026-06-01". */
export function mesesAntes(referencia: string, n: number): string {
  const [a, m] = referencia.split("-").map(Number) as [number, number];
  const total = a * 12 + (m - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/**
 * Média do consumo nos `meses` meses antes da referência (só os meses em
 * que o hidrômetro teve leitura). null sem nenhum.
 */
export function mediaAnterior(
  historico: ConsumoDoMes[],
  referencia: string,
  meses: number,
): number | null {
  const desde = mesesAntes(referencia, meses);
  const janela = historico.filter(
    (h) => h.referencia >= desde && h.referencia < referencia,
  );
  if (!janela.length) return null;
  return janela.reduce((s, h) => s + h.consumo, 0) / janela.length;
}

/** O que o ENET diz da sala: null quando o ENET não tem contrato nenhum. */
export type SituacaoEnet = { locatarios: string[] } | null;

/** Alertas de uma leitura (a ordem é a da lista ALERTAS). */
export function alertasDaLeitura(
  l: LeituraParaAlerta,
  ctx: {
    parametros: ParametrosAlerta;
    historico: ConsumoDoMes[];
    enet: SituacaoEnet;
  },
): Alerta[] {
  const p = ctx.parametros;
  const r: Alerta[] = [];
  if (l.consumo > p.limiteM3)
    r.push({
      codigo: "limite",
      texto: `${formatarM3(l.consumo)} passa do limite de ${formatarM3(p.limiteM3)}`,
    });
  const regressiva =
    l.leituraAtual !== null &&
    l.leituraAnterior !== null &&
    l.leituraAtual < l.leituraAnterior;
  if (regressiva)
    r.push({
      codigo: "regressiva",
      texto:
        l.leituraAtual === 0
          ? "Leitura atual zerada"
          : `Leitura atual (${formatarM3(l.leituraAtual)}) menor que a anterior (${formatarM3(l.leituraAnterior)}): virada do relógio ou troca do hidrômetro?`,
    });
  const media = mediaAnterior(ctx.historico, l.referencia, p.variacaoMeses);
  const meses = `${p.variacaoMeses} ${p.variacaoMeses === 1 ? "mês" : "meses"}`;
  if (l.consumo === 0 && !regressiva && media !== null && media > 0)
    r.push({
      codigo: "consumo_zero",
      texto: `Consumo zero; a média dos últimos ${meses} era ${formatarM3(media)}`,
    });
  if (l.consumo > 0 && media !== null && media > 0) {
    const diferenca = l.consumo - media;
    const pct = (diferenca / media) * 100;
    if (
      Math.abs(diferenca) >= p.variacaoMinM3 &&
      Math.abs(pct) >= p.variacaoPct
    )
      r.push({
        codigo: "variacao",
        texto: `${pct > 0 ? "+" : ""}${formatarNumero(pct, 0)}% contra a média dos últimos ${meses} (${formatarM3(media)})`,
      });
  }
  if (!l.temFoto)
    r.push({ codigo: "sem_foto", texto: "Leitura sem a foto do visor" });
  if (ctx.enet) {
    const a = compararComEnet(l.cliente, ctx.enet.locatarios);
    if (a) r.push(a);
  }
  return r;
}

/** Hidrômetros com leitura no mês anterior que não vieram neste. */
export function sumidos<T extends { hidrometro: string }>(
  mesAnterior: T[],
  atuais: Iterable<string>,
): T[] {
  const vieram = new Set(atuais);
  const vistos = new Set<string>();
  return mesAnterior.filter((l) => {
    if (vieram.has(l.hidrometro) || vistos.has(l.hidrometro)) return false;
    vistos.add(l.hidrometro);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Locatário no ENET
// ---------------------------------------------------------------------------

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Sala como chave: "01" → "1", " 112a " → "112A". */
export function chaveDaSala(sala: string): string {
  const t = semAcento(sala).replace(/[^A-Z0-9]/g, "");
  return t.replace(/^0+(?=\d)/, "");
}

/**
 * Salas citadas no texto da sala do faturamento: "107 e 108" → [107, 108];
 * "104A à 118" → [104A, 118] (as pontas; o meio de uma faixa não entra).
 */
export function salasDoTexto(sala: string): string[] {
  return [
    ...new Set(
      semAcento(sala)
        .split(/\s*(?:,|;|\/|&|\+|\bE\b|\bA\b|-|–)\s*/)
        .map(chaveDaSala)
        .filter((s) => s.length > 0 && s.length <= 12),
    ),
  ];
}

const chave = (bloco: string, sala: string) => `${bloco}|${chaveDaSala(sala)}`;

export interface ContratoEnet {
  bloco: string | null;
  luc: string;
  locatario: string | null;
  nome: string;
}

/**
 * Índice "bloco|sala" → locatários vigentes, a partir dos contratos (os.lojas
 * com situação vigente). O bloco vem da coluna (só os dígitos) ou do começo
 * do LUC ("05_112"); a sala, do fim do LUC ("05_112" → 112, "BL04-311" → 311).
 */
export function indiceDoEnet(contratos: ContratoEnet[]): Map<string, string[]> {
  const indice = new Map<string, string[]>();
  for (const c of contratos) {
    const luc = semAcento(c.luc).trim();
    const partes = luc.split(/[\s_/-]+/).filter(Boolean);
    const blocoLuc =
      partes.length > 1
        ? (partes[0] ?? "").match(/^(?:BL)?(\d{1,2})$/)?.[1]
        : undefined;
    const digitos = (c.bloco ?? "").match(/\d{1,2}/)?.[0] ?? blocoLuc;
    if (!digitos) continue;
    const bloco = digitos.padStart(2, "0");
    const sala = partes.at(-1) ?? luc;
    const nome = (c.locatario ?? "").trim() || c.nome.trim();
    if (!nome) continue;
    const k = chave(bloco, sala);
    const lista = indice.get(k) ?? [];
    if (!lista.includes(nome)) lista.push(nome);
    indice.set(k, lista);
  }
  return indice;
}

/** Locatários vigentes das salas citadas na leitura. */
export function locatariosDaSala(
  indice: Map<string, string[]>,
  bloco: string,
  sala: string,
): string[] {
  const nomes = new Set<string>();
  for (const s of salasDoTexto(sala))
    for (const n of indice.get(chave(bloco, s)) ?? []) nomes.add(n);
  return [...nomes];
}

/** "CONTROLE ARP", "ESTOQUE ARP": marcações da própria ARP no faturamento. */
export const ehDaArp = (cliente: string) => /\bARP\b/.test(semAcento(cliente));

/** "LOCATÁRIO", "-", vazio: o arquivo não diz quem é. */
const semNome = (cliente: string) =>
  /^(LOCATARIO|LOCATARIA|-|—|)$/.test(semAcento(cliente).trim());

const SUFIXOS = new Set([
  "LTDA",
  "ME",
  "EPP",
  "EIRELI",
  "SA",
  "MEI",
  "CIA",
  "UNIFICADO",
  "DE",
  "DA",
  "DO",
  "DAS",
  "DOS",
  "E",
]);

function palavras(nome: string): Set<string> {
  return new Set(
    semAcento(nome)
      .replace(/[^A-Z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((p) => p.length >= 2 && !SUFIXOS.has(p)),
  );
}

/**
 * O mesmo cliente com grafias diferentes ("Café Serra" e "CAFE SERRA
 * LTDA"): pelo menos 2/3 das palavras do nome mais curto aparecem no outro.
 */
export function mesmoCliente(a: string, b: string): boolean {
  const x = palavras(a);
  const y = palavras(b);
  if (!x.size || !y.size) return false;
  let comuns = 0;
  for (const p of x) if (y.has(p)) comuns++;
  const menor = Math.min(x.size, y.size);
  if (menor === 1)
    return comuns === 1 && [...x].some((p) => p.length >= 4 && y.has(p));
  return comuns / menor >= 2 / 3;
}

function compararComEnet(cliente: string, locatarios: string[]): Alerta | null {
  if (!locatarios.length) {
    if (ehDaArp(cliente) || !cliente.trim()) return null;
    return {
      codigo: "sem_locatario",
      texto: `Cobrado de "${cliente}", mas a sala não tem contrato vigente no ENET`,
    };
  }
  if (semNome(cliente)) return null;
  if (locatarios.some((n) => mesmoCliente(cliente, n))) return null;
  return {
    codigo: "cliente_difere",
    texto: `Faturado para "${cliente}"; no ENET: ${locatarios.join(" · ")}`,
  };
}

// ---------------------------------------------------------------------------
// Vínculo corrigido (sala e bloco a partir de um mês)
// ---------------------------------------------------------------------------

export interface Vinculo {
  hidrometro: string;
  desde: string;
  bloco: string;
  sala: string;
}

/** A correção que vale para o hidrômetro no mês (a mais recente até ele). */
export function vinculoDoMes(
  vinculos: Vinculo[],
  hidrometro: string,
  referencia: string,
): Vinculo | null {
  let melhor: Vinculo | null = null;
  for (const v of vinculos)
    if (
      v.hidrometro === hidrometro &&
      v.desde <= referencia &&
      (!melhor || v.desde > melhor.desde)
    )
      melhor = v;
  return melhor;
}
