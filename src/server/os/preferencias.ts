import "server-only";
import { cache } from "react";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { contexto } from "./base";

// Preferências de cada usuário (core.preferencias, RLS "proprias"): os
// filtros lembrados de cada tela, o setor escolhido e o dia em que o "Seu
// dia" já foi visto. Nunca é dado do negócio: falhar aqui não derruba tela.

async function core() {
  return (await createClient()).schema("core");
}

/**
 * Todas as preferências de Tickets da pessoa, numa leitura por requisição:
 * os filtros da tela e o "Seu dia" saem da mesma consulta (são poucas
 * linhas, só as da própria pessoa).
 */
const preferenciasDoModulo = cache(async (): Promise<Map<string, Json>> => {
  const { data, error } = await (await core())
    .from("preferencias")
    .select("chave, valor")
    .like("chave", "os.%");
  if (error) {
    console.error("preferências", error);
    return new Map();
  }
  return new Map((data ?? []).map((p) => [p.chave, p.valor]));
});

/** Valor guardado na chave; null se não houver ou não der para ler. */
export async function lerPreferencia(chave: string): Promise<Json | null> {
  return (await preferenciasDoModulo()).get(chave) ?? null;
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
