import "server-only";
import { randomBytes } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import {
  type CriterioCartao,
  filtrosDaBusca,
  type PassoOrdem,
  statusComCartao,
} from "@/lib/os/lista";
import { intervalo, POR_PAGINA, totalDePaginas } from "@/lib/os/paginacao";
import type { Calendario } from "@/lib/os/prazo";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import {
  type Bucket,
  gravarArquivo,
  lerArquivo,
  linksDeLeitura,
  removerArquivos as removerDoArmazenamento,
} from "@/server/arquivos";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";

// Base do módulo Tickets: quem é o usuário no módulo, parâmetros,
// catálogo, pessoas, a consulta padrão de chamados, a linha do tempo, as
// notificações e os arquivos. Tudo o que é lido em nome do usuário passa
// pelo RLS; a service role só grava o que é do sistema (notificações,
// arquivos no bucket privado, cálculo da OS) e atende os links públicos.
//
// Exceção, com cache: a configuração do módulo (parâmetros, feriados,
// setores, catálogo, metas, agendas, pessoas) é a mesma para todo mundo que
// usa o módulo.
// É lida uma vez pela service role e guardada no cache ("use cache"),
// sempre depois de conferir aqui o mesmo acesso que o RLS exige
// (core.pode_modulo('os')). Quem grava chama updateTag(TAG.os.*).

type Os = Database["os"];
export type Tabela<T extends keyof Os["Tables"]> = Os["Tables"][T]["Row"];
export type Enum<T extends keyof Os["Enums"]> = Os["Enums"][T];

export type Setor = Tabela<"setores">;
export type Categoria = Tabela<"categorias">;
export type Parametros = Tabela<"parametros">;

// ---------------------------------------------------------------------------
// Chamado ou OS
// ---------------------------------------------------------------------------

/**
 * Um chamado (os.chamados) ou uma OS (os.ordens): o tipo decide a tabela e
 * a coluna das filhas comuns (destinos, participantes, linha do tempo,
 * anexos, notificações). Qualquer linha lida serve de alvo.
 */
export interface Alvo {
  id: string;
  tipo: Enum<"tipo_chamado">;
}

/** Alvo de uma OS pelo id (o bloco da OS, o link do terceirizado). */
export const ordem = (id: string): Alvo => ({ id, tipo: "os" });

/**
 * Alvo de um chamado pelo id (portal, modelos, vistorias: só chamados). O
 * tipo serve só para escolher a tabela.
 */
export const chamado = (id: string): Alvo => ({ id, tipo: "solicitacao" });

export const ehOrdem = (a: Pick<Alvo, "tipo">) => a.tipo === "os";

/**
 * Tabela do alvo. os.ordens tem todas as colunas de os.chamados (e mais as
 * da execução); por isso o tipo é o do chamado.
 */
export const tabelaDo = (a: Pick<Alvo, "tipo">) =>
  (ehOrdem(a) ? "ordens" : "chamados") as "chamados";

/** Coluna que liga a filha comum ao dono. */
export const chaveDo = (a: Pick<Alvo, "tipo">) =>
  ehOrdem(a) ? ("ordem_id" as const) : ("chamado_id" as const);

/** { chamado_id } ou { ordem_id }, para gravar a filha comum. */
export const donoDo = (a: Alvo): { chamado_id?: string; ordem_id?: string } =>
  ehOrdem(a) ? { ordem_id: a.id } : { chamado_id: a.id };

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
  const membro = usaOModulo(usuario) ? await setoresDe(usuario.id) : [];
  return {
    usuario,
    pode: (p) => usuario.permissoes.includes(p),
    setores: membro.map((m) => m.setor_id),
    gestorDe: membro.filter((m) => m.gestor).map((m) => m.setor_id),
  };
});

// Não exportar: o id só pode vir da sessão validada (contexto()).
async function setoresDe(usuarioId: string) {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.membros, TAG.usuario(usuarioId));
  const { data, error } = await osAdmin()
    .from("setor_membros")
    .select("setor_id, gestor")
    .eq("usuario_id", usuarioId);
  falhar(error);
  return data ?? [];
}

/**
 * Libera a leitura da configuração do módulo pela service role: o mesmo
 * acesso que o RLS exige dela (alguma permissão os.*, usuário ativo).
 */
async function exigirModulo(): Promise<void> {
  if (!usaOModulo(await usuarioAtual()))
    throw new Error("Sem acesso ao módulo Tickets.");
}

function usaOModulo(usuario: Usuario): boolean {
  return usuario.ativo && usuario.permissoes.some((p) => p.startsWith("os."));
}

// ---------------------------------------------------------------------------
// Parâmetros, calendário e catálogo
// ---------------------------------------------------------------------------

export const parametros = cache(async (): Promise<Parametros> => {
  await exigirModulo();
  return parametrosDoModulo();
});

async function parametrosDoModulo(): Promise<Parametros> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.parametros);
  const { data, error } = await osAdmin()
    .from("parametros")
    .select("*")
    .eq("id", 1)
    .single();
  falhar(error);
  return data;
}

/** Dias úteis, feriados e fim do expediente (prazos e aceite automático). */
export const calendario = cache(async (): Promise<Calendario> => {
  const [p, feriados] = await Promise.all([parametros(), feriadosDoModulo()]);
  return calendarioDe(p, feriados);
});

async function feriadosDoModulo(): Promise<string[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.feriados);
  const { data, error } = await osAdmin().from("feriados").select("data");
  falhar(error);
  return (data ?? []).map((f) => f.data);
}

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
  await exigirModulo();
  return setoresDoModulo();
});

async function setoresDoModulo(): Promise<Setor[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.setores);
  const { data, error } = await osAdmin()
    .from("setores")
    .select("*")
    .order("ordem")
    .order("nome");
  falhar(error);
  return data ?? [];
}

/** Categorias (ativas e inativas; a tela filtra), na ordem do catálogo. */
export const categorias = cache(async (): Promise<Categoria[]> => {
  await exigirModulo();
  return categoriasDoModulo();
});

async function categoriasDoModulo(): Promise<Categoria[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.categorias);
  const { data, error } = await osAdmin()
    .from("categorias")
    .select("*")
    .order("ordem")
    .order("nome");
  falhar(error);
  return data ?? [];
}

export type Meta = Tabela<"metas">;

/** Metas dos painéis (Configurações › Parâmetros). */
export const metas = cache(async (): Promise<Meta[]> => {
  await exigirModulo();
  return metasDoModulo();
});

async function metasDoModulo(): Promise<Meta[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.metas);
  const { data, error } = await osAdmin().from("metas").select("*");
  falhar(error);
  return data ?? [];
}

export type Agenda = Tabela<"agendas">;

/** Agendas (ativas e inativas; a tela filtra), pelo nome. */
export const agendas = cache(async (): Promise<Agenda[]> => {
  await exigirModulo();
  return agendasDoModulo();
});

async function agendasDoModulo(): Promise<Agenda[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.agendas);
  const { data, error } = await osAdmin()
    .from("agendas")
    .select("*")
    .order("nome");
  falhar(error);
  return data ?? [];
}

export interface Pessoa {
  id: string;
  nome: string;
  setores: string[];
}

/** Quem usa o módulo (responsável, citação com @). */
export const pessoas = cache(async (): Promise<Pessoa[]> => {
  await exigirModulo();
  return pessoasDoModulo();
});

// Mesma regra de os.pessoas() (que depende de auth.uid() e por isso não
// roda pela service role): usuários ativos com alguma permissão os.*,
// individual ou de cargo ativo.
async function pessoasDoModulo(): Promise<Pessoa[]> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.permissoes, TAG.os.pessoas, TAG.os.membros);
  const core = createAdminClient().schema("core");
  const [usuarios, individuais, doCargo, membros] = await Promise.all([
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
    osAdmin().from("setor_membros").select("usuario_id, setor_id"),
  ]);
  falhar(usuarios.error);
  falhar(individuais.error);
  falhar(doCargo.error);
  falhar(membros.error);

  const comPermissao = new Set(
    (individuais.data ?? []).map((p) => p.usuario_id),
  );
  const cargos = new Set((doCargo.data ?? []).map((c) => c.cargo_id));
  const setoresDe = new Map<string, string[]>();
  for (const m of membros.data ?? []) {
    setoresDe.set(m.usuario_id, [
      ...(setoresDe.get(m.usuario_id) ?? []),
      m.setor_id,
    ]);
  }
  return (usuarios.data ?? [])
    .filter(
      (u) =>
        comPermissao.has(u.id) ||
        (u.cargo_id !== null && cargos.has(u.cargo_id)),
    )
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      setores: setoresDe.get(u.id) ?? [],
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Nome de cada pessoa pelo id (para listas e linha do tempo). */
export const nomes = cache(async (): Promise<Map<string, string>> => {
  return new Map((await pessoas()).map((p) => [p.id, p.nome]));
});

// ---------------------------------------------------------------------------
// Consulta padrão de chamados (listas, quadro, calendário, painéis)
// ---------------------------------------------------------------------------

/** Colunas que as listas usam; o detalhe lê o chamado inteiro. */
export const COLUNAS_RESUMO =
  "id, numero, tipo, titulo, setor_id, categoria_id, status, prioridade, origem, pessoal, precisa_confirmacao, aberto_por, solicitante_nome, responsavel_id, prazo, loja_id, ativo_id, etiquetas, aguardando_tipo, aguardando_min, aguardando_desde, primeira_resposta_em, concluido_em, fechado_em, cancelado_em, avaliacao, criado_em, atualizado_em" as const;

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
  | "avaliacao"
  | "criado_em"
  | "atualizado_em"
>;

export interface FiltroChamados {
  /**
   * Lê as OS (os.ordens) em vez dos chamados: as mesmas colunas, filtros e
   * recortes; o tipo não filtra (é sempre OS).
   */
  ordens?: boolean;
  /** Minha caixa: responsável sou eu, ou destino meu/do meu setor. */
  recorte?: "minha_caixa" | "meu_setor" | "abertos_por_mim" | "todos";
  setor?: string | null;
  /** Geral: os setores escolhidos (um ou mais). */
  setores?: string[] | null;
  tipos?: Enum<"tipo_chamado">[];
  status?: Enum<"status_chamado">[];
  categoria?: string | null;
  responsavel?: string | null;
  /** Só os abertos por esta pessoa (filtro "Abertos por mim"). */
  abertoPor?: string | null;
  prioridade?: Enum<"prioridade"> | null;
  etiqueta?: string | null;
  /** Criados a partir de / até (aaaa-mm-dd, inclusive). */
  de?: string | null;
  ate?: string | null;
  limite?: number;
  /**
   * Minha caixa: junta os pedidos meus já concluídos (esperam a minha
   * confirmação), na mesma consulta, para paginar tudo junto.
   */
  comConfirmacao?: boolean;
  /** Busca do topo da lista (?q=): título, descrição ou número. */
  busca?: string | null;
  /** O que o cartão clicado (ou o contador) conta. */
  cartao?: CriterioCartao | null;
  /** Calendário: prazo no intervalo (ISO; de inclusive, até exclusive). */
  prazoEntre?: { de: string; ate: string } | null;
}

/**
 * Consulta de chamados com os filtros, o recorte, o cartão e a busca (as
 * listas, a página, a contagem e a exportação montam do mesmo jeito). null:
 * o cartão e a barra se contradizem, nada passa.
 */
async function montarConsulta(
  f: FiltroChamados,
  contar?: Contar,
): Promise<{ q: Consulta } | null> {
  const status = f.cartao ? statusComCartao(f.status, f.cartao) : f.status;
  if (f.cartao && !status?.length) return null;
  // Os destinos saem uma vez com o status da barra; cada cartão (ou coluna
  // do quadro) só filtra a mesma lista pelo status dele.
  const daBarra =
    f.cartao && (f.cartao.foraDaBarra || !f.status?.length) ? status : f.status;
  const [ctx, cliente, destinos] = await Promise.all([
    contexto(),
    os(),
    f.recorte === "minha_caixa"
      ? destinosEmCache((daBarra ?? []).join(","), !!f.ordens)
      : [],
  ]);
  const ids = destinos
    .filter((d) => !status?.length || status.includes(d.status))
    .map((d) => d.id);
  // Num objeto: o construtor é "thenable" e o await de uma função async
  // dispararia a consulta antes da ordem e da página.
  return {
    q: filtrar(selecionar(cliente, contar, f.ordens), f, status, ctx, ids),
  };
}

type Contar = { count: "exact"; head?: boolean };
type Consulta = ReturnType<typeof selecionar>;

function selecionar(
  cliente: Awaited<ReturnType<typeof os>>,
  contar?: Contar,
  ordens = false,
) {
  return cliente
    .from(tabelaDo({ tipo: ordens ? "os" : "solicitacao" }))
    .select(COLUNAS_RESUMO, contar);
}

/** Período de abertura da barra (aaaa-mm-dd, inclusive), em Brasília. */
const criadoDesde = (de: string) => `${de}T00:00:00-03:00`;
const criadoAte = (ate: string) => `${ate}T23:59:59-03:00`;

/** Em aberto e atrasados de um responsável (null: a fila do setor). */
export interface ContagemDaCarga {
  responsavel_id: string | null;
  abertos: number;
  atrasados: number;
}

/**
 * Carga por pessoa do Geral, agregada no banco (os.carga_do_setor, com
 * o RLS de quem pede): chamados em aberto e atrasados (prazo antes de
 * `agora`) de cada responsável dos setores escolhidos, com os filtros da
 * barra. A busca e o cartão da lista não entram, como antes. Quem soma é
 * quem chama (a mesma pessoa pode vir de mais de um setor).
 */
export async function cargaPorResponsavel(
  f: FiltroChamados,
  agora: Date,
): Promise<ContagemDaCarga[]> {
  const setores = f.setores?.length ? f.setores : f.setor ? [f.setor] : [];
  // atalho: uma chamada por setor (são poucos); se crescer, a função do
  // banco passa a receber a lista.
  const porSetor = await Promise.all(
    setores.map((s) => cargaDeUmSetor(s, f, agora)),
  );
  return porSetor.flat();
}

async function cargaDeUmSetor(
  setor: string,
  f: FiltroChamados,
  agora: Date,
): Promise<ContagemDaCarga[]> {
  const comuns = {
    p_setor: setor,
    p_agora: agora.toISOString(),
    p_status: f.status?.length ? f.status : undefined,
    p_categoria: f.categoria ?? undefined,
    p_responsavel: f.responsavel ?? undefined,
    p_aberto_por: f.abertoPor ?? undefined,
    p_prioridade: f.prioridade ?? undefined,
    p_etiqueta: f.etiqueta ?? undefined,
    p_criado_desde: f.de ? criadoDesde(f.de) : undefined,
    p_criado_ate: f.ate ? criadoAte(f.ate) : undefined,
  };
  const cliente = await os();
  const { data, error } = f.ordens
    ? await cliente.rpc("carga_das_ordens", comuns)
    : await cliente.rpc("carga_do_setor", {
        ...comuns,
        p_tipos: f.tipos?.length ? f.tipos : undefined,
      });
  falhar(error);
  // O tipo gerado não marca a coluna como opcional: a fila vem com null.
  return (data ?? []).map((c) => ({
    responsavel_id: c.responsavel_id ?? null,
    abertos: c.abertos,
    atrasados: c.atrasados,
  }));
}

function filtrar(
  consulta: Consulta,
  f: FiltroChamados,
  status: FiltroChamados["status"],
  ctx: Contexto,
  destinos: string[],
): Consulta {
  const eu = ctx.usuario.id;
  let q = consulta;
  if (f.setor) q = q.eq("setor_id", f.setor);
  if (f.setores?.length) q = q.in("setor_id", f.setores);
  if (f.tipos?.length && !f.ordens) q = q.in("tipo", f.tipos);
  if (status?.length) q = q.in("status", status);
  if (f.categoria) q = q.eq("categoria_id", f.categoria);
  if (f.responsavel) q = q.eq("responsavel_id", f.responsavel);
  if (f.abertoPor) q = q.eq("aberto_por", f.abertoPor);
  if (f.prioridade) q = q.eq("prioridade", f.prioridade);
  if (f.etiqueta) q = q.contains("etiquetas", [f.etiqueta]);
  if (f.de) q = q.gte("criado_em", criadoDesde(f.de));
  if (f.ate) q = q.lte("criado_em", criadoAte(f.ate));
  if (f.prazoEntre)
    q = q.gte("prazo", f.prazoEntre.de).lt("prazo", f.prazoEntre.ate);

  const c = f.cartao;
  if (c?.abertoPor) q = q.eq("aberto_por", c.abertoPor);
  if (c?.semResponsavel) q = q.is("responsavel_id", null);
  if (c?.prazoDesde) q = q.gte("prazo", c.prazoDesde);
  if (c?.prazoAntes) q = q.lt("prazo", c.prazoAntes);
  if (c?.encerradoDesde)
    q = q.gte(c.encerradoDesde.campo, c.encerradoDesde.iso);
  // Campos calculados (os.lido_por_mim, os.todos_leram): o PostgREST filtra
  // como coluna; o tipo gerado não os lista entre as colunas.
  if (c?.lido !== undefined) q = q.filter("lido_por_mim", "is", c.lido);
  if (c?.todosLeram !== undefined)
    q = q.filter("todos_leram", "is", c.todosLeram);
  // Um .or() por palavra: o PostgREST junta todos com "e".
  for (const ou of filtrosDaBusca(f.busca ?? "")) q = q.or(ou);

  switch (f.recorte) {
    case "abertos_por_mim":
      q = q.eq("aberto_por", eu);
      break;
    case "meu_setor":
      if (!f.setor && !f.setores?.length)
        q = ctx.setores.length
          ? q.in("setor_id", ctx.setores)
          : q.eq("setor_id", "00000000-0000-0000-0000-000000000000");
      break;
    case "minha_caixa": {
      const ou = [`responsavel_id.eq.${eu}`];
      if (destinos.length) ou.push(`id.in.(${destinos.join(",")})`);
      if (ctx.setores.length)
        ou.push(
          `and(responsavel_id.is.null,setor_id.in.(${ctx.setores.join(",")}))`,
        );
      if (f.comConfirmacao)
        ou.push(`and(aberto_por.eq.${eu},status.eq.concluido)`);
      q = q.or(ou.join(","));
      break;
    }
    default:
      break;
  }
  return q;
}

/**
 * Chamados que o usuário vê (RLS) no recorte pedido. O recorte "minha
 * caixa" junta o que está comigo: sou o responsável, ou um destino é meu
 * ou do meu setor e ainda não concluiu, ou é a fila do meu setor.
 */
export async function buscarChamados(
  f: FiltroChamados = {},
): Promise<ChamadoResumo[]> {
  const m = await montarConsulta(f);
  if (!m) return [];
  const { data, error } = await m.q
    .order("criado_em", { ascending: false })
    .limit(f.limite ?? 2000);
  falhar(error);
  return data ?? [];
}

/** Ordem do banco (passos de `ordemDaConsulta`, em src/lib/os/lista.ts). */
function ordenar(q: Consulta, passos: PassoOrdem[]): Consulta {
  let r = q;
  for (const p of passos)
    r = r.order(p.coluna, { ascending: p.asc, nullsFirst: p.nullsFirst });
  return r;
}

/**
 * Só a página pedida (.range) e o total com os mesmos filtros (count
 * "exact", na mesma consulta). Página além do fim (a lista encolheu): volta
 * para a última.
 */
export async function buscarPaginaDeChamados(
  f: FiltroChamados,
  p: { pagina: number; ordem: PassoOrdem[]; porPagina?: number },
): Promise<{ linhas: ChamadoResumo[]; total: number; pagina: number }> {
  const porPagina = p.porPagina ?? POR_PAGINA;
  const m = await montarConsulta(f, { count: "exact" });
  if (!m) return { linhas: [], total: 0, pagina: 1 };
  const { de, ate } = intervalo(p.pagina, porPagina);
  const { data, error, count } = await ordenar(m.q, p.ordem).range(de, ate);
  if (error?.code === "PGRST103" && p.pagina > 1) {
    const ultima = totalDePaginas(await contarChamados(f), porPagina);
    if (ultima < p.pagina)
      return buscarPaginaDeChamados(f, { ...p, pagina: ultima });
  }
  falhar(error);
  return { linhas: data ?? [], total: count ?? 0, pagina: p.pagina };
}

/** Quantos chamados passam nos filtros (sem trazer linha nenhuma). */
export async function contarChamados(f: FiltroChamados): Promise<number> {
  const m = await montarConsulta(f, { count: "exact", head: true });
  if (!m) return 0;
  const { count, error } = await m.q;
  falhar(error);
  return count ?? 0;
}

/**
 * O resultado filtrado inteiro, na ordem pedida, lido de 1000 em 1000 (o
 * máximo do PostgREST). Só para a exportação, no clique; `maximo` segura o
 * tamanho do arquivo.
 */
export async function todosOsChamados(
  f: FiltroChamados,
  ordem: PassoOrdem[],
  maximo = 10_000,
): Promise<ChamadoResumo[]> {
  const LOTE = 1000;
  const linhas: ChamadoResumo[] = [];
  for (let de = 0; de < maximo; de += LOTE) {
    const m = await montarConsulta(f);
    if (!m) break;
    const { data, error } = await ordenar(m.q, ordem).range(
      de,
      Math.min(de + LOTE, maximo) - 1,
    );
    falhar(error);
    linhas.push(...(data ?? []));
    if ((data ?? []).length < LOTE) break;
  }
  return linhas;
}

/** Chamado com um destino meu, e o status dele (para cada cartão filtrar). */
interface DestinoMeu {
  id: string;
  status: Enum<"status_chamado">;
}

/**
 * Os destinos por requisição: a página, os cartões da Minha caixa, o
 * "Seu dia" e as colunas do quadro pedem a mesma lista, sem repetir a
 * consulta.
 */
const destinosEmCache = cache(
  async (status: string, ordens: boolean): Promise<DestinoMeu[]> =>
    destinosDaMinhaCaixa(await contexto(), {
      ordens,
      status: status ? (status.split(",") as Enum<"status_chamado">[]) : [],
    }),
);

/**
 * Chamados em que um destino é meu (ou do meu setor) e ainda não concluiu.
 * Só os chamados que a consulta pediria (status): o destino de um
 * chamado cancelado fica "aberto" para sempre, e a lista de ids vai na URL
 * da consulta principal (sem o filtro ela cresce sem fim).
 */
async function destinosDaMinhaCaixa(
  ctx: Contexto,
  f: FiltroChamados,
): Promise<DestinoMeu[]> {
  const eu = ctx.usuario.id;
  const ou = [`usuario_id.eq.${eu}`, `responsavel_id.eq.${eu}`];
  if (ctx.setores.length) ou.push(`setor_id.in.(${ctx.setores.join(",")})`);
  const dono = f.ordens ? "ordem_id" : "chamado_id";
  const tabela = f.ordens ? "ordens" : "chamados";
  // O embutido com !inner deixa só os destinos do lado pedido.
  let q = (await os())
    .from("destinatarios")
    .select(`${dono}, dono:${tabela}!inner(status)`)
    .neq("status", "concluido")
    .or(ou.join(","));
  if (f.status?.length) q = q.in("dono.status", f.status);
  const { data, error } = await q;
  falhar(error);
  const unicos = new Map<string, DestinoMeu>();
  for (const d of (data ?? []) as unknown as {
    chamado_id?: string | null;
    ordem_id?: string | null;
    dono: { status: Enum<"status_chamado"> };
  }[]) {
    const id = d.chamado_id ?? d.ordem_id;
    if (id) unicos.set(id, { id, status: d.dono.status });
  }
  return [...unicos.values()];
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
  alvo: Alvo,
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
      ...donoDo(alvo),
      tipo: e.tipo,
      texto: e.texto ?? null,
      dados: (e.dados ?? {}) as Json,
      visivel_lojista: e.visivelLojista ?? false,
      autor_id: ctx.usuario.id,
    })
    .select("id")
    .single();
  if (error) {
    console.error("linha do tempo", alvo.id, error);
    return null;
  }
  return data.id;
}

/** Registro feito pelo lojista, terceirizado ou por uma rotina (sem sessão). */
export async function registrarComoSistema(
  alvo: Alvo,
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
      ...donoDo(alvo),
      tipo: e.tipo,
      texto: e.texto ?? null,
      dados: (e.dados ?? {}) as Json,
      visivel_lojista: e.visivelLojista ?? false,
      autor_nome: e.autorNome,
    })
    .select("id")
    .single();
  if (error) {
    console.error("linha do tempo (sistema)", alvo.id, error);
    return null;
  }
  return data.id;
}

export interface Notificacao {
  tipo: string;
  titulo: string;
  texto?: string;
  href: string;
  /** O chamado ou a OS do aviso (some com ele). */
  alvo?: Alvo | null;
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
          chamado_id: n.alvo && !ehOrdem(n.alvo) ? n.alvo.id : null,
          ordem_id: n.alvo && ehOrdem(n.alvo) ? n.alvo.id : null,
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

const BUCKET: Bucket = "os";

/** Caminho no bucket: <dono>/<id do dono>/<id aleatório>-<nome limpo>. */
export function caminhoDoArquivo(
  dono:
    | "chamados"
    | "ordens"
    | "vistorias"
    | "ambientes"
    | "ativos"
    | "assinaturas",
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
  try {
    await gravarArquivo(BUCKET, path, conteudo, mime);
  } catch (e) {
    throw new Error(
      `Falha ao enviar o arquivo: ${e instanceof Error ? e.message : e}`,
    );
  }
}

export async function removerArquivos(paths: string[]): Promise<void> {
  await removerDoArmazenamento(BUCKET, paths);
}

/** Endereços temporários (1 h) para mostrar os arquivos já liberados. */
export async function urlsAssinadas(
  paths: string[],
  segundos = 3600,
): Promise<Map<string, string>> {
  return linksDeLeitura(BUCKET, paths, segundos);
}

/** Lê um arquivo do bucket (PDF do laudo, papel timbrado, fotos). */
export async function baixarArquivo(path: string): Promise<Uint8Array | null> {
  return lerArquivo(BUCKET, path);
}

/** Token de link público (portal, terceirizado): 32+ caracteres aleatórios. */
export function novoToken(): string {
  return randomBytes(24).toString("base64url");
}

export { urlDoSistema } from "@/server/endereco";
