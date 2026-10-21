import "server-only";
import { cache } from "react";
import { SISTEMAS, type Sistema } from "@/lib/integracoes";
import { PERMISSOES, type Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cofreConfigurado } from "../cofre";
import { temNoAmbiente } from "../integracoes";

// Leituras da Administração. Tudo passa pelo RLS com a sessão do usuário;
// a service role só entra para o que fica no Auth (último acesso).

const ehPermissao = (p: string): p is Permissao => p in PERMISSOES;

export interface Cargo {
  id: string;
  nome: string;
  descricao: string | null;
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
    core.from("cargos").select("id, nome, descricao").order("nome"),
    core.from("cargo_permissoes").select("cargo_id, permissao"),
    core.from("usuarios").select("cargo_id").not("cargo_id", "is", null),
  ]);
  for (const r of [lista, perms, usuarios]) if (r.error) throw r.error;
  return (lista.data ?? []).map((c) => ({
    ...c,
    permissoes: (perms.data ?? [])
      .filter((p) => p.cargo_id === c.id)
      .map((p) => p.permissao)
      .filter(ehPermissao),
    usuarios: (usuarios.data ?? []).filter((u) => u.cargo_id === c.id).length,
  }));
});

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
  return (lista.data ?? []).map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    ativo: u.ativo,
    cargoId: u.cargo_id,
    permissoes: (perms.data ?? [])
      .filter((p) => p.usuario_id === u.id)
      .map((p) => p.permissao)
      .filter(ehPermissao),
    criadoEm: u.criado_em,
    ultimoAcesso: acessos.get(u.id) ?? null,
  }));
});

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

export const empresa = cache(async (): Promise<Empresa | null> => {
  const { data, error } = await (await createClient())
    .schema("core")
    .from("empresa")
    .select(
      "nome, razao_social, cnpj, email, telefone, site, endereco, cidade, uf, cep, atualizado_em",
    )
    .maybeSingle();
  if (error) throw error;
  return data;
});

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

export async function integracoesNaTela(): Promise<{
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

  const integracoes = SISTEMAS.map((sistema): IntegracaoNaTela => {
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
