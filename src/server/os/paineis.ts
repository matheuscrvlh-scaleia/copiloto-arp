import "server-only";
import type { LinhaMeta } from "@/lib/os/indicadores";
import type {
  CustoDoPainel,
  DestinoDoPainel,
  LinkDoPainel,
  SessaoDoPainel,
  TecnicoDoPainel,
} from "@/lib/os/indicadores-setor";
import { hojeEmBrasilia, somarDias } from "@/lib/os/tempo";
import {
  ateNoMaximo,
  descreverPeriodo,
  lerPeriodo,
  type Periodo,
} from "@/lib/periodo";
import {
  type Categoria,
  type ChamadoResumo,
  categorias,
  os,
  pessoas,
  type Setor,
  type Tabela,
} from "./base";

// Leitura dos painéis (spec 4.13). Tudo pela sessão (RLS): o painel geral
// vê todos os setores (os.painel_geral) e o de setor, os chamados do
// próprio setor (os.painel_setor). Uma consulta de chamados por painel,
// paginada; as tabelas filhas vêm em lotes pelos ids. Os números saem das
// funções puras de src/lib/os/indicadores*.ts.

export type Busca = Record<string, string | string[] | undefined>;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------------------
// Filtros (na URL: período, ?categoria= e ?pessoa=)
// ---------------------------------------------------------------------------

export interface FiltrosPainel {
  periodo: Periodo;
  /** "out/2026", "01/10/2026 a 15/10/2026"… */
  rotulo: string;
  /** aaaa-mm-dd em Brasília (limite das datas na tela). */
  hoje: string;
  /** null: painel geral. */
  setor: Setor | null;
  categoria: Categoria | null;
  /** Responsável pelo chamado. */
  pessoa: string | null;
}

/**
 * Lê os filtros sem confiar na URL: data no futuro vira hoje, categoria de
 * outro setor ou pessoa desconhecida viram "todas".
 */
export async function lerFiltrosDoPainel(
  busca: Busca,
  setor: Setor | null,
  agora: Date,
): Promise<FiltrosPainel> {
  const hoje = hojeEmBrasilia(agora);
  const [a, m, d] = hoje.split("-").map(Number) as [number, number, number];
  // lerPeriodo usa a data local: entrega o "hoje" de Brasília.
  const periodo = ateNoMaximo(lerPeriodo(busca, new Date(a, m - 1, d)), hoje);
  const [cats, gente] = await Promise.all([categorias(), pessoas()]);
  const pedida = um(busca.categoria);
  const categoria =
    cats.find((c) => c.id === pedida && (!setor || c.setor_id === setor.id)) ??
    null;
  const pessoa = um(busca.pessoa);
  return {
    periodo,
    rotulo: descreverPeriodo(periodo),
    hoje,
    setor,
    categoria,
    pessoa: gente.some((p) => p.id === pessoa) ? (pessoa as string) : null,
  };
}

// ---------------------------------------------------------------------------
// Chamados
// ---------------------------------------------------------------------------

const COLUNAS_PAINEL =
  "id, numero, tipo, titulo, setor_id, categoria_id, status, prioridade, origem, pessoal, precisa_confirmacao, aberto_por, solicitante_nome, responsavel_id, prazo, loja_id, ativo_id, etiquetas, aguardando_tipo, aguardando_min, aguardando_desde, primeira_resposta_em, concluido_em, fechado_em, cancelado_em, execucao, local, rateio, avaliacao, lixeira_em, exemplo, criado_em, atualizado_em, bloco, empresa_id, prazo_terceirizado, reaberto_vezes, plano_id, vistoria_id, ambiente_id, avaliado_em" as const;

export type ChamadoDoPainel = ChamadoResumo &
  Pick<
    Tabela<"chamados">,
    | "bloco"
    | "empresa_id"
    | "prazo_terceirizado"
    | "reaberto_vezes"
    | "plano_id"
    | "vistoria_id"
    | "ambiente_id"
    | "avaliado_em"
  >;

const PAGINA = 1000;
const LOTE = 150;

/**
 * Lê todas as páginas de uma consulta: o PostgREST corta cada resposta em
 * mil linhas (um `.limit()` maior não passa disso). A consulta precisa de
 * uma ordem estável (termine com uma coluna única).
 */
async function todasAsPaginas<T>(
  pagina: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    falhar(error);
    linhas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) return linhas;
  }
}

/**
 * Chamados que o usuário vê e que importam para o período: os que estão em
 * aberto e os que nasceram, concluíram, fecharam ou foram cancelados desde
 * `desde`, criados até `ate` (fora da lixeira). Paginado: o PostgREST corta
 * cada resposta em mil linhas.
 */
export async function chamadosDoPainel(
  desde: string,
  ate: string,
): Promise<ChamadoDoPainel[]> {
  const cliente = await os();
  const inicio = `"${desde}T00:00:00-03:00"`;
  const fim = `${somarDias(ate, 1)}T00:00:00-03:00`;
  return todasAsPaginas((de, ultimo) =>
    cliente
      .from("chamados")
      .select(COLUNAS_PAINEL)
      .is("lixeira_em", null)
      .lt("criado_em", fim)
      .or(
        [
          "status.in.(aberto,em_andamento,aguardando,concluido)",
          `criado_em.gte.${inicio}`,
          `concluido_em.gte.${inicio}`,
          `fechado_em.gte.${inicio}`,
          `cancelado_em.gte.${inicio}`,
        ].join(","),
      )
      .order("criado_em", { ascending: false })
      .order("id")
      .range(de, ultimo),
  );
}

/** Chamados pelos ids (os que um painel cita e não vieram na consulta). */
export async function chamadosPorId(ids: string[]): Promise<ChamadoDoPainel[]> {
  return emLotes(ids, async (lote) => {
    const { data, error } = await (await os())
      .from("chamados")
      .select(COLUNAS_PAINEL)
      .in("id", lote)
      .is("lixeira_em", null);
    falhar(error);
    return data ?? [];
  });
}

/** Consulta por partes (o endereço com centenas de ids passa do limite). */
async function emLotes<T>(
  ids: string[],
  ler: (lote: string[]) => Promise<T[]>,
): Promise<T[]> {
  const unicos = [...new Set(ids)];
  const lotes: string[][] = [];
  for (let i = 0; i < unicos.length; i += LOTE)
    lotes.push(unicos.slice(i, i + LOTE));
  return (await Promise.all(lotes.map(ler))).flat();
}

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

export async function metas(): Promise<LinhaMeta[]> {
  const { data, error } = await (await os())
    .from("metas")
    .select("setor_id, categoria_id, indicador, meta, limite_atencao");
  falhar(error);
  return data ?? [];
}

/** Setores de cada pessoa, na ordem dos setores (o primeiro é a origem). */
export async function setoresDasPessoas(
  ordem: Setor[],
): Promise<Map<string, string[]>> {
  const cliente = await os();
  const data = await todasAsPaginas((de, ate) =>
    cliente
      .from("setor_membros")
      .select("setor_id, usuario_id")
      .order("setor_id")
      .order("usuario_id")
      .range(de, ate),
  );
  const posicao = new Map(ordem.map((s, i) => [s.id, i]));
  const mapa = new Map<string, string[]>();
  for (const m of data)
    mapa.set(m.usuario_id, [...(mapa.get(m.usuario_id) ?? []), m.setor_id]);
  for (const lista of mapa.values())
    lista.sort((a, b) => (posicao.get(a) ?? 99) - (posicao.get(b) ?? 99));
  return mapa;
}

/** Setores que recebem os itens de vistoria dos modelos de entrada e saída. */
export async function setoresDasVistorias(): Promise<Set<string>> {
  const { data, error } = await (await os())
    .from("modelo_itens")
    .select("setor_id, acao")
    .in("acao", ["vistoria_entrada", "vistoria_saida"]);
  falhar(error);
  return new Set((data ?? []).map((i) => i.setor_id));
}

// ---------------------------------------------------------------------------
// Tabelas filhas
// ---------------------------------------------------------------------------

const COLUNAS_DESTINO =
  "chamado_id, titulo, setor_id, status, prazo, concluido_em, criado_em" as const;

/** Itens (destinatários) dos chamados. */
export function destinosDe(ids: string[]): Promise<DestinoDoPainel[]> {
  return emLotes(ids, async (lote) => {
    const cliente = await os();
    // Um aviso de modelo tem um item por setor: o lote passa de mil linhas.
    return todasAsPaginas((de, ate) =>
      cliente
        .from("destinatarios")
        .select(COLUNAS_DESTINO)
        .in("chamado_id", lote)
        .order("id")
        .range(de, ate),
    );
  });
}

/** Itens de outros chamados (avisos) que um setor recebeu desde a data. */
export async function destinosDoSetor(
  setorId: string,
  desde: string,
): Promise<DestinoDoPainel[]> {
  const cliente = await os();
  // Fora os itens de chamados na lixeira: a lista que o número abre não os
  // mostraria (o número contaria a mais).
  const linhas = await todasAsPaginas((de, ate) =>
    cliente
      .from("destinatarios")
      .select(`${COLUNAS_DESTINO}, chamados!inner(lixeira_em)`)
      .eq("setor_id", setorId)
      .is("chamados.lixeira_em", null)
      .or(
        `status.neq.concluido,concluido_em.gte."${desde}T00:00:00-03:00",criado_em.gte."${desde}T00:00:00-03:00"`,
      )
      .order("id")
      .range(de, ate),
  );
  return linhas.map(({ chamados: _, ...d }) => d);
}

/** Sessões de trabalho dos chamados, com os técnicos de cada uma. */
export function sessoesDe(ids: string[]): Promise<SessaoDoPainel[]> {
  return emLotes(ids, async (lote) => {
    const cliente = await os();
    const data = await todasAsPaginas((de, ate) =>
      cliente
        .from("sessoes")
        .select(
          "chamado_id, data, inicio, fim, almoco_inicio, almoco_fim, sessao_tecnicos(tecnico_id)",
        )
        .in("chamado_id", lote)
        .order("id")
        .range(de, ate),
    );
    return data.map((s) => ({
      chamado_id: s.chamado_id,
      data: s.data,
      inicio: s.inicio.slice(0, 5),
      fim: s.fim?.slice(0, 5) ?? null,
      almoco_inicio: s.almoco_inicio?.slice(0, 5) ?? null,
      almoco_fim: s.almoco_fim?.slice(0, 5) ?? null,
      tecnicos: s.sessao_tecnicos.map((t) => t.tecnico_id),
    }));
  });
}

export async function tecnicos(): Promise<TecnicoDoPainel[]> {
  const cliente = await os();
  return todasAsPaginas((de, ate) =>
    cliente
      .from("tecnicos")
      .select("id, nome, desligado_em")
      .order("id")
      .range(de, ate),
  );
}

/** Custos já calculados das OS (o RLS só devolve com os.custos). */
export async function custosDe(
  ids: string[],
): Promise<Map<string, CustoDoPainel>> {
  const linhas = await emLotes(ids, async (lote) => {
    const { data, error } = await (await os())
      .from("os_custos")
      .select(
        "chamado_id, custo_mao_obra, custo_materiais, valor_terceirizado, custo_total, valor_rateio, completo",
      )
      .in("chamado_id", lote);
    falhar(error);
    return data ?? [];
  });
  return new Map(linhas.map((l) => [l.chamado_id, l]));
}

/** Links da OS enviados aos terceirizados no período. */
export async function linksDoPeriodo(
  de: string,
  ate: string,
): Promise<LinkDoPainel[]> {
  const cliente = await os();
  return todasAsPaginas((inicio, fim) =>
    cliente
      .from("terceirizado_links")
      .select("chamado_id, empresa_id, aceito_em, recusado_em, terminado_em")
      .gte("criado_em", `${de}T00:00:00-03:00`)
      .lt("criado_em", `${somarDias(ate, 1)}T00:00:00-03:00`)
      .order("id")
      .range(inicio, fim),
  );
}

export async function empresas(): Promise<Map<string, string>> {
  const cliente = await os();
  const data = await todasAsPaginas((de, ate) =>
    cliente.from("empresas").select("id, nome").order("id").range(de, ate),
  );
  return new Map(data.map((e) => [e.id, e.nome]));
}

export async function lojas(): Promise<Map<string, string>> {
  const cliente = await os();
  const data = await todasAsPaginas((de, ate) =>
    cliente.from("lojas").select("id, nome, luc").order("id").range(de, ate),
  );
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
export async function nomesDosAtivos(): Promise<Map<string, string>> {
  const cliente = await os();
  const data = await todasAsPaginas((de, ate) =>
    cliente.rpc("ativos_para_vincular").order("id").range(de, ate),
  );
  return new Map(data.map((a) => [a.id, `${a.codigo} · ${a.nome}`]));
}

/** Ficha dos ativos para o sinal de troca (só com os.ativos). */
export async function ativosParaSinal(): Promise<AtivoDoPainel[]> {
  const cliente = await os();
  const data = await todasAsPaginas((de, ate) =>
    cliente
      .from("ativos")
      .select(
        "id, codigo, nome, valor_reposicao, compra_data, vida_util_anos, situacao, categoria:ativo_categorias(vida_util_padrao_anos)",
      )
      .order("id")
      .range(de, ate),
  );
  return data.map((a) => ({
    id: a.id,
    codigo: a.codigo,
    nome: a.nome,
    valorReposicao: a.valor_reposicao,
    compraData: a.compra_data,
    vidaUtilAnos:
      a.vida_util_anos ?? a.categoria?.vida_util_padrao_anos ?? null,
    baixado: a.situacao === "baixado",
  }));
}

/** Custo e corretivas por ativo desde a data (os.resumo_ativos). */
export async function resumoDosAtivos(desde: string) {
  const cliente = await os();
  return todasAsPaginas((de, ate) =>
    cliente
      .rpc("resumo_ativos", { p_desde: desde })
      .order("ativo_id")
      .range(de, ate),
  );
}

// ---------------------------------------------------------------------------
// Vistorias, portal e agendas
// ---------------------------------------------------------------------------

export type VistoriaDoPainel = Pick<
  Tabela<"vistorias">,
  | "id"
  | "codigo"
  | "tipo"
  | "status"
  | "rascunho"
  | "data"
  | "locatario"
  | "unidade"
  | "assinado_em"
  | "exemplo"
>;

/** Vistorias com data no período e os ambientes com problema delas. */
export async function vistoriasDoPeriodo(de: string, ate: string) {
  const cliente = await os();
  const vistorias: VistoriaDoPainel[] = await todasAsPaginas((inicio, fim) =>
    cliente
      .from("vistorias")
      .select(
        "id, codigo, tipo, status, rascunho, data, locatario, unidade, assinado_em, exemplo",
      )
      .gte("data", de)
      .lte("data", ate)
      .order("data", { ascending: false })
      .order("id")
      .range(inicio, fim),
  );
  const ambientes = await emLotes(
    vistorias.map((v) => v.id),
    (lote) =>
      todasAsPaginas((inicio, fim) =>
        cliente
          .from("vistoria_ambientes")
          .select("id, vistoria_id, titulo")
          .eq("problema", true)
          .in("vistoria_id", lote)
          .order("id")
          .range(inicio, fim),
      ),
  );
  return { vistorias, ambientes };
}

/** Agendas ativas com os horários e bloqueios que tocam o período. */
export async function agendasDoPeriodo(de: string, ate: string) {
  const inicio = `${de}T00:00:00-03:00`;
  const fim = `${somarDias(ate, 1)}T00:00:00-03:00`;
  const cliente = await os();
  const [agendas, agendamentos, bloqueios] = await Promise.all([
    cliente
      .from("agendas")
      .select("id, nome, dias_semana, limite_por_dia")
      .eq("ativo", true)
      .order("nome"),
    todasAsPaginas((a, b) =>
      cliente
        .from("agendamentos")
        .select("id, agenda_id, chamado_id, loja_id, inicio, status, exemplo")
        .gte("inicio", inicio)
        .lt("inicio", fim)
        .order("inicio")
        .order("id")
        .range(a, b),
    ),
    cliente
      .from("agenda_bloqueios")
      .select("agenda_id, inicio, fim, motivo")
      .lt("inicio", fim)
      .gt("fim", inicio),
  ]);
  falhar(agendas.error);
  falhar(bloqueios.error);
  return {
    agendas: agendas.data ?? [],
    agendamentos,
    bloqueios: bloqueios.data ?? [],
  };
}
