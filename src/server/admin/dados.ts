import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import {
  type DefinicaoIntegracao,
  INTEGRACOES,
  SISTEMAS,
  type Sistema,
} from "@/lib/integracoes";
import { PERMISSOES, type Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "../auth";
import { TAG } from "../cache";
import { cofreConfigurado } from "../cofre";
import { temNoAmbiente } from "../integracoes";

// Leituras da Administração. Tudo passa pelo RLS com a sessão do usuário;
// a service role só entra para o que fica no Auth (último acesso) e para os
// dados da empresa, que todo usuário logado lê e ficam no cache
// (TAG.empresa).

const ehPermissao = (p: string): p is Permissao => p in PERMISSOES;

export interface Cargo {
  id: string;
  nome: string;
  descricao: string | null;
  /** Inativo continua nos usuários, mas não dá permissão. */
  ativo: boolean;
  permissoes: Permissao[];
  usuarios: number;
}

export interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  cargoId: string | null;
  /** Permissões individuais (fora as do cargo). */
  permissoes: Permissao[];
  criadoEm: string;
  ultimoAcesso: string | null;
}

export const cargos = cache(async (): Promise<Cargo[]> => {
  const core = (await createClient()).schema("core");
  const [lista, perms, usuarios] = await Promise.all([
    core.from("cargos").select("id, nome, descricao, ativo").order("nome"),
    core.from("cargo_permissoes").select("cargo_id, permissao"),
    core.from("usuarios").select("cargo_id").not("cargo_id", "is", null),
  ]);
  for (const r of [lista, perms, usuarios]) if (r.error) throw r.error;
  // Agrupa uma vez (em vez de filtrar a lista inteira para cada cargo).
  const permissoesDe = new Map<string, Permissao[]>();
  for (const p of perms.data ?? []) {
    if (!ehPermissao(p.permissao)) continue;
    permissoesDe.set(p.cargo_id, [
      ...(permissoesDe.get(p.cargo_id) ?? []),
      p.permissao,
    ]);
  }
  const usuariosDe = new Map<string, number>();
  for (const u of usuarios.data ?? []) {
    if (u.cargo_id)
      usuariosDe.set(u.cargo_id, (usuariosDe.get(u.cargo_id) ?? 0) + 1);
  }
  return (lista.data ?? []).map((c) => ({
    ...c,
    permissoes: permissoesDe.get(c.id) ?? [],
    usuarios: usuariosDe.get(c.id) ?? 0,
  }));
});

/** Só o que a escolha de cargo mostra (vai para o navegador). */
export function cargosParaEscolha(lista: Cargo[]) {
  return lista.map(({ id, nome, ativo, permissoes }) => ({
    id,
    nome,
    ativo,
    permissoes,
  }));
}

/** Data do último login de cada usuário (fica no Auth). */
async function ultimosAcessos(): Promise<Map<string, string | null>> {
  const { data, error } = await createAdminClient().auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) throw new Error(`Falha ao ler o Auth: ${error.message}`);
  return new Map(data.users.map((u) => [u.id, u.last_sign_in_at ?? null]));
}

export const usuarios = cache(async (): Promise<UsuarioAdmin[]> => {
  const core = (await createClient()).schema("core");
  const [lista, perms, acessos] = await Promise.all([
    core
      .from("usuarios")
      .select("id, nome, email, ativo, cargo_id, criado_em")
      .order("nome"),
    core.from("usuario_permissoes").select("usuario_id, permissao"),
    ultimosAcessos(),
  ]);
  if (lista.error) throw lista.error;
  if (perms.error) throw perms.error;
  const individuais = new Map<string, Permissao[]>();
  for (const p of perms.data ?? []) {
    if (!ehPermissao(p.permissao)) continue;
    individuais.set(p.usuario_id, [
      ...(individuais.get(p.usuario_id) ?? []),
      p.permissao,
    ]);
  }
  return (lista.data ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    cargoId: u.cargo_id,
    permissoes: individuais.get(u.id) ?? [],
    criadoEm: u.criado_em,
    ultimoAcesso: acessos.get(u.id) ?? null,
  }));
});

/** Um usuário (tela de edição), sem ler a lista inteira nem todo o Auth. */
export const usuarioAdmin = cache(
  async (id: string): Promise<UsuarioAdmin | null> => {
    const core = (await createClient()).schema("core");
    const [perfil, perms] = await Promise.all([
      core
        .from("usuarios")
        .select("id, nome, email, ativo, cargo_id, criado_em")
        .eq("id", id)
        .maybeSingle(),
      core.from("usuario_permissoes").select("permissao").eq("usuario_id", id),
    ]);
    if (perfil.error) throw perfil.error;
    if (perms.error) throw perms.error;
    // O RLS decide se a pessoa aparece; só então o Auth (último acesso).
    const u = perfil.data;
    if (!u) return null;
    const auth = await createAdminClient().auth.admin.getUserById(id);
    if (auth.error && auth.error.status !== 404)
      throw new Error(`Falha ao ler o Auth: ${auth.error.message}`);
    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      ativo: u.ativo,
      cargoId: u.cargo_id,
      permissoes: (perms.data ?? [])
        .map((p) => p.permissao)
        .filter(ehPermissao),
      criadoEm: u.criado_em,
      ultimoAcesso: auth.data.user?.last_sign_in_at ?? null,
    };
  },
);

// ---------------------------------------------------------------------------

export interface Empresa {
  nome: string;
  razao_social: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  atualizado_em: string;
}

/**
 * Dados da empresa. O RLS deixa todo usuário logado ler a linha; por isso
 * basta a sessão validada para devolver a cópia do cache. Quem grava chama
 * updateTag(TAG.empresa).
 */
export const empresa = cache(async (): Promise<Empresa | null> => {
  await usuarioAtual();
  return empresaDoCache();
});

// Não exportar: lê pela service role, só depois de conferir a sessão acima.
async function empresaDoCache(): Promise<Empresa | null> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.empresa);
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("empresa")
    .select(
      "nome, razao_social, cnpj, email, telefone, site, endereco, cidade, uf, cep, atualizado_em",
    )
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler a empresa: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------

export interface IntegracaoNaTela {
  sistema: Sistema;
  /** "tela": salva na Administração; "ambiente": vem do .env; null: nenhuma. */
  origem: "tela" | "ambiente" | null;
  parametros: Record<string, unknown>;
  ativa: boolean;
  configuradoPor: string | null;
  configuradoEm: string | null;
  testadoEm: string | null;
  testeOk: boolean | null;
  testeMensagem: string | null;
}

export interface Execucao {
  sistema: string;
  recurso: string;
  status: "rodando" | "sucesso" | "erro";
  iniciado_em: string;
  finalizado_em: string | null;
  registros: number;
  erro: string | null;
  /** O que a execução pediu para conferir (sem dado pessoal). */
  avisos: string[];
}

/** Integrações de um módulo (Administração ou Marketing), com a situação. */
export async function integracoesNaTela(
  modulo: DefinicaoIntegracao["modulo"] = "admin",
): Promise<{
  cofre: boolean;
  integracoes: IntegracaoNaTela[];
  historico: Execucao[];
}> {
  const core = (await createClient()).schema("core");
  const [conf, hist] = await Promise.all([
    core.rpc("integracoes_configuradas"),
    core.rpc("historico_integracoes", { p_limite: 15 }),
  ]);
  if (conf.error) throw conf.error;
  if (hist.error) throw hist.error;

  const doModulo = SISTEMAS.filter((s) => INTEGRACOES[s].modulo === modulo);
  const integracoes = doModulo.map((sistema): IntegracaoNaTela => {
    const c = (conf.data ?? []).find((r) => r.sistema === sistema);
    if (c) {
      return {
        sistema,
        origem: "tela",
        parametros: (c.parametros ?? {}) as Record<string, unknown>,
        ativa: c.ativa,
        configuradoPor: c.configurado_por,
        configuradoEm: c.configurado_em,
        testadoEm: c.testado_em,
        testeOk: c.teste_ok,
        testeMensagem: c.teste_mensagem,
      };
    }
    const ambiente = temNoAmbiente(sistema);
    return {
      sistema,
      origem: ambiente ? "ambiente" : null,
      parametros: {},
      ativa: ambiente,
      configuradoPor: null,
      configuradoEm: null,
      testadoEm: null,
      testeOk: null,
      testeMensagem: null,
    };
  });

  return {
    cofre: cofreConfigurado(),
    integracoes,
    historico: (hist.data ?? []).map((h) => ({
      ...h,
      avisos: Array.isArray(h.avisos)
        ? h.avisos.filter((a): a is string => typeof a === "string")
        : [],
    })),
  };
}
