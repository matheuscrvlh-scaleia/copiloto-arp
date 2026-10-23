import "server-only";
import { cache } from "react";
import { formatarDataHora } from "@/lib/formato";
import {
  datasDoPlano,
  type ItemCalendario,
  rotuloPeriodo,
} from "@/lib/os/calendario";
import { andamentoDosDestinos } from "@/lib/os/ciclo";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import {
  agrupar,
  type Busca,
  CARTOES_DA_TELA,
  type Carga,
  type ChaveCartao,
  COLUNAS_DA_TELA,
  type Contagens,
  type ContextoLista,
  type CriterioCartao,
  criterioDoCartao,
  type Filtros,
  type LinhaChamado,
  lerBusca,
  lerCartao,
  lerFiltros,
  lerOrdem,
  type ModoGrupo,
  modoDaLista,
  type Ordem,
  ordemDaConsulta,
  ordenarCarga,
  type PassoOrdem,
  PREFERENCIA_FILTROS,
  paraExportar,
  type Recorte,
  statusDoFiltro,
  type Tela,
  type TelaLista,
  temFiltrosNaUrl,
} from "@/lib/os/lista";
import { paginaDaUrl } from "@/lib/os/paginacao";
import {
  COLUNAS_QUADRO,
  type ColunaDoQuadro,
  lerMais,
  limiteDaColuna,
  type MaisPorColuna,
} from "@/lib/os/quadro";
import { rotaAtivo } from "@/lib/os/rotas";
import { PRIORIDADES, STATUS, type StatusChamado } from "@/lib/os/rotulos";
import { deBrasilia, instante, paraBrasilia, somarDias } from "@/lib/os/tempo";
import {
  buscarPaginaDeChamados,
  type Categoria,
  type ChamadoResumo,
  type Contexto,
  categorias,
  contarChamados,
  contexto,
  type FiltroChamados,
  os,
  type Pessoa,
  parametros,
  pessoas,
  type Setor,
  setores,
  todosOsChamados,
} from "./base";
import { lerPreferencias } from "./preferencias";

// Dados das visões do dia a dia (Minha caixa, Meu setor, Abertos por mim,
// Quadro e Calendário). Tudo pela sessão (RLS). As listas e o quadro pedem
// ao banco só a página (ou os primeiros cartões de cada coluna) com o total
// junto; cartões e carga por pessoa são contagens. Nomes de setores,
// categorias e pessoas vêm uma vez só; as contagens de fotos, anexos e
// conversa numa consulta agregada.

export interface Apoio {
  ctx: Contexto;
  agora: Date;
  avisoHoras: number;
  setores: Setor[];
  setorPorId: Map<string, Setor>;
  categorias: Categoria[];
  categoriaPorId: Map<string, Categoria>;
  pessoas: Pessoa[];
  nomes: Map<string, string>;
}

/** O que toda visão precisa, uma vez por requisição. */
export const apoio = cache(async (): Promise<Apoio> => {
  const [ctx, p, listaSetores, listaCategorias, listaPessoas] =
    await Promise.all([
      contexto(),
      parametros(),
      setores(),
      categorias(),
      pessoas(),
    ]);
  return {
    ctx,
    // Depois da sessão (leitura da requisição): a hora é a desta visita.
    agora: new Date(),
    avisoHoras: p.aviso_vencimento_horas,
    setores: listaSetores,
    setorPorId: new Map(listaSetores.map((s) => [s.id, s])),
    categorias: listaCategorias,
    categoriaPorId: new Map(listaCategorias.map((c) => [c.id, c])),
    pessoas: listaPessoas,
    nomes: new Map(listaPessoas.map((x) => [x.id, x.nome])),
  };
});

/** Quem gerencia o setor troca responsável, prazo e prioridade (os.gerencia). */
export function gerencia(ctx: Contexto, setorId: string): boolean {
  return (
    ctx.pode("os.gerenciar_setor") &&
    (ctx.pode("os.todos_setores") || ctx.setores.includes(setorId))
  );
}

/** Setores que a pessoa pode escolher (os dela, ou todos com permissão). */
export function setoresDisponiveis(a: Apoio): Setor[] {
  return a.ctx.pode("os.todos_setores")
    ? a.setores.filter((s) => s.ativo)
    : a.setores.filter((s) => a.ctx.setores.includes(s.id));
}

/** Pessoas de cada setor (para atribuir responsável em 1 clique). */
export function pessoasPorSetor(
  a: Apoio,
  setorIds: Iterable<string>,
): Record<string, { id: string; nome: string }[]> {
  const r: Record<string, { id: string; nome: string }[]> = {};
  for (const id of new Set(setorIds))
    r[id] = a.pessoas
      .filter((p) => p.setores.includes(id))
      .map((p) => ({ id: p.id, nome: p.nome }));
  return r;
}

/** Chamado do banco → linha da tela, com o que a pessoa pode mudar. */
export function paraLinha(
  ch: ChamadoResumo,
  a: Apoio,
  soNoCartao = false,
): LinhaChamado {
  const eu = a.ctx.usuario.id;
  const setor = a.setorPorId.get(ch.setor_id);
  const pediu = ch.aberto_por === eu;
  const gestor = gerencia(a.ctx, ch.setor_id);
  const aberto = !["concluido", "fechado", "cancelado"].includes(ch.status);
  return {
    id: ch.id,
    numero: ch.numero,
    tipo: ch.tipo,
    origem: ch.origem,
    titulo: ch.titulo,
    status: ch.status,
    prioridade: ch.prioridade,
    prazo: ch.prazo,
    setorId: ch.setor_id,
    setor: setor?.nome ?? "Setor",
    setorCor: setor?.cor ?? "#a3a3a3",
    categoriaId: ch.categoria_id,
    categoria: ch.categoria_id
      ? (a.categoriaPorId.get(ch.categoria_id)?.nome ?? null)
      : null,
    responsavelId: ch.responsavel_id,
    responsavel: ch.responsavel_id
      ? (a.nomes.get(ch.responsavel_id) ?? "Usuário inativo")
      : null,
    abertoPor: ch.aberto_por,
    solicitante: ch.aberto_por
      ? (a.nomes.get(ch.aberto_por) ?? "Usuário inativo")
      : ch.solicitante_nome,
    etiquetas: ch.etiquetas,
    aguardando: ch.aguardando_tipo,
    pessoal: ch.pessoal,
    precisaConfirmacao: ch.precisa_confirmacao,
    concluidoEm: ch.concluido_em,
    fechadoEm: ch.fechado_em,
    criadoEm: ch.criado_em,
    exemplo: ch.exemplo,
    soNoCartao,
    // As mesmas regras do gatilho os.validar_chamado (o banco confere).
    podeAtribuir: aberto && (gestor || (pediu && ch.status === "aberto")),
    podePrazo: aberto && (gestor || pediu),
  };
}

// ---------------------------------------------------------------------------
// Filtros: da URL ou os lembrados
// ---------------------------------------------------------------------------

export interface FiltrosDaTela {
  filtros: Filtros;
  /** Vieram da preferência (a URL não tinha filtros). */
  lembrados: boolean;
}

/**
 * Filtros da tela: os da URL; sem nenhum na URL, os lembrados. Lê também
 * outras preferências pedidas (ex.: o "Seu dia") na mesma consulta.
 */
export async function filtrosDaTela(
  tela: Tela,
  busca: Busca,
): Promise<FiltrosDaTela> {
  if (temFiltrosNaUrl(tela, busca))
    return { filtros: lerFiltros(tela, busca), lembrados: false };
  const prefs = await lerPreferencias([PREFERENCIA_FILTROS[tela]]);
  const guardado = prefs.get(PREFERENCIA_FILTROS[tela]);
  const filtros = lerFiltros(
    tela,
    guardado && typeof guardado === "object" && !Array.isArray(guardado)
      ? guardado
      : null,
  );
  return { filtros, lembrados: Object.keys(filtros).length > 0 };
}

/** Filtros da barra → consulta padrão (base.ts). */
export function paraConsulta(f: Filtros, recorte: Recorte): FiltroChamados {
  return {
    recorte,
    setor: f.setor ?? null,
    tipos: f.tipo ? [f.tipo] : undefined,
    status: statusDoFiltro(f.status),
    categoria: f.categoria ?? null,
    responsavel: f.responsavel ?? null,
    prioridade: f.prioridade ?? null,
    etiqueta: f.etiqueta ?? null,
    de: f.de ?? null,
    ate: f.ate ?? null,
  };
}

// ---------------------------------------------------------------------------
// Listas paginadas (Minha caixa, Meu setor, Abertos por mim): o banco
// devolve só a página, conta os cartões e a carga; tudo com os mesmos
// filtros da barra. A exportação lê o resultado inteiro no clique.
// ---------------------------------------------------------------------------

const RECORTE_DA_TELA: Record<TelaLista, Recorte> = {
  caixa: "minha_caixa",
  setor: "meu_setor",
  abertos: "abertos_por_mim",
};

const umTexto = (v: unknown): string | undefined =>
  typeof v === "string"
    ? v
    : Array.isArray(v) && typeof v[0] === "string"
      ? v[0]
      : undefined;

export interface EstadoDaLista {
  tela: TelaLista;
  a: Apoio;
  filtros: Filtros;
  lembrados: boolean;
  /** Barra e recorte (sem o cartão nem a busca). */
  consulta: FiltroChamados;
  cartao: ChaveCartao | null;
  q: string;
  ordem: Ordem | null;
  modo: ModoGrupo;
  pagina: number;
  /** Meu setor: setores que a pessoa pode escolher (vazio: nenhum). */
  disponiveis: Setor[];
}

/** Tudo o que a lista lê da URL (ou dos filtros lembrados). */
export async function estadoDaLista(
  tela: TelaLista,
  busca: Busca,
): Promise<EstadoDaLista> {
  const [a, lidos] = await Promise.all([apoio(), filtrosDaTela(tela, busca)]);
  let filtros = lidos.filtros;
  let disponiveis: Setor[] = [];
  if (tela === "setor") {
    // Setor escolhido (lembrado); sem escolha válida, o primeiro dos meus.
    disponiveis = setoresDisponiveis(a);
    const setor =
      disponiveis.find((s) => s.id === filtros.setor)?.id ??
      disponiveis.find((s) => a.ctx.setores.includes(s.id))?.id ??
      disponiveis[0]?.id;
    filtros = { ...filtros, setor };
  }
  const ordem = lerOrdem(busca.ordem);
  return {
    tela,
    a,
    filtros,
    lembrados: lidos.lembrados,
    consulta: {
      ...paraConsulta(filtros, RECORTE_DA_TELA[tela]),
      comConfirmacao: tela === "caixa",
    },
    cartao: lerCartao(tela, busca.cartao),
    q: lerBusca(busca.q),
    ordem,
    modo: modoDaLista(tela, filtros.agrupar, ordem),
    pagina: paginaDaUrl(umTexto(busca.pagina)),
    disponiveis,
  };
}

const contextoDaLista = (a: Apoio): ContextoLista => ({
  agora: a.agora,
  eu: a.ctx.usuario.id,
  avisoHoras: a.avisoHoras,
});

/** Consulta da lista com um cartão (o clicado, por padrão) e a busca. */
export function consultaDaLista(
  e: EstadoDaLista,
  cartao: ChaveCartao | null = e.cartao,
  comBusca = true,
): FiltroChamados {
  return {
    ...e.consulta,
    cartao: cartao ? criterioDoCartao(cartao, contextoDaLista(e.a)) : null,
    busca: comBusca ? e.q : null,
  };
}

/** Chamados → linhas da tela (avisos com vários destinos: o andamento). */
async function paraLinhasDaLista(
  e: EstadoDaLista,
  chamados: ChamadoResumo[],
): Promise<LinhaChamado[]> {
  const destinos =
    e.tela === "abertos"
      ? await andamentoDosAvisos(
          chamados.filter((c) => c.tipo === "aviso").map((c) => c.id),
          e.a,
        )
      : null;
  return chamados.map((c) => ({
    ...paraLinha(c, e.a),
    destinos: destinos?.get(c.id) ?? null,
  }));
}

/** Só a página mostrada, na ordem do grupo e da coluna escolhida. */
export async function paginaDaLista(
  e: EstadoDaLista,
): Promise<{ linhas: LinhaChamado[]; total: number; pagina: number }> {
  const r = await buscarPaginaDeChamados(consultaDaLista(e), {
    pagina: e.pagina,
    ordem: ordemDaConsulta(e.modo, e.ordem),
  });
  return { ...r, linhas: await paraLinhasDaLista(e, r.linhas) };
}

/**
 * Número de cada cartão, contado no banco com os filtros da barra (a busca
 * não muda os cartões, como antes), em paralelo.
 */
export async function contarCartoes(
  e: EstadoDaLista,
): Promise<Partial<Record<ChaveCartao, number>>> {
  const chaves = CARTOES_DA_TELA[e.tela];
  const valores = await Promise.all(
    chaves.map((c) => contarChamados(consultaDaLista(e, c, false))),
  );
  return Object.fromEntries(chaves.map((c, i) => [c, valores[i] ?? 0]));
}

/**
 * Carga por pessoa do Meu setor, contada no banco: abertos e atrasados de
 * cada pessoa do setor e da fila, com os filtros da barra. Filtrando por um
 * responsável, os outros ficam com zero (como a lista).
 */
export async function cargaDoSetor(
  e: EstadoDaLista,
  membros: { id: string; nome: string }[],
): Promise<Carga[]> {
  const base = consultaDaLista(e, null, false);
  const ctx = contextoDaLista(e.a);
  const abertos = criterioDoCartao("abertos", ctx);
  const atrasados = criterioDoCartao("atrasados", ctx);
  const contar = (responsavel: string | null, criterio: CriterioCartao) =>
    base.responsavel && base.responsavel !== responsavel
      ? Promise.resolve(0)
      : contarChamados({
          ...base,
          responsavel,
          cartao: responsavel
            ? criterio
            : { ...criterio, semResponsavel: true },
        });
  const quanto = async (id: string | null, nome: string): Promise<Carga> => {
    const [a, b] = await Promise.all([
      contar(id, abertos),
      contar(id, atrasados),
    ]);
    return { id, nome, abertos: a, atrasados: b };
  };
  const [pessoas, fila] = await Promise.all([
    Promise.all(membros.map((p) => quanto(p.id, p.nome))),
    quanto(null, "Na fila"),
  ]);
  return ordenarCarga(pessoas, fila);
}

/** Exportação: o resultado filtrado inteiro, agrupado como na tela. */
export async function exportacaoDaLista(e: EstadoDaLista) {
  const chamados = await todosOsChamados(
    consultaDaLista(e),
    ordemDaConsulta(e.modo, e.ordem),
  );
  const linhas = await paraLinhasDaLista(e, chamados);
  const ctx = contextoDaLista(e.a);
  return paraExportar(
    agrupar(linhas, e.modo, ctx),
    e.modo,
    COLUNAS_DA_TELA[e.tela],
    ctx,
  );
}

// ---------------------------------------------------------------------------
// Quadro: uma consulta por coluna (os primeiros cartões e o total real)
// ---------------------------------------------------------------------------

export interface EstadoDoQuadro {
  a: Apoio;
  filtros: Filtros;
  lembrados: boolean;
  /** Filtros em vigor (recorte permitido, setor só onde cabe). */
  valores: Filtros;
  permitidos: Recorte[];
  comSetor: boolean;
  setores: Setor[];
  consulta: FiltroChamados;
  mais: MaisPorColuna;
}

export async function estadoDoQuadro(busca: Busca): Promise<EstadoDoQuadro> {
  const [a, { filtros, lembrados }] = await Promise.all([
    apoio(),
    filtrosDaTela("quadro", busca),
  ]);
  const permitidos: Recorte[] = [
    "minha_caixa",
    ...(a.ctx.pode("os.meu_setor") ? (["meu_setor"] as const) : []),
    "abertos_por_mim",
    ...(a.ctx.pode("os.todos_setores") ? (["todos"] as const) : []),
  ];
  const recorte =
    filtros.recorte && permitidos.includes(filtros.recorte)
      ? filtros.recorte
      : "minha_caixa";
  const comSetor = recorte === "meu_setor" || recorte === "todos";
  const valores: Filtros = {
    ...filtros,
    recorte,
    setor: comSetor ? filtros.setor : undefined,
  };
  return {
    a,
    filtros,
    lembrados,
    valores,
    permitidos,
    comSetor,
    setores:
      recorte === "todos"
        ? a.setores.filter((s) => s.ativo)
        : setoresDisponiveis(a),
    consulta: paraConsulta({ ...valores, status: undefined }, recorte),
    mais: lerMais(busca.mais),
  };
}

/** Colunas que o quadro consulta (Fechado só com o filtro "Fechados"). */
export const colunasConsultadas = (e: EstadoDoQuadro): StatusChamado[] =>
  COLUNAS_QUADRO.filter((s) => s !== "fechado" || !!e.filtros.fechados);

/** Mais novos em cima; em Fechado, os fechados mais recentes. */
const ordemDaColuna = (s: StatusChamado): PassoOrdem[] => [
  {
    coluna: s === "fechado" ? "fechado_em" : "criado_em",
    asc: false,
    nullsFirst: false,
  },
  { coluna: "numero", asc: false, nullsFirst: false },
];

export async function colunasDoQuadro(
  e: EstadoDoQuadro,
): Promise<ColunaDoQuadro[]> {
  const colunas = await Promise.all(
    colunasConsultadas(e).map(async (status) => {
      const r = await buscarPaginaDeChamados(
        { ...e.consulta, status: [status] },
        {
          pagina: 1,
          porPagina: limiteDaColuna(e.mais, status),
          ordem: ordemDaColuna(status),
        },
      );
      return { status, chamados: r.linhas, total: r.total };
    }),
  );
  const numeros = await contagens(
    colunas.flatMap((c) => c.chamados.map((x) => x.id)),
  );
  return colunas.map((c) => ({
    status: c.status,
    total: c.total,
    cartoes: c.chamados.map((x) => ({
      ...paraLinha(x, e.a),
      contagens: numeros.get(x.id),
    })),
  }));
}

/** Exportação do quadro: todas as colunas consultadas, inteiras. */
export async function exportacaoDoQuadro(e: EstadoDoQuadro) {
  const porColuna = await Promise.all(
    colunasConsultadas(e).map(async (s) => ({
      s,
      chamados: await todosOsChamados(
        { ...e.consulta, status: [s] },
        ordemDaColuna(s),
      ),
    })),
  );
  return {
    colunas: [
      { titulo: "Coluna" },
      { titulo: "Número", numero: true },
      { titulo: "Título" },
      { titulo: "Categoria" },
      { titulo: "Responsável" },
      { titulo: "Prioridade" },
      { titulo: "Prazo" },
    ] satisfies ColunaExportar[],
    linhas: porColuna.flatMap(({ s, chamados }) =>
      chamados.map((x): CelulaExportar[] => {
        const c = paraLinha(x, e.a);
        return [
          STATUS[s],
          c.numero,
          c.titulo,
          c.categoria ?? "",
          c.responsavel ?? "Na fila",
          PRIORIDADES[c.prioridade],
          c.prazo ? formatarDataHora(c.prazo) : "",
        ];
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Contagens (cartões do quadro) e andamento dos avisos
// ---------------------------------------------------------------------------

const LOTE = 150;
const lotes = <T>(xs: T[], tamanho = LOTE) =>
  Array.from({ length: Math.ceil(xs.length / tamanho) }, (_, i) =>
    xs.slice(i * tamanho, (i + 1) * tamanho),
  );

/** Destinos por lote: o PostgREST devolve no máximo 1000 linhas. */
const LOTE_DESTINOS = 40;

const FOTOS = ["foto", "antes", "depois"];

/**
 * Fotos, outros anexos, comentários e destinatários de cada chamado, numa
 * consulta agregada (contagem dos relacionamentos) por lote de ids. Se
 * falhar, a tela segue sem os ícones.
 */
export async function contagens(
  ids: string[],
): Promise<Map<string, Contagens>> {
  const mapa = new Map<string, Contagens>();
  const cliente = await os();
  await Promise.all(
    lotes(ids).map(async (lote) => {
      const { data, error } = await cliente
        .from("chamados")
        .select(
          "id, fotos:anexos!anexos_chamado_id_fkey(count), arquivos:anexos!anexos_chamado_id_fkey(count), comentarios:eventos!eventos_chamado_id_fkey(count), destinos:destinatarios!destinatarios_chamado_id_fkey(count)",
        )
        .in("id", lote)
        .in("fotos.categoria", FOTOS)
        .not("arquivos.categoria", "in", `(${[...FOTOS, "assinatura"]})`)
        .eq("comentarios.tipo", "comentario");
      if (error) {
        console.error("contagens dos chamados", error);
        return;
      }
      const n = (x: unknown) =>
        Array.isArray(x) ? Number((x[0] as { count?: number })?.count ?? 0) : 0;
      for (const c of data ?? [])
        mapa.set(c.id, {
          fotos: n(c.fotos),
          anexos: n(c.arquivos),
          comentarios: n(c.comentarios),
          destinos: n(c.destinos),
        });
    }),
  );
  return mapa;
}

/**
 * Avisos para vários setores ou pessoas: "3 de 5 concluídos" e quem falta
 * (o título do item, o setor ou a pessoa).
 */
export async function andamentoDosAvisos(
  ids: string[],
  a: Apoio,
): Promise<Map<string, NonNullable<LinhaChamado["destinos"]>>> {
  const cliente = await os();
  const linhas = (
    await Promise.all(
      lotes(ids, LOTE_DESTINOS).map(async (lote) => {
        const { data, error } = await cliente
          .from("destinatarios")
          .select("chamado_id, status, setor_id, usuario_id, titulo, ordem")
          .in("chamado_id", lote)
          .order("ordem");
        if (error) {
          console.error("andamento dos destinos", error);
          return [];
        }
        return data ?? [];
      }),
    )
  ).flat();

  const porChamado = new Map<string, typeof linhas>();
  for (const d of linhas)
    porChamado.set(d.chamado_id, [...(porChamado.get(d.chamado_id) ?? []), d]);

  const r = new Map<string, NonNullable<LinhaChamado["destinos"]>>();
  for (const [id, destinos] of porChamado) {
    if (destinos.length < 2) continue;
    const andamento = andamentoDosDestinos(destinos);
    r.set(id, {
      texto: andamento.texto,
      todos: andamento.todosConcluidos,
      faltam: destinos
        .filter((d) => d.status !== "concluido")
        .map(
          (d) =>
            d.titulo ??
            (d.setor_id ? a.setorPorId.get(d.setor_id)?.nome : null) ??
            (d.usuario_id ? a.nomes.get(d.usuario_id) : null) ??
            "Destino",
        ),
    });
  }
  return r;
}

// ---------------------------------------------------------------------------
// Rótulos dos filtros (linha de filtros da tela e da exportação)
// ---------------------------------------------------------------------------

export function nomesDosFiltros(f: Filtros, a: Apoio) {
  return {
    setor: f.setor ? (a.setorPorId.get(f.setor)?.nome ?? null) : null,
    categoria: f.categoria
      ? (a.categoriaPorId.get(f.categoria)?.nome ?? null)
      : null,
    responsavel: f.responsavel ? (a.nomes.get(f.responsavel) ?? null) : null,
  };
}

/** Opções de categoria do filtro: só as do setor escolhido (ou dos meus). */
export function opcoesDeCategoria(a: Apoio, setorIds: string[] | null) {
  return a.categorias
    .filter((c) => c.ativo && (!setorIds || setorIds.includes(c.setor_id)))
    .map((c) => ({
      valor: c.id,
      rotulo: c.nome,
      descricao: a.setorPorId.get(c.setor_id)?.nome,
    }));
}

/** "10:32" (Brasília): o "Atualizado às" do topo. */
export function horaDaVisita(a: Apoio): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(a.agora);
}

// ---------------------------------------------------------------------------
// Calendário: prazos, visitas de terceirizados, agendamentos e preventivas
// ---------------------------------------------------------------------------

const falhou = (o: string, e: { message: string } | null) => {
  if (e) console.error(`calendário: ${o}`, e);
};

/** Prazos dos chamados da tela que caem no intervalo. */
export function itensDePrazo(
  linhas: LinhaChamado[],
  de: string,
  ate: string,
): ItemCalendario[] {
  return linhas.flatMap((l) => {
    if (!l.prazo) return [];
    const { data, hora } = paraBrasilia(instante(l.prazo));
    if (data < de || data > ate) return [];
    return [
      {
        chave: `prazo:${l.id}`,
        tipo: l.origem === "preventiva" ? "preventiva" : "prazo",
        dia: data,
        hora,
        quando: hora,
        titulo: `#${l.numero} ${l.titulo}`,
        detalhe: l.responsavel ?? "Na fila",
        chamadoId: l.id,
        href: null,
        status: l.status,
        prazo: l.prazo,
        arrastavel: l.podePrazo,
      } satisfies ItemCalendario,
    ];
  });
}

/** Visitas de terceirizados (OS com data de visita) no intervalo. */
export async function itensDeVisita(
  de: string,
  ate: string,
  soEstes: Set<string> | null,
): Promise<ItemCalendario[]> {
  const { data, error } = await (await os())
    .from("chamados")
    .select("id, numero, titulo, status, visita_data, visita_periodo")
    .gte("visita_data", de)
    .lte("visita_data", ate)
    .is("lixeira_em", null)
    .neq("status", "cancelado")
    .limit(500);
  falhou("visitas", error);
  return (data ?? [])
    .filter((c) => c.visita_data && (!soEstes || soEstes.has(c.id)))
    .map((c) => ({
      chave: `visita:${c.id}`,
      tipo: "visita",
      dia: c.visita_data as string,
      hora: null,
      quando: rotuloPeriodo(c.visita_periodo) ?? "Visita",
      titulo: `#${c.numero} ${c.titulo}`,
      detalhe: "Visita do terceirizado",
      chamadoId: c.id,
      href: null,
      status: c.status,
      prazo: null,
      arrastavel: false,
    }));
}

/** Agendamentos marcados (todas as agendas) no intervalo. */
export async function itensDeAgendamento(
  de: string,
  ate: string,
): Promise<ItemCalendario[]> {
  const cliente = await os();
  const [ags, agendas] = await Promise.all([
    cliente
      .from("agendamentos")
      .select(
        "id, agenda_id, chamado_id, loja_id, inicio, fim, status, observacao",
      )
      .gte("inicio", deBrasilia(de).toISOString())
      .lt("inicio", deBrasilia(somarDias(ate, 1)).toISOString())
      .neq("status", "cancelado")
      .order("inicio")
      .limit(500),
    cliente.from("agendas").select("id, nome"),
  ]);
  falhou("agendamentos", ags.error);
  falhou("agendas", agendas.error);
  const lista = ags.data ?? [];
  const lojaIds = [
    ...new Set(lista.map((g) => g.loja_id).filter((x): x is string => !!x)),
  ];
  const lojas = lojaIds.length
    ? await cliente.from("lojas").select("id, nome, luc").in("id", lojaIds)
    : { data: [], error: null };
  falhou("lojas", lojas.error);
  const nomeAgenda = new Map((agendas.data ?? []).map((a) => [a.id, a.nome]));
  const nomeLoja = new Map(
    (lojas.data ?? []).map((l) => [l.id, `${l.nome} (${l.luc})`]),
  );

  return lista.map((g) => {
    const ini = paraBrasilia(instante(g.inicio));
    const fim = paraBrasilia(instante(g.fim));
    const loja = g.loja_id ? nomeLoja.get(g.loja_id) : null;
    return {
      chave: `agendamento:${g.id}`,
      tipo: "agendamento",
      dia: ini.data,
      hora: ini.hora,
      quando: `${ini.hora}–${fim.hora}`,
      titulo: `${nomeAgenda.get(g.agenda_id) ?? "Agenda"}${loja ? ` · ${loja}` : ""}`,
      detalhe:
        g.status === "remarcar"
          ? "Precisa remarcar"
          : g.status === "realizado"
            ? "Realizado"
            : (g.observacao ?? null),
      chamadoId: g.chamado_id,
      href: null,
      status: null,
      prazo: null,
      arrastavel: false,
    } satisfies ItemCalendario;
  });
}

/** Próximas datas dos planos preventivos (quem vê ativos). */
export async function itensDePlano(
  a: Apoio,
  de: string,
  ate: string,
  setor: string | null,
): Promise<ItemCalendario[]> {
  if (!a.ctx.pode("os.ativos") && !a.ctx.pode("os.ativos_gerenciar")) return [];
  let q = (await os())
    .from("planos_preventivos")
    .select(
      "id, titulo, proxima_data, frequencia_dias, frequencia_meses, ativo_id, setor_id, ativos(codigo, nome)",
    )
    .eq("ativo", true)
    .lte("proxima_data", ate)
    .limit(1000);
  if (setor) q = q.eq("setor_id", setor);
  const { data, error } = await q;
  falhou("planos", error);
  return (data ?? []).flatMap((p) =>
    datasDoPlano(p, de, ate).map(
      (dia) =>
        ({
          chave: `plano:${p.id}:${dia}`,
          tipo: "plano",
          dia,
          hora: null,
          quando: "Previsto",
          titulo: p.titulo,
          detalhe: p.ativos ? `${p.ativos.codigo} · ${p.ativos.nome}` : null,
          chamadoId: null,
          href: rotaAtivo(p.ativo_id),
          status: null,
          prazo: null,
          arrastavel: false,
        }) satisfies ItemCalendario,
    ),
  );
}
