import type { LinhaMeta } from "@arp/shared/os/indicadores";
import type {
  CustoDoPainel,
  DestinoDoPainel,
  LinkDoPainel,
  SessaoDoPainel,
  TecnicoDoPainel,
} from "@arp/shared/os/indicadores-setor";
import { somarDias } from "@arp/shared/os/tempo";
import { type Selectable, sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { Tx } from "@/infra/banco";
import type { OsOrdens, OsVistorias } from "@/infra/banco/tipos";
import type { Chamado, ChamadoResumo, Setor } from "./base.service";
import * as base from "./base.service";

// Leitura dos painéis (spec 4.13). Tudo pela sessão (RLS, escopo
// `comoUsuario`): o painel geral vê todos os setores (os.painel_geral) e o de
// setor, os chamados do próprio setor (os.painel_setor). Os painéis somam
// chamados e OS: uma consulta em cada tabela (a OS tem tipo 'os'); as tabelas
// filhas vêm pelos ids (o id é único entre as duas). Os números saem das
// funções puras de @arp/shared/os/indicadores*.

const inicioDoDia = (data: string) => `${data}T00:00:00-03:00`;

// ---------------------------------------------------------------------------
// Chamados
// ---------------------------------------------------------------------------

const COLUNAS_PAINEL = [
  "id",
  "numero",
  "tipo",
  "titulo",
  "setor_id",
  "categoria_id",
  "status",
  "prioridade",
  "origem",
  "pessoal",
  "precisa_confirmacao",
  "aberto_por",
  "solicitante_nome",
  "responsavel_id",
  "prazo",
  "loja_id",
  "ativo_id",
  "etiquetas",
  "aguardando_tipo",
  "aguardando_min",
  "aguardando_desde",
  "primeira_resposta_em",
  "concluido_em",
  "fechado_em",
  "cancelado_em",
  "avaliacao",
  "criado_em",
  "atualizado_em",
  "reaberto_vezes",
  "vistoria_id",
  "ambiente_id",
  "avaliado_em",
] as const;
/** Na OS, também a execução. */
const COLUNAS_DA_OS = [
  "execucao",
  "local",
  "rateio",
  "bloco",
  "empresa_id",
  "prazo_terceirizado",
  "plano_id",
] as const;

type ColunaDaOS = (typeof COLUNAS_DA_OS)[number];

/** Chamado ou OS; no chamado, as colunas da execução vêm nulas. */
export type ChamadoDoPainel = ChamadoResumo &
  Pick<
    Chamado,
    "reaberto_vezes" | "vistoria_id" | "ambiente_id" | "avaliado_em"
  > & { [K in ColunaDaOS]: Selectable<OsOrdens>[K] | null };

const SEM_EXECUCAO: { [K in ColunaDaOS]: null } = {
  execucao: null,
  local: null,
  rateio: null,
  bloco: null,
  empresa_id: null,
  prazo_terceirizado: null,
  plano_id: null,
};

/** Chamados e OS juntos, do mais novo para o mais antigo. */
function juntar(
  chamados: Omit<ChamadoDoPainel, ColunaDaOS>[],
  ordens: ChamadoDoPainel[],
): ChamadoDoPainel[] {
  return [...chamados.map((c) => ({ ...c, ...SEM_EXECUCAO })), ...ordens].sort(
    (a, b) => b.criado_em.localeCompare(a.criado_em),
  );
}

/**
 * Chamados que o usuário vê e que importam para o período: os que estão em
 * aberto e os que nasceram, concluíram, fecharam ou foram cancelados desde
 * `desde`, criados até `ate`.
 */
export async function chamadosDoPainel(
  tx: Tx,
  desde: string,
  ate: string,
): Promise<ChamadoDoPainel[]> {
  const inicio = inicioDoDia(desde);
  const fim = inicioDoDia(somarDias(ate, 1));
  const chamados = await tx
    .selectFrom("os.chamados")
    .select(COLUNAS_PAINEL)
    .where("criado_em", "<", fim)
    .where((eb) =>
      eb.or([
        eb("status", "in", [
          "aberto",
          "em_andamento",
          "aguardando",
          "concluido",
        ]),
        eb("criado_em", ">=", inicio),
        eb("concluido_em", ">=", inicio),
        eb("fechado_em", ">=", inicio),
        eb("cancelado_em", ">=", inicio),
      ]),
    )
    .orderBy("criado_em", "desc")
    .orderBy("id")
    .execute();
  const ordens = await tx
    .selectFrom("os.ordens")
    .select([...COLUNAS_PAINEL, ...COLUNAS_DA_OS])
    .where("criado_em", "<", fim)
    .where((eb) =>
      eb.or([
        eb("status", "in", [
          "aberto",
          "em_andamento",
          "aguardando",
          "concluido",
        ]),
        eb("criado_em", ">=", inicio),
        eb("concluido_em", ">=", inicio),
        eb("fechado_em", ">=", inicio),
        eb("cancelado_em", ">=", inicio),
      ]),
    )
    .orderBy("criado_em", "desc")
    .orderBy("id")
    .execute();
  return juntar(chamados, ordens);
}

/** Chamados pelos ids (os que um painel cita e não vieram na consulta). */
export async function chamadosPorId(
  tx: Tx,
  ids: string[],
): Promise<ChamadoDoPainel[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];
  const chamados = await tx
    .selectFrom("os.chamados")
    .select(COLUNAS_PAINEL)
    .where("id", "in", unicos)
    .execute();
  const ordens = await tx
    .selectFrom("os.ordens")
    .select([...COLUNAS_PAINEL, ...COLUNAS_DA_OS])
    .where("id", "in", unicos)
    .execute();
  return juntar(chamados, ordens);
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

/** Metas, só o que os indicadores usam. */
export async function metas(tx: Tx): Promise<LinhaMeta[]> {
  return (await base.metas(tx)).map((m) => ({
    setor_id: m.setor_id,
    categoria_id: m.categoria_id,
    indicador: m.indicador,
    meta: m.meta,
    limite_atencao: m.limite_atencao,
  }));
}

/** Setores de cada pessoa, na ordem dos setores (o primeiro é a origem). */
export async function setoresDasPessoas(
  tx: Tx,
  ordem: Setor[],
): Promise<Map<string, string[]>> {
  const data = await tx
    .selectFrom("os.setor_membros")
    .select(["setor_id", "usuario_id"])
    .orderBy("setor_id")
    .orderBy("usuario_id")
    .execute();
  const posicao = new Map(ordem.map((s, i) => [s.id, i]));
  const mapa = new Map<string, string[]>();
  for (const m of data)
    mapa.set(m.usuario_id, [...(mapa.get(m.usuario_id) ?? []), m.setor_id]);
  for (const lista of mapa.values())
    lista.sort((a, b) => (posicao.get(a) ?? 99) - (posicao.get(b) ?? 99));
  return mapa;
}

/** Setores que recebem os itens de vistoria dos modelos de entrada e saída. */
export async function setoresDasVistorias(tx: Tx): Promise<Set<string>> {
  const data = await tx
    .selectFrom("os.modelo_itens")
    .select(["setor_id", "acao"])
    .where("acao", "in", ["vistoria_entrada", "vistoria_saida"])
    .execute();
  return new Set(data.map((i) => i.setor_id));
}

// ---------------------------------------------------------------------------
// Tabelas filhas
// ---------------------------------------------------------------------------

const COLUNAS_DESTINO = [
  "chamado_id",
  "ordem_id",
  "titulo",
  "setor_id",
  "status",
  "prazo",
  "concluido_em",
  "criado_em",
] as const;

/** O destino com o id do dono (chamado ou OS) em chamado_id. */
const doDono = ({
  ordem_id,
  chamado_id,
  ...d
}: {
  chamado_id: string | null;
  ordem_id: string | null;
} & Omit<DestinoDoPainel, "chamado_id">): DestinoDoPainel => ({
  ...d,
  chamado_id: chamado_id ?? ordem_id ?? "",
});

/** Itens (destinatários) dos chamados e das OS. */
export async function destinosDe(
  tx: Tx,
  ids: string[],
): Promise<DestinoDoPainel[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];
  const linhas = await tx
    .selectFrom("os.destinatarios")
    .select(COLUNAS_DESTINO)
    .where((eb) =>
      eb.or([eb("chamado_id", "in", unicos), eb("ordem_id", "in", unicos)]),
    )
    .orderBy("id")
    .execute();
  return linhas.map(doDono);
}

/** Itens de outros chamados (avisos) que um setor recebeu desde a data. */
export async function destinosDoSetor(
  tx: Tx,
  setorId: string,
  desde: string,
): Promise<DestinoDoPainel[]> {
  const linhas = await tx
    .selectFrom("os.destinatarios")
    .select(COLUNAS_DESTINO)
    .where("setor_id", "=", setorId)
    .where((eb) =>
      eb.or([
        eb("status", "<>", "concluido"),
        eb("concluido_em", ">=", inicioDoDia(desde)),
        eb("criado_em", ">=", inicioDoDia(desde)),
      ]),
    )
    .orderBy("id")
    .execute();
  return linhas.map(doDono);
}

/** Sessões de trabalho das OS, com os técnicos de cada uma. */
export async function sessoesDe(
  tx: Tx,
  ids: string[],
): Promise<SessaoDoPainel[]> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return [];
  const data = await tx
    .selectFrom("os.sessoes as s")
    .select((eb) => [
      "s.ordem_id",
      "s.data",
      "s.inicio",
      "s.fim",
      "s.almoco_inicio",
      "s.almoco_fim",
      jsonArrayFrom(
        eb
          .selectFrom("os.sessao_tecnicos as t")
          .select("t.tecnico_id")
          .whereRef("t.sessao_id", "=", "s.id"),
      ).as("sessao_tecnicos"),
    ])
    .where("s.ordem_id", "in", unicos)
    .orderBy("s.id")
    .execute();
  return data.map((s) => ({
    chamado_id: s.ordem_id,
    data: s.data,
    inicio: s.inicio.slice(0, 5),
    fim: s.fim?.slice(0, 5) ?? null,
    almoco_inicio: s.almoco_inicio?.slice(0, 5) ?? null,
    almoco_fim: s.almoco_fim?.slice(0, 5) ?? null,
    tecnicos: s.sessao_tecnicos.map((t) => t.tecnico_id),
  }));
}

export function tecnicos(tx: Tx): Promise<TecnicoDoPainel[]> {
  return tx
    .selectFrom("os.tecnicos")
    .select(["id", "nome", "desligado_em"])
    .orderBy("id")
    .execute();
}

/** Custos já calculados das OS (o RLS só devolve com os.custos). */
export async function custosDe(
  tx: Tx,
  ids: string[],
): Promise<Map<string, CustoDoPainel>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const linhas = await tx
    .selectFrom("os.os_custos")
    .select([
      "ordem_id",
      "custo_mao_obra",
      "custo_materiais",
      "valor_terceirizado",
      "custo_total",
      "valor_rateio",
      "completo",
    ])
    .where("ordem_id", "in", unicos)
    .execute();
  return new Map(
    linhas.map(({ ordem_id, ...l }) => [
      ordem_id,
      { ...l, chamado_id: ordem_id },
    ]),
  );
}

/** Links da OS enviados aos terceirizados no período. */
export async function linksDoPeriodo(
  tx: Tx,
  de: string,
  ate: string,
): Promise<LinkDoPainel[]> {
  const linhas = await tx
    .selectFrom("os.terceirizado_links")
    .select([
      "ordem_id",
      "empresa_id",
      "aceito_em",
      "recusado_em",
      "terminado_em",
    ])
    .where("criado_em", ">=", inicioDoDia(de))
    .where("criado_em", "<", inicioDoDia(somarDias(ate, 1)))
    .orderBy("id")
    .execute();
  return linhas.map(({ ordem_id, ...l }) => ({ ...l, chamado_id: ordem_id }));
}

export async function empresas(tx: Tx): Promise<Map<string, string>> {
  const data = await tx
    .selectFrom("os.empresas")
    .select(["id", "nome"])
    .orderBy("id")
    .execute();
  return new Map(data.map((e) => [e.id, e.nome]));
}

export async function lojas(tx: Tx): Promise<Map<string, string>> {
  const data = await tx
    .selectFrom("os.lojas")
    .select(["id", "nome", "luc"])
    .orderBy("id")
    .execute();
  return new Map(data.map((l) => [l.id, `${l.nome} (${l.luc})`]));
}

// ---------------------------------------------------------------------------
// Ativos
// ---------------------------------------------------------------------------

export interface AtivoDoPainel {
  id: string;
  codigo: string;
  nome: string;
  valorReposicao: number | null;
  compraData: string | null;
  vidaUtilAnos: number | null;
  baixado: boolean;
}

/** Nome dos ativos (todos que usam o módulo podem vincular um ativo). */
export async function nomesDosAtivos(tx: Tx): Promise<Map<string, string>> {
  const r = await sql<{
    id: string;
    codigo: string;
    nome: string;
  }>`select id, codigo, nome from os.ativos_para_vincular() order by id`.execute(
    tx,
  );
  return new Map(r.rows.map((a) => [a.id, `${a.codigo} · ${a.nome}`]));
}

/** Ficha dos ativos para o sinal de troca (só com os.ativos). */
export async function ativosParaSinal(tx: Tx): Promise<AtivoDoPainel[]> {
  const data = await tx
    .selectFrom("os.ativos as a")
    .leftJoin("os.ativo_categorias as c", "c.id", "a.categoria_id")
    .select([
      "a.id",
      "a.codigo",
      "a.nome",
      "a.valor_reposicao",
      "a.compra_data",
      "a.vida_util_anos",
      "a.situacao",
      "c.vida_util_padrao_anos",
    ])
    .orderBy("a.id")
    .execute();
  return data.map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nome: a.nome,
    valorReposicao: a.valor_reposicao,
    compraData: a.compra_data,
    vidaUtilAnos: a.vida_util_anos ?? a.vida_util_padrao_anos ?? null,
    baixado: a.situacao === "baixado",
  }));
}

export interface ResumoDoAtivo {
  ativo_id: string;
  custo_periodo: number | null;
  corretivas_periodo: number | null;
}

/** Custo e corretivas por ativo desde a data (os.resumo_ativos). */
export async function resumoDosAtivos(
  tx: Tx,
  desde: string,
): Promise<ResumoDoAtivo[]> {
  const r = await sql<ResumoDoAtivo>`
    select ativo_id, custo_periodo, corretivas_periodo
    from os.resumo_ativos(p_desde => ${desde}::date)
    order by ativo_id
  `.execute(tx);
  return r.rows;
}

// ---------------------------------------------------------------------------
// Vistorias, portal e agendas
// ---------------------------------------------------------------------------

export type VistoriaDoPainel = Pick<
  Selectable<OsVistorias>,
  | "id"
  | "codigo"
  | "tipo"
  | "status"
  | "rascunho"
  | "data"
  | "locatario"
  | "unidade"
  | "assinado_em"
>;

/** Vistorias com data no período e os ambientes com problema delas. */
export async function vistoriasDoPeriodo(tx: Tx, de: string, ate: string) {
  const vistorias: VistoriaDoPainel[] = await tx
    .selectFrom("os.vistorias")
    .select([
      "id",
      "codigo",
      "tipo",
      "status",
      "rascunho",
      "data",
      "locatario",
      "unidade",
      "assinado_em",
    ])
    .where("data", ">=", de)
    .where("data", "<=", ate)
    .orderBy("data", "desc")
    .orderBy("id")
    .execute();
  const ids = vistorias.map((v) => v.id);
  const ambientes = ids.length
    ? await tx
        .selectFrom("os.vistoria_ambientes")
        .select(["id", "vistoria_id", "titulo"])
        .where("problema", "=", true)
        .where("vistoria_id", "in", ids)
        .orderBy("id")
        .execute()
    : [];
  return { vistorias, ambientes };
}

/** Agendas ativas com os horários e bloqueios que tocam o período. */
export async function agendasDoPeriodo(tx: Tx, de: string, ate: string) {
  const inicio = inicioDoDia(de);
  const fim = inicioDoDia(somarDias(ate, 1));
  const agendas = await base.agendas(tx);
  const agendamentos = await tx
    .selectFrom("os.agendamentos")
    .select(["id", "agenda_id", "chamado_id", "loja_id", "inicio", "status"])
    .where("inicio", ">=", inicio)
    .where("inicio", "<", fim)
    .orderBy("inicio")
    .orderBy("id")
    .execute();
  const bloqueios = await tx
    .selectFrom("os.agenda_bloqueios")
    .select(["agenda_id", "inicio", "fim", "motivo"])
    .where("inicio", "<", fim)
    .where("fim", ">", inicio)
    .execute();
  return {
    agendas: agendas
      .filter((a) => a.ativo)
      .map((a) => ({
        id: a.id,
        nome: a.nome,
        dias_semana: a.dias_semana,
        limite_por_dia: a.limite_por_dia,
      })),
    agendamentos,
    bloqueios,
  };
}
