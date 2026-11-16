import {
  type CriterioCartao,
  type PassoOrdem,
  palavrasDaBusca,
} from "@arp/shared/os/lista";
import { type Selectable, sql } from "kysely";
import type { Tx } from "@/infra/banco";
import type {
  JsonValue,
  OsChamados,
  OsPrioridade,
  OsStatusChamado,
  OsTipoChamado,
} from "@/infra/banco/tipos";
import { type Alvo, donoDo } from "./alvo";

// Consultas da base do módulo Tickets: configuração (parâmetros, feriados,
// setores, catálogo, agendas, pessoas), a consulta padrão de chamados (listas,
// quadro, calendário, painéis), a linha do tempo e as notificações. Só SQL:
// quem abre o escopo (com a sessão ou a service role) é o service.

// ---------------------------------------------------------------------------
// Configuração do módulo
// ---------------------------------------------------------------------------

/** Setores de que a pessoa faz parte (e em quais é gestora). */
export function setoresDoUsuario(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("os.setor_membros")
    .select(["setor_id", "gestor"])
    .where("usuario_id", "=", usuarioId)
    .execute();
}

export function parametros(tx: Tx) {
  return tx
    .selectFrom("os.parametros")
    .selectAll()
    .where("id", "=", 1)
    .executeTakeFirstOrThrow();
}

export async function feriados(tx: Tx): Promise<string[]> {
  const linhas = await tx.selectFrom("os.feriados").select("data").execute();
  return linhas.map((f) => f.data);
}

/** Todos os setores, na ordem da tela. */
export function setores(tx: Tx) {
  return tx
    .selectFrom("os.setores")
    .selectAll()
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

/** Categorias (ativas e inativas), na ordem do catálogo. */
export function categorias(tx: Tx) {
  return tx
    .selectFrom("os.categorias")
    .selectAll()
    .orderBy("ordem")
    .orderBy("nome")
    .execute();
}

export function categoria(tx: Tx, id: string) {
  return tx
    .selectFrom("os.categorias")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

/** Metas dos painéis (Configurações › Parâmetros). */
export function metas(tx: Tx) {
  return tx.selectFrom("os.metas").selectAll().execute();
}

/** Agendas (ativas e inativas), pelo nome. */
export function agendas(tx: Tx) {
  return tx.selectFrom("os.agendas").selectAll().orderBy("nome").execute();
}

export interface Pessoa {
  id: string;
  nome: string;
  setores: string[];
}

/**
 * Quem usa o módulo (os.pessoas: usuários ativos com alguma permissão os.*).
 * A função depende de auth.uid(): só no escopo `comoUsuario`.
 */
export async function pessoas(tx: Tx): Promise<Pessoa[]> {
  const r =
    await sql<Pessoa>`select id, nome, setores from os.pessoas()`.execute(tx);
  return r.rows;
}

/**
 * A mesma regra de os.pessoas(), sem depender da sessão: para as rotinas
 * (service role).
 */
export function usuariosDoModulo(tx: Tx) {
  return tx
    .selectFrom("core.usuarios as u")
    .select(["u.id", "u.nome"])
    .where("u.ativo", "=", true)
    .where((eb) =>
      eb.or([
        eb.exists(
          eb
            .selectFrom("core.usuario_permissoes as up")
            .select("up.usuario_id")
            .whereRef("up.usuario_id", "=", "u.id")
            .where("up.permissao", "like", "os.%"),
        ),
        eb.exists(
          eb
            .selectFrom("core.cargo_permissoes as cp")
            .innerJoin("core.cargos as c", "c.id", "cp.cargo_id")
            .select("cp.cargo_id")
            .whereRef("cp.cargo_id", "=", "u.cargo_id")
            .where("cp.permissao", "like", "os.%")
            .where("c.ativo", "=", true),
        ),
      ]),
    )
    .execute();
}

/** Pessoas de um setor (todas, ou só as marcadas como gestoras). */
export async function membrosDoSetor(
  tx: Tx,
  setorId: string,
  soGestores = false,
): Promise<string[]> {
  let q = tx
    .selectFrom("os.setor_membros")
    .select("usuario_id")
    .where("setor_id", "=", setorId);
  if (soGestores) q = q.where("gestor", "=", true);
  return (await q.execute()).map((m) => m.usuario_id);
}

// ---------------------------------------------------------------------------
// Consulta padrão de chamados (listas, quadro, calendário, painéis)
// ---------------------------------------------------------------------------

/** Colunas que as listas usam; o detalhe lê o chamado inteiro. */
export const COLUNAS_RESUMO = [
  "c.id",
  "c.numero",
  "c.tipo",
  "c.titulo",
  "c.setor_id",
  "c.categoria_id",
  "c.status",
  "c.prioridade",
  "c.origem",
  "c.pessoal",
  "c.precisa_confirmacao",
  "c.aberto_por",
  "c.solicitante_nome",
  "c.responsavel_id",
  "c.prazo",
  "c.loja_id",
  "c.ativo_id",
  "c.etiquetas",
  "c.aguardando_tipo",
  "c.aguardando_min",
  "c.aguardando_desde",
  "c.primeira_resposta_em",
  "c.concluido_em",
  "c.fechado_em",
  "c.cancelado_em",
  "c.avaliacao",
  "c.criado_em",
  "c.atualizado_em",
] as const;

/** Linha de os.chamados ou de os.ordens (a OS tem as mesmas colunas). */
export type Chamado = Selectable<OsChamados>;

export type ChamadoResumo = Pick<
  Chamado,
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
  tipos?: OsTipoChamado[];
  status?: OsStatusChamado[];
  categoria?: string | null;
  responsavel?: string | null;
  /** Só os abertos por esta pessoa (filtro "Abertos por mim"). */
  abertoPor?: string | null;
  prioridade?: OsPrioridade | null;
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

/** Quem pede a lista (o recorte depende da pessoa e dos setores dela). */
export interface Quem {
  eu: string;
  setores: string[];
}

/** Período de abertura da barra (aaaa-mm-dd, inclusive), em Brasília. */
export const criadoDesde = (de: string) => `${de}T00:00:00-03:00`;
export const criadoAte = (ate: string) => `${ate}T23:59:59-03:00`;

const NENHUM_SETOR = "00000000-0000-0000-0000-000000000000";

/**
 * os.chamados ou os.ordens com o apelido `c`. As duas têm as colunas do
 * chamado; por isso o tipo da linha é o do chamado.
 */
function dono(tx: Tx, ordens: boolean) {
  const tabela = ordens ? sql<Chamado>`os.ordens` : sql<Chamado>`os.chamados`;
  return tx.selectFrom(tabela.as("c"));
}

/**
 * Chamados com os filtros, o recorte, o cartão e a busca (as listas, a
 * página, a contagem e a exportação montam do mesmo jeito). `status` já é o
 * da barra cruzado com o do cartão (quem cruza é o service).
 */
function filtrados(
  tx: Tx,
  f: FiltroChamados,
  status: OsStatusChamado[] | undefined,
  quem: Quem,
) {
  const ordens = !!f.ordens;
  let q = dono(tx, ordens);
  if (f.setor) q = q.where("c.setor_id", "=", f.setor);
  if (f.setores?.length) q = q.where("c.setor_id", "in", f.setores);
  if (f.tipos?.length && !ordens) q = q.where("c.tipo", "in", f.tipos);
  if (status?.length) q = q.where("c.status", "in", status);
  if (f.categoria) q = q.where("c.categoria_id", "=", f.categoria);
  if (f.responsavel) q = q.where("c.responsavel_id", "=", f.responsavel);
  if (f.abertoPor) q = q.where("c.aberto_por", "=", f.abertoPor);
  if (f.prioridade) q = q.where("c.prioridade", "=", f.prioridade);
  if (f.etiqueta)
    q = q.where(sql<boolean>`c.etiquetas @> ${[f.etiqueta]}::text[]`);
  if (f.de) q = q.where("c.criado_em", ">=", criadoDesde(f.de));
  if (f.ate) q = q.where("c.criado_em", "<=", criadoAte(f.ate));
  if (f.prazoEntre)
    q = q
      .where("c.prazo", ">=", f.prazoEntre.de)
      .where("c.prazo", "<", f.prazoEntre.ate);

  const c = f.cartao;
  if (c?.abertoPor) q = q.where("c.aberto_por", "=", c.abertoPor);
  if (c?.semResponsavel) q = q.where("c.responsavel_id", "is", null);
  if (c?.prazoDesde) q = q.where("c.prazo", ">=", c.prazoDesde);
  if (c?.prazoAntes) q = q.where("c.prazo", "<", c.prazoAntes);
  if (c?.encerradoDesde)
    q = q.where(
      c.encerradoDesde.campo === "fechado_em"
        ? "c.fechado_em"
        : "c.concluido_em",
      ">=",
      c.encerradoDesde.iso,
    );
  // Campos calculados do banco (só existem para os.chamados: avisos).
  if (c?.lido !== undefined)
    q = q.where(sql<boolean>`os.lido_por_mim(c) = ${c.lido}`);
  if (c?.todosLeram !== undefined)
    q = q.where(sql<boolean>`os.todos_leram(c) = ${c.todosLeram}`);
  // Todas as palavras precisam aparecer (título, descrição ou número).
  for (const palavra of palavrasDaBusca(f.busca ?? "")) {
    const n = palavra.replace(/^#/, "");
    q = q.where((eb) =>
      eb.or([
        eb("c.titulo", "ilike", `%${palavra}%`),
        eb("c.descricao", "ilike", `%${palavra}%`),
        ...(/^\d{1,9}$/.test(n) ? [eb("c.numero", "=", Number(n))] : []),
      ]),
    );
  }

  switch (f.recorte) {
    case "abertos_por_mim":
      q = q.where("c.aberto_por", "=", quem.eu);
      break;
    case "meu_setor":
      if (!f.setor && !f.setores?.length)
        q = quem.setores.length
          ? q.where("c.setor_id", "in", quem.setores)
          : q.where("c.setor_id", "=", NENHUM_SETOR);
      break;
    case "minha_caixa":
      // O que está comigo: sou o responsável; um destino é meu (ou do meu
      // setor) e ainda não concluiu; é a fila do meu setor; ou (caixa) é um
      // pedido meu já concluído, que espera a minha confirmação.
      q = q.where((eb) =>
        eb.or([
          eb("c.responsavel_id", "=", quem.eu),
          eb.exists(
            eb
              .selectFrom("os.destinatarios as d")
              .select("d.id")
              .whereRef(ordens ? "d.ordem_id" : "d.chamado_id", "=", "c.id")
              .where("d.status", "<>", "concluido")
              .where((e2) =>
                e2.or([
                  e2("d.usuario_id", "=", quem.eu),
                  e2("d.responsavel_id", "=", quem.eu),
                  ...(quem.setores.length
                    ? [e2("d.setor_id", "in", quem.setores)]
                    : []),
                ]),
              ),
          ),
          ...(quem.setores.length
            ? [
                eb.and([
                  eb("c.responsavel_id", "is", null),
                  eb("c.setor_id", "in", quem.setores),
                ]),
              ]
            : []),
          ...(f.comConfirmacao
            ? [
                eb.and([
                  eb("c.aberto_por", "=", quem.eu),
                  eb("c.status", "=", "concluido"),
                ]),
              ]
            : []),
        ]),
      );
      break;
    default:
      break;
  }
  return q;
}

type Filtrados = ReturnType<typeof filtrados>;

/** Colunas que a ordem pode usar (as de `ordemDaConsulta`). */
const ORDENAVEIS = {
  responsavel_id: sql`c.responsavel_id`,
  categoria_id: sql`c.categoria_id`,
  status: sql`c.status`,
  lido_por_mim: sql`os.lido_por_mim(c)`,
  todos_leram: sql`os.todos_leram(c)`,
  numero: sql`c.numero`,
  titulo: sql`c.titulo`,
  prioridade: sql`c.prioridade`,
  prazo: sql`c.prazo`,
  criado_em: sql`c.criado_em`,
  fechado_em: sql`c.fechado_em`,
};
const ordenavel = (c: string): c is keyof typeof ORDENAVEIS =>
  Object.hasOwn(ORDENAVEIS, c);

/** Ordem do banco (passos de `ordemDaConsulta`, em @arp/shared/os/lista). */
function ordenar(q: Filtrados, passos: PassoOrdem[]): Filtrados {
  let r = q;
  for (const p of passos) {
    if (!ordenavel(p.coluna)) continue;
    r = r.orderBy(ORDENAVEIS[p.coluna], (ob) => {
      const direcao = p.asc ? ob.asc() : ob.desc();
      return p.nullsFirst ? direcao.nullsFirst() : direcao.nullsLast();
    });
  }
  return r;
}

/** Os chamados do filtro, do mais novo, até `limite`. */
export function buscarChamados(
  tx: Tx,
  f: FiltroChamados,
  status: OsStatusChamado[] | undefined,
  quem: Quem,
): Promise<ChamadoResumo[]> {
  return filtrados(tx, f, status, quem)
    .select(COLUNAS_RESUMO)
    .orderBy("c.criado_em", "desc")
    .limit(f.limite ?? 2000)
    .execute();
}

/** Quantos chamados passam nos filtros (sem trazer linha nenhuma). */
export async function contarChamados(
  tx: Tx,
  f: FiltroChamados,
  status: OsStatusChamado[] | undefined,
  quem: Quem,
): Promise<number> {
  const r = await filtrados(tx, f, status, quem)
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

/** Um trecho do resultado filtrado, na ordem pedida. */
export function trechoDeChamados(
  tx: Tx,
  f: FiltroChamados,
  status: OsStatusChamado[] | undefined,
  quem: Quem,
  p: { ordem: PassoOrdem[]; limite: number; pular?: number },
): Promise<ChamadoResumo[]> {
  return ordenar(filtrados(tx, f, status, quem), p.ordem)
    .select(COLUNAS_RESUMO)
    .limit(p.limite)
    .offset(p.pular ?? 0)
    .execute();
}

/** Em aberto e atrasados de um responsável (null: a fila do setor). */
export interface ContagemDaCarga {
  responsavel_id: string | null;
  abertos: number;
  atrasados: number;
}

/**
 * Carga por pessoa de um setor, agregada no banco (os.carga_do_setor e
 * os.carga_das_ordens, com o RLS de quem pede).
 */
export async function cargaDeUmSetor(
  tx: Tx,
  setor: string,
  f: FiltroChamados,
  agora: Date,
): Promise<ContagemDaCarga[]> {
  const status = f.status?.length ? f.status : null;
  const desde = f.de ? criadoDesde(f.de) : null;
  const ate = f.ate ? criadoAte(f.ate) : null;
  const r = f.ordens
    ? await sql<ContagemDaCarga>`
        select responsavel_id, abertos, atrasados from os.carga_das_ordens(
          p_setor => ${setor}::uuid,
          p_agora => ${agora.toISOString()}::timestamptz,
          p_status => ${status}::os.status_chamado[],
          p_categoria => ${f.categoria ?? null}::uuid,
          p_responsavel => ${f.responsavel ?? null}::uuid,
          p_prioridade => ${f.prioridade ?? null}::os.prioridade,
          p_etiqueta => ${f.etiqueta ?? null}::text,
          p_criado_desde => ${desde}::timestamptz,
          p_criado_ate => ${ate}::timestamptz,
          p_aberto_por => ${f.abertoPor ?? null}::uuid
        )`.execute(tx)
    : await sql<ContagemDaCarga>`
        select responsavel_id, abertos, atrasados from os.carga_do_setor(
          p_setor => ${setor}::uuid,
          p_agora => ${agora.toISOString()}::timestamptz,
          p_status => ${status}::os.status_chamado[],
          p_tipos => ${f.tipos?.length ? f.tipos : null}::os.tipo_chamado[],
          p_categoria => ${f.categoria ?? null}::uuid,
          p_responsavel => ${f.responsavel ?? null}::uuid,
          p_prioridade => ${f.prioridade ?? null}::os.prioridade,
          p_etiqueta => ${f.etiqueta ?? null}::text,
          p_criado_desde => ${desde}::timestamptz,
          p_criado_ate => ${ate}::timestamptz,
          p_aberto_por => ${f.abertoPor ?? null}::uuid
        )`.execute(tx);
  return r.rows.map((c) => ({
    responsavel_id: c.responsavel_id ?? null,
    abertos: Number(c.abertos),
    atrasados: Number(c.atrasados),
  }));
}

// ---------------------------------------------------------------------------
// Linha do tempo e notificações
// ---------------------------------------------------------------------------

export interface NovoEvento {
  tipo: string;
  texto?: string | null;
  dados?: Record<string, JsonValue | undefined>;
  visivelLojista?: boolean;
  /** Usuário logado que fez; ou o nome de quem não tem sessão. */
  autorId?: string | null;
  autorNome?: string | null;
}

/** Grava na linha do tempo do chamado ou da OS e devolve o id do evento. */
export async function inserirEvento(
  tx: Tx,
  alvo: Alvo,
  e: NovoEvento,
): Promise<number> {
  const r = await tx
    .insertInto("os.eventos")
    .values({
      ...donoDo(alvo),
      tipo: e.tipo,
      texto: e.texto ?? null,
      dados: JSON.stringify(e.dados ?? {}),
      visivel_lojista: e.visivelLojista ?? false,
      autor_id: e.autorId ?? null,
      autor_nome: e.autorNome ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export interface LinhaDeNotificacao {
  usuario_id: string;
  chamado_id: string | null;
  ordem_id: string | null;
  tipo: string;
  titulo: string;
  texto: string | null;
  href: string;
  chave: string | null;
}

/** Notificações do sininho; a mesma (pessoa e chave) não se repete. */
export async function inserirNotificacoes(
  tx: Tx,
  linhas: LinhaDeNotificacao[],
): Promise<void> {
  if (!linhas.length) return;
  await tx
    .insertInto("os.notificacoes")
    .values(linhas)
    .onConflict((oc) => oc.columns(["usuario_id", "chave"]).doNothing())
    .execute();
}

/** Das chaves pedidas, quem já recebeu cada aviso ("usuario|chave"). */
export async function notificacoesJaEnviadas(
  tx: Tx,
  chaves: string[],
): Promise<Set<string>> {
  if (!chaves.length) return new Set();
  const linhas = await tx
    .selectFrom("os.notificacoes")
    .select(["usuario_id", "chave"])
    .where("chave", "in", chaves)
    .execute();
  return new Set(linhas.map((n) => `${n.usuario_id}|${n.chave}`));
}

/** Quem acompanha o chamado (citado ou seguindo); a repetição é ignorada. */
export async function incluirParticipantes(
  tx: Tx,
  alvo: Alvo,
  usuarios: string[],
  motivo: "mencionado" | "seguindo",
): Promise<void> {
  if (!usuarios.length) return;
  const dono = donoDo(alvo);
  await tx
    .insertInto("os.participantes")
    .values(usuarios.map((usuario_id) => ({ ...dono, usuario_id, motivo })))
    .onConflict((oc) =>
      oc
        .columns([dono.ordem_id ? "ordem_id" : "chamado_id", "usuario_id"])
        .doNothing(),
    )
    .execute();
}
