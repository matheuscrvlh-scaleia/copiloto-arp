import "server-only";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import type { Calendario } from "@/lib/os/prazo";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type Usuario, usuarioAtual } from "@/server/auth";

// Base do módulo Chamados e OS: quem é o usuário no módulo, parâmetros,
// catálogo, pessoas, a consulta padrão de chamados, a linha do tempo, as
// notificações e os arquivos. Tudo o que é lido em nome do usuário passa
// pelo RLS; a service role só grava o que é do sistema (notificações,
// arquivos no bucket privado, cálculo da OS) e atende os links públicos.

type Os = Database["os"];
export type Tabela<T extends keyof Os["Tables"]> = Os["Tables"][T]["Row"];
export type Enum<T extends keyof Os["Enums"]> = Os["Enums"][T];

export type Setor = Tabela<"setores">;
export type Categoria = Tabela<"categorias">;
export type Parametros = Tabela<"parametros">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

/** Cliente com a sessão, já no schema os. */
export async function os() {
  return (await createClient()).schema("os");
}

/** Cliente da service role no schema os (só depois de conferir o acesso). */
export function osAdmin() {
  return createAdminClient().schema("os");
}

// ---------------------------------------------------------------------------
// Quem é o usuário no módulo
// ---------------------------------------------------------------------------

export interface Contexto {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** Setores de que a pessoa faz parte. */
  setores: string[];
  /** Setores em que ela é marcada como gestora (recebe os vencidos). */
  gestorDe: string[];
}

/** Usuário logado, permissões e setores. Lê a sessão: use em <Suspense>. */
export const contexto = cache(async (): Promise<Contexto> => {
  const usuario = await usuarioAtual();
  const { data, error } = await (await os())
    .from("setor_membros")
    .select("setor_id, gestor")
    .eq("usuario_id", usuario.id);
  falhar(error);
  return {
    usuario,
    pode: (p) => usuario.permissoes.includes(p),
    setores: (data ?? []).map((m) => m.setor_id),
    gestorDe: (data ?? []).filter((m) => m.gestor).map((m) => m.setor_id),
  };
});

// ---------------------------------------------------------------------------
// Parâmetros, calendário e catálogo
// ---------------------------------------------------------------------------

export const parametros = cache(async (): Promise<Parametros> => {
  const { data, error } = await (await os())
    .from("parametros")
    .select("*")
    .eq("id", 1)
    .single();
  falhar(error);
  return data;
});

/** Dias úteis, feriados e fim do expediente (prazos e aceite automático). */
export const calendario = cache(async (): Promise<Calendario> => {
  const [p, feriados] = await Promise.all([
    parametros(),
    (await os()).from("feriados").select("data"),
  ]);
  falhar(feriados.error);
  return calendarioDe(
    p,
    (feriados.data ?? []).map((f) => f.data),
  );
});

export function calendarioDe(
  p: Pick<Parametros, "dias_uteis" | "expediente_fim">,
  feriados: string[],
): Calendario {
  return {
    feriados: new Set(feriados),
    diasUteis: p.dias_uteis,
    expedienteFim: p.expediente_fim.slice(0, 5),
  };
}

/** Setores ativos, na ordem da tela. */
export const setores = cache(async (): Promise<Setor[]> => {
  const { data, error } = await (await os())
    .from("setores")
    .select("*")
    .order("ordem")
    .order("nome");
  falhar(error);
  return data ?? [];
});

/** Categorias (ativas e inativas; a tela filtra), na ordem do catálogo. */
export const categorias = cache(async (): Promise<Categoria[]> => {
  const { data, error } = await (await os())
    .from("categorias")
    .select("*")
    .order("ordem")
    .order("nome");
  falhar(error);
  return data ?? [];
});

export interface Pessoa {
  id: string;
  nome: string;
  setores: string[];
}

/** Quem usa o módulo (responsável, citação com @). */
export const pessoas = cache(async (): Promise<Pessoa[]> => {
  const { data, error } = await (await os()).rpc("pessoas");
  falhar(error);
  return data ?? [];
});

/** Nome de cada pessoa pelo id (para listas e linha do tempo). */
export const nomes = cache(async (): Promise<Map<string, string>> => {
  return new Map((await pessoas()).map((p) => [p.id, p.nome]));
});

// ---------------------------------------------------------------------------
// Consulta padrão de chamados (listas, quadro, calendário, painéis)
// ---------------------------------------------------------------------------

/** Colunas que as listas usam; o detalhe lê o chamado inteiro. */
export const COLUNAS_RESUMO =
  "id, numero, tipo, titulo, setor_id, categoria_id, status, prioridade, origem, pessoal, precisa_confirmacao, aberto_por, solicitante_nome, responsavel_id, prazo, loja_id, ativo_id, etiquetas, aguardando_tipo, aguardando_min, aguardando_desde, primeira_resposta_em, concluido_em, fechado_em, cancelado_em, execucao, local, rateio, avaliacao, lixeira_em, exemplo, criado_em, atualizado_em" as const;

export type ChamadoResumo = Pick<
  Tabela<"chamados">,
  | "id"
  | "numero"
  | "tipo"
  | "titulo"
  | "setor_id"
  | "categoria_id"
  | "status"
  | "prioridade"
  | "origem"
  | "pessoal"
  | "precisa_confirmacao"
  | "aberto_por"
  | "solicitante_nome"
  | "responsavel_id"
  | "prazo"
  | "loja_id"
  | "ativo_id"
  | "etiquetas"
  | "aguardando_tipo"
  | "aguardando_min"
  | "aguardando_desde"
  | "primeira_resposta_em"
  | "concluido_em"
  | "fechado_em"
  | "cancelado_em"
  | "execucao"
  | "local"
  | "rateio"
  | "avaliacao"
  | "lixeira_em"
  | "exemplo"
  | "criado_em"
  | "atualizado_em"
>;

export interface FiltroChamados {
  /** Minha caixa: responsável sou eu, ou destino meu/do meu setor. */
  recorte?: "minha_caixa" | "meu_setor" | "abertos_por_mim" | "todos";
  setor?: string | null;
  tipos?: Enum<"tipo_chamado">[];
  status?: Enum<"status_chamado">[];
  categoria?: string | null;
  responsavel?: string | null;
  prioridade?: Enum<"prioridade"> | null;
  etiqueta?: string | null;
  /** Criados a partir de / até (aaaa-mm-dd, inclusive). */
  de?: string | null;
  ate?: string | null;
  /** Só os da lixeira (padrão: fora dela). */
  lixeira?: boolean;
  limite?: number;
}

/**
 * Chamados que o usuário vê (RLS) no recorte pedido. O recorte "minha
 * caixa" junta o que está comigo: sou o responsável, ou um destino é meu
 * ou do meu setor e ainda não concluiu, ou é a fila do meu setor.
 */
export async function buscarChamados(
  f: FiltroChamados = {},
): Promise<ChamadoResumo[]> {
  const ctx = await contexto();
  const eu = ctx.usuario.id;
  let q = (await os())
    .from("chamados")
    .select(COLUNAS_RESUMO)
    .order("criado_em", { ascending: false })
    .limit(f.limite ?? 2000);

  q = f.lixeira ? q.not("lixeira_em", "is", null) : q.is("lixeira_em", null);
  if (f.setor) q = q.eq("setor_id", f.setor);
  if (f.tipos?.length) q = q.in("tipo", f.tipos);
  if (f.status?.length) q = q.in("status", f.status);
  if (f.categoria) q = q.eq("categoria_id", f.categoria);
  if (f.responsavel) q = q.eq("responsavel_id", f.responsavel);
  if (f.prioridade) q = q.eq("prioridade", f.prioridade);
  if (f.etiqueta) q = q.contains("etiquetas", [f.etiqueta]);
  if (f.de) q = q.gte("criado_em", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("criado_em", `${f.ate}T23:59:59-03:00`);

  switch (f.recorte) {
    case "abertos_por_mim":
      q = q.eq("aberto_por", eu);
      break;
    case "meu_setor":
      if (!f.setor)
        q = ctx.setores.length
          ? q.in("setor_id", ctx.setores)
          : q.eq("setor_id", "00000000-0000-0000-0000-000000000000");
      break;
    case "minha_caixa": {
      const destinos = await destinosDaMinhaCaixa(ctx, f);
      const ou = [`responsavel_id.eq.${eu}`];
      if (destinos.length) ou.push(`id.in.(${destinos.join(",")})`);
      if (ctx.setores.length)
        ou.push(
          `and(responsavel_id.is.null,setor_id.in.(${ctx.setores.join(",")}))`,
        );
      q = q.or(ou.join(","));
      break;
    }
    default:
      break;
  }

  const { data, error } = await q;
  falhar(error);
  return data ?? [];
}

/**
 * Chamados em que um destino é meu (ou do meu setor) e ainda não concluiu.
 * Só os chamados que a consulta pediria (status e lixeira): o destino de um
 * chamado cancelado fica "aberto" para sempre, e a lista de ids vai na URL
 * da consulta principal (sem o filtro ela cresce sem fim).
 */
async function destinosDaMinhaCaixa(
  ctx: Contexto,
  f: FiltroChamados,
): Promise<string[]> {
  const eu = ctx.usuario.id;
  const ou = [`usuario_id.eq.${eu}`, `responsavel_id.eq.${eu}`];
  if (ctx.setores.length) ou.push(`setor_id.in.(${ctx.setores.join(",")})`);
  let q = (await os())
    .from("destinatarios")
    .select("chamado_id, chamados!inner(status, lixeira_em)")
    .neq("status", "concluido")
    .or(ou.join(","));
  q = f.lixeira
    ? q.not("chamados.lixeira_em", "is", null)
    : q.is("chamados.lixeira_em", null);
  if (f.status?.length) q = q.in("chamados.status", f.status);
  const { data, error } = await q;
  falhar(error);
  return [...new Set((data ?? []).map((d) => d.chamado_id))];
}

// ---------------------------------------------------------------------------
// Linha do tempo e notificações
// ---------------------------------------------------------------------------

export type TipoEvento = Tabela<"eventos">["tipo"];

/**
 * Registra na linha do tempo do chamado, em nome do usuário logado (RLS).
 * Para lojista, terceirizado e rotinas, use `registrarComoSistema`.
 */
export async function registrar(
  chamadoId: string,
  e: {
    tipo: TipoEvento;
    texto?: string | null;
    dados?: Record<string, Json | undefined>;
    visivelLojista?: boolean;
  },
): Promise<number | null> {
  const ctx = await contexto();
  const { data, error } = await (await os())
    .from("eventos")
    .insert({
      chamado_id: chamadoId,
      tipo: e.tipo,
      texto: e.texto ?? null,
      dados: (e.dados ?? {}) as Json,
      visivel_lojista: e.visivelLojista ?? false,
      autor_id: ctx.usuario.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("linha do tempo", chamadoId, error);
    return null;
  }
  return data.id;
}

/** Registro feito pelo lojista, terceirizado ou por uma rotina (sem sessão). */
export async function registrarComoSistema(
  chamadoId: string,
  e: {
    tipo: TipoEvento;
    autorNome: string;
    texto?: string | null;
    dados?: Record<string, Json | undefined>;
    visivelLojista?: boolean;
  },
): Promise<number | null> {
  const { data, error } = await osAdmin()
    .from("eventos")
    .insert({
      chamado_id: chamadoId,
      tipo: e.tipo,
      texto: e.texto ?? null,
      dados: (e.dados ?? {}) as Json,
      visivel_lojista: e.visivelLojista ?? false,
      autor_nome: e.autorNome,
    })
    .select("id")
    .single();
  if (error) {
    console.error("linha do tempo (sistema)", chamadoId, error);
    return null;
  }
  return data.id;
}

export interface Notificacao {
  tipo: string;
  titulo: string;
  texto?: string;
  href: string;
  chamadoId?: string | null;
  /** Mesmo aviso não se repete para a mesma pessoa (ex.: "vence24h:<id>"). */
  chave?: string;
}

/**
 * Notifica pessoas no sininho. Nunca falha a ação de quem pediu; quem fez
 * a ação (`exceto`) não recebe aviso do que ele mesmo fez.
 */
export async function notificar(
  usuarios: (string | null | undefined)[],
  n: Notificacao,
  exceto?: string | null,
): Promise<void> {
  const destino = [
    ...new Set(usuarios.filter((u): u is string => !!u && u !== exceto)),
  ];
  if (!destino.length) return;
  try {
    const { error } = await osAdmin()
      .from("notificacoes")
      .upsert(
        destino.map((usuario_id) => ({
          usuario_id,
          chamado_id: n.chamadoId ?? null,
          tipo: n.tipo,
          titulo: n.titulo.slice(0, 200),
          texto: n.texto?.slice(0, 500) ?? null,
          href: n.href,
          chave: n.chave ?? null,
        })),
        { onConflict: "usuario_id,chave", ignoreDuplicates: true },
      );
    if (error) throw error;
  } catch (erro) {
    console.error("notificação", n.tipo, erro);
  }
}

/** Pessoas de um setor (todas, ou só as marcadas como gestoras). */
export async function membrosDoSetor(
  setorId: string,
  soGestores = false,
): Promise<string[]> {
  let q = osAdmin()
    .from("setor_membros")
    .select("usuario_id")
    .eq("setor_id", setorId);
  if (soGestores) q = q.eq("gestor", true);
  const { data, error } = await q;
  if (error) {
    console.error("membros do setor", setorId, error);
    return [];
  }
  return (data ?? []).map((m) => m.usuario_id);
}

// ---------------------------------------------------------------------------
// Arquivos (bucket privado "os") e links públicos
// ---------------------------------------------------------------------------

const BUCKET = "os";

/** Caminho no bucket: <dono>/<id do dono>/<id aleatório>-<nome limpo>. */
export function caminhoDoArquivo(
  dono: "chamados" | "vistorias" | "ambientes" | "ativos" | "assinaturas",
  id: string,
  nome: string,
): string {
  const limpo =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "arquivo";
  return `${dono}/${id}/${randomBytes(6).toString("hex")}-${limpo}`;
}

/**
 * Grava o arquivo no bucket. Só depois de conferir o acesso (a linha em
 * os.anexos passa pelo RLS antes, ou o token do link foi conferido).
 */
export async function enviarArquivo(
  path: string,
  conteudo: Blob | ArrayBuffer | Uint8Array,
  mime: string,
): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, conteudo, { contentType: mime, upsert: false });
  if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
}

export async function removerArquivos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove(paths);
  if (error) console.error("remover arquivos", error);
}

/** Endereços temporários (1 h) para mostrar os arquivos já liberados. */
export async function urlsAssinadas(
  paths: string[],
  segundos = 3600,
): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .createSignedUrls(paths, segundos);
  if (error) {
    console.error("urls assinadas", error);
    return new Map();
  }
  return new Map(
    (data ?? [])
      .filter((d) => d.signedUrl && d.path)
      .map((d) => [d.path as string, d.signedUrl as string]),
  );
}

/** Lê um arquivo do bucket (PDF do laudo, papel timbrado, fotos). */
export async function baixarArquivo(path: string): Promise<Uint8Array | null> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** Token de link público (portal, terceirizado): 32+ caracteres aleatórios. */
export function novoToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Endereço absoluto do sistema (links do WhatsApp). */
export function urlDoSistema(caminho: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}${caminho}`;
}
