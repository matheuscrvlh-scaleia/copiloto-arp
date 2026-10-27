import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { INICIO } from "@/config/navigation";
import { AVISO_DE_USO_MS } from "@/config/sessao";
import { ROTA_TROCAR_SENHA, temSenhaProvisoria } from "@/lib/senha-provisoria";
import {
  assinarSessao,
  COOKIE_SESSAO,
  lerSessao,
  OPCOES_COOKIE_SESSAO,
  sessaoVencida,
} from "@/lib/sessao";
import { supabasePublico } from "./config";

// Portal do lojista e link da OS do terceirizado: abrem só pelo token do
// link, sem login (a página confere o token no servidor). O matcher de
// src/proxy.ts já os deixa de fora; ficam aqui como segunda trava.
const PUBLICAS = ["/login", "/portal", "/ordem"];

/** Aviso de uso que o navegador manda quando a pessoa mexe na tela. */
export const ROTA_AVISO_DE_USO = "/api/sessao";

/**
 * Renova a sessão a cada requisição, encerra a que venceu (8h ou 30 min
 * parada, ver src/lib/sessao.ts) e manda para /login quem não está logado.
 * É só a primeira barreira: a permissão de verdade é conferida junto dos
 * dados (src/server/auth.ts e RLS).
 */
export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabasePublico();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Valida o token (não confia só no cookie).
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  const { pathname, search } = request.nextUrl;
  const publica = PUBLICAS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  let logado = Boolean(sub);
  let expirou = false;
  if (sub) {
    const agora = Date.now();
    const prazo = await lerSessao(request.cookies.get(COOKIE_SESSAO)?.value);
    if (sessaoVencida(prazo, sub, agora)) {
      // Revoga no Supabase também: o refresh token deixa de valer.
      await supabase.auth.signOut({ scope: "local" });
      response.cookies.delete(COOKIE_SESSAO);
      logado = false;
      expirou = true;
    } else if (
      prazo &&
      usoDaPessoa(request) &&
      agora - prazo.ultima > AVISO_DE_USO_MS
    ) {
      response.cookies.set(
        COOKIE_SESSAO,
        await assinarSessao({ ...prazo, ultima: agora }),
        OPCOES_COOKIE_SESSAO,
      );
    }
  }

  // Leva junto os cookies desta resposta (token renovado, sessão encerrada):
  // sem eles, o refresh token já trocado se perde e a pessoa cai do sistema.
  const redirecionar = (
    caminho: string,
    params: Record<string, string> = {},
  ) => {
    const destino = request.nextUrl.clone();
    destino.pathname = caminho;
    destino.search = new URLSearchParams(params).toString();
    const r = NextResponse.redirect(destino);
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };

  if (!logado && !publica) {
    const params: Record<string, string> = {};
    if (pathname !== "/") params.next = pathname + search;
    if (expirou) params.motivo = "expirou";
    return redirecionar("/login", params);
  }
  if (!logado) return response;
  // Senha provisória: nada abre antes de a pessoa definir a própria.
  const trocando = pathname === ROTA_TROCAR_SENHA;
  if (temSenhaProvisoria(data?.claims) !== trocando) {
    return redirecionar(trocando ? INICIO : ROTA_TROCAR_SENHA);
  }
  // Logado: "/" e "/login" levam direto para a primeira tela (Gestão).
  if (pathname === "/login" || pathname === "/") return redirecionar(INICIO);
  return response;
}

/**
 * Conta como uso: abrir ou navegar entre telas e o aviso do navegador. Não
 * contam prefetch nem server actions, que rodam sozinhas (o sino busca
 * notificações de tempos em tempos); quem envia formulário mexeu na tela
 * antes, e o aviso de uso já foi.
 */
function usoDaPessoa(request: NextRequest): boolean {
  if (request.nextUrl.pathname === ROTA_AVISO_DE_USO) return true;
  return (
    request.method === "GET" &&
    !request.headers.has("next-router-prefetch") &&
    !request.headers.has("next-action")
  );
}
