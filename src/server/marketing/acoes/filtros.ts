"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Últimos filtros de cada pessoa por tela (spec 4.3: "o sistema lembra os
// últimos filtros de cada usuário"). Vazio apaga (botão Limpar). Nunca falha
// a tela: sem registro, só fica o aviso no log.

const entrada = z.object({
  tela: z.string().regex(/^[a-z_]+$/),
  // Só a query da própria tela (ex.: "periodo=mes&plataforma=meta").
  query: z.string().max(500),
});

export async function lembrarFiltros(tela: string, query: string) {
  const ok = entrada.safeParse({ tela, query });
  if (!ok.success) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const usuario = data?.claims?.sub;
  if (!usuario) return;
  const chave = `marketing.filtros.${ok.data.tela}`;
  const core = supabase.schema("core");
  const { error } = ok.data.query
    ? await core
        .from("preferencias")
        .upsert(
          { usuario_id: usuario, chave, valor: ok.data.query },
          { onConflict: "usuario_id,chave" },
        )
    : await core.from("preferencias").delete().eq("chave", chave);
  if (error) console.error("lembrar filtros", chave, error);
}
