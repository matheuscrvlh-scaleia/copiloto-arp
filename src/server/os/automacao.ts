import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Calendario } from "@/lib/os/prazo";
import { createAdminClient } from "@/lib/supabase/admin";
import { TAG } from "@/server/cache";
import {
  calendarioDe,
  membrosDoSetor,
  type Notificacao,
  notificar,
  osAdmin,
  type Parametros,
} from "./base";

// Apoio das rotinas (cron, service role, sem sessão): parâmetros e
// calendário lidos sem RLS, quem usa o módulo e notificação que não se
// repete. As telas usam as versões com sessão de base.ts. Parâmetros e
// feriados são os mesmos para todos: vêm do cache (as telas que gravam
// neles invalidam TAG.os.parametros e TAG.os.feriados).

export interface ConfigDoSistema {
  p: Parametros;
  cal: Calendario;
}

export async function configDoSistema(): Promise<ConfigDoSistema> {
  const { p, feriados } = await configEmCache();
  return { p, cal: calendarioDe(p, feriados) };
}

// Sem argumentos e sem nada da sessão: a mesma linha para todo mundo.
async function configEmCache(): Promise<{ p: Parametros; feriados: string[] }> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.parametros, TAG.os.feriados);
  const db = osAdmin();
  const [p, feriados] = await Promise.all([
    db.from("parametros").select("*").eq("id", 1).single(),
    db.from("feriados").select("data"),
  ]);
  if (p.error) throw new Error(`Parâmetros: ${p.error.message}`);
  if (feriados.error) throw new Error(`Feriados: ${feriados.error.message}`);
  return { p: p.data, feriados: (feriados.data ?? []).map((f) => f.data) };
}

/** Membros de cada setor, lidos uma vez por rodada. */
export function cacheDeSetores() {
  const todos = new Map<string, Promise<string[]>>();
  const gestores = new Map<string, Promise<string[]>>();
  return {
    membros: (setor: string) => {
      const m = todos.get(setor) ?? membrosDoSetor(setor);
      todos.set(setor, m);
      return m;
    },
    gestores: (setor: string) => {
      const m = gestores.get(setor) ?? membrosDoSetor(setor, true);
      gestores.set(setor, m);
      return m;
    },
  };
}

export interface AvisoPlanejado extends Notificacao {
  usuarios: string[];
  chave: string;
}

/**
 * Notifica só quem ainda não recebeu o aviso com a mesma chave. Devolve
 * quantas notificações novas saíram (a rotina roda de hora em hora e não
 * pode contar de novo o que já avisou).
 */
export async function notificarUmaVez(
  avisos: AvisoPlanejado[],
): Promise<number> {
  const comGente = avisos.filter((a) => a.usuarios.length > 0);
  if (!comGente.length) return 0;
  const ja = new Set<string>();
  const chaves = [...new Set(comGente.map((a) => a.chave))];
  // Lotes pequenos: cada chave tem uns 80 caracteres na URL, e a URL do
  // PostgREST tem limite (200 chaves passariam de 16 KB).
  for (let i = 0; i < chaves.length; i += 50) {
    const { data, error } = await osAdmin()
      .from("notificacoes")
      .select("usuario_id, chave")
      .in("chave", chaves.slice(i, i + 50));
    if (error) throw new Error(`Notificações: ${error.message}`);
    for (const n of data ?? []) ja.add(`${n.usuario_id}|${n.chave}`);
  }
  let novas = 0;
  for (const { usuarios, ...n } of comGente) {
    const faltam = [...new Set(usuarios)].filter(
      (u) => !ja.has(`${u}|${n.chave}`),
    );
    if (!faltam.length) continue;
    await notificar(faltam, n);
    novas += faltam.length;
  }
  return novas;
}

export interface UsuarioDoModulo {
  id: string;
  nome: string;
}

/**
 * Usuários ativos com alguma permissão do módulo (cargo ou individual),
 * lidos com a service role: os.pessoas() depende da sessão.
 */
export async function usuariosDoModulo(): Promise<UsuarioDoModulo[]> {
  const core = createAdminClient().schema("core");
  const [usuarios, individuais, cargos] = await Promise.all([
    core.from("usuarios").select("id, nome, cargo_id").eq("ativo", true),
    core
      .from("usuario_permissoes")
      .select("usuario_id")
      .like("permissao", "os.%"),
    core
      .from("cargo_permissoes")
      .select("cargo_id, cargos!inner(ativo)")
      .like("permissao", "os.%")
      .eq("cargos.ativo", true),
  ]);
  for (const r of [usuarios, individuais, cargos])
    if (r.error) throw new Error(`Usuários do módulo: ${r.error.message}`);
  const porPessoa = new Set((individuais.data ?? []).map((p) => p.usuario_id));
  const porCargo = new Set((cargos.data ?? []).map((c) => c.cargo_id));
  return (usuarios.data ?? [])
    .filter(
      (u) => porPessoa.has(u.id) || (u.cargo_id && porCargo.has(u.cargo_id)),
    )
    .map((u) => ({ id: u.id, nome: u.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
