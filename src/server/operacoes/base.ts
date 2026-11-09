import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { dadosDe } from "@/lib/comercial/formato";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";

// Base do módulo Operações: quem está logado, "hoje", os clientes do schema
// operacoes e os parâmetros (linha única), lidos pela service role e
// guardados no cache depois de conferir o mesmo acesso do RLS
// (operacoes.acessa = core.pode_modulo('operacoes')). Padrão em
// docs/arquitetura.md.

type Op = Database["operacoes"];
export type Tabela<T extends keyof Op["Tables"]> = Op["Tables"][T]["Row"];
export type Parametros = Tabela<"parametros">;
export type Importacao = Tabela<"importacoes">;

export function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

/** Cliente com a sessão, no schema operacoes (RLS). */
export async function op() {
  return (await createClient()).schema("operacoes");
}

/** Service role no schema operacoes (só depois de conferir o acesso). */
export function opAdmin() {
  return createAdminClient().schema("operacoes");
}

export interface ContextoOp {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: string;
  /** "Dados de dd/mm/aaaa às hh:mm" (hora de Brasília) desta leitura. */
  dadosDe: string;
}

/** Usuário, permissões e a data de hoje. Lê a sessão: use em <Suspense>. */
export const contextoOp = cache(async (): Promise<ContextoOp> => {
  const usuario = await usuarioAtual();
  await connection();
  const agora = new Date();
  return {
    usuario,
    pode: (p) => usuario.permissoes.includes(p),
    hoje: hojeEmBrasilia(agora),
    dadosDe: dadosDe(agora),
  };
});

/** Mesmo acesso que o RLS exige dos parâmetros (operacoes.acessa). */
async function exigirModulo(): Promise<void> {
  const u = await usuarioAtual();
  if (!u.ativo || !u.permissoes.some((p) => p.startsWith("operacoes.")))
    throw new Error("Sem acesso ao módulo Operações.");
}

/** Parâmetros do módulo (cache "referencia", invalidado ao salvar). */
export const parametros = cache(async (): Promise<Parametros> => {
  await exigirModulo();
  return parametrosDoModulo();
});

async function parametrosDoModulo(): Promise<Parametros> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.operacoes.parametros);
  const { data, error } = await opAdmin()
    .from("parametros")
    .select("*")
    .eq("id", true)
    .single();
  falhar(error);
  return data;
}
