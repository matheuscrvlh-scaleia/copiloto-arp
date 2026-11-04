"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { chaveDosFiltros, MODULOS_COM_FILTROS } from "./filtros";

// Grava os últimos filtros da pessoa na tela (spec 4.3). Vazio apaga (botão
// Limpar). Nunca falha a tela: sem registro, só fica o aviso no log.

const entrada = z.object({
  modulo: z.enum(MODULOS_COM_FILTROS),
  tela: z.string().regex(/^[a-z_]+$/),
  // Só a query da própria tela (ex.: "periodo=mes&plataforma=meta").
  query: z.string().max(500),
});

export async function lembrarFiltros(
  modulo: string,
  tela: string,
  query: string,
) {
  const ok = entrada.safeParse({ modulo, tela, query });
  if (!ok.success) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const usuario = data?.claims?.sub;
  if (!usuario) return;
  const chave = chaveDosFiltros(ok.data.modulo, ok.data.tela);
  const core = supabase.schema("core");
  const { error } = ok.data.query
    ? await core
        .from("preferencias")
        .upsert(
          { usuario_id: usuario, chave, valor: ok.data.query },
          { onConflict: "usuario_id,chave" },
        )
    : await core
        .from("preferencias")
        .delete()
        .eq("usuario_id", usuario)
        .eq("chave", chave);
  if (error) console.error("lembrar filtros", chave, error);
}
