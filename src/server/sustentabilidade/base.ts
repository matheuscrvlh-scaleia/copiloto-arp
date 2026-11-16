import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { dadosDe } from "@/lib/comercial/formato";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import {
  ehPermissaoDePrograma,
  type Permissao,
  permissaoDoPrograma,
} from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import type { ParametrosEntrevista } from "@/lib/sustentabilidade/situacao";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";

// Base do Módulo Sustentabilidade: quem está logado, "hoje", os clientes do
// schema sustentabilidade e as configurações (parâmetros, validades por setor,
// coletores), lidas pela service role e guardadas no cache depois de conferir
// o mesmo acesso do RLS (sustentabilidade.acessa = alguma permissão do
// módulo). Padrão em docs/arquitetura.md; contrato em docs/sustentabilidade.md.

type Su = Database["sustentabilidade"];
export type Tabela<T extends keyof Su["Tables"]> = Su["Tables"][T]["Row"];
export type Parametros = Tabela<"parametros">;
export type Coletor = Tabela<"coletores">;

export const MODULO = "sustentabilidade";

export function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

/** Cliente com a sessão, no schema sustentabilidade (RLS). */
export async function su() {
  return (await createClient()).schema("sustentabilidade");
}

/** Service role no schema sustentabilidade (só depois de conferir o acesso). */
export function suAdmin() {
  return createAdminClient().schema("sustentabilidade");
}

export interface ContextoSu {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** Tem "Programa – lançar" deste programa (ou gerencia os programas). */
  podeLancar: (programaId: string) => boolean;
  /** Programas com "Programa – lançar" da pessoa. */
  programas: string[];
  /** "aaaa-mm-dd" de hoje em Brasília. */
  hoje: string;
  /** "Dados de dd/mm/aaaa às hh:mm" (hora de Brasília) desta leitura. */
  dadosDe: string;
}

/** Usuário, permissões e a data de hoje. Lê a sessão: use em <Suspense>. */
export const contextoSu = cache(async (): Promise<ContextoSu> => {
  const usuario = await usuarioAtual();
  await connection();
  const agora = new Date();
  const programas = usuario.programas ?? [];
  const pode = (p: Permissao) => usuario.permissoes.includes(p);
  return {
    usuario,
    pode,
    programas,
    podeLancar: (id) =>
      pode("sustentabilidade.programas.gerenciar") ||
      programas.includes(permissaoDoPrograma(id)),
    hoje: hojeEmBrasilia(agora),
    dadosDe: dadosDe(agora),
  };
});

/** Tem alguma permissão do módulo (mesma regra de sustentabilidade.acessa). */
export function acessaModulo(u: Usuario): boolean {
  return (
    u.ativo &&
    (u.permissoes.some((p) => p.startsWith("sustentabilidade.")) ||
      (u.programas ?? []).some(ehPermissaoDePrograma))
  );
}

async function exigirModulo(): Promise<void> {
  if (!acessaModulo(await usuarioAtual()))
    throw new Error("Sem acesso ao módulo Sustentabilidade.");
}

/** Parâmetros do módulo (cache "referencia", invalidado ao salvar). */
export const parametros = cache(async (): Promise<Parametros> => {
  await exigirModulo();
  return parametrosDoModulo();
});

async function parametrosDoModulo(): Promise<Parametros> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.sustentabilidade.parametros);
  const { data, error } = await suAdmin()
    .from("parametros")
    .select("*")
    .eq("id", true)
    .single();
  falhar(error);
  return data;
}

/** Validade da entrevista por setor econômico (meses). */
export const validadesPorSetor = cache(
  async (): Promise<Record<string, number>> => {
    await exigirModulo();
    return validadesDoModulo();
  },
);

async function validadesDoModulo(): Promise<Record<string, number>> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.sustentabilidade.parametros);
  const { data, error } = await suAdmin()
    .from("setor_validades")
    .select("setor, meses");
  falhar(error);
  return Object.fromEntries(data.map((s) => [s.setor, s.meses]));
}

/** Parâmetros no formato das regras de situação (src/lib/sustentabilidade). */
export const parametrosDaEntrevista = cache(
  async (): Promise<ParametrosEntrevista> => {
    const [p, validadePorSetor] = await Promise.all([
      parametros(),
      validadesPorSetor(),
    ]);
    return {
      mesesPrimeira: p.meses_primeira_entrevista,
      validadePadraoMeses: p.validade_padrao_meses,
      validadePorSetor,
      avisoDias: p.aviso_dias,
    };
  },
);

/** Coletores cadastrados (ativos e inativos), na ordem da ronda. */
export const coletores = cache(async (): Promise<Coletor[]> => {
  await exigirModulo();
  return coletoresDoModulo();
});

async function coletoresDoModulo(): Promise<Coletor[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.sustentabilidade.coletores);
  const { data, error } = await suAdmin()
    .from("coletores")
    .select("*")
    .order("ordem")
    .order("local");
  falhar(error);
  return data;
}
