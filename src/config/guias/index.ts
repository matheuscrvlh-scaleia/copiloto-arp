import { GUIAS_ADMIN } from "./admin";
import { GUIAS_COMERCIAL } from "./comercial";
import { encerramento } from "./comum";
import { GUIAS_FINANCEIRO } from "./financeiro";
import { GUIAS_FORMULARIOS } from "./formularios";
import { GUIAS_MARKETING } from "./marketing";
import { GUIAS_GESTAO, GUIAS_RH } from "./rh-gestao";
import { GUIAS_TICKETS } from "./tickets";
import type { Guia, Passo } from "./tipos";

export type { Alvo, Guia, Passo, PassoTrilha, Trilha } from "./tipos";
export { TRILHAS, trilhasDa } from "./trilhas";

/** Um guia por tela do menu (o teste confere que nenhuma fica sem). */
export const GUIAS: Record<string, Guia> = {
  ...GUIAS_GESTAO,
  ...GUIAS_RH,
  ...GUIAS_FINANCEIRO,
  ...GUIAS_TICKETS,
  ...GUIAS_MARKETING,
  ...GUIAS_COMERCIAL,
  ...GUIAS_FORMULARIOS,
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
