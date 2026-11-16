import {
  AUTORIZACAO_GOOGLE,
  AUTORIZACAO_RD,
  AUTORIZACAO_TIKTOK,
  ehSistemaGoogle,
  escolhaInicial,
  escoposFaltando,
  INTEGRACOES,
  juntarSegredos,
  type ResultadoAutorizacao,
  type ResultadoGoogle,
  type Sistema,
  type SistemaGoogle,
  separarSegredos,
  valorDaEscolha,
} from "@arp/shared/integracoes";
import { env } from "@/config/env";
import {
  revogarGoogle,
  trocarCodigoGoogle,
  urlAutorizacaoGoogle,
} from "@/connectors/marketing/google";
import { trocarCodigoRd } from "@/connectors/marketing/rd-station";
import { trocarCodigoTikTok } from "@/connectors/marketing/tiktok";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import { cifrar, decifrar } from "@/infra/cofre";
import { log } from "@/infra/log";
import { aleatorio, desafioPkce, mesmoState } from "@/infra/oauth";
import type { Autorizacao } from "@/modules/admin/conexoes";
import { testarConexao } from "@/modules/admin/conexoes";
import * as integracoes from "@/modules/admin/integracoes.repository";
import { credencialSalva } from "@/modules/sync/credenciais.service";
import { appGoogle } from "./app-google";
import { descobrirGoogle } from "./descoberta-google";
import { esquecerLeituras } from "./memoria";

// Autorização (OAuth) do Google, do YouTube, do RD Station e do TikTok:
// "Conectar com …" guarda o state (e, no Google, o verificador do PKCE) num
// cookie e manda a pessoa à tela da ferramenta; ela volta para a rota de
// retorno (endereço cadastrado no app, fora de /api/v1), que confere o
// state, troca o código pelo token e salva cifrado no acesso que começou.
//
// A volta vem de outro site: o navegador não manda os cookies da sessão
// (SameSite=Strict). Por isso o cookie do state (SameSite=Lax, HttpOnly, só
// no caminho do retorno) leva também quem começou, cifrado com a chave do
// cofre e preso ao state; a permissão dessa pessoa é conferida de novo no
// banco na volta (como no RD Station CRM).

const SEPARADOR = "~";
const contextoDoCofre = (state: string) => `autorizacao:mkt:${state}`;

const COOKIE = {
  google: "google_autorizacao",
  rd: "rd_autorizacao",
  tiktok: "tiktok_autorizacao",
} as const;
export { COOKIE as COOKIES_DE_AUTORIZACAO };

function cookie(
  nome: string,
  dados: string,
  state: string,
  ctx: Contexto,
  caminho: string,
  segundos: number,
): Autorizacao["cookie"] {
  return {
    nome,
    valor: `${dados}${SEPARADOR}${cifrar(ctx.usuario.id, contextoDoCofre(state))}`,
    caminho,
    segundos,
  };
}

/** Os dados do cookie e quem começou; null se o cookie não vale. */
function lerCookie(
  valor: string | undefined,
  stateDe: (dados: string) => string,
): { dados: string; usuarioId: string } | null {
  const corte = valor?.indexOf(SEPARADOR) ?? -1;
  if (!valor || corte < 1) return null;
  const dados = valor.slice(0, corte);
  try {
    return {
      dados,
      usuarioId: decifrar(
        valor.slice(corte + 1),
        contextoDoCofre(stateDe(dados)),
      ),
    };
  } catch {
    return null;
  }
}

/** A pessoa (ativa) pode configurar esta integração? Confere agora, no banco. */
const podeConfigurarAgora = (usuarioId: string, sistema: Sistema) =>
  banco
    .comoUsuario(usuarioId, (tx) => integracoes.podeIntegracao(tx, sistema))
    .catch(() => false);

/** Salva o acesso autorizado e o teste; o resultado vai para a tela. */
async function salvarETestar(
  usuarioId: string,
  sistema: Sistema,
  parametros: Record<string, string | number>,
  segredo: string,
): Promise<"salvar" | "conectado" | "teste"> {
  try {
    await banco.comoUsuario(usuarioId, (tx) =>
      integracoes.salvar(tx, {
        sistema,
        parametros,
        segredoCifrado: cifrar(segredo, sistema),
        ativa: true,
      }),
    );
  } catch (err) {
    log.error({ err, sistema }, "salvar a autorização");
    return "salvar";
  }
  const teste = await testarConexao(sistema, { parametros, segredo });
  await banco
    .comoUsuario(usuarioId, (tx) =>
      integracoes.registrarTeste(tx, sistema, teste),
    )
    .catch((err) => log.error({ err, sistema }, "teste da autorização"));
  return teste.ok ? "conectado" : "teste";
}

// ---------------------------------------------------------------------------
// Google e YouTube
// ---------------------------------------------------------------------------

const retornoGoogle = () => `${env.SITE_URL}${AUTORIZACAO_GOOGLE.retorno}`;

/** Endereço da tela de autorização do Google, com state e PKCE no cookie. */
export function iniciarAutorizacaoGoogle(sistema: SistemaGoogle) {
  return async (ctx: Contexto, clientId: string): Promise<Autorizacao> => {
    const state = aleatorio();
    const verificador = aleatorio();
    return {
      url: urlAutorizacaoGoogle({
        clientId,
        redirectUri: retornoGoogle(),
        escopos: Object.keys(AUTORIZACAO_GOOGLE.escopos[sistema]),
        state,
        desafio: desafioPkce(verificador),
      }),
      cookie: cookie(
        COOKIE.google,
        `${sistema}.${state}.${verificador}`,
        state,
        ctx,
        AUTORIZACAO_GOOGLE.retorno,
        10 * 60,
      ),
    };
  };
}

/**
 * Conclui a autorização. Devolve o acesso e a chave do resultado (o texto
 * fica em RETORNO_GOOGLE, na tela). O teste da conexão, com a conta e as
 * permissões que faltaram, fica gravado no cartão.
 */
export async function concluirAutorizacaoGoogle(
  valorDoCookie: string | undefined,
  volta: { code: string; state: string; erro: string },
): Promise<{ sistema: SistemaGoogle; resultado: ResultadoGoogle }> {
  const lido = lerCookie(valorDoCookie, (d) => d.split(".")[1] ?? "");
  const [doCookie, esperado = "", verificador = ""] = (lido?.dados ?? "").split(
    ".",
  );
  // Sem cookie não dá para saber qual começou: a mensagem vai para o Google.
  const sistema = ehSistemaGoogle(doCookie) ? doCookie : "mkt_google";
  const resultado = lido
    ? await concluirGoogle(
        lido.usuarioId,
        sistema,
        volta,
        esperado,
        verificador,
      )
    : "state";
  return { sistema, resultado };
}

async function concluirGoogle(
  usuarioId: string,
  sistema: SistemaGoogle,
  volta: { code: string; state: string; erro: string },
  esperado: string,
  verificador: string,
): Promise<ResultadoGoogle> {
  if (!(await podeConfigurarAgora(usuarioId, sistema))) return "permissao";
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
      redirectUri: retornoGoogle(),
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

  const r = await salvarETestar(usuarioId, sistema, parametros, segredo);
  if (r === "salvar") return r;
  esquecerLeituras("google");
  if (escoposFaltando(sistema, novo.escopos).length > 0) return "escopos";
  return r;
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

// ---------------------------------------------------------------------------
// RD Station Marketing
// ---------------------------------------------------------------------------

/**
 * Endereço da tela de autorização do RD, com o state no cookie. O RD volta
 * para a raiz do sistema (a URL de callback do app); a tela repassa o code e
 * o state para a rota de retorno.
 */
export async function iniciarAutorizacaoRd(
  ctx: Contexto,
  clientId: string,
): Promise<Autorizacao> {
  const state = `${AUTORIZACAO_RD.prefixoState}${aleatorio(24)}`;
  const u = new URL("https://api.rd.services/auth/dialog");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", `${env.SITE_URL}/`);
  u.searchParams.set("state", state);
  return {
    url: u.toString(),
    cookie: cookie(
      COOKIE.rd,
      state,
      state,
      ctx,
      AUTORIZACAO_RD.retorno,
      60 * 60,
    ),
  };
}

/**
 * Conclui a autorização. Devolve só a chave do resultado (o texto fica em
 * RETORNO_RD, na tela): a URL de volta não carrega mensagem de ninguém. O
 * teste da conexão fica gravado no cartão, como no "Salvar e testar".
 */
export async function concluirAutorizacaoRd(
  valorDoCookie: string | undefined,
  code: string,
  state: string,
): Promise<ResultadoAutorizacao> {
  const SISTEMA = "mkt_rd_station";
  const lido = lerCookie(valorDoCookie, (d) => d);
  if (!lido) return "state";
  if (!(await podeConfigurarAgora(lido.usuarioId, SISTEMA))) return "permissao";
  if (!code || !mesmoState(state, lido.dados)) return "state";

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
  return salvarETestar(lido.usuarioId, SISTEMA, p.data, segredo);
}

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------

/** Endereço do portal de autorização do TikTok, com o state no cookie. */
export async function iniciarAutorizacaoTikTok(
  ctx: Contexto,
  appId: string,
): Promise<Autorizacao> {
  const state = aleatorio(24);
  const u = new URL("https://business-api.tiktok.com/portal/auth");
  u.searchParams.set("app_id", appId);
  u.searchParams.set("state", state);
  u.searchParams.set(
    "redirect_uri",
    `${env.SITE_URL}${AUTORIZACAO_TIKTOK.retorno}`,
  );
  return {
    url: u.toString(),
    cookie: cookie(
      COOKIE.tiktok,
      state,
      state,
      ctx,
      AUTORIZACAO_TIKTOK.retorno,
      60 * 60,
    ),
  };
}

/**
 * Conclui a autorização. O auth_code (vale 1 hora, uma vez só) vira o token
 * de Ads, que não vence. O id do anunciante (fora do formulário) fica o
 * salvo se o token o enxerga; senão, o primeiro que ele enxerga.
 */
export async function concluirAutorizacaoTikTok(
  valorDoCookie: string | undefined,
  authCode: string,
  state: string,
): Promise<ResultadoAutorizacao> {
  const SISTEMA = "mkt_tiktok";
  const lido = lerCookie(valorDoCookie, (d) => d);
  if (!lido) return "state";
  if (!(await podeConfigurarAgora(lido.usuarioId, SISTEMA))) return "permissao";
  if (!authCode || !mesmoState(state, lido.dados)) return "state";

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
      ? String(p.data.advertiser_id)
      : (autorizado.anunciantes[0] ?? ""),
  };
  const segredo = juntarSegredos(def, {
    ...segredos,
    segredo: autorizado.token,
  });
  return salvarETestar(lido.usuarioId, SISTEMA, parametros, segredo);
}
