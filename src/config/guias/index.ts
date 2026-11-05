import { encerramento } from "./comum";
import {
  GUIAS_FINANCEIRO,
  GUIAS_GESTAO,
  GUIAS_RH,
} from "./gestao-rh-financeiro";
import { GUIAS_MARKETING } from "./marketing";
import { GUIAS_COMERCIAL } from "./marketing-comercial";
import { GUIAS_TICKETS } from "./tickets";
import { GUIAS_ADMIN } from "./tickets-admin";
import type { Guia, Passo } from "./tipos";

export type { Alvo, Guia, Passo } from "./tipos";

/** Um guia por tela do menu (o teste confere que nenhuma fica sem). */
export const GUIAS: Record<string, Guia> = {
  ...GUIAS_GESTAO,
  ...GUIAS_RH,
  ...GUIAS_FINANCEIRO,
  ...GUIAS_TICKETS,
  ...GUIAS_MARKETING,
  ...GUIAS_COMERCIAL,
  ...GUIAS_ADMIN,
};

/**
 * O guia da tela: o da rota mais específica que casa com o endereço, então
 * uma subtela (ex.: /rh/configuracoes/parametros) usa o guia da tela-mãe.
 */
export function guiaDa(
  pathname: string,
): { chave: string; guia: Guia; passos: Passo[] } | null {
  const chave = Object.keys(GUIAS)
    .filter((k) => pathname === k || pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  const guia = chave ? GUIAS[chave] : undefined;
  if (!chave || !guia) return null;
  return { chave, guia, passos: [...guia.passos, encerramento] };
}

/** Chave no navegador com a versão do guia que a pessoa já viu. */
export const chaveVisto = (chave: string) => `guia-visto:${chave}`;
