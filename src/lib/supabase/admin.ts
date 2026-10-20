import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabasePublico } from "./config";
import type { Database } from "./database.types";

/**
 * Cliente com a service role: IGNORA o RLS. Só para sincronizações, tarefas
 * do servidor e o que só ela faz no Auth (criar usuário, trocar senha,
 * bloquear acesso), sempre depois de conferir a permissão de quem pediu.
 * Nunca para ler dados do negócio em nome do usuário.
 */
export function createAdminClient() {
  const { url } = supabasePublico();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error(
      "Supabase não configurado: defina SUPABASE_SERVICE_ROLE_KEY",
    );
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
