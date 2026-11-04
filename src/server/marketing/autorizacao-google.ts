import "server-only";
import { cookies } from "next/headers";
import {
  revogarGoogle,
  trocarCodigoGoogle,
  urlAutorizacaoGoogle,
} from "@/connectors/marketing/google";
import {
  AUTORIZACAO_GOOGLE,
  ehSistemaGoogle,
  escolhaInicial,
  escoposFaltando,
  INTEGRACOES,
  juntarSegredos,
  type ResultadoGoogle,
  type SistemaGoogle,
  separarSegredos,
  valorDaEscolha,
} from "@/lib/integracoes";
import { aleatorio, desafioPkce, mesmoState } from "@/lib/oauth";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { cifrar } from "../cofre";
import { credencialSalva, podeConfigurar, testarConexao } from "../integracoes";
import { appGoogle } from "./app-google";
import { origem } from "./autorizacao-rd";
import { descobrirGoogle } from "./descoberta-google";

// Autorização do Google (OAuth): "Conectar com o Google" (ou "com o YouTube",
// que está em outra conta) guarda o acesso, o state e o verificador do PKCE
// num cookie e manda a pessoa à tela do Google; ele volta para a mesma rota
// de callback com code e state, que confere o state, troca o code pelo
// refresh token (só com o verificador do cookie) e salva cifrado no acesso
// que começou.

const COOKIE = "google_autorizacao";

const redirectUri = async () =>
  `${await origem()}${AUTORIZACAO_GOOGLE.retorno}`;

/** Endereço da tela de autorização do Google, com state e PKCE no cookie. */
export async function iniciarAutorizacaoGoogle(
  sistema: SistemaGoogle,
  clientId: string,
): Promise<string> {
  const state = aleatorio();
  const verificador = aleatorio();
  (await cookies()).set(COOKIE, `${sistema}.${state}.${verificador}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: AUTORIZACAO_GOOGLE.retorno,
    maxAge: 10 * 60,
  });
  return urlAutorizacaoGoogle({
    clientId,
    redirectUri: await redirectUri(),
    escopos: Object.keys(AUTORIZACAO_GOOGLE.escopos[sistema]),
    state,
    desafio: desafioPkce(verificador),
  });
}

/**
 * Conclui a autorização. Devolve o acesso e a chave do resultado (o texto
 * fica em RETORNO_GOOGLE, na tela). O teste da conexão, com a conta e as
 * permissões que faltaram, fica gravado no cartão.
 */
export async function concluirAutorizacaoGoogle(volta: {
  code: string;
  state: string;
  erro: string;
}): Promise<{ sistema: SistemaGoogle; resultado: ResultadoGoogle }> {
  const jar = await cookies();
  const [doCookie, esperado = "", verificador = ""] = (
    jar.get(COOKIE)?.value ?? ""
  ).split(".");
  jar.delete({ name: COOKIE, path: AUTORIZACAO_GOOGLE.retorno });
  // Sem cookie não dá para saber qual começou: a mensagem vai para o Google.
  const sistema = ehSistemaGoogle(doCookie) ? doCookie : "mkt_google";
  const resultado = await concluir(sistema, volta, esperado, verificador);
  return { sistema, resultado };
}

async function concluir(
  sistema: SistemaGoogle,
  volta: { code: string; state: string; erro: string },
  esperado: string,
  verificador: string,
): Promise<ResultadoGoogle> {
  if (!(await podeConfigurar(sistema))) return "permissao";
  if (!mesmoState(volta.state, esperado) || !verificador) return "state";
  if (volta.erro) return "negado";
  if (!volta.code) return "state";

  const def = INTEGRACOES[sistema];
  const app = await appGoogle(sistema);
  // O YouTube pode chegar aqui sem nada salvo: a volta grava tudo.
  const salva = await credencialSalva(sistema);
  const p = def.parametros.safeParse(salva?.parametros ?? {});
  const segredos = salva ? separarSegredos(def, salva.segredo) : {};
  if (!app || !p.success) return "credencial";

  let novo: Awaited<ReturnType<typeof trocarCodigoGoogle>>;
  try {
    novo = await trocarCodigoGoogle({
      clientId: app.clientId,
      clientSecret: app.clientSecret,
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

  // O que a conta acessa: onde há uma opção só, ela já fica escolhida.
  const achados = await descobrirGoogle(sistema, {
    parametros: p.data,
    segredo,
  });
  const parametros = def.parametros.parse({
    ...p.data,
    ...Object.fromEntries(
      def.campos
        .filter((c) => c.escolha)
        .map((c) => {
          const d = achados[c.nome];
          const atual = valorDaEscolha(c.nome, p.data);
          return [c.nome, d ? escolhaInicial(atual, d) : atual];
        }),
    ),
  });

  const core = (await createClient()).schema("core");
  const salvo = await core.rpc("salvar_integracao", {
    p_sistema: sistema,
    p_parametros: parametros as Json,
    p_segredo_cifrado: cifrar(segredo, sistema),
    p_ativa: true,
  });
  if (salvo.error) return "salvar";
  const teste = await testarConexao(sistema, { parametros, segredo });
  await core.rpc("registrar_teste_integracao", {
    p_sistema: sistema,
    p_ok: teste.ok,
    p_mensagem: teste.mensagem,
  });
  if (escoposFaltando(sistema, novo.escopos).length > 0) return "escopos";
  return teste.ok ? "conectado" : "teste";
}

/**
 * Antes de remover a credencial: revoga o refresh token no Google, para o
 * app sair da conta. Falha aqui não impede a remoção.
 */
export async function revogarAutorizacaoGoogle(
  sistema: SistemaGoogle,
): Promise<void> {
  const salva = await credencialSalva(sistema).catch(() => null);
  const token = salva
    ? separarSegredos(INTEGRACOES[sistema], salva.segredo).refresh_token
    : undefined;
  if (token) await revogarGoogle(token).catch(() => undefined);
}
