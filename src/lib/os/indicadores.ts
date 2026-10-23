import type { Direcao, Meta } from "@/lib/indicadores";
import { minutosEmAguardando, tempoDeResolucaoMin } from "./prazo";
import type { Origem, StatusChamado } from "./rotulos";
import {
  deBrasilia,
  diaDaSemana,
  diasEntre,
  instante,
  paraBrasilia,
  somarDias,
} from "./tempo";

// Indicadores dos painéis de Tickets (spec 4.13). Funções puras: o
// servidor lê os chamados uma vez e tudo o que os painéis mostram sai daqui,
// sempre com a lista de quem forma cada número (o modal abre exatamente
// essa lista). Metas e prazos vêm do banco; aqui só as regras.

/** Início (inclusive) e fim (exclusivo) de um período em datas de Brasília. */
export interface Janela {
  inicio: Date;
  fim: Date;
}

export function janelaDoPeriodo(de: string, ate: string): Janela {
  return { inicio: deBrasilia(de), fim: deBrasilia(somarDias(ate, 1)) };
}

/** O instante cai dentro da janela? */
export function naJanela(quando: string | null, j: Janela): boolean {
  if (!quando) return false;
  const t = instante(quando).getTime();
  return t >= j.inicio.getTime() && t < j.fim.getTime();
}

/** Até onde o painel olha: agora, ou o fim do período se ele já passou. */
export function momentoDoPainel(j: Janela, agora: Date): Date {
  return j.fim.getTime() < agora.getTime() ? j.fim : agora;
}

// ---------------------------------------------------------------------------
// Abertos, atrasados e fechados
// ---------------------------------------------------------------------------

/** Ainda com a equipe: sem os concluídos que aguardam a confirmação. */
export const STATUS_EM_ABERTO: StatusChamado[] = [
  "aberto",
  "em_andamento",
  "aguardando",
];

type Ciclo = {
  status: StatusChamado;
  criado_em: string;
  concluido_em: string | null;
  fechado_em: string | null;
  cancelado_em: string | null;
};

/**
 * Estava em aberto no momento? Agora vale o status; num momento passado, as
 * datas do ciclo (aberto antes e ainda não concluído, fechado nem cancelado
 * até ali).
 */
export function emAbertoEm(c: Ciclo, momento: Date, agora: Date): boolean {
  if (momento.getTime() >= agora.getTime())
    return STATUS_EM_ABERTO.includes(c.status);
  if (instante(c.criado_em).getTime() > momento.getTime()) return false;
  return ![c.concluido_em, c.fechado_em, c.cancelado_em].some(
    (d) => d !== null && instante(d).getTime() <= momento.getTime(),
  );
}

/** Em aberto e com o prazo vencido no momento. */
export function atrasadoEm(
  c: Ciclo & { prazo: string | null },
  momento: Date,
  agora: Date,
): boolean {
  return (
    emAbertoEm(c, momento, agora) &&
    c.prazo !== null &&
    instante(c.prazo).getTime() < momento.getTime()
  );
}

/** Concluídos pela equipe dentro da janela (inclui os já confirmados). */
export function concluidosNa<T extends Ciclo>(chs: T[], j: Janela): T[] {
  return chs.filter(
    (c) =>
      (c.status === "concluido" || c.status === "fechado") &&
      naJanela(c.concluido_em, j),
  );
}

export interface ResultadoNoPrazo<T> {
  noPrazo: T[];
  fora: T[];
  semPrazo: T[];
  /** % dos que tinham prazo; null se nenhum tinha. */
  pct: number | null;
}

/** Concluídos dentro do prazo, entre os que tinham prazo. */
export function separarNoPrazo<
  T extends { prazo: string | null; concluido_em: string | null },
>(concluidos: T[]): ResultadoNoPrazo<T> {
  const r: ResultadoNoPrazo<T> = {
    noPrazo: [],
    fora: [],
    semPrazo: [],
    pct: null,
  };
  for (const c of concluidos) {
    if (!c.prazo || !c.concluido_em) r.semPrazo.push(c);
    else if (instante(c.concluido_em) <= instante(c.prazo)) r.noPrazo.push(c);
    else r.fora.push(c);
  }
  const comPrazo = r.noPrazo.length + r.fora.length;
  r.pct = comPrazo ? (r.noPrazo.length / comPrazo) * 100 : null;
  return r;
}

// ---------------------------------------------------------------------------
// Metas (os.metas): por setor e/ou categoria; nenhum = geral
// ---------------------------------------------------------------------------

export type IndicadorOs = "pct_no_prazo" | "tempo_medio_horas";

export const DIRECAO_DO_INDICADOR: Record<IndicadorOs, Direcao> = {
  pct_no_prazo: "maior_melhor",
  tempo_medio_horas: "menor_melhor",
};

export interface LinhaMeta {
  setor_id: string | null;
  categoria_id: string | null;
  indicador: string;
  meta: number;
  limite_atencao: number | null;
}

/**
 * Meta mais específica que vale: da categoria, do setor ou a geral. A da
 * categoria vale com ou sem o setor preenchido.
 */
export function metaPara(
  metas: LinhaMeta[],
  indicador: IndicadorOs,
  setorId: string | null,
  categoriaId: string | null = null,
): Meta | null {
  const doIndicador = metas.filter((m) => m.indicador === indicador);
  const achada =
    (categoriaId &&
      (doIndicador.find(
        (m) => m.categoria_id === categoriaId && m.setor_id === setorId,
      ) ??
        doIndicador.find(
          (m) => m.categoria_id === categoriaId && m.setor_id === null,
        ))) ||
    (setorId &&
      doIndicador.find(
        (m) => m.setor_id === setorId && m.categoria_id === null,
      )) ||
    doIndicador.find((m) => m.setor_id === null && m.categoria_id === null);
  if (!achada) return null;
  return {
    meta: Number(achada.meta),
    limiteAtencao:
      achada.limite_atencao === null ? null : Number(achada.limite_atencao),
    direcao: DIRECAO_DO_INDICADOR[indicador],
  };
}

// ---------------------------------------------------------------------------
// Semanas (ou meses) do período
// ---------------------------------------------------------------------------

export interface Balde {
  tipo: "semana" | "mes";
  chave: string;
  /** Rótulo curto do eixo ("13/10", "out"). */
  rotulo: string;
  /** "13/10 a 19/10/2026", "out/2026". */
  titulo: string;
  de: string;
  ate: string;
}

const MESES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Acima disso o gráfico semanal fica ilegível: agrupa por mês. */
export const MAX_SEMANAS = 16;

/**
 * Semanas de segunda a domingo que o período toca, cortadas nas pontas do
 * período (a contagem de cada uma é só do que está dentro dele). Períodos
 * longos viram meses.
 */
export function baldesDoPeriodo(de: string, ate: string): Balde[] {
  const semanas: Balde[] = [];
  let inicio = de;
  while (inicio <= ate) {
    const domingo = somarDias(inicio, (7 - diaDaSemana(inicio)) % 7);
    const fim = domingo < ate ? domingo : ate;
    semanas.push({
      tipo: "semana",
      chave: inicio,
      rotulo: ddmm(inicio),
      titulo:
        inicio === fim
          ? `${ddmm(inicio)}/${inicio.slice(0, 4)}`
          : `${ddmm(inicio)} a ${ddmm(fim)}/${fim.slice(0, 4)}`,
      de: inicio,
      ate: fim,
    });
    inicio = somarDias(fim, 1);
  }
  if (semanas.length <= MAX_SEMANAS) return semanas;

  const meses: Balde[] = [];
  inicio = de;
  while (inicio <= ate) {
    const [a, m] = inicio.split("-").map(Number) as [number, number];
    const proximo =
      m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
    const fimDoMes = somarDias(proximo, -1);
    const fim = fimDoMes < ate ? fimDoMes : ate;
    meses.push({
      tipo: "mes",
      chave: inicio,
      rotulo: MESES[m - 1] as string,
      titulo: `${MESES[m - 1]}/${a}`,
      de: inicio,
      ate: fim,
    });
    inicio = proximo;
  }
  return meses;
}

/** Em que balde cai o instante (null se fora de todos). */
export function baldeDe(quando: string | null, baldes: Balde[]): string | null {
  if (!quando) return null;
  const dia = paraBrasilia(instante(quando)).data;
  return baldes.find((b) => dia >= b.de && dia <= b.ate)?.chave ?? null;
}

// ---------------------------------------------------------------------------
// Agrupamentos
// ---------------------------------------------------------------------------

export interface Grupo<T> {
  chave: string;
  itens: T[];
}

/** Agrupa e ordena do maior grupo para o menor (empate: pela chave). */
export function agrupar<T>(itens: T[], chave: (t: T) => string): Grupo<T>[] {
  const mapa = new Map<string, T[]>();
  for (const i of itens) {
    const k = chave(i);
    const lista = mapa.get(k);
    if (lista) lista.push(i);
    else mapa.set(k, [i]);
  }
  return [...mapa]
    .map(([k, v]) => ({ chave: k, itens: v }))
    .sort(
      (a, b) =>
        b.itens.length - a.itens.length || a.chave.localeCompare(b.chave),
    );
}

export function media(valores: number[]): number | null {
  return valores.length
    ? valores.reduce((s, v) => s + v, 0) / valores.length
    : null;
}

// ---------------------------------------------------------------------------
// Tempo de resolução (MTTR), sem o tempo em Aguardando
// ---------------------------------------------------------------------------

type ParaResolucao = {
  origem: Origem;
  criado_em: string;
  concluido_em: string | null;
  aguardando_min: number;
};

export interface Resolucao {
  /** Média em minutos; null sem nenhum concluído. */
  mediaMin: number | null;
  n: number;
  /**
   * Vindos do sistema anterior: ele não guardava o tempo em Aguardando, então
   * o tempo deles é bruto (o rótulo avisa).
   */
  importados: number;
  /** Minutos de cada chamado, pelo id. */
  porChamado: Map<string, number>;
}

export function resolucao<T extends ParaResolucao & { id: string }>(
  concluidos: T[],
): Resolucao {
  const porChamado = new Map<string, number>();
  for (const c of concluidos) {
    const min = tempoDeResolucaoMin(c);
    if (min !== null) porChamado.set(c.id, min);
  }
  return {
    mediaMin: media([...porChamado.values()]),
    n: porChamado.size,
    importados: concluidos.filter(
      (c) => c.origem === "importacao" && porChamado.has(c.id),
    ).length,
    porChamado,
  };
}

// ---------------------------------------------------------------------------
// Aguardando confirmação de quem pediu
// ---------------------------------------------------------------------------

/**
 * Concluídos que esperam a confirmação há mais de `dias` dias corridos
 * (parâmetro confirmacao_alerta_dias).
 */
export function confirmacaoParada<
  T extends { status: StatusChamado; concluido_em: string | null },
>(chs: T[], agora: Date, dias: number): T[] {
  const limite = agora.getTime() - dias * 86_400_000;
  return chs.filter(
    (c) =>
      c.status === "concluido" &&
      c.concluido_em !== null &&
      instante(c.concluido_em).getTime() < limite,
  );
}

// ---------------------------------------------------------------------------
// SLA de primeira resposta
// ---------------------------------------------------------------------------

type ParaResposta = {
  id: string;
  origem: Origem;
  status: StatusChamado;
  categoria_id: string | null;
  criado_em: string;
  primeira_resposta_em: string | null;
};

export interface ResultadoResposta<T> {
  cumpridos: T[];
  estourados: T[];
  /** Ainda sem resposta e dentro do prazo de resposta. */
  pendentes: T[];
  /** Categoria sem meta de resposta. */
  semMeta: T[];
  /** Do sistema anterior, que não registrava a primeira resposta. */
  semDado: T[];
  /** % cumpridos entre cumpridos e estourados; null sem nenhum. */
  pct: number | null;
  /** Média até a primeira resposta (minutos), entre os respondidos com dado. */
  mediaMin: number | null;
  porChamado: Map<string, number>;
}

/**
 * Primeira resposta (o chamado sai de Aberto) dentro das horas da
 * categoria. Sem resposta e já passou do prazo também estoura.
 */
export function primeiraResposta<T extends ParaResposta>(
  chs: T[],
  respostaHoras: Map<string, number | null>,
  agora: Date,
): ResultadoResposta<T> {
  const r: ResultadoResposta<T> = {
    cumpridos: [],
    estourados: [],
    pendentes: [],
    semMeta: [],
    semDado: [],
    pct: null,
    mediaMin: null,
    porChamado: new Map(),
  };
  for (const c of chs) {
    if (c.origem === "importacao") {
      r.semDado.push(c);
      continue;
    }
    const criado = instante(c.criado_em).getTime();
    const resposta = c.primeira_resposta_em
      ? instante(c.primeira_resposta_em).getTime()
      : null;
    if (resposta !== null)
      r.porChamado.set(c.id, Math.max(0, (resposta - criado) / 60_000));
    const horas = c.categoria_id
      ? (respostaHoras.get(c.categoria_id) ?? null)
      : null;
    if (!horas) {
      r.semMeta.push(c);
      continue;
    }
    const limite = criado + horas * 3_600_000;
    if (resposta !== null) {
      (resposta <= limite ? r.cumpridos : r.estourados).push(c);
    } else if (c.status === "cancelado") {
      r.semMeta.push(c);
    } else if (agora.getTime() > limite) {
      r.estourados.push(c);
    } else {
      r.pendentes.push(c);
    }
  }
  const medidos = r.cumpridos.length + r.estourados.length;
  r.pct = medidos ? (r.cumpridos.length / medidos) * 100 : null;
  r.mediaMin = media([...r.porChamado.values()]);
  return r;
}

// ---------------------------------------------------------------------------
// Backlog: idade dos que estão em aberto
// ---------------------------------------------------------------------------

/**
 * Faixas de idade do gráfico (só agrupam para leitura; não são regra de
 * negócio). "ate" em dias, exclusivo.
 */
export const FAIXAS_IDADE = [
  { chave: "ate2", rotulo: "Até 2 dias", ate: 2 },
  { chave: "ate7", rotulo: "3 a 7 dias", ate: 7 },
  { chave: "ate30", rotulo: "8 a 30 dias", ate: 30 },
  { chave: "mais30", rotulo: "Mais de 30", ate: Number.POSITIVE_INFINITY },
] as const;

type ParaIdade = {
  id: string;
  criado_em: string;
  aguardando_min: number;
  aguardando_desde: string | null;
};

/** Idade em dias (1 casa) até o momento, sem o tempo em Aguardando. */
export function idadeEmDias(c: ParaIdade, momento: Date): number {
  const corrido =
    (momento.getTime() - instante(c.criado_em).getTime()) / 60_000;
  const aguardando = minutosEmAguardando(c, momento);
  return Math.round((Math.max(0, corrido - aguardando) / 1440) * 10) / 10;
}

export interface Backlog<T> {
  faixas: { chave: string; rotulo: string; itens: T[] }[];
  /** Soma das idades, em dias (o "tamanho" do backlog). */
  totalDias: number;
  mediaDias: number | null;
  maisAntigo: T | null;
  idades: Map<string, number>;
}

export function backlog<T extends ParaIdade>(
  abertos: T[],
  momento: Date,
): Backlog<T> {
  const idades = new Map(abertos.map((c) => [c.id, idadeEmDias(c, momento)]));
  const idade = (c: T) => idades.get(c.id) ?? 0;
  let de = 0;
  const faixas = FAIXAS_IDADE.map((f) => {
    const itens = abertos.filter((c) => idade(c) >= de && idade(c) < f.ate);
    de = f.ate;
    return { chave: f.chave, rotulo: f.rotulo, itens };
  });
  const valores = [...idades.values()];
  const maisAntigo =
    [...abertos].sort((a, b) => idade(b) - idade(a))[0] ?? null;
  return {
    faixas,
    totalDias: Math.round(valores.reduce((s, v) => s + v, 0) * 10) / 10,
    mediaDias: media(valores),
    maisAntigo,
    idades,
  };
}

// ---------------------------------------------------------------------------
// Chamados entre setores (painel geral)
// ---------------------------------------------------------------------------

/** Origem que não é setor: pedido do lojista ou de quem não tem setor. */
export const ORIGEM_PORTAL = "portal";
export const SEM_SETOR = "sem_setor";

/**
 * Setor de quem abriu (o primeiro na ordem dos setores, se a pessoa é de
 * vários). Pedido do portal vem do lojista. Quem é do próprio setor de
 * destino conta como interno (null).
 */
export function setorDeOrigem(
  c: { origem: Origem; aberto_por: string | null },
  destino: string,
  setoresDaPessoa: Map<string, string[]>,
): string | null {
  if (c.origem === "portal") return ORIGEM_PORTAL;
  const dela = c.aberto_por ? (setoresDaPessoa.get(c.aberto_por) ?? []) : [];
  if (dela.includes(destino)) return null;
  return dela[0] ?? SEM_SETOR;
}

export interface CelulaMatriz<T> {
  origem: string;
  destino: string;
  itens: T[];
}

/**
 * Quem pede a quem: uma célula por (setor de origem → setor de destino).
 * Um aviso para vários setores conta em cada setor que recebeu um item.
 */
export function matrizEntreSetores<
  T extends {
    id: string;
    setor_id: string;
    origem: Origem;
    aberto_por: string | null;
  },
>(
  chs: T[],
  setoresDaPessoa: Map<string, string[]>,
  destinosExtras: Map<string, string[]> = new Map(),
): CelulaMatriz<T>[] {
  const celulas = new Map<string, CelulaMatriz<T>>();
  for (const c of chs) {
    const destinos = new Set([c.setor_id, ...(destinosExtras.get(c.id) ?? [])]);
    for (const destino of destinos) {
      const origem = setorDeOrigem(c, destino, setoresDaPessoa);
      if (origem === null || origem === destino) continue;
      const k = `${origem}>${destino}`;
      const cel = celulas.get(k) ?? { origem, destino, itens: [] };
      cel.itens.push(c);
      celulas.set(k, cel);
    }
  }
  return [...celulas.values()].sort((a, b) => b.itens.length - a.itens.length);
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------

/** Dias corridos (aaaa-mm-dd) de `de` a `ate`, inclusive. */
export function diasDoPeriodo(de: string, ate: string): string[] {
  const n = diasEntre(de, ate);
  return Array.from({ length: Math.max(n + 1, 0) }, (_, i) => somarDias(de, i));
}
