import type { CriterioDoCartao } from "@arp/shared/os/ordem-lista";
import type { Execucao, StatusChamado } from "@arp/shared/os/rotulos";
import {
  type ExpressionBuilder,
  type Insertable,
  type Selectable,
  sql,
  type Updateable,
} from "kysely";
import { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";
import type {
  DB,
  OsEmpresas,
  OsOrdens,
  OsOsCustos,
  OsProfissionais,
  OsSessoes,
  OsTecnicos,
  OsTerceirizadoLinks,
} from "@/infra/banco/tipos";

// Consultas das Ordens de serviço: a lista com tudo o que a tela, o PDF e a
// exportação mostram (sessões, técnicos, terceirizado e, para quem vê
// custos, o resultado gravado), o bloco da OS e as gravações dele. Só SQL:
// quem abre o escopo (sessão ou service role) é o service.

export type Ordem = Selectable<OsOrdens>;
export type Tecnico = Selectable<OsTecnicos>;
export type Empresa = Selectable<OsEmpresas>;
export type Profissional = Selectable<OsProfissionais>;
export type Custos = Selectable<OsOsCustos>;
export type LinkDaOS = Selectable<OsTerceirizadoLinks>;

type Eb = ExpressionBuilder<DB & { o: OsOrdens }, "o">;

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

/** Sessões com os técnicos (o `sessoes(…, sessao_tecnicos(tecnico_id))`). */
function sessoesDaOrdem(eb: Eb) {
  return jsonArrayFrom(
    eb
      .selectFrom("os.sessoes as s")
      .select((e) => [
        "s.id",
        "s.data",
        "s.inicio",
        "s.fim",
        "s.almoco_inicio",
        "s.almoco_fim",
        jsonArrayFrom(
          e
            .selectFrom("os.sessao_tecnicos as st")
            .select("st.tecnico_id")
            .whereRef("st.sessao_id", "=", "s.id"),
        ).as("sessao_tecnicos"),
      ])
      .whereRef("s.ordem_id", "=", "o.id"),
  ).as("sessoes");
}

function colunasDaOS(eb: Eb) {
  return [
    "o.id",
    "o.numero",
    "o.tipo",
    "o.titulo",
    "o.descricao",
    "o.setor_id",
    "o.categoria_id",
    "o.status",
    "o.prioridade",
    "o.aguardando_tipo",
    "o.aberto_por",
    "o.solicitante_nome",
    "o.responsavel_id",
    "o.prazo",
    "o.loja_id",
    "o.ativo_id",
    "o.execucao",
    "o.local",
    "o.bloco",
    "o.empresa_id",
    "o.visita_data",
    "o.visita_periodo",
    "o.prazo_terceirizado",
    "o.solucao",
    "o.causa_falha",
    "o.ativo_parado",
    "o.rateio",
    "o.assinatura_nome",
    "o.assinatura_path",
    "o.assinado_em",
    "o.concluido_em",
    "o.fechado_em",
    "o.fechado_por",
    "o.cancelado_em",
    "o.criado_em",
    "o.legado_origem",
    sessoesDaOrdem(eb),
    jsonArrayFrom(
      eb
        .selectFrom("os.ordem_profissionais as op")
        .select("op.profissional_id")
        .whereRef("op.ordem_id", "=", "o.id"),
    ).as("ordem_profissionais"),
    jsonObjectFrom(
      eb
        .selectFrom("os.os_custos as k")
        .select([
          "k.custo_total",
          "k.valor_rateio",
          "k.custo_mao_obra",
          "k.custo_materiais",
          "k.valor_terceirizado",
          "k.outros_custos",
          "k.completo",
          "k.legado_valor",
          "k.legado_valor_rateio",
        ])
        .whereRef("k.ordem_id", "=", "o.id"),
    ).as("os_custos"),
  ] as const;
}

function consultaBase(tx: Tx) {
  return tx.selectFrom("os.ordens as o").select(colunasDaOS);
}

/** A OS com sessões, profissionais e custos (o que o RLS deixa ver). */
export type LinhaOS = Awaited<
  ReturnType<ReturnType<typeof consultaBase>["execute"]>
>[number];

export interface FiltroOS {
  ids?: string[];
  /** Só OS (padrão) ou qualquer chamado (impressão pelo id). */
  soOS?: boolean;
  status?: StatusChamado[];
  execucao?: Execucao | null;
  categoria?: string | null;
  empresa?: string | null;
  rateio?: boolean | null;
  /** Criadas de / até (aaaa-mm-dd, Brasília, inclusive). */
  de?: string | null;
  ate?: string | null;
  /** Fechadas de / até (relatórios de finalizadas). */
  fechadoDe?: string | null;
  fechadoAte?: string | null;
  limite?: number;
}

const inicioDoDia = (d: string) => `${d}T00:00:00-03:00`;
const fimDoDia = (d: string) => `${d}T23:59:59.999-03:00`;

/** OS que o usuário vê, já com sessões, profissionais e custos (RLS). */
export function consultarOS(tx: Tx, f: FiltroOS = {}): Promise<LinhaOS[]> {
  if (f.ids && !f.ids.length) return Promise.resolve([]);
  let q = consultaBase(tx).orderBy("o.numero", "desc");
  if (f.ids) q = q.where("o.id", "in", f.ids);
  if (f.soOS ?? true) q = q.where("o.tipo", "=", "os");
  if (f.status?.length) q = q.where("o.status", "in", f.status);
  if (f.execucao) q = q.where("o.execucao", "=", f.execucao);
  if (f.categoria) q = q.where("o.categoria_id", "=", f.categoria);
  if (f.empresa) q = q.where("o.empresa_id", "=", f.empresa);
  if (f.rateio != null) q = q.where("o.rateio", "=", f.rateio);
  if (f.de) q = q.where("o.criado_em", ">=", inicioDoDia(f.de));
  if (f.ate) q = q.where("o.criado_em", "<=", fimDoDia(f.ate));
  if (f.fechadoDe) q = q.where("o.fechado_em", ">=", inicioDoDia(f.fechadoDe));
  if (f.fechadoAte) q = q.where("o.fechado_em", "<=", fimDoDia(f.fechadoAte));
  // O sistema anterior lia no máximo mil por padrão.
  return q.limit(f.limite ?? 1000).execute();
}

/** Filtros da tela já resolvidos para o banco. */
export interface FiltroListaOS {
  status: StatusChamado[];
  execucao: Execucao | null;
  setor: string | null;
  /** Uma pessoa ou NA_FILA (sem responsável). */
  responsavel: string | null;
  semResponsavel: boolean;
  categoria: string | null;
  empresa: string | null;
  rateio: boolean | null;
  tecnico: string | null;
  /** Criadas de / até (aaaa-mm-dd, Brasília, inclusive). */
  de: string | null;
  ate: string | null;
  /** Local digitado: no local, no bloco e nas lojas que conferem. */
  local: {
    termo: string;
    bloco: string;
    lojas: string[];
    /** Sem loja, bloco nem ponto, a tela mostra "Área comum". */
    areaComum: boolean;
  } | null;
  /** Busca (título, descrição e, se for número, o número exato). */
  busca: { termo: string; numero: number | null } | null;
}

/** As OS do filtro e do cartão (lista, contagem e exportação). */
function filtradas(tx: Tx, f: FiltroListaOS, extra: CriterioDoCartao | null) {
  let q = tx.selectFrom("os.ordens as o").where("o.tipo", "=", "os");
  if (f.status.length) q = q.where("o.status", "in", f.status);
  if (f.execucao) q = q.where("o.execucao", "=", f.execucao);
  if (f.setor) q = q.where("o.setor_id", "=", f.setor);
  if (f.semResponsavel) q = q.where("o.responsavel_id", "is", null);
  else if (f.responsavel) q = q.where("o.responsavel_id", "=", f.responsavel);
  if (f.categoria) q = q.where("o.categoria_id", "=", f.categoria);
  if (f.empresa) q = q.where("o.empresa_id", "=", f.empresa);
  if (f.rateio !== null) q = q.where("o.rateio", "=", f.rateio);
  // Técnico: as OS em que ele trabalhou, sem cortar as outras sessões da OS
  // (que somam o tempo).
  const tecnico = f.tecnico;
  if (tecnico)
    q = q.where((eb) =>
      eb.exists(
        eb
          .selectFrom("os.sessoes as fs")
          .innerJoin("os.sessao_tecnicos as ft", "ft.sessao_id", "fs.id")
          .select("fs.id")
          .whereRef("fs.ordem_id", "=", "o.id")
          .where("ft.tecnico_id", "=", tecnico),
      ),
    );
  if (f.de) q = q.where("o.criado_em", ">=", inicioDoDia(f.de));
  if (f.ate) q = q.where("o.criado_em", "<=", fimDoDia(f.ate));
  const local = f.local;
  if (local)
    q = q.where((eb) =>
      eb.or([
        eb("o.local", "ilike", `%${local.termo}%`),
        eb("o.bloco", "ilike", `%${local.bloco}%`),
        ...(local.lojas.length ? [eb("o.loja_id", "in", local.lojas)] : []),
        ...(local.areaComum
          ? [
              eb.and([
                eb("o.loja_id", "is", null),
                eb("o.bloco", "is", null),
                eb("o.local", "is", null),
              ]),
            ]
          : []),
      ]),
    );
  const busca = f.busca;
  if (busca)
    q = q.where((eb) =>
      eb.or([
        eb("o.titulo", "ilike", `%${busca.termo}%`),
        eb("o.descricao", "ilike", `%${busca.termo}%`),
        ...(busca.numero !== null ? [eb("o.numero", "=", busca.numero)] : []),
      ]),
    );
  if (extra) {
    // Dois filtros na mesma coluna somam (status do filtro E do cartão).
    if (extra.status) q = q.where("o.status", "in", extra.status);
    if (extra.execucao) q = q.where("o.execucao", "=", extra.execucao);
    if (extra.fechadoEntre)
      q = q
        .where("o.fechado_em", ">=", extra.fechadoEntre.de)
        .where("o.fechado_em", "<", extra.fechadoEntre.ate);
    // Com o cronômetro rodando agora (sessão aberta).
    if (extra.rodando)
      q = q.where((eb) =>
        eb.exists(
          eb
            .selectFrom("os.sessoes as rs")
            .select("rs.id")
            .whereRef("rs.ordem_id", "=", "o.id")
            .where("rs.fim", "is", null),
        ),
      );
    if (extra.prazoAntes) q = q.where("o.prazo", "<", extra.prazoAntes);
  }
  return q;
}

export async function contarOS(
  tx: Tx,
  f: FiltroListaOS,
  extra: CriterioDoCartao | null,
): Promise<number> {
  const r = await filtradas(tx, f, extra)
    .select((eb) => eb.fn.countAll<number>().as("total"))
    .executeTakeFirstOrThrow();
  return Number(r.total);
}

/** Um trecho do filtro, a mais recente primeiro. */
export function trechoDeOS(
  tx: Tx,
  f: FiltroListaOS,
  extra: CriterioDoCartao | null,
  p: { limite: number; pular?: number },
): Promise<LinhaOS[]> {
  return filtradas(tx, f, extra)
    .select(colunasDaOS)
    .orderBy("o.numero", "desc")
    .limit(p.limite)
    .offset(p.pular ?? 0)
    .execute();
}

// ---------------------------------------------------------------------------
// Cadastros (técnicos, empresas, profissionais)
// ---------------------------------------------------------------------------

export function tecnicos(tx: Tx): Promise<Tecnico[]> {
  return tx.selectFrom("os.tecnicos").selectAll().orderBy("nome").execute();
}

export function empresas(tx: Tx): Promise<Empresa[]> {
  return tx.selectFrom("os.empresas").selectAll().orderBy("nome").execute();
}

export function profissionais(tx: Tx): Promise<Profissional[]> {
  return tx
    .selectFrom("os.profissionais")
    .selectAll()
    .orderBy("nome")
    .execute();
}

// ---------------------------------------------------------------------------
// Bloco da OS
// ---------------------------------------------------------------------------

export function ordem(tx: Tx, id: string): Promise<Ordem | undefined> {
  return tx
    .selectFrom("os.ordens")
    .selectAll()
    .where("id", "=", id)
    .executeTakeFirst();
}

/** A pessoa mexe nesta OS (a mesma regra do RLS das filhas). */
export async function podeEditar(tx: Tx, id: string): Promise<boolean> {
  const r = await sql<{ pode: boolean | null }>`
    select os.pode_editar_ordem(${id}) as pode`.execute(tx);
  return r.rows[0]?.pode === true;
}

export function sessoesDa(tx: Tx, ordemId: string) {
  return tx
    .selectFrom("os.sessoes as s")
    .select((eb) => [
      "s.id",
      "s.data",
      "s.inicio",
      "s.fim",
      "s.almoco_inicio",
      "s.almoco_fim",
      "s.observacao",
      jsonArrayFrom(
        eb
          .selectFrom("os.sessao_tecnicos as st")
          .select("st.tecnico_id")
          .whereRef("st.sessao_id", "=", "s.id"),
      ).as("sessao_tecnicos"),
    ])
    .where("s.ordem_id", "=", ordemId)
    .execute();
}

/** Materiais com o preço (o RLS esconde o preço de quem não vê custos). */
export function materiaisDa(tx: Tx, ordemId: string) {
  return tx
    .selectFrom("os.materiais as m")
    .leftJoin("os.material_valores as v", "v.material_id", "m.id")
    .select([
      "m.id",
      "m.ordem_id",
      "m.descricao",
      "m.quantidade",
      "m.unidade",
      "v.valor_unitario",
    ])
    .where("m.ordem_id", "=", ordemId)
    .orderBy("m.criado_em")
    .execute();
}

export function custosDa(tx: Tx, ordemId: string): Promise<Custos | undefined> {
  return tx
    .selectFrom("os.os_custos")
    .selectAll()
    .where("ordem_id", "=", ordemId)
    .executeTakeFirst();
}

export function linksDa(tx: Tx, ordemId: string): Promise<LinkDaOS[]> {
  return tx
    .selectFrom("os.terceirizado_links")
    .selectAll()
    .where("ordem_id", "=", ordemId)
    .orderBy("criado_em", "desc")
    .limit(5)
    .execute();
}

/** Situação de todos os links da OS (ordem das assinaturas). */
export function situacaoDosLinks(tx: Tx, ordemId: string) {
  return tx
    .selectFrom("os.terceirizado_links")
    .select(["cancelado_em", "recusado_em", "assinado_em"])
    .where("ordem_id", "=", ordemId)
    .execute();
}

/** Fotos de antes e depois, orçamento e laudo da OS. */
export function arquivosDaOS(tx: Tx, ordemId: string) {
  return tx
    .selectFrom("os.anexos")
    .select([
      "id",
      "nome",
      "categoria",
      "path",
      "mime",
      "enviado_por",
      "enviado_por_nome",
      "em",
    ])
    .where("ordem_id", "=", ordemId)
    .where("categoria", "in", ["antes", "depois", "orcamento", "laudo"])
    .orderBy("em")
    .execute();
}

export async function profissionaisDa(
  tx: Tx,
  ordemId: string,
): Promise<string[]> {
  const linhas = await tx
    .selectFrom("os.ordem_profissionais")
    .select("profissional_id")
    .where("ordem_id", "=", ordemId)
    .execute();
  return linhas.map((x) => x.profissional_id);
}

export interface AtivoDoVinculo {
  id: string;
  codigo: string;
  nome: string;
  local: string;
  situacao: string;
}

export async function ativosParaVincular(tx: Tx): Promise<AtivoDoVinculo[]> {
  const r = await sql<AtivoDoVinculo>`
    select id, codigo, nome, local, situacao from os.ativos_para_vincular()
  `.execute(tx);
  return r.rows;
}

export function contatos(tx: Tx) {
  return tx
    .selectFrom("os.contatos")
    .select(["id", "nome", "telefone", "empresa"])
    .orderBy("nome")
    .execute();
}

export function vigenciasDe(tx: Tx, tecnicoIds: string[]) {
  if (!tecnicoIds.length) return Promise.resolve([]);
  return tx
    .selectFrom("os.tecnico_valores")
    .select(["tecnico_id", "vigente_desde", "valor_minuto"])
    .where("tecnico_id", "in", tecnicoIds)
    .execute();
}

export function nomesDosTecnicos(tx: Tx, ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  return tx
    .selectFrom("os.tecnicos")
    .select(["id", "nome", "desligado_em"])
    .where("id", "in", ids)
    .execute();
}

/** Grava o resultado do cálculo (função do banco, só a service role). */
export async function gravarCalculo(
  tx: Tx,
  ordemId: string,
  resultado: unknown,
): Promise<void> {
  await sql`
    select os.gravar_calculo_os(${ordemId}, ${JSON.stringify(resultado)}::jsonb)
  `.execute(tx);
}

export async function atualizarOrdem(
  tx: Tx,
  id: string,
  muda: Updateable<OsOrdens>,
  se: { solucaoVazia?: boolean } = {},
): Promise<void> {
  let q = tx.updateTable("os.ordens").set(muda).where("id", "=", id);
  if (se.solucaoVazia) q = q.where("solucao", "is", null);
  await q.execute();
}

/** Ativo parado ↔ em uso: só mexe em quem está na situação oposta. */
export async function situacaoDoAtivo(
  tx: Tx,
  ativoId: string,
  parado: boolean,
): Promise<void> {
  await tx
    .updateTable("os.ativos")
    .set({ situacao: parado ? "em_manutencao" : "em_uso" })
    .where("id", "=", ativoId)
    .where("situacao", "=", parado ? "em_uso" : "em_manutencao")
    .execute();
}

// ---------------------------------------------------------------------------
// Técnico do usuário e sessões
// ---------------------------------------------------------------------------

export function tecnicoDoUsuario(tx: Tx, usuarioId: string) {
  return tx
    .selectFrom("os.tecnicos")
    .select(["id", "desligado_em"])
    .where("usuario_id", "=", usuarioId)
    .executeTakeFirst();
}

export async function criarTecnico(
  tx: Tx,
  t: { nome: string; usuario_id: string; setor_id: string },
): Promise<string> {
  const r = await tx
    .insertInto("os.tecnicos")
    .values(t)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Sessões abertas (cronômetro rodando) de um técnico, com o número da OS. */
export function sessoesAbertasDoTecnico(tx: Tx, tecnicoId: string) {
  return tx
    .selectFrom("os.sessao_tecnicos as st")
    .innerJoin("os.sessoes as s", "s.id", "st.sessao_id")
    .leftJoin("os.ordens as o", "o.id", "s.ordem_id")
    .select(["s.id", "s.ordem_id", "s.data", "s.inicio", "o.numero"])
    .where("st.tecnico_id", "=", tecnicoId)
    .where("s.fim", "is", null)
    .execute();
}

export async function inserirSessao(
  tx: Tx,
  linha: Insertable<OsSessoes>,
): Promise<string> {
  const r = await tx
    .insertInto("os.sessoes")
    .values(linha)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function atualizarSessao(
  tx: Tx,
  id: string,
  ordemId: string,
  muda: Updateable<OsSessoes>,
): Promise<boolean> {
  const r = await tx
    .updateTable("os.sessoes")
    .set(muda)
    .where("id", "=", id)
    .where("ordem_id", "=", ordemId)
    .returning("id")
    .execute();
  return r.length > 0;
}

export function removerSessao(tx: Tx, id: string, ordemId: string) {
  return tx
    .deleteFrom("os.sessoes")
    .where("id", "=", id)
    .where("ordem_id", "=", ordemId)
    .returning(["data", "inicio", "fim"])
    .executeTakeFirst();
}

export async function tecnicosDaSessao(
  tx: Tx,
  sessaoId: string,
): Promise<string[]> {
  const linhas = await tx
    .selectFrom("os.sessao_tecnicos")
    .select("tecnico_id")
    .where("sessao_id", "=", sessaoId)
    .execute();
  return linhas.map((t) => t.tecnico_id);
}

export async function trocarTecnicosDaSessao(
  tx: Tx,
  sessaoId: string,
  tecnicoIds: string[],
  limpar: boolean,
): Promise<void> {
  if (limpar)
    await tx
      .deleteFrom("os.sessao_tecnicos")
      .where("sessao_id", "=", sessaoId)
      .execute();
  if (tecnicoIds.length)
    await tx
      .insertInto("os.sessao_tecnicos")
      .values(
        tecnicoIds.map((tecnico_id) => ({ sessao_id: sessaoId, tecnico_id })),
      )
      .execute();
}

// ---------------------------------------------------------------------------
// Execução, materiais e custos
// ---------------------------------------------------------------------------

export async function trocarProfissionais(
  tx: Tx,
  ordemId: string,
  ids: string[],
): Promise<void> {
  await tx
    .deleteFrom("os.ordem_profissionais")
    .where("ordem_id", "=", ordemId)
    .execute();
  if (ids.length)
    await tx
      .insertInto("os.ordem_profissionais")
      .values(
        ids.map((profissional_id) => ({ ordem_id: ordemId, profissional_id })),
      )
      .execute();
}

export async function inserirMaterial(
  tx: Tx,
  linha: {
    ordem_id: string;
    descricao: string;
    quantidade: number;
    unidade: string | null;
    criado_por: string;
  },
): Promise<string> {
  const r = await tx
    .insertInto("os.materiais")
    .values(linha)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

export async function atualizarMaterial(
  tx: Tx,
  id: string,
  ordemId: string,
  muda: { descricao: string; quantidade: number; unidade: string | null },
): Promise<boolean> {
  const r = await tx
    .updateTable("os.materiais")
    .set(muda)
    .where("id", "=", id)
    .where("ordem_id", "=", ordemId)
    .returning("id")
    .execute();
  return r.length > 0;
}

export function removerMaterial(tx: Tx, id: string, ordemId: string) {
  return tx
    .deleteFrom("os.materiais")
    .where("id", "=", id)
    .where("ordem_id", "=", ordemId)
    .returning("descricao")
    .executeTakeFirst();
}

/** Preço do material (null: tira o preço). */
export async function valorDoMaterial(
  tx: Tx,
  materialId: string,
  valor: number | null,
): Promise<void> {
  if (valor === null) {
    await tx
      .deleteFrom("os.material_valores")
      .where("material_id", "=", materialId)
      .execute();
    return;
  }
  await tx
    .insertInto("os.material_valores")
    .values({ material_id: materialId, valor_unitario: valor })
    .onConflict((oc) =>
      oc.column("material_id").doUpdateSet({ valor_unitario: valor }),
    )
    .execute();
}

/** Inclui ou altera a linha de custos da OS (só as colunas dadas). */
export async function gravarCustos(
  tx: Tx,
  ordemId: string,
  muda: Omit<Updateable<OsOsCustos>, "ordem_id">,
): Promise<void> {
  await tx
    .insertInto("os.os_custos")
    .values({ ordem_id: ordemId, ...muda })
    .onConflict((oc) => oc.column("ordem_id").doUpdateSet(muda))
    .execute();
}

/** Aprova o orçamento que existe; devolve o valor aprovado. */
export function aprovarOrcamento(tx: Tx, ordemId: string, usuarioId: string) {
  return tx
    .updateTable("os.os_custos")
    .set({
      orcamento_aprovado_em: sql<string>`now()`,
      orcamento_aprovado_por: usuarioId,
    })
    .where("ordem_id", "=", ordemId)
    .where("valor_terceirizado", "is not", null)
    .returning("valor_terceirizado")
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Arquivos da OS
// ---------------------------------------------------------------------------

export async function inserirArquivo(
  tx: Tx,
  a: {
    ordem_id: string;
    categoria: string;
    nome: string;
    path: string;
    mime: string;
    tamanho: number;
    enviado_por?: string | null;
    enviado_por_nome?: string | null;
  },
): Promise<string> {
  const r = await tx
    .insertInto("os.anexos")
    .values(a)
    .returning("id")
    .executeTakeFirstOrThrow();
  return r.id;
}

/** Apaga o arquivo (o RLS só deixa o que a própria pessoa enviou). */
export function removerArquivo(tx: Tx, id: string, ordemId: string) {
  return tx
    .deleteFrom("os.anexos")
    .where("id", "=", id)
    .where("ordem_id", "=", ordemId)
    .returning(["path", "nome"])
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// Link do terceirizado
// ---------------------------------------------------------------------------

export function linkAtivoDa(tx: Tx, ordemId: string) {
  return tx
    .selectFrom("os.terceirizado_links")
    .select([
      "id",
      "token",
      "recusado_em",
      "empresa_id",
      "solucao",
      "valor_informado",
      "orcamento_numero",
    ])
    .where("ordem_id", "=", ordemId)
    .where("cancelado_em", "is", null)
    .executeTakeFirst();
}

export async function cancelarLink(tx: Tx, id: string): Promise<void> {
  await tx
    .updateTable("os.terceirizado_links")
    .set({ cancelado_em: sql<string>`now()` })
    .where("id", "=", id)
    .execute();
}

/** Cancela o link ativo da OS; devolve quantos eram. */
export async function cancelarLinksDa(
  tx: Tx,
  ordemId: string,
): Promise<number> {
  const r = await tx
    .updateTable("os.terceirizado_links")
    .set({ cancelado_em: sql<string>`now()` })
    .where("ordem_id", "=", ordemId)
    .where("cancelado_em", "is", null)
    .returning("id")
    .execute();
  return r.length;
}

export async function inserirLink(
  tx: Tx,
  l: {
    ordem_id: string;
    token: string;
    empresa_id: string | null;
    criado_por: string;
  },
): Promise<void> {
  await tx.insertInto("os.terceirizado_links").values(l).execute();
}

const COLUNAS_DO_LINK = [
  "l.id",
  "l.ordem_id",
  "l.token",
  "l.empresa_id",
  "l.criado_por",
  "l.criado_em",
  "l.aceito_em",
  "l.recusado_em",
  "l.recusa_motivo",
  "l.chegada_em",
  "l.saida_em",
  "l.solucao",
  "l.valor_informado",
  "l.orcamento_numero",
  "l.terminado_em",
  "l.cancelado_em",
  "l.assinado_em",
  "l.assinatura_nome",
] as const;

/** O link, a OS e a empresa (do link e da OS) pelo token. */
export function acessoPeloToken(tx: Tx, token: string) {
  return tx
    .selectFrom("os.terceirizado_links as l")
    .innerJoin("os.ordens as o", "o.id", "l.ordem_id")
    .leftJoin("os.empresas as el", "el.id", "l.empresa_id")
    .leftJoin("os.empresas as eo", "eo.id", "o.empresa_id")
    .select([
      ...COLUNAS_DO_LINK,
      "o.numero",
      "o.titulo",
      "o.descricao",
      "o.status",
      "o.prioridade",
      "o.categoria_id",
      "o.bloco",
      "o.local",
      "o.loja_id",
      "o.empresa_id as empresa_da_os",
      "o.visita_data",
      "o.visita_periodo",
      "o.prazo_terceirizado",
      "o.responsavel_id",
      "o.aberto_por",
      "o.solucao as solucao_da_os",
      "el.nome as link_empresa_nome",
      "el.telefone as link_empresa_telefone",
      "el.ativo as link_empresa_ativo",
      "eo.nome as os_empresa_nome",
      "eo.telefone as os_empresa_telefone",
      "eo.ativo as os_empresa_ativo",
    ])
    .where("l.token", "=", token)
    .executeTakeFirst();
}

/** Altera o link se ele não foi cancelado; `seNaoAssinado`: nem assinado. */
export async function gravarLink(
  tx: Tx,
  id: string,
  muda: Updateable<OsTerceirizadoLinks>,
  se: { naoAssinado?: boolean } = {},
): Promise<number> {
  let q = tx
    .updateTable("os.terceirizado_links")
    .set(muda)
    .where("id", "=", id)
    .where("cancelado_em", "is", null);
  if (se.naoAssinado) q = q.where("assinado_em", "is", null);
  return (await q.returning("id").execute()).length;
}

export async function marcarAcessoDoLink(tx: Tx, id: string): Promise<void> {
  await tx
    .updateTable("os.terceirizado_links")
    .set({ ultimo_acesso_em: sql<string>`now()` })
    .where("id", "=", id)
    .execute();
}

export function nomeDaCategoria(tx: Tx, id: string) {
  return tx
    .selectFrom("os.categorias")
    .select("nome")
    .where("id", "=", id)
    .executeTakeFirst();
}

export function lojaCurta(tx: Tx, id: string) {
  return tx
    .selectFrom("os.lojas")
    .select(["luc", "nome"])
    .where("id", "=", id)
    .executeTakeFirst();
}

export async function nomesDosProfissionaisDa(
  tx: Tx,
  ordemId: string,
): Promise<string[]> {
  const linhas = await tx
    .selectFrom("os.ordem_profissionais as op")
    .innerJoin("os.profissionais as p", "p.id", "op.profissional_id")
    .select("p.nome")
    .where("op.ordem_id", "=", ordemId)
    .execute();
  return linhas.map((p) => p.nome);
}

/** Todos os anexos da OS (a página do terceirizado escolhe o que mostra). */
export function anexosDa(tx: Tx, ordemId: string) {
  return tx
    .selectFrom("os.anexos")
    .select([
      "id",
      "nome",
      "path",
      "mime",
      "categoria",
      "enviado_por_nome",
      "evento_id",
      "visivel_lojista",
    ])
    .where("ordem_id", "=", ordemId)
    .orderBy("em")
    .execute();
}

/** Contato da ARP no rodapé do link. */
export function contatoDaArp(tx: Tx) {
  return tx
    .selectFrom("core.empresa")
    .select(["nome", "telefone", "email", "endereco", "cidade", "uf"])
    .executeTakeFirst();
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

export function materiaisDasOrdens(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.materiais as m")
    .leftJoin("os.material_valores as v", "v.material_id", "m.id")
    .select([
      "m.ordem_id",
      "m.descricao",
      "m.quantidade",
      "m.unidade",
      "v.valor_unitario",
    ])
    .where("m.ordem_id", "in", ids)
    .orderBy("m.criado_em")
    .orderBy("m.id")
    .execute();
}

export function fotosDasOrdens(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.anexos")
    .select(["ordem_id", "nome", "path", "mime", "categoria", "em"])
    .where("ordem_id", "in", ids)
    .where("categoria", "in", ["foto", "antes", "depois"])
    .orderBy("em")
    .orderBy("id")
    .execute();
}

/** Assinatura do terceirizado pelo link (o que não foi cancelado). */
export function assinaturasDosLinks(tx: Tx, ids: string[]) {
  return tx
    .selectFrom("os.terceirizado_links")
    .select([
      "ordem_id",
      "assinatura_nome",
      "assinatura_documento",
      "assinatura_path",
      "assinado_em",
    ])
    .where("ordem_id", "in", ids)
    .where("cancelado_em", "is", null)
    .where("assinado_em", "is not", null)
    .execute();
}
