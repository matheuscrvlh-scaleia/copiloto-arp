import "server-only";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { contexto } from "./base";

// Preferências de cada usuário (core.preferencias, RLS "proprias"): os
// filtros lembrados de cada tela, o setor escolhido e o dia em que o "Seu
// dia" já foi visto. Nunca é dado do negócio: falhar aqui não derruba tela.

async function core() {
  return (await createClient()).schema("core");
}

/** Valor guardado na chave; null se não houver ou não der para ler. */
export async function lerPreferencia(chave: string): Promise<Json | null> {
  const { data, error } = await (await core())
    .from("preferencias")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();
  if (error) {
    console.error("preferência", chave, error);
    return null;
  }
  return data?.valor ?? null;
}

/** Várias chaves numa leitura só (filtros da tela + "Seu dia"). */
export async function lerPreferencias(
  chaves: string[],
): Promise<Map<string, Json>> {
  const { data, error } = await (await core())
    .from("preferencias")
    .select("chave, valor")
    .in("chave", chaves);
  if (error) {
    console.error("preferências", chaves, error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.chave, p.valor]));
}

export async function gravarPreferencia(
  chave: string,
  valor: Json,
): Promise<boolean> {
  const { usuario } = await contexto();
  const { error } = await (await core())
    .from("preferencias")
    .upsert(
      { usuario_id: usuario.id, chave, valor },
      { onConflict: "usuario_id,chave" },
    );
  if (error) console.error("gravar preferência", chave, error);
  return !error;
}
