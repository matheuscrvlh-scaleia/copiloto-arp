import type { NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return atualizarSessao(request);
}

export const config = {
  // Tudo, menos arquivos estáticos, imagens da marca e as rotas de
  // sincronização e rotinas (protegidas por CRON_SECRET).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|brand/|api/sync/|api/cron/).*)",
  ],
};
