import "server-only";
import { cache } from "react";
import { diferencas, TABELAS, tabelasQueCasam } from "@/lib/historico";
import { etiquetasMaisUsadas } from "@/lib/os/catalogo";
import {
  type FiltrosHistoricoOS,
  numeroBuscado,
  POR_PAGINA_HISTORICO,
} from "@/lib/os/configuracoes";
import { createClient } from "@/lib/supabase/server";
import { CAMINHOS_PAPEL_TIMBRADO } from "@/server/os/pdf/papel-timbrado";
import {
  contexto,
  nomes,
  os,
  pessoas,
  type Tabela,
  urlsAssinadas,
} from "./base";

// Leituras da tela Configurações do módulo (spec 4.5 e 4.15). Tudo com a
// sessão (RLS): cada tabela já diz quem vê; a tela só esconde o que a
// pessoa não pode editar.

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

export type Agenda = Pick<Tabela<"agendas">, "id" | "nome" | "ativo">;

export const agendas = cache(async (): Promise<Agenda[]> => {
  const { data, error } = await (await os())
    .from("agendas")
    .select("id, nome, ativo")
    .order("nome");
  falhar(error);
  return data ?? [];
});

/**
 * Chamados de cada categoria (fora da lixeira). Conta o que a pessoa vê:
 * quem configura o catálogo costuma ver todos os setores.
 */
export async function chamadosPorCategoria(
  ids: string[],
): Promise<Map<string, number>> {
  const cliente = await os();
  const contagens = await Promise.all(
    ids.map(async (id) => {
      const { count, error } = await cliente
        .from("chamados")
        .select("id", { count: "exact", head: true })
        .eq("categoria_id", id)
        .is("lixeira_em", null);
      falhar(error);
      return [id, count ?? 0] as const;
    }),
  );
  return new Map(contagens);
}

/** Etiquetas mais usadas nos últimos 1.000 chamados (só informativo). */
export async function etiquetasRecentes() {
  const { data, error } = await (await os())
    .from("chamados")
    .select("etiquetas")
    .not("etiquetas", "eq", "{}")
    .order("criado_em", { ascending: false })
    .limit(1000);
  falhar(error);
  return etiquetasMaisUsadas(
    (data ?? []).map((c) => c.etiquetas),
    24,
  );
}

export type Membro = Tabela<"setor_membros">;

export const membros = cache(async (): Promise<Membro[]> => {
  const { data, error } = await (await os()).from("setor_membros").select("*");
  falhar(error);
  return data ?? [];
});

export type Tecnico = Tabela<"tecnicos"> & {
  valores: Tabela<"tecnico_valores">[];
};

/** Técnicos e o histórico de valor por minuto (só quem pode ver custos). */
export async function tecnicos(): Promise<Tecnico[]> {
  const cliente = await os();
  const [t, v] = await Promise.all([
    cliente.from("tecnicos").select("*").order("nome"),
    cliente
      .from("tecnico_valores")
      .select("*")
      .order("vigente_desde", { ascending: false }),
  ]);
  falhar(t.error);
  falhar(v.error);
  return (t.data ?? []).map((tec) => ({
    ...tec,
    valores: (v.data ?? []).filter((x) => x.tecnico_id === tec.id),
  }));
}

export type Empresa = Tabela<"empresas"> & {
  profissionais: Tabela<"profissionais">[];
};

export async function empresas(): Promise<Empresa[]> {
  const cliente = await os();
  const [e, p] = await Promise.all([
    cliente.from("empresas").select("*").order("nome"),
    cliente.from("profissionais").select("*").order("nome"),
  ]);
  falhar(e.error);
  falhar(p.error);
  return (e.data ?? []).map((emp) => ({
    ...emp,
    profissionais: (p.data ?? []).filter((x) => x.empresa_id === emp.id),
  }));
}

export async function contatos(): Promise<Tabela<"contatos">[]> {
  const { data, error } = await (await os())
    .from("contatos")
    .select("*")
    .order("nome");
  falhar(error);
  return data ?? [];
}

export async function feriados(): Promise<Tabela<"feriados">[]> {
  const { data, error } = await (await os())
    .from("feriados")
    .select("*")
    .order("data");
  falhar(error);
  return data ?? [];
}

export async function metas(): Promise<Tabela<"metas">[]> {
  const { data, error } = await (await os()).from("metas").select("*");
  falhar(error);
  return data ?? [];
}

export async function ativoCategorias(): Promise<Tabela<"ativo_categorias">[]> {
  const { data, error } = await (await os())
    .from("ativo_categorias")
    .select("*")
    .order("nome");
  falhar(error);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Auditoria (core.auditoria): o RLS libera as tabelas os.* com os.historico
// ---------------------------------------------------------------------------

export interface Alteracao {
  id: number;
  em: string;
  tabela: string;
  registroId: string;
  acao: "insert" | "update" | "delete";
  autor: string;
  antes: Record<string, unknown> | null;
  depois: Record<string, unknown> | null;
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;

interface LinhaAuditoria {
  id: number;
  em: string;
  tabela: string;
  registro_id: string;
  acao: string;
  usuario_id: string | null;
  antes: unknown;
  depois: unknown;
}

async function comAutores(linhas: LinhaAuditoria[]): Promise<Alteracao[]> {
  const nomesPorId = await nomes();
  return linhas.map((l) => ({
    id: l.id,
    em: l.em,
    tabela: l.tabela,
    registroId: l.registro_id,
    acao: l.acao as Alteracao["acao"],
    autor: l.usuario_id
      ? (nomesPorId.get(l.usuario_id) ?? "Outro usuário")
      : "Sistema",
    antes: objeto(l.antes),
    depois: objeto(l.depois),
  }));
}

/** Quem vê o histórico do módulo (os.historico ou o histórico geral). */
export async function podeVerHistorico(): Promise<boolean> {
  const ctx = await contexto();
  return ctx.pode("os.historico") || ctx.pode("admin.historico");
}

/**
 * Últimas alterações de um bloco de Parâmetros. `campos` separa os blocos
 * que dividem a linha única de os.parametros: só entra a alteração que
 * mexeu num campo do bloco. null: a pessoa não vê o histórico (a tela
 * esconde o bloco).
 */
export async function ultimasAlteracoes(
  tabelas: string[],
  { campos, limite = 5 }: { campos?: string[]; limite?: number } = {},
): Promise<Alteracao[] | null> {
  if (!(await podeVerHistorico())) return null;
  const { data, error } = await (await createClient())
    .schema("core")
    .from("auditoria")
    .select("id, em, tabela, registro_id, acao, usuario_id, antes, depois")
    .in("tabela", tabelas)
    .order("em", { ascending: false })
    .limit(campos ? limite * 10 : limite);
  falhar(error);
  const linhas = (data ?? []).filter(
    (l) =>
      !campos ||
      l.tabela !== "os.parametros" ||
      diferencas(objeto(l.antes), objeto(l.depois)).some((d) =>
        campos.includes(d.campo),
      ),
  );
  return comAutores(linhas.slice(0, limite));
}

/** Termo de busca seguro para o filtro do PostgREST (sem vírgula nem parênteses). */
const termoSeguro = (t: string) =>
  t.replace(/[^\p{L}\p{N} @._-]/gu, " ").trim();

/** Histórico do módulo inteiro, com filtros e página. */
export async function historicoDoModulo(f: FiltrosHistoricoOS): Promise<{
  linhas: Alteracao[];
  total: number;
}> {
  let q = (await createClient())
    .schema("core")
    .from("auditoria")
    .select("id, em, tabela, registro_id, acao, usuario_id, antes, depois", {
      count: "exact",
    })
    .like("tabela", "os.%")
    .order("em", { ascending: false })
    .range(
      (f.pagina - 1) * POR_PAGINA_HISTORICO,
      f.pagina * POR_PAGINA_HISTORICO - 1,
    );
  if (f.tabela) q = q.eq("tabela", f.tabela);
  if (f.usuario) q = q.eq("usuario_id", f.usuario);
  if (f.registro) q = q.eq("registro_id", f.registro);
  if (f.de) q = q.gte("em", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("em", `${f.ate}T23:59:59-03:00`);

  const termo = termoSeguro(f.busca);
  if (termo) {
    const ou = [`registro_id.ilike.*${termo}*`];
    const numero = numeroBuscado(f.busca);
    if (numero !== null) {
      const { data } = await (await os())
        .from("chamados")
        .select("id")
        .eq("numero", numero)
        .maybeSingle();
      if (data) ou.push(`registro_id.eq.${data.id}`);
    }
    const tabelas = tabelasQueCasam(termo).filter((t) => t.startsWith("os."));
    if (tabelas.length) ou.push(`tabela.in.(${tabelas.join(",")})`);
    const semAcento = (t: string) =>
      t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const autores = (await pessoas())
      .filter((p) => semAcento(p.nome).includes(semAcento(termo)))
      .map((p) => p.id);
    if (autores.length) ou.push(`usuario_id.in.(${autores.join(",")})`);
    q = q.or(ou.join(","));
  }

  const { data, error, count } = await q;
  falhar(error);
  return { linhas: await comAutores(data ?? []), total: count ?? 0 };
}

/** Tabelas do módulo para o filtro (nome na tela). */
export const TABELAS_OS = Object.entries(TABELAS)
  .filter(([t]) => t.startsWith("os."))
  .map(([tabela, nome]) => ({ tabela, nome }))
  .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

// ---------------------------------------------------------------------------
// Lixeira e papel timbrado
// ---------------------------------------------------------------------------

export type ChamadoNaLixeira = Pick<
  Tabela<"chamados">,
  | "id"
  | "numero"
  | "tipo"
  | "titulo"
  | "setor_id"
  | "status"
  | "lixeira_em"
  | "lixeira_por"
  | "aberto_por"
  | "criado_em"
  | "exemplo"
>;

export async function chamadosNaLixeira(): Promise<ChamadoNaLixeira[]> {
  const { data, error } = await (await os())
    .from("chamados")
    .select(
      "id, numero, tipo, titulo, setor_id, status, lixeira_em, lixeira_por, aberto_por, criado_em, exemplo",
    )
    .not("lixeira_em", "is", null)
    .order("lixeira_em", { ascending: false })
    .limit(500);
  falhar(error);
  return data ?? [];
}

/** Imagem atual do papel timbrado (endereço temporário) ou null. */
export async function papelTimbradoAtual(): Promise<{
  path: string;
  url: string;
} | null> {
  const urls = await urlsAssinadas([...CAMINHOS_PAPEL_TIMBRADO], 600);
  for (const path of CAMINHOS_PAPEL_TIMBRADO) {
    const url = urls.get(path);
    if (url) return { path, url };
  }
  return null;
}
