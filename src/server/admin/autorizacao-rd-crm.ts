import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { AUTORIZAR_URL, trocarCodigoRdCrm } from "@/connectors/rd-crm";
import {
  AUTORIZACAO_RD_CRM,
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
import { origem } from "../marketing/autorizacao-rd";

// Autorização do RD Station CRM (OAuth do app do CRM): "Conectar com o RD
// Station CRM" guarda um state num cookie e manda a pessoa ao RD, que volta
// para a rota de retorno (a URL de callback cadastrada no app) com o code.
// O code vale 5 minutos e vira o refresh token, salvo cifrado.

const SISTEMA = "rd_crm";
const COOKIE = "rd_crm_autorizacao";

const retorno = async () => `${await origem()}${AUTORIZACAO_RD_CRM.retorno}`;

export async function iniciarAutorizacaoRdCrm(
  clientId: string,
): Promise<string> {
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AUTORIZACAO_RD_CRM.retorno,
    maxAge: 10 * 60,
  });
  const u = new URL(AUTORIZAR_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", await retorno());
  u.searchParams.set("state", state);
  return u.toString();
}

/**
 * Conclui a autorização e devolve só a chave do resultado (o texto fica em
 * RETORNO_RD_CRM, na tela). A documentação do CRM não cita o state na volta:
 * se ele vier, tem de bater; sem ele, vale o cookie desta autorização (10
 * minutos, só neste navegador).
 */
export async function concluirAutorizacaoRdCrm(
  code: string,
  state: string,
): Promise<ResultadoRd> {
  const jar = await cookies();
  const esperado = jar.get(COOKIE)?.value ?? "";
  jar.delete({ name: COOKIE, path: AUTORIZACAO_RD_CRM.retorno });
  if (!(await podeConfigurar(SISTEMA))) return "permissao";
  if (!code || !esperado || (state && !mesmoState(state, esperado)))
    return "state";

  const def = INTEGRACOES[SISTEMA];
  const salva = await credencialSalva(SISTEMA);
  const p = def.parametros.safeParse(salva?.parametros ?? {});
  const segredos = salva ? separarSegredos(def, salva.segredo) : {};
  if (!salva || !p.success || !segredos.client_secret) return "credencial";

  let refresh: string;
  try {
    refresh = (
      await trocarCodigoRdCrm({
        clientId: String(p.data.client_id),
        clientSecret: segredos.client_secret,
        code,
        redirectUri: await retorno(),
      })
    ).refresh_token;
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
