import "server-only";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { trocarCodigoRd } from "@/connectors/marketing/rd-station";
import {
  AUTORIZACAO_RD,
  INTEGRACOES,
  juntarSegredos,
  type ResultadoRd,
  separarSegredos,
} from "@/lib/integracoes";
import { mesmoState } from "@/lib/oauth";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { cifrar } from "../cofre";
import { credencialSalva, podeConfigurar, testarConexao } from "../integracoes";

// Autorização do RD Station (OAuth): "Conectar com o RD Station" guarda um
// state aleatório num cookie e manda a pessoa à tela do RD; o RD volta para a
// URL de callback (a raiz do sistema) com code e state, o proxy repassa para
// a rota de retorno, que confere o state, troca o code pelo refresh token e
// salva cifrado. Ninguém precisa copiar o code (vale 1 hora, uma vez só).

const SISTEMA = "mkt_rd_station";
const COOKIE = "rd_autorizacao";

/** Endereço da tela de autorização do RD, com o state no cookie. */
export async function iniciarAutorizacaoRd(clientId: string): Promise<string> {
  const state = `${AUTORIZACAO_RD.prefixoState}${randomBytes(24).toString("base64url")}`;
  (await cookies()).set(COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AUTORIZACAO_RD.retorno,
    maxAge: 60 * 60,
  });
  const u = new URL("https://api.rd.services/auth/dialog");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", `${await origem()}/`);
  u.searchParams.set("state", state);
  return u.toString();
}

/** O domínio em que a pessoa está (precisa ser o da URL de callback). */
export async function origem(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/**
 * Conclui a autorização. Devolve só a chave do resultado (o texto fica em
 * RETORNO_RD, na tela): a URL de volta não carrega mensagem de ninguém. O
 * teste da conexão fica gravado no cartão, como no "Salvar e testar".
 */
export async function concluirAutorizacaoRd(
  code: string,
  state: string,
): Promise<ResultadoRd> {
  const jar = await cookies();
  const esperado = jar.get(COOKIE)?.value ?? "";
  jar.delete({ name: COOKIE, path: AUTORIZACAO_RD.retorno });
  if (!(await podeConfigurar(SISTEMA))) return "permissao";
  if (!code || !esperado || !mesmoState(state, esperado)) return "state";

  const def = INTEGRACOES[SISTEMA];
  const salva = await credencialSalva(SISTEMA);
  const p = def.parametros.safeParse(salva?.parametros ?? {});
  const segredos = salva ? separarSegredos(def, salva.segredo) : {};
  if (!salva || !p.success || !segredos.client_secret) return "credencial";

  let refresh: string;
  try {
    refresh = await trocarCodigoRd({
      clientId: String(p.data.client_id),
      clientSecret: segredos.client_secret,
      code,
    });
  } catch {
    return "codigo";
  }

  const segredo = juntarSegredos(def, { ...segredos, refresh_token: refresh });
  const core = (await createClient()).schema("core");
  const salvo = await core.rpc("salvar_integracao", {
    p_sistema: SISTEMA,
    p_parametros: p.data as Json,
    p_segredo_cifrado: cifrar(segredo, SISTEMA),
    p_ativa: true,
  });
  if (salvo.error) return "salvar";
  const teste = await testarConexao(SISTEMA, { parametros: p.data, segredo });
  await core.rpc("registrar_teste_integracao", {
    p_sistema: SISTEMA,
    p_ok: teste.ok,
    p_mensagem: teste.mensagem,
  });
  return teste.ok ? "conectado" : "teste";
}
