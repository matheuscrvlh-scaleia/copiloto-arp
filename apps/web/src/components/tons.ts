import type { Tom } from "@/components/estilos";

// Tons dos cartões de indicador do módulo Tickets: como no RH, cada linha
// mistura um cartão preto, um verde da marca e o vidro claro, para variar o
// ritmo das telas. A posição muda de tela para tela (sorteio pelo nome da
// tela), mas é sempre a mesma na mesma tela: nada pisca a cada recarga.

const PADROES: Tom[][] = [
  ["escuro", "claro", "verde", "claro"],
  ["claro", "verde", "claro", "escuro"],
  ["verde", "claro", "escuro", "claro"],
  ["claro", "escuro", "claro", "verde"],
  ["escuro", "verde", "claro", "claro"],
  ["claro", "claro", "verde", "escuro"],
];

function sorteio(texto: string): number {
  let h = 2166136261;
  for (const ch of texto) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Tons de uma linha de cartões, fixos para a tela `tela`. */
export function tonsDaTela(tela: string, quantos = 4): Tom[] {
  const padrao = PADROES[sorteio(tela) % PADROES.length] ?? [];
  return Array.from(
    { length: quantos },
    (_, i): Tom => padrao[i % padrao.length] ?? "claro",
  );
}

// Blocos grandes (gráficos, tabelas): cor mais espaçada, para não pesar.
const RITMO_BLOCOS: Tom[] = [
  "claro",
  "escuro",
  "claro",
  "claro",
  "verde",
  "claro",
];

/** Tons de uma sequência de blocos, fixos para a tela `tela`. */
export function tonsDosBlocos(tela: string, quantos: number): Tom[] {
  const inicio = sorteio(tela) % RITMO_BLOCOS.length;
  return Array.from(
    { length: quantos },
    (_, i) => RITMO_BLOCOS[(inicio + i) % RITMO_BLOCOS.length] ?? "claro",
  );
}

/** Classe do cartão escolhido (filtrando a lista): contorno verde da marca. */
export const CLASSE_MARCADO =
  "ring-2 ring-marca ring-offset-2 ring-offset-[color-mix(in_oklab,var(--color-neutral-100)_60%,transparent)]";
