import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  // Tudo, menos o que não precisa de sessão: arquivos do build, imagens e
  // fontes (por extensão), a marca, as rotas de sincronização e rotinas
  // (protegidas por CRON_SECRET) e os links públicos do portal do lojista e
  // da OS do terceirizado (a página confere a sessão da loja ou o token).
  // Prefetch continua passando: o esqueleto das telas internas só sai para
  // quem está logado e já definiu a própria senha.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|brand/|api/sync/|api/cron/|portal/|ordem/|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|txt|xml|webmanifest)$).*)",
  ],
};
