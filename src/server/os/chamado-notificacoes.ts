"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/server/auth";

// Sininho: as notificações do módulo Chamados e OS (os.notificacoes). O
// sino do menu busca daqui ao carregar e ao abrir, e marca como lida. O RLS
// só deixa ler e marcar as do próprio usuário.

export interface NotificacaoDoSino {
  id: number;
  tipo: string;
  titulo: string;
  texto: string | null;
  href: string;
  criado_em: string;
}

async function tabela() {
  return (await createClient()).schema("os").from("notificacoes");
}

/** Não lidas mais recentes de quem está logado (vazio sem o módulo). */
export async function minhasNotificacoes(): Promise<NotificacaoDoSino[]> {
  const usuario = await usuarioAtual();
  if (!usuario.permissoes.some((p) => p.startsWith("os."))) return [];
  const { data, error } = await (await tabela())
    .select("id, tipo, titulo, texto, href, criado_em")
    .eq("usuario_id", usuario.id)
    .is("lida_em", null)
    .order("criado_em", { ascending: false })
    .limit(30);
  if (error) {
    console.error("notificações", error);
    return [];
  }
  return data ?? [];
}

export async function marcarNotificacaoLida(id: number): Promise<void> {
  if (!z.number().int().positive().safeParse(id).success) return;
  const usuario = await usuarioAtual();
  await (await tabela())
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id)
    .eq("usuario_id", usuario.id);
}

export async function marcarTodasLidas(): Promise<void> {
  const usuario = await usuarioAtual();
  await (await tabela())
    .update({ lida_em: new Date().toISOString() })
    .eq("usuario_id", usuario.id)
    .is("lida_em", null);
}
