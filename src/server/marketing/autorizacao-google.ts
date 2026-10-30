import "server-only";
import { cookies } from "next/headers";
import {
  revogarGoogle,
  trocarCodigoGoogle,
  urlAutorizacaoGoogle,
} from "@/connectors/marketing/google";
import {
  AUTORIZACAO_GOOGLE,
  escoposFaltando,
  INTEGRACOES,
  juntarSegredos,
  type ResultadoGoogle,
  separarSegredos,
} from "@/lib/integracoes";
import { aleatorio, desafioPkce, mesmoState } from "@/lib/oauth";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { cifrar } from "../cofre";
import { credencialSalva, podeConfigurar, testarConexao } from "../integracoes";
import { origem } from "./autorizacao-rd";

// Autorização do Google (OAuth): "Conectar com o Google" guarda o state e o
// verificador do PKCE num cookie e manda a pessoa à tela do Google; ele volta
// para a rota de callback com code e state, que confere o state, troca o code
// pelo refresh token (só com o verificador do cookie) e salva cifrado.

const SISTEMA = "mkt_google";
const COOKIE = "google_autorizacao";

const redirectUri = async () =>
  `${await origem()}${AUTORIZACAO_GOOGLE.retorno}`;

/** Endereço da tela de autorização do Google, com state e PKCE no cookie. */
export async function iniciarAutorizacaoGoogle(
  clientId: string,
): Promise<string> {
  const state = aleatorio();
  const verificador = aleatorio();
  (await cookies()).set(COOKIE, `${state}.${verificador}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AUTORIZACAO_GOOGLE.retorno,
    maxAge: 10 * 60,
  });
  return urlAutorizacaoGoogle({
    clientId,
    redirectUri: await redirectUri(),
    escopos: Object.keys(AUTORIZACAO_GOOGLE.escopos),
    state,
    desafio: desafioPkce(verificador),
  });
}

/**
 * Conclui a autorização. Devolve só a chave do resultado (o texto fica em
 * RETORNO_GOOGLE, na tela). O teste da conexão, com a conta e as permissões
 * que faltaram, fica gravado no cartão.
 */
export async function concluirAutorizacaoGoogle(volta: {
  code: string;
  state: string;
  erro: string;
}): Promise<ResultadoGoogle> {
  const jar = await cookies();
  const [esperado = "", verificador = ""] = (
    jar.get(COOKIE)?.value ?? ""
  ).split(".");
  jar.delete({ name: COOKIE, path: AUTORIZACAO_GOOGLE.retorno });
  if (!(await podeConfigurar(SISTEMA))) return "permissao";
  if (!mesmoState(volta.state, esperado) || !verificador) return "state";
  if (volta.erro) return "negado";
  if (!volta.code) return "state";

  const def = INTEGRACOES[SISTEMA];
  const salva = await credencialSalva(SISTEMA);
  const p = def.parametros.safeParse(salva?.parametros ?? {});
  const segredos = salva ? separarSegredos(def, salva.segredo) : {};
  if (!salva || !p.success || !segredos.client_secret) return "credencial";

  let novo: Awaited<ReturnType<typeof trocarCodigoGoogle>>;
  try {
    novo = await trocarCodigoGoogle({
      clientId: String(p.data.client_id),
      clientSecret: segredos.client_secret,
      code: volta.code,
      redirectUri: await redirectUri(),
      verificador,
    });
  } catch {
    return "codigo";
  }

  const segredo = juntarSegredos(def, {
    ...segredos,
    refresh_token: novo.refreshToken,
  });
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
  if (escoposFaltando(novo.escopos).length > 0) return "escopos";
  return teste.ok ? "conectado" : "teste";
}

/**
 * Antes de remover a credencial: revoga o refresh token no Google, para o
 * app sair da conta. Falha aqui não impede a remoção.
 */
export async function revogarAutorizacaoGoogle(): Promise<void> {
  const salva = await credencialSalva(SISTEMA).catch(() => null);
  const token = salva
    ? separarSegredos(INTEGRACOES[SISTEMA], salva.segredo).refresh_token
    : undefined;
  if (token) await revogarGoogle(token).catch(() => undefined);
}
