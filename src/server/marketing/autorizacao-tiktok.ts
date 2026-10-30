import "server-only";
import { cookies } from "next/headers";
import { trocarCodigoTikTok } from "@/connectors/marketing/tiktok";
import {
  AUTORIZACAO_TIKTOK,
  INTEGRACOES,
  juntarSegredos,
  type ResultadoAutorizacao,
  separarSegredos,
} from "@/lib/integracoes";
import { aleatorio, mesmoState } from "@/lib/oauth";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { cifrar } from "../cofre";
import { credencialSalva, podeConfigurar, testarConexao } from "../integracoes";
import { origem } from "./autorizacao-rd";

// Autorização do anunciante no TikTok (OAuth): "Conectar com o TikTok"
// guarda o state num cookie e abre o portal do TikTok; quem tem acesso à
// conta de anúncios aprova, e o TikTok volta para a rota de retorno com
// auth_code e state. O auth_code (vale 1 hora, uma vez só) vira o token de
// Ads, que não vence, salvo cifrado. O id do anunciante (fora do formulário)
// fica o salvo se o token o enxerga; senão, o primeiro que ele enxerga.

const SISTEMA = "mkt_tiktok";
const COOKIE = "tiktok_autorizacao";

/** Endereço do portal de autorização do TikTok, com o state no cookie. */
export async function iniciarAutorizacaoTikTok(appId: string): Promise<string> {
  const state = aleatorio(24);
  (await cookies()).set(COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AUTORIZACAO_TIKTOK.retorno,
    maxAge: 60 * 60,
  });
  const u = new URL("https://business-api.tiktok.com/portal/auth");
  u.searchParams.set("app_id", appId);
  u.searchParams.set("state", state);
  u.searchParams.set(
    "redirect_uri",
    `${await origem()}${AUTORIZACAO_TIKTOK.retorno}`,
  );
  return u.toString();
}

/**
 * Conclui a autorização. Devolve só a chave do resultado (o texto fica em
 * RETORNO_TIKTOK, na tela). O teste da conexão fica gravado no cartão.
 */
export async function concluirAutorizacaoTikTok(
  authCode: string,
  state: string,
): Promise<ResultadoAutorizacao> {
  const jar = await cookies();
  const esperado = jar.get(COOKIE)?.value ?? "";
  jar.delete({ name: COOKIE, path: AUTORIZACAO_TIKTOK.retorno });
  if (!(await podeConfigurar(SISTEMA))) return "permissao";
  if (!authCode || !esperado || !mesmoState(state, esperado)) return "state";

  const def = INTEGRACOES[SISTEMA];
  const salva = await credencialSalva(SISTEMA);
  const p = def.parametros.safeParse(salva?.parametros ?? {});
  const segredos = salva ? separarSegredos(def, salva.segredo) : {};
  if (!salva || !p.success || !p.data.app_id || !segredos.app_secret)
    return "credencial";

  let autorizado: Awaited<ReturnType<typeof trocarCodigoTikTok>>;
  try {
    autorizado = await trocarCodigoTikTok({
      appId: String(p.data.app_id),
      secret: segredos.app_secret,
      authCode,
    });
  } catch {
    return "codigo";
  }

  const parametros = {
    ...p.data,
    advertiser_id: autorizado.anunciantes.includes(String(p.data.advertiser_id))
      ? p.data.advertiser_id
      : (autorizado.anunciantes[0] ?? ""),
  };
  const segredo = juntarSegredos(def, {
    ...segredos,
    segredo: autorizado.token,
  });
  const core = (await createClient()).schema("core");
  const salvo = await core.rpc("salvar_integracao", {
    p_sistema: SISTEMA,
    p_parametros: parametros as Json,
    p_segredo_cifrado: cifrar(segredo, SISTEMA),
    p_ativa: true,
  });
  if (salvo.error) return "salvar";
  const teste = await testarConexao(SISTEMA, { parametros, segredo });
  await core.rpc("registrar_teste_integracao", {
    p_sistema: SISTEMA,
    p_ok: teste.ok,
    p_mensagem: teste.mensagem,
  });
  return teste.ok ? "conectado" : "teste";
}
