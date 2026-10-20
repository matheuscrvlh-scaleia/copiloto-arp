import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublico } from "./config";
import type { Database } from "./database.types";

/**
 * Cliente com a sessão do usuário logado: tudo passa pelo RLS.
 * Lê cookies, então quem usa precisa estar dentro de <Suspense>.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabasePublico();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component não grava cookie; o proxy renova a sessão.
        }
      },
    },
  });
}
