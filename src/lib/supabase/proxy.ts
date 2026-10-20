import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { INICIO } from "@/config/navigation";
import { supabasePublico } from "./config";

const PUBLICAS = ["/login"];

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
  // Logado: "/" e "/login" levam direto para a primeira tela (Gestão).
  if (logado && (pathname === "/login" || pathname === "/")) {
    const destino = request.nextUrl.clone();
    destino.pathname = INICIO;
    destino.search = "";
    return NextResponse.redirect(destino);
  }
  return response;
}
