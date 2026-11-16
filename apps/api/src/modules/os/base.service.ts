import { randomBytes } from "node:crypto";
import type { RespostaApoio } from "@arp/shared/os/contratos/base";
import { type PassoOrdem, statusComCartao } from "@arp/shared/os/lista";
import { POR_PAGINA, totalDePaginas } from "@arp/shared/os/paginacao";
import type { Calendario } from "@arp/shared/os/prazo";
import type { Permissao } from "@arp/shared/permissions";
import type { Selectable } from "kysely";
import { env } from "@/config/env";
import type { Contexto } from "@/contexto";
import {
  type Bucket,
  gravarArquivo,
  lerArquivo,
  linksDeLeitura,
  removerArquivos as removerDoArmazenamento,
} from "@/infra/arquivos";
import { banco, type Tx } from "@/infra/banco";
import type {
  OsCategorias,
  OsParametros,
  OsSetores,
} from "@/infra/banco/tipos";
import { log } from "@/infra/log";
import { type Alvo, ehOrdem } from "./alvo";
import type {
  ChamadoResumo,
  ContagemDaCarga,
  FiltroChamados,
  NovoEvento,
  Pessoa,
} from "./base.repository";
import * as repo from "./base.repository";
import { tentar } from "./tentar";

// Base do módulo Tickets: quem é o usuário no módulo, parâmetros, catálogo,
// pessoas, a consulta padrão de chamados, a linha do tempo, as notificações
// e os arquivos. Tudo o que é lido em nome do usuário roda no escopo
// `comoUsuario` (o RLS decide); a service role só grava o que é do sistema
// (notificações, cálculo da OS) e atende os links públicos e as rotinas.
//
// As funções que recebem `tx` rodam dentro do escopo de quem chama (uma
// transação por pedido). A configuração do módulo (parâmetros, feriados,
// setores, catálogo, agendas, pessoas) tem o mesmo acesso para todos do
// módulo no RLS (core.pode_modulo('os')): é lida com a sessão.

export type Setor = Selectable<OsSetores>;
export type Categoria = Selectable<OsCategorias>;
export type Parametros = Selectable<OsParametros>;
export type {
  Chamado,
  ChamadoResumo,
  ContagemDaCarga,
  FiltroChamados,
  Pessoa,
} from "./base.repository";

// ---------------------------------------------------------------------------
// Quem é o usuário no módulo
// ---------------------------------------------------------------------------

export interface ContextoOs {
  usuario: Contexto["usuario"];
  pode: (p: Permissao) => boolean;
  /** Setores de que a pessoa faz parte. */
  setores: string[];
  /** Setores em que ela é marcada como gestora (recebe os vencidos). */
  gestorDe: string[];
}

/** Usuário logado, permissões e setores (dentro do escopo `comoUsuario`). */
export async function contextoOs(tx: Tx, ctx: Contexto): Promise<ContextoOs> {
  const membro = usaOModulo(ctx)
    ? await repo.setoresDoUsuario(tx, ctx.usuario.id)
    : [];
  return {
    usuario: ctx.usuario,
    pode: (p) => ctx.permissoes.has(p),
    setores: membro.map((m) => m.setor_id),
    gestorDe: membro.filter((m) => m.gestor).map((m) => m.setor_id),
  };
}

/** Alguma permissão os.* (a sessão já garante o usuário ativo). */
export function usaOModulo(ctx: Contexto): boolean {
  return [...ctx.permissoes].some((p) => p.startsWith("os."));
}

/** Gestor do setor: a mesma regra de os.gerencia no banco. */
export function gerencia(cx: ContextoOs, setorId: string): boolean {
  return (
    cx.pode("os.gerenciar_setor") &&
    (cx.pode("os.todos_setores") || cx.setores.includes(setorId))
  );
}

// ---------------------------------------------------------------------------
// Parâmetros, calendário e catálogo
// ---------------------------------------------------------------------------

export const parametros = repo.parametros;
export const setores = repo.setores;
export const categorias = repo.categorias;
export const metas = repo.metas;
export const agendas = repo.agendas;

/** Quem usa o módulo (responsável, citação com @), pelo nome. */
export async function pessoas(tx: Tx): Promise<Pessoa[]> {
  return (await repo.pessoas(tx)).sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** Nome de cada pessoa pelo id (para listas e linha do tempo). */
export async function nomes(tx: Tx): Promise<Map<string, string>> {
  return new Map((await pessoas(tx)).map((p) => [p.id, p.nome]));
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

/** Dias úteis, feriados e fim do expediente (prazos e aceite automático). */
export async function calendario(tx: Tx): Promise<Calendario> {
  return calendarioDe(await repo.parametros(tx), await repo.feriados(tx));
}

export interface Apoio {
  cx: ContextoOs;
  agora: Date;
  avisoHoras: number;
  parametros: Parametros;
  setores: Setor[];
  setorPorId: Map<string, Setor>;
  categorias: Categoria[];
  categoriaPorId: Map<string, Categoria>;
  pessoas: Pessoa[];
  nomes: Map<string, string>;
}

/** O que toda visão precisa, uma vez por pedido. */
export async function apoio(tx: Tx, ctx: Contexto): Promise<Apoio> {
  const cx = await contextoOs(tx, ctx);
  const p = await repo.parametros(tx);
  const listaSetores = await repo.setores(tx);
  const listaCategorias = await repo.categorias(tx);
  const listaPessoas = await pessoas(tx);
  return {
    cx,
    agora: new Date(),
    avisoHoras: p.aviso_vencimento_horas,
    parametros: p,
    setores: listaSetores,
    setorPorId: new Map(listaSetores.map((s) => [s.id, s])),
    categorias: listaCategorias,
    categoriaPorId: new Map(listaCategorias.map((c) => [c.id, c])),
    pessoas: listaPessoas,
    nomes: new Map(listaPessoas.map((x) => [x.id, x.nome])),
  };
}

/** GET /os/apoio: setores, catálogo e pessoas para as telas do módulo. */
export function lerApoio(ctx: Contexto): Promise<RespostaApoio> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const a = await apoio(tx, ctx);
    return {
      setores: a.setores,
      categorias: a.categorias,
      pessoas: a.pessoas,
      meusSetores: a.cx.setores,
      gestorDe: a.cx.gestorDe,
      avisoHoras: a.avisoHoras,
    };
  });
}

// ---------------------------------------------------------------------------
// Consulta padrão de chamados (listas, quadro, calendário, painéis)
// ---------------------------------------------------------------------------

/**
 * Status em vigor com o cartão (a barra E o cartão). `nada`: o cartão e a
 * barra se contradizem, nada passa.
 */
function statusDa(f: FiltroChamados) {
  const status = f.cartao ? statusComCartao(f.status, f.cartao) : f.status;
  return { status, nada: !!f.cartao && !status?.length };
}

const quem = (cx: ContextoOs) => ({ eu: cx.usuario.id, setores: cx.setores });

/**
 * Chamados que o usuário vê (RLS) no recorte pedido. O recorte "minha
 * caixa" junta o que está comigo: sou o responsável, ou um destino é meu
 * ou do meu setor e ainda não concluiu, ou é a fila do meu setor.
 */
export async function buscarChamados(
  tx: Tx,
  cx: ContextoOs,
  f: FiltroChamados = {},
): Promise<ChamadoResumo[]> {
  const { status, nada } = statusDa(f);
  if (nada) return [];
  return repo.buscarChamados(tx, f, status, quem(cx));
}

/** Quantos chamados passam nos filtros (sem trazer linha nenhuma). */
export async function contarChamados(
  tx: Tx,
  cx: ContextoOs,
  f: FiltroChamados,
): Promise<number> {
  const { status, nada } = statusDa(f);
  if (nada) return 0;
  return repo.contarChamados(tx, f, status, quem(cx));
}

/**
 * Só a página pedida e o total com os mesmos filtros. Página além do fim (a
 * lista encolheu): volta para a última.
 */
export async function buscarPaginaDeChamados(
  tx: Tx,
  cx: ContextoOs,
  f: FiltroChamados,
  p: { pagina: number; ordem: PassoOrdem[]; porPagina?: number },
): Promise<{ linhas: ChamadoResumo[]; total: number; pagina: number }> {
  const porPagina = p.porPagina ?? POR_PAGINA;
  const { status, nada } = statusDa(f);
  if (nada) return { linhas: [], total: 0, pagina: 1 };
  const total = await repo.contarChamados(tx, f, status, quem(cx));
  const ultima = totalDePaginas(total, porPagina);
  const pagina = p.pagina > 1 && ultima < p.pagina ? ultima : p.pagina;
  const linhas = await repo.trechoDeChamados(tx, f, status, quem(cx), {
    ordem: p.ordem,
    limite: porPagina,
    pular: (Math.max(1, pagina) - 1) * porPagina,
  });
  return { linhas, total, pagina };
}

/**
 * O resultado filtrado inteiro, na ordem pedida. Só para a exportação, no
 * clique; `maximo` segura o tamanho do arquivo.
 */
export async function todosOsChamados(
  tx: Tx,
  cx: ContextoOs,
  f: FiltroChamados,
  ordem: PassoOrdem[],
  maximo = 10_000,
): Promise<ChamadoResumo[]> {
  const { status, nada } = statusDa(f);
  if (nada) return [];
  return repo.trechoDeChamados(tx, f, status, quem(cx), {
    ordem,
    limite: maximo,
  });
}

/**
 * Carga por pessoa do Geral, agregada no banco: chamados em aberto e
 * atrasados (prazo antes de `agora`) de cada responsável dos setores
 * escolhidos, com os filtros da barra. A busca e o cartão da lista não
 * entram. Quem soma é quem chama (a mesma pessoa pode vir de mais de um
 * setor).
 */
export async function cargaPorResponsavel(
  tx: Tx,
  f: FiltroChamados,
  agora: Date,
): Promise<ContagemDaCarga[]> {
  const lista = f.setores?.length ? f.setores : f.setor ? [f.setor] : [];
  const porSetor: ContagemDaCarga[] = [];
  // atalho: uma chamada por setor (são poucos); se crescer, a função do
  // banco passa a receber a lista.
  for (const s of lista)
    porSetor.push(...(await repo.cargaDeUmSetor(tx, s, f, agora)));
  return porSetor;
}

// ---------------------------------------------------------------------------
// Linha do tempo e notificações
// ---------------------------------------------------------------------------

type Evento = Omit<NovoEvento, "autorId" | "autorNome">;

/**
 * Registra na linha do tempo do chamado, em nome do usuário logado (RLS;
 * `tx` do escopo `comoUsuario`). Para lojista, terceirizado e rotinas, use
 * `registrarComoSistema`.
 */
export function registrar(
  tx: Tx,
  cx: ContextoOs,
  alvo: Alvo,
  e: Evento,
): Promise<number> {
  return repo.inserirEvento(tx, alvo, { ...e, autorId: cx.usuario.id });
}

/**
 * Registro feito pelo lojista, terceirizado ou por uma rotina (sem sessão;
 * `tx` do escopo `comoServico`).
 */
export function registrarComoSistema(
  tx: Tx,
  alvo: Alvo,
  e: Evento & { autorNome: string },
): Promise<number> {
  return repo.inserirEvento(tx, alvo, e);
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

function linhasDaNotificacao(
  usuarios: (string | null | undefined)[],
  n: Notificacao,
  exceto?: string | null,
) {
  const destino = [
    ...new Set(usuarios.filter((u): u is string => !!u && u !== exceto)),
  ];
  return destino.map((usuario_id) => ({
    usuario_id,
    chamado_id: n.alvo && !ehOrdem(n.alvo) ? n.alvo.id : null,
    ordem_id: n.alvo && ehOrdem(n.alvo) ? n.alvo.id : null,
    tipo: n.tipo,
    titulo: n.titulo.slice(0, 200),
    texto: n.texto?.slice(0, 500) ?? null,
    href: n.href,
    chave: n.chave ?? null,
  }));
}

/**
 * Notifica pessoas no sininho (service role, escopo próprio). Nunca falha a
 * ação de quem pediu; quem fez a ação (`exceto`) não recebe aviso do que ele
 * mesmo fez.
 */
export async function notificar(
  usuarios: (string | null | undefined)[],
  n: Notificacao,
  exceto?: string | null,
): Promise<void> {
  const linhas = linhasDaNotificacao(usuarios, n, exceto);
  if (!linhas.length) return;
  try {
    await banco.comoServico((tx) => repo.inserirNotificacoes(tx, linhas));
  } catch (err) {
    log.error({ err, tipo: n.tipo }, "notificação");
  }
}

/**
 * O mesmo, dentro do escopo `comoServico` de quem chama (rotinas, portal,
 * criação pelo sistema: o chamado ainda não foi confirmado no banco, e só a
 * mesma transação o enxerga). Também nunca falha a ação.
 */
export async function notificarNoEscopo(
  tx: Tx,
  usuarios: (string | null | undefined)[],
  n: Notificacao,
  exceto?: string | null,
): Promise<void> {
  const linhas = linhasDaNotificacao(usuarios, n, exceto);
  if (!linhas.length) return;
  const t = await tentar(tx, () => repo.inserirNotificacoes(tx, linhas));
  if (!t.ok) log.error({ err: t.erro, tipo: n.tipo }, "notificação");
}

/**
 * Pessoas de um setor (todas, ou só as gestoras), pela service role, em
 * escopo próprio: para os avisos que saem depois da resposta. Falhou: [].
 */
export async function membrosDoSetor(
  setorId: string,
  soGestores = false,
): Promise<string[]> {
  try {
    return await banco.comoServico((tx) =>
      repo.membrosDoSetor(tx, setorId, soGestores),
    );
  } catch (err) {
    log.error({ err, setorId }, "membros do setor");
    return [];
  }
}

const pendentes = new Set<Promise<void>>();

/**
 * Trabalho que sai depois da resposta (o `after()` de antes): avisos do
 * sininho. Não segura quem agiu e nunca derruba a ação.
 */
export function depois(oQue: string, fn: () => Promise<unknown>): void {
  const p = Promise.resolve()
    .then(fn)
    .then(
      () => undefined,
      (err: unknown) => log.error({ err }, oQue),
    )
    .finally(() => pendentes.delete(p));
  pendentes.add(p);
}

/** Espera os avisos em andamento (testes e desligamento do processo). */
export async function avisosPendentes(): Promise<void> {
  await Promise.all(pendentes);
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
  conteudo: Uint8Array,
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
export function urlsAssinadas(
  paths: string[],
  segundos = 3600,
): Promise<Map<string, string>> {
  return linksDeLeitura(BUCKET, paths, segundos);
}

/** Lê um arquivo do bucket (PDF do laudo, papel timbrado, fotos). */
export function baixarArquivo(path: string): Promise<Uint8Array | null> {
  return lerArquivo(BUCKET, path);
}

/** Token de link público (portal, terceirizado): 32+ caracteres aleatórios. */
export function novoToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Endereço absoluto de uma tela ("/os/chamados/…"), para mensagens. */
export function urlDoSistema(caminho: string): string {
  return `${env.SITE_URL}${caminho}`;
}
