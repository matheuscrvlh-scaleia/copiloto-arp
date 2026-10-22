import "server-only";
import type { Evento, Modulo } from "@/lib/historico";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// Eventos do sistema que não são alteração de linha (essas já caem em
// core.auditoria): entrar, errar a senha, trocar senha, testar integração…
// Grava com a service role porque parte deles não tem sessão. Nunca falha
// a ação de quem pediu: sem registro, só fica o aviso no log do servidor.

export async function registrarEvento(e: {
  modulo: Modulo;
  evento: Evento;
  descricao: string;
  /** Quem fez; null quando não há sessão (login errado, cron). */
  usuarioId: string | null;
  /** Contexto (e-mail digitado, sistema, resultado). Nunca senha nem token. */
  detalhes?: Record<string, Json | undefined>;
}): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .schema("core")
      .from("logs")
      .insert({
        modulo: e.modulo,
        evento: e.evento,
        descricao: e.descricao.slice(0, 500),
        usuario_id: e.usuarioId,
        detalhes: (e.detalhes ?? {}) as Json,
      });
    if (error) throw error;
  } catch (erro) {
    console.error("registro do evento", e.evento, erro);
  }
}
