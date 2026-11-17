import { z } from "zod";
import type { PrecoDoModelo } from "./contratos";

// Regras puras da IA ARP: quanto custa, quanto conta no limite e se a pessoa
// ainda pode perguntar. A API usa para barrar e registrar; a tela, para
// mostrar o mesmo número.

export interface UsoDeTokens {
  entrada: number;
  saida: number;
  cache_escrita: number;
  cache_leitura: number;
}

export const USO_ZERADO: UsoDeTokens = {
  entrada: 0,
  saida: 0,
  cache_escrita: 0,
  cache_leitura: 0,
};

export function somarUso(a: UsoDeTokens, b: UsoDeTokens): UsoDeTokens {
  return {
    entrada: a.entrada + b.entrada,
    saida: a.saida + b.saida,
    cache_escrita: a.cache_escrita + b.cache_escrita,
    cache_leitura: a.cache_leitura + b.cache_leitura,
  };
}

/**
 * Tokens que contam no limite da pessoa: entrada, saída e a escrita do
 * cache. A releitura do cache (instruções e catálogo repetidos a cada passo)
 * custa um vigésimo e fica de fora, senão uma pergunta com várias consultas
 * gastaria o limite à toa.
 */
export function tokensQueContam(u: UsoDeTokens): number {
  return u.entrada + u.saida + u.cache_escrita;
}

/** Custo em US$ (preços por milhão de tokens). Modelo sem preço: 0. */
export function custoEmDolar(
  u: UsoDeTokens,
  preco: PrecoDoModelo | undefined,
): number {
  if (!preco) return 0;
  const c =
    u.entrada * preco.entrada +
    u.saida * preco.saida +
    u.cache_escrita * preco.cache_escrita +
    u.cache_leitura * preco.cache_leitura;
  return Math.round(c) / 1_000_000;
}

/**
 * Limite de tokens no mês: o da pessoa, senão o do cargo, senão o padrão.
 * `undefined` = não definido naquele nível; `null` = sem limite.
 */
export function limiteEfetivo(n: {
  usuario: number | null | undefined;
  cargo: number | null | undefined;
  padrao: number | null;
}): number | null {
  if (n.usuario !== undefined) return n.usuario;
  if (n.cargo !== undefined) return n.cargo;
  return n.padrao;
}

/** Por que a pessoa não pode perguntar agora (null: pode). */
export function motivoDoBloqueio(s: {
  ativa: boolean;
  configurada: boolean;
  usadosMes: number;
  limiteMes: number | null;
  gastoMesUsd: number;
  orcamentoMesUsd: number | null;
}): string | null {
  if (!s.ativa) return "A IA está desligada. Fale com o administrador.";
  if (!s.configurada)
    return "A IA ainda não foi configurada (falta a chave da Claude em Administração › Configurações › Integrações).";
  if (s.limiteMes !== null && s.usadosMes >= s.limiteMes)
    return "Você chegou ao seu limite de uso da IA neste mês. Fale com o administrador se precisar de mais.";
  if (s.orcamentoMesUsd !== null && s.gastoMesUsd >= s.orcamentoMesUsd)
    return "A IA chegou ao teto de gasto do mês. Fale com o administrador.";
  return null;
}

/** Título da conversa: o começo da primeira pergunta, numa linha. */
export function tituloDaConversa(pergunta: string): string {
  const t = pergunta.replace(/\s+/g, " ").trim();
  return t.length <= 70 ? t : `${t.slice(0, 67).trimEnd()}…`;
}

/** 950 → "950"; 12.300 → "12,3 mil"; 4.500.000 → "4,5 mi". */
export function formatarTokens(n: number): string {
  const um = (v: number) =>
    v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 });
  if (Math.abs(n) >= 1_000_000) return `${um(n / 1_000_000)} mi`;
  if (Math.abs(n) >= 1000) return `${um(n / 1000)} mil`;
  return String(Math.round(n));
}

// ---------------------------------------------------------------------------
// Gráfico na resposta: a IA escreve um bloco ```grafico com este JSON e a
// tela desenha com os mesmos gráficos do sistema.
// ---------------------------------------------------------------------------

export const graficoDaIa = z.object({
  tipo: z.enum(["colunas", "barras", "linha", "rosca"]),
  titulo: z.string().max(120),
  unidade: z.enum(["numero", "moeda", "pct"]).default("numero"),
  itens: z
    .array(z.object({ rotulo: z.string().max(60), valor: z.number() }))
    .min(1)
    .max(40),
});
export type GraficoDaIa = z.infer<typeof graficoDaIa>;

/** O gráfico do bloco, ou null se o JSON não serve (a tela mostra o texto). */
export function lerGrafico(texto: string): GraficoDaIa | null {
  try {
    const r = graficoDaIa.safeParse(JSON.parse(texto));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
