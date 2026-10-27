import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { INICIO } from "@/config/navigation";
import { ROTA_TROCAR_SENHA, temSenhaProvisoria } from "@/lib/senha-provisoria";
import { supabasePublico } from "./config";

// Portal do lojista e link da OS do terceirizado: abrem só pelo token do
// link, sem login (a página confere o token no servidor). O matcher de
// src/proxy.ts já os deixa de fora; ficam aqui como segunda trava.
const PUBLICAS = ["/login", "/portal", "/ordem"];

/**
 * Renova a sessão a cada requisição e manda para /login quem não está
 * logado. É só a primeira barreira: a permissão de verdade é conferida
 * junto dos dados (src/server/auth.ts e RLS).
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
  const logado = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;
  const publica = PUBLICAS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!logado && !publica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.search = "";
    if (pathname !== "/") destino.searchParams.set("next", pathname + search);
    return NextResponse.redirect(destino);
  }
  // Senha provisória: nada abre antes de a pessoa definir a própria.
  const trocando = pathname === ROTA_TROCAR_SENHA;
  if (logado && temSenhaProvisoria(data?.claims) !== trocando) {
    const destino = request.nextUrl.clone();
    destino.pathname = trocando ? INICIO : ROTA_TROCAR_SENHA;
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  // Logado: "/" e "/login" levam direto para a primeira tela (Gestão).
  if (logado && (pathname === "/login" || pathname === "/")) {
    const destino = request.nextUrl.clone();
    destino.pathname = INICIO;
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return response;
}
