import "server-only";
import { cache } from "react";
import {
  custoPorMes,
  descreverLocal,
  faixasDosParametros,
  faltasNoCadastro,
  idadeEmAnos,
  type MesDeCusto,
  ordenarPorPeso,
  tempoMedioDeReparoMin,
  umAnoAntes,
} from "@/lib/os/ativos";
import {
  type FiltroAtivos,
  OR_CADASTRO_INCOMPLETO,
  precisaDoSinal,
} from "@/lib/os/ativos-lista";
import {
  buscaNoOr,
  type Filtravel,
  totalForaDoIntervalo,
} from "@/lib/os/filtro-postgrest";
import { intervalo } from "@/lib/os/paginacao";
import {
  diasParado,
  type FaixasSinal,
  type ResultadoSinal,
  sinalDoAtivo,
  tempoMedioEntreFalhasDias,
} from "@/lib/os/sinal";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import {
  categorias,
  contexto,
  nomes,
  os,
  parametros,
  pessoas as pessoasDoModulo,
  setores,
  type Tabela,
  urlsAssinadas,
} from "./base";

// Leitura dos ativos para a lista, a decisão de troca e a ficha. Tudo pela
// sessão (RLS). O custo por ativo vem de os.resumo_ativos (soma de todas as
// OS do ativo, mesmo as de setores que a pessoa não vê); a linha do tempo e
// o gráfico mês a mês mostram as OS que ela vê.

export type Ativo = Tabela<"ativos">;
export type CategoriaAtivo = Tabela<"ativo_categorias">;
export type Plano = Tabela<"planos_preventivos">;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

const PAGINA = 1000;

/**
 * Todas as linhas, de mil em mil: o PostgREST corta cada resposta em mil
 * (max_rows) sem avisar. A consulta precisa de uma ordem estável.
 */
async function todas<T>(
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

/** Quem vê a tela de Ativos. */
export async function podeVerAtivos(): Promise<boolean> {
  const ctx = await contexto();
  return ctx.pode("os.ativos") || ctx.pode("os.ativos_gerenciar");
}

export interface Resumo {
  custo12m: number;
  custoTotal: number;
  corretivas12m: number;
  preventivas12m: number;
  osAbertas: number;
  ultimaOs: string | null;
}

const RESUMO_VAZIO: Resumo = {
  custo12m: 0,
  custoTotal: 0,
  corretivas12m: 0,
  preventivas12m: 0,
  osAbertas: 0,
  ultimaOs: null,
};

/** Manutenção por ativo nos últimos 12 meses e desde sempre. */
async function resumos(hoje: string, ativoId?: string) {
  const db = await os();
  const consulta = () => {
    const q = db.rpc("resumo_ativos", { p_desde: umAnoAntes(hoje) });
    return ativoId ? q.eq("ativo_id", ativoId) : q;
  };
  const data = await todas((de, ate) =>
    consulta().order("ativo_id").range(de, ate),
  );
  return new Map<string, Resumo>(
    data.map((r) => [
      r.ativo_id,
      {
        custo12m: Number(r.custo_periodo),
        custoTotal: Number(r.custo_total),
        corretivas12m: Number(r.corretivas_periodo),
        preventivas12m: Number(r.preventivas_periodo),
        osAbertas: Number(r.os_abertas),
        ultimaOs: r.ultima_os,
      },
    ]),
  );
}

export const categoriasDeAtivo = async (): Promise<CategoriaAtivo[]> => {
  const { data, error } = await (await os())
    .from("ativo_categorias")
    .select("*")
    .order("nome");
  falhar(error);
  return data ?? [];
};

/** Quantos ativos cada categoria tem (página de categorias). */
export async function ativosPorCategoria(): Promise<Map<string, number>> {
  const db = await os();
  const lista = await todas((de, ate) =>
    db
      .from("ativos")
      .select("categoria_id")
      .not("categoria_id", "is", null)
      .order("id")
      .range(de, ate),
  );
  const contagem = new Map<string, number>();
  for (const a of lista)
    if (a.categoria_id)
      contagem.set(a.categoria_id, (contagem.get(a.categoria_id) ?? 0) + 1);
  return contagem;
}

export interface Loja {
  id: string;
  luc: string;
  nome: string;
  bloco: string | null;
  vigente: boolean;
}

/** Lojas (contratos) para o local do ativo. */
export async function lojas(): Promise<Loja[]> {
  const db = await os();
  // Um contrato por linha: com o histórico, passa de mil.
  const data = await todas((de, ate) =>
    db
      .from("lojas")
      .select("id, luc, nome, bloco, situacao")
      .order("luc")
      .order("id")
      .range(de, ate),
  );
  return data.map(({ situacao, ...l }) => ({
    ...l,
    vigente: situacao === "vigente",
  }));
}

export interface Empresa {
  id: string;
  nome: string;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
}

export async function empresas(): Promise<Empresa[]> {
  const db = await os();
  return todas((de, ate) =>
    db
      .from("empresas")
      .select("id, nome, contato, telefone, email, ativo")
      .order("nome")
      .order("id")
      .range(de, ate),
  );
}

/** Faixas do sinal (Parâmetros) e a antecedência padrão da preventiva. */
export async function regrasDosAtivos(): Promise<{
  faixas: FaixasSinal;
  antecedenciaPadrao: number;
}> {
  const p = await parametros();
  return {
    faixas: faixasDosParametros(p),
    antecedenciaPadrao: p.preventiva_antecedencia_dias,
  };
}

// ---------------------------------------------------------------------------
// Lista e decisão de troca
// ---------------------------------------------------------------------------

export interface AtivoNaLista {
  ativo: Ativo;
  categoria: string | null;
  loja: string | null;
  local: string;
  resumo: Resumo;
  sinal: ResultadoSinal;
  faltas: string[];
  idadeAnos: number | null;
  proximaPreventiva: string | null;
  preventivasAtrasadas: number;
}

interface SinalDoAtivo {
  situacao: Ativo["situacao"];
  bloco: string | null;
  resumo: Resumo;
  sinal: ResultadoSinal;
}

/**
 * O sinal de troca de todos os ativos. Ele sai de os.resumo_ativos (RPC)
 * com regras em TypeScript (faixas dos Parâmetros), então o banco não sabe
 * filtrar nem ordenar por ele: o cartão "Sinal Trocar", o filtro por sinal
 * e a ordem por peso leem as colunas do cálculo de todos (uma linha por
 * ativo, poucas colunas). O resto da lista pagina no banco.
 */
const sinaisDosAtivos = cache(
  async (
    hoje: string,
  ): Promise<{ porAtivo: Map<string, SinalDoAtivo>; faixas: FaixasSinal }> => {
    const db = await os();
    const [lista, porAtivo, regras] = await Promise.all([
      todas((de, ate) =>
        db
          .from("ativos")
          .select(
            "id, situacao, bloco, valor_reposicao, compra_data, vida_util_anos",
          )
          .order("id")
          .range(de, ate),
      ),
      resumos(hoje),
      regrasDosAtivos(),
    ]);
    const mapa = new Map<string, SinalDoAtivo>();
    for (const a of lista) {
      const resumo = porAtivo.get(a.id) ?? RESUMO_VAZIO;
      mapa.set(a.id, {
        situacao: a.situacao,
        bloco: a.bloco,
        resumo,
        sinal: sinalDoAtivo(
          {
            custo12m: resumo.custo12m,
            valorReposicao: a.valor_reposicao,
            corretivas12m: resumo.corretivas12m,
            compraData: a.compra_data,
            vidaUtilAnos: a.vida_util_anos,
          },
          regras.faixas,
          hoje,
        ),
      });
    }
    return { porAtivo: mapa, faixas: regras.faixas };
  },
);

/**
 * Preventivas atrasadas por ativo: OS de plano ainda abertas com o prazo
 * vencido (filtradas no banco; costumam ser poucas).
 */
const atrasadasPorAtivo = cache(
  async (agoraIso: string): Promise<Map<string, number>> => {
    const db = await os();
    const lista = await todas((de, ate) =>
      db
        .from("chamados")
        .select("ativo_id")
        .not("plano_id", "is", null)
        .not("ativo_id", "is", null)
        .in("status", ["aberto", "em_andamento", "aguardando"])
        .is("lixeira_em", null)
        .lt("prazo", agoraIso)
        .order("id")
        .range(de, ate),
    );
    const mapa = new Map<string, number>();
    for (const c of lista)
      if (c.ativo_id) mapa.set(c.ativo_id, (mapa.get(c.ativo_id) ?? 0) + 1);
    return mapa;
  },
);

/** Filtros da lista que o banco resolve (todos menos o sinal). */
function filtrarAtivos<Q extends Filtravel<Q>>(
  q: Q,
  f: FiltroAtivos,
  comAtraso: string[],
): Q {
  let c = q;
  if (f.situacao === "") c = c.neq("situacao", "baixado");
  else if (f.situacao !== "todas") c = c.eq("situacao", f.situacao);
  if (f.cat === "sem") c = c.is("categoria_id", null);
  else if (f.cat) c = c.eq("categoria_id", f.cat);
  if (f.local === "sem") c = c.or("bloco.is.null,bloco.eq.");
  else if (f.local) c = c.eq("bloco", f.local);
  if (f.incompleto) c = c.or(OR_CADASTRO_INCOMPLETO);
  if (f.preventiva) c = c.in("id", comAtraso);
  const busca = buscaNoOr(f.q, [
    "codigo",
    "nome",
    "numero_serie",
    "fabricante",
    "modelo",
  ]);
  if (busca) c = c.or(busca);
  return c;
}

/** Junta categoria, loja, sinal, preventivas e próxima data às linhas. */
async function completar(
  lista: Ativo[],
  hoje: string,
  agora: Date,
): Promise<AtivoNaLista[]> {
  if (lista.length === 0) return [];
  const db = await os();
  const ids = lista.map((a) => a.id);
  const lojaIds = [
    ...new Set(lista.flatMap((a) => (a.loja_id ? [a.loja_id] : []))),
  ];
  const [cats, sinais, atrasadas, planos, lojasDaPagina] = await Promise.all([
    categoriasDeAtivo(),
    sinaisDosAtivos(hoje),
    atrasadasPorAtivo(agora.toISOString()),
    todas((de, ate) =>
      db
        .from("planos_preventivos")
        .select("ativo_id, proxima_data")
        .eq("ativo", true)
        .in("ativo_id", ids)
        .order("id")
        .range(de, ate),
    ),
    lojaIds.length
      ? db.from("lojas").select("id, luc, nome").in("id", lojaIds)
      : null,
  ]);
  falhar(lojasDaPagina?.error ?? null);
  const nomeCategoria = new Map(cats.map((c) => [c.id, c.nome]));
  const loja = new Map(
    (lojasDaPagina?.data ?? []).map((l) => [l.id, `${l.luc} ${l.nome}`]),
  );
  const proxima = new Map<string, string>();
  for (const p of planos) {
    const atual = proxima.get(p.ativo_id);
    if (!atual || p.proxima_data < atual)
      proxima.set(p.ativo_id, p.proxima_data);
  }
  return lista.map((a): AtivoNaLista => {
    const s = sinais.porAtivo.get(a.id);
    const resumo = s?.resumo ?? RESUMO_VAZIO;
    const nomeLoja = a.loja_id ? (loja.get(a.loja_id) ?? null) : null;
    return {
      ativo: a,
      categoria: a.categoria_id
        ? (nomeCategoria.get(a.categoria_id) ?? null)
        : null,
      loja: nomeLoja,
      local: descreverLocal({ ...a, loja: nomeLoja }),
      resumo,
      sinal:
        s?.sinal ??
        sinalDoAtivo(
          {
            custo12m: resumo.custo12m,
            valorReposicao: a.valor_reposicao,
            corretivas12m: resumo.corretivas12m,
            compraData: a.compra_data,
            vidaUtilAnos: a.vida_util_anos,
          },
          sinais.faixas,
          hoje,
        ),
      faltas: faltasNoCadastro(a),
      idadeAnos: idadeEmAnos(a.compra_data, hoje),
      proximaPreventiva: proxima.get(a.id) ?? null,
      preventivasAtrasadas: atrasadas.get(a.id) ?? 0,
    };
  });
}

/**
 * Os ids do filtro na ordem da tela, quando o sinal entra (filtro por
 * sinal ou decisão de troca, do maior peso para o menor): o banco devolve
 * só os ids filtrados e o sinal filtra e ordena aqui.
 */
async function idsPeloSinal(
  f: FiltroAtivos,
  hoje: string,
  agora: Date,
): Promise<string[]> {
  const db = await os();
  const [sinais, atrasadas] = await Promise.all([
    sinaisDosAtivos(hoje),
    atrasadasPorAtivo(agora.toISOString()),
  ]);
  const lista = await todas((de, ate) =>
    filtrarAtivos(db.from("ativos").select("id"), f, [...atrasadas.keys()])
      .order("codigo")
      .order("id")
      .range(de, ate),
  );
  const comSinal = lista
    .map((a) => ({
      id: a.id,
      pesoPct: sinais.porAtivo.get(a.id)?.sinal.pesoPct ?? null,
      sinal: sinais.porAtivo.get(a.id)?.sinal.sinal,
    }))
    .filter((a) => !f.sinal || a.sinal === f.sinal);
  const ordem = f.visao === "decisao" ? ordenarPorPeso(comSinal) : comSinal;
  return ordem.map((a) => a.id);
}

/** Linhas completas de uma lista de ids, na ordem pedida. */
async function ativosPorId(ids: string[]): Promise<Ativo[]> {
  const db = await os();
  const linhas: Ativo[] = [];
  // Em lotes: os ids vão na URL.
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db
      .from("ativos")
      .select("*")
      .in("id", ids.slice(i, i + 100));
    falhar(error);
    linhas.push(...(data ?? []));
  }
  const porId = new Map(linhas.map((a) => [a.id, a]));
  return ids.flatMap((id) => porId.get(id) ?? []);
}

/** Uma página da lista (ou da decisão de troca) e o total do filtro. */
export async function paginaDeAtivos(
  f: FiltroAtivos,
  pagina: number,
  agora: Date,
): Promise<{ ativos: AtivoNaLista[]; total: number }> {
  const hoje = hojeEmBrasilia(agora);
  const { de, ate } = intervalo(pagina);
  if (precisaDoSinal(f)) {
    const ids = await idsPeloSinal(f, hoje, agora);
    const linhas = await ativosPorId(ids.slice(de, ate + 1));
    return { ativos: await completar(linhas, hoje, agora), total: ids.length };
  }
  const db = await os();
  const atrasadas = await atrasadasPorAtivo(agora.toISOString());
  const { data, error, count } = await filtrarAtivos(
    db.from("ativos").select("*", { count: "exact" }),
    f,
    [...atrasadas.keys()],
  )
    .order("codigo")
    .order("id")
    .range(de, ate);
  if (error) {
    const total = totalForaDoIntervalo(error);
    if (total !== null) return { ativos: [], total };
    falhar(error);
  }
  return {
    ativos: await completar(data ?? [], hoje, agora),
    total: count ?? 0,
  };
}

/** Todos os ativos do filtro, na ordem da tela (exportar, no clique). */
export async function ativosDoFiltro(
  f: FiltroAtivos,
  agora: Date,
): Promise<AtivoNaLista[]> {
  const hoje = hojeEmBrasilia(agora);
  if (precisaDoSinal(f))
    return completar(
      await ativosPorId(await idsPeloSinal(f, hoje, agora)),
      hoje,
      agora,
    );
  const db = await os();
  const atrasadas = await atrasadasPorAtivo(agora.toISOString());
  const lista = await todas((de, ate) =>
    filtrarAtivos(db.from("ativos").select("*"), f, [...atrasadas.keys()])
      .order("codigo")
      .order("id")
      .range(de, ate),
  );
  return completar(lista, hoje, agora);
}

export interface IndicadoresDosAtivos {
  /** Em uso, em manutenção ou parados (sem os baixados). */
  emUso: number;
  incompletos: number;
  manutencao: number;
  parados: number;
  /** Preventivas atrasadas e em quantos ativos. */
  atrasadas: number;
  comAtraso: number;
  trocar: number;
  /** Blocos usados (opções do filtro de local). */
  blocos: string[];
  faixas: FaixasSinal;
  categorias: CategoriaAtivo[];
}

/** Os cartões do topo: contagens no banco; o sinal sai do cálculo acima. */
export async function indicadoresDosAtivos(
  agora: Date,
): Promise<IndicadoresDosAtivos> {
  const hoje = hojeEmBrasilia(agora);
  const db = await os();
  const contar = async (
    filtro: (
      q: ReturnType<typeof consultaDeContagem>,
    ) => ReturnType<typeof consultaDeContagem>,
  ) => {
    const { count, error } = await filtro(consultaDeContagem(db));
    falhar(error);
    return count ?? 0;
  };
  const [emUso, incompletos, manutencao, parados, sinais, atrasadas, cats] =
    await Promise.all([
      contar((q) => q.neq("situacao", "baixado")),
      contar((q) => q.neq("situacao", "baixado").or(OR_CADASTRO_INCOMPLETO)),
      contar((q) => q.eq("situacao", "em_manutencao")),
      contar((q) => q.eq("situacao", "parado")),
      sinaisDosAtivos(hoje),
      atrasadasPorAtivo(agora.toISOString()),
      categoriasDeAtivo(),
    ]);
  const emUsoComAtraso = [...atrasadas].filter(
    ([id]) => sinais.porAtivo.get(id)?.situacao !== "baixado",
  );
  const valores = [...sinais.porAtivo.values()];
  return {
    emUso,
    incompletos,
    manutencao,
    parados,
    atrasadas: emUsoComAtraso.reduce((s, [, n]) => s + n, 0),
    comAtraso: emUsoComAtraso.length,
    trocar: valores.filter(
      (s) => s.situacao !== "baixado" && s.sinal.sinal === "trocar",
    ).length,
    blocos: [
      ...new Set(
        valores.map((s) => s.bloco?.trim()).filter((b): b is string => !!b),
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    faixas: sinais.faixas,
    categorias: cats,
  };
}

function consultaDeContagem(db: Awaited<ReturnType<typeof os>>) {
  return db.from("ativos").select("id", { count: "exact", head: true });
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

export interface OSDoAtivo {
  id: string;
  numero: number;
  tipo: Tabela<"chamados">["tipo"];
  titulo: string;
  status: Tabela<"chamados">["status"];
  prazo: string | null;
  criado_em: string;
  concluido_em: string | null;
  aguardando_min: number;
  causa_falha: string | null;
  preventiva: boolean;
  /** Só com os.custos (null: sem permissão ou ainda sem cálculo). */
  custo: number | null;
}

export interface Anexo {
  id: string;
  nome: string;
  categoria: Tabela<"anexos">["categoria"];
  mime: string | null;
  tamanho: number | null;
  em: string;
  enviadoPor: string | null;
  url: string | null;
}

export interface Ficha {
  ativo: Ativo;
  categoria: CategoriaAtivo | null;
  loja: Pick<Loja, "id" | "luc" | "nome" | "bloco"> | null;
  local: string;
  fornecedor: Empresa | null;
  setor: string | null;
  responsavel: string | null;
  resumo: Resumo;
  sinal: ResultadoSinal;
  faixas: FaixasSinal;
  antecedenciaPadrao: number;
  faltas: string[];
  idadeAnos: number | null;
  diasParado12m: number;
  mtbfDias: number | null;
  mttrMin: number | null;
  ordens: OSDoAtivo[];
  /** Custo mês a mês desde a compra (só com os.custos). */
  custoMensal: MesDeCusto[] | null;
  planos: Plano[];
  anexos: Anexo[];
  foto: string | null;
  verCustos: boolean;
}

export async function fichaDoAtivo(
  id: string,
  agora: Date,
): Promise<Ficha | null> {
  const hoje = hojeEmBrasilia(agora);
  const db = await os();
  const { data: ativo, error } = await db
    .from("ativos")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!ativo) return null;

  const ctx = await contexto();
  const verCustos = ctx.pode("os.custos");
  const [
    cats,
    porAtivo,
    chamados,
    situacoes,
    planos,
    anexos,
    regras,
    catsChamado,
    listaSetores,
    pessoas,
    loja,
    fornecedor,
  ] = await Promise.all([
    categoriasDeAtivo(),
    resumos(hoje, id),
    db
      .from("chamados")
      .select(
        "id, numero, tipo, titulo, status, prazo, criado_em, concluido_em, aguardando_min, causa_falha, plano_id, categoria_id",
      )
      .eq("ativo_id", id)
      .is("lixeira_em", null)
      .order("criado_em", { ascending: false })
      .limit(1000),
    db
      .from("ativo_situacoes")
      .select("situacao, desde, ate")
      .eq("ativo_id", id)
      .order("desde"),
    db
      .from("planos_preventivos")
      .select("*")
      .eq("ativo_id", id)
      .order("ativo", { ascending: false })
      .order("proxima_data"),
    db
      .from("anexos")
      .select("id, nome, categoria, mime, tamanho, em, path, enviado_por")
      .eq("ativo_id", id)
      .order("em", { ascending: false }),
    regrasDosAtivos(),
    categorias(),
    setores(),
    nomes(),
    ativo.loja_id
      ? db
          .from("lojas")
          .select("id, luc, nome, bloco")
          .eq("id", ativo.loja_id)
          .maybeSingle()
      : null,
    ativo.fornecedor_id
      ? db
          .from("empresas")
          .select("id, nome, contato, telefone, email, ativo")
          .eq("id", ativo.fornecedor_id)
          .maybeSingle()
      : null,
  ]);
  falhar(chamados.error);
  falhar(situacoes.error);
  falhar(planos.error);
  falhar(anexos.error);

  const preventivaDaCategoria = new Set(
    catsChamado.filter((c) => c.preventiva).map((c) => c.id),
  );
  const visiveis = chamados.data ?? [];
  const custos = verCustos
    ? await custosDasOS(visiveis.map((c) => c.id))
    : null;
  const ordens: OSDoAtivo[] = visiveis.map((c) => ({
    id: c.id,
    numero: c.numero,
    tipo: c.tipo,
    titulo: c.titulo,
    status: c.status,
    prazo: c.prazo,
    criado_em: c.criado_em,
    concluido_em: c.concluido_em,
    aguardando_min: c.aguardando_min,
    causa_falha: c.causa_falha,
    preventiva:
      !!c.plano_id ||
      (!!c.categoria_id && preventivaDaCategoria.has(c.categoria_id)),
    custo: custos?.get(c.id) ?? null,
  }));
  // Corretiva como no resumo do banco: OS não cancelada e não preventiva.
  const corretivas = ordens.filter(
    (o) => o.tipo === "os" && o.status !== "cancelado" && !o.preventiva,
  );

  const urls = await urlsAssinadas((anexos.data ?? []).map((a) => a.path));
  const listaAnexos: Anexo[] = (anexos.data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    categoria: a.categoria,
    mime: a.mime,
    tamanho: a.tamanho,
    em: a.em,
    enviadoPor: a.enviado_por ? (pessoas.get(a.enviado_por) ?? null) : null,
    url: urls.get(a.path) ?? null,
  }));
  const foto =
    listaAnexos.find(
      (a) => a.categoria === "foto" && a.mime?.startsWith("image/"),
    )?.url ?? null;

  const resumo = porAtivo.get(id) ?? RESUMO_VAZIO;
  const lojaDoAtivo = loja?.data ?? null;
  const nomeLoja = lojaDoAtivo
    ? `${lojaDoAtivo.luc} ${lojaDoAtivo.nome}`
    : null;
  const custoMensal = custos
    ? custoPorMes(
        ordens
          .filter((o) => o.tipo === "os" && o.status !== "cancelado")
          .flatMap((o) =>
            o.custo ? [{ em: o.criado_em, valor: o.custo }] : [],
          ),
        ativo.compra_data ?? hoje,
        hoje,
      )
    : null;

  return {
    ativo,
    categoria: cats.find((c) => c.id === ativo.categoria_id) ?? null,
    loja: lojaDoAtivo,
    local: descreverLocal({ ...ativo, loja: nomeLoja }),
    fornecedor: fornecedor?.data ?? null,
    setor: listaSetores.find((s) => s.id === ativo.setor_id)?.nome ?? null,
    responsavel: ativo.responsavel_id
      ? (pessoas.get(ativo.responsavel_id) ?? null)
      : null,
    resumo,
    sinal: sinalDoAtivo(
      {
        custo12m: resumo.custo12m,
        valorReposicao: ativo.valor_reposicao,
        corretivas12m: resumo.corretivas12m,
        compraData: ativo.compra_data,
        vidaUtilAnos: ativo.vida_util_anos,
      },
      regras.faixas,
      hoje,
    ),
    faixas: regras.faixas,
    antecedenciaPadrao: regras.antecedenciaPadrao,
    faltas: faltasNoCadastro(ativo),
    idadeAnos: idadeEmAnos(ativo.compra_data, hoje),
    diasParado12m: diasParado(
      situacoes.data ?? [],
      umAnoAntes(hoje),
      hoje,
      agora,
    ),
    mtbfDias: tempoMedioEntreFalhasDias(corretivas.map((c) => c.criado_em)),
    mttrMin: tempoMedioDeReparoMin(corretivas),
    ordens,
    custoMensal,
    planos: planos.data ?? [],
    anexos: listaAnexos,
    foto,
    verCustos,
  };
}

/** Custo total de cada OS (só com os.custos; o RLS confere). */
async function custosDasOS(ids: string[]): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  // Em lotes: a lista de ids vai na URL.
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await (await os())
      .from("os_custos")
      .select("chamado_id, custo_total")
      .in("chamado_id", ids.slice(i, i + 150));
    falhar(error);
    for (const c of data ?? [])
      if (c.custo_total !== null) mapa.set(c.chamado_id, Number(c.custo_total));
  }
  return mapa;
}

/** Ativos para a página de etiquetas (código, nome e local). */
export async function ativosParaEtiqueta(ids?: string[]): Promise<
  {
    id: string;
    codigo: string;
    nome: string;
    local: string;
    situacao: Ativo["situacao"];
  }[]
> {
  // Lê todos e filtra aqui: os ids de um lote grande não cabem na URL.
  const db = await os();
  const [data, todasLojas] = await Promise.all([
    todas((de, ate) =>
      db
        .from("ativos")
        .select("id, codigo, nome, bloco, area, ponto, loja_id, situacao")
        .order("codigo")
        .range(de, ate),
    ),
    lojas(),
  ]);
  const loja = new Map(todasLojas.map((l) => [l.id, `${l.luc} ${l.nome}`]));
  const pedidos = ids ? new Set(ids) : null;
  return data
    .filter((a) => !pedidos || pedidos.has(a.id))
    .map((a) => ({
      id: a.id,
      codigo: a.codigo,
      nome: a.nome,
      situacao: a.situacao,
      local: descreverLocal({
        ...a,
        loja: a.loja_id ? (loja.get(a.loja_id) ?? null) : null,
      }),
    }));
}

/**
 * Listas do formulário do ativo (categoria, loja, fornecedor, setor,
 * pessoa). Contrato encerrado só aparece se já é o do ativo.
 */
export async function opcoesDoCadastro(atual?: {
  loja_id: string | null;
  fornecedor_id: string | null;
}) {
  const [cats, todasLojas, todasEmpresas, listaSetores, quem, blocos] =
    await Promise.all([
      categoriasDeAtivo(),
      lojas(),
      empresas(),
      setores(),
      pessoasDoModulo(),
      blocosUsados(),
    ]);
  return {
    categorias: cats.map((c) => ({
      id: c.id,
      nome: c.nome,
      vidaUtil: c.vida_util_padrao_anos,
    })),
    lojas: todasLojas
      .filter((l) => l.vigente || l.id === atual?.loja_id)
      .map((l) => ({
        id: l.id,
        nome: `${l.luc} · ${l.nome}`,
        bloco: l.bloco,
      })),
    empresas: todasEmpresas
      .filter((e) => e.ativo || e.id === atual?.fornecedor_id)
      .map((e) => ({ id: e.id, nome: e.nome })),
    setores: listaSetores
      .filter((s) => s.ativo)
      .map((s) => ({ id: s.id, nome: s.nome })),
    pessoas: quem.map((p) => ({ id: p.id, nome: p.nome })),
    blocos: [
      ...new Set([
        ...blocos,
        ...todasLojas
          .map((l) => l.bloco?.trim())
          .filter((b): b is string => !!b),
      ]),
    ].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
  };
}

async function blocosUsados(): Promise<string[]> {
  const db = await os();
  const data = await todas((de, ate) =>
    db
      .from("ativos")
      .select("bloco")
      .not("bloco", "is", null)
      .order("id")
      .range(de, ate),
  );
  return data.map((a) => a.bloco?.trim() ?? "").filter(Boolean);
}
