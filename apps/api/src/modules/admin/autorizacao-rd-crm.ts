import { randomBytes } from "node:crypto";
import { AUTORIZACAO_RD_CRM } from "@arp/shared/integracoes";
import { env } from "@/config/env";
import { AUTORIZAR_URL } from "@/connectors/rd-crm";
import type { Contexto } from "@/contexto";
import { cifrar, decifrar } from "@/infra/cofre";

// Autorização do RD Station CRM (OAuth do app do CRM): "Conectar com o RD
// Station CRM" guarda um state num cookie e manda a pessoa ao RD, que volta
// para a rota de retorno (a URL de callback cadastrada no app) com o code.
// O code vale 5 minutos e vira o refresh token, salvo cifrado.
//
// A volta vem de outro site: o navegador não manda os cookies da sessão
// (SameSite=Strict). Por isso o cookie do state (SameSite=Lax, HttpOnly, 10
// minutos, só no caminho do retorno) leva também quem começou a autorização,
// cifrado com a chave do cofre e preso ao state. A permissão dessa pessoa é
// conferida de novo no banco na volta.

export const COOKIE_RD_CRM = "rd_crm_autorizacao";
const SEPARADOR = "~";
const contextoDoCofre = (state: string) => `autorizacao:rd_crm:${state}`;

export const retornoRdCrm = () =>
  `${env.SITE_URL}${AUTORIZACAO_RD_CRM.retorno}`;

export async function iniciarAutorizacaoRdCrm(ctx: Contexto, clientId: string) {
  const state = randomBytes(24).toString("base64url");
  const u = new URL(AUTORIZAR_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", retornoRdCrm());
  u.searchParams.set("state", state);
  return {
    url: u.toString(),
    cookie: {
      nome: COOKIE_RD_CRM,
      valor: `${state}${SEPARADOR}${cifrar(ctx.usuario.id, contextoDoCofre(state))}`,
      caminho: AUTORIZACAO_RD_CRM.retorno,
      segundos: 10 * 60,
    },
  };
}

/** O state esperado e quem começou a autorização; null se o cookie não vale. */
export function lerCookieRdCrm(
  valor: string | undefined,
): { state: string; usuarioId: string } | null {
  const corte = valor?.indexOf(SEPARADOR) ?? -1;
  if (!valor || corte < 1) return null;
  const state = valor.slice(0, corte);
  try {
    return {
      state,
      usuarioId: decifrar(valor.slice(corte + 1), contextoDoCofre(state)),
    };
  } catch {
    return null;
  }
}
