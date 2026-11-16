import { instante } from "./tempo";

// Textos curtos para a tela: prazo relativo ("vence em 2h", "atrasado há 3
// dias"), como os service desks mostram, em vez de só a data.

function partes(minutos: number): string {
  const m = Math.round(Math.abs(minutos));
  if (m < 60) return `${Math.max(m, 1)}min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h`;
  const d = Math.round(m / 1440);
  return `${d} dia${d === 1 ? "" : "s"}`;
}

/** "vence em 2h", "vence em 3 dias", "atrasado há 5h". */
export function prazoRelativo(prazo: string, agora: Date): string {
  const minutos = (instante(prazo).getTime() - agora.getTime()) / 60_000;
  return minutos >= 0
    ? `vence em ${partes(minutos)}`
    : `atrasado há ${partes(minutos)}`;
}

/** "há 5min", "há 3h", "há 2 dias" (linha do tempo, notificações). */
export function tempoAtras(quando: string, agora: Date): string {
  const minutos = (agora.getTime() - instante(quando).getTime()) / 60_000;
  if (minutos < 1) return "agora";
  return `há ${partes(minutos)}`;
}
