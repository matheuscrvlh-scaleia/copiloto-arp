import { z } from "zod";
import { GRUPOS_CAIXA, grupoDaCaixa, situacaoDoPrazo } from "./prazo";
import {
  type MotivoAguardando,
  ORDEM_PRIORIDADE,
  type Origem,
  PRIORIDADES,
  type Prioridade,
  STATUS,
  STATUS_ABERTOS,
  type StatusChamado,
  TIPOS,
  type TipoChamado,
} from "./rotulos";
import { hojeEmBrasilia, instante, paraBrasilia } from "./tempo";

// Listas do dia a dia (Minha caixa, Meu setor, Abertos por mim, Quadro e
// Calendário): filtros da barra, cartões que filtram, busca, ordenação,
// grupos e a carga por pessoa. Regras puras; o servidor monta as linhas.

/** Chamado já pronto para a tela (nomes resolvidos, sem funções). */
export interface LinhaChamado {
  id: string;
  numero: number;
  tipo: TipoChamado;
  origem: Origem;
  titulo: string;
  status: StatusChamado;
  prioridade: Prioridade;
  prazo: string | null;
  setorId: string;
  setor: string;
  setorCor: string;
  categoriaId: string | null;
  categoria: string | null;
  responsavelId: string | null;
  responsavel: string | null;
  abertoPor: string | null;
  /** Quem pediu: o usuário que abriu ou o lojista do portal. */
  solicitante: string | null;
  etiquetas: string[];
  aguardando: MotivoAguardando | null;
  pessoal: boolean;
  precisaConfirmacao: boolean;
  concluidoEm: string | null;
  fechadoEm: string | null;
  criadoEm: string;
  exemplo: boolean;
  /** Fora dos filtros da barra: só aparece pelo cartão (ex.: fechados no mês). */
  soNoCartao?: boolean;
  /** O que a pessoa pode mudar direto na lista (o banco confere de novo). */
  podeAtribuir: boolean;
  podePrazo: boolean;
  /** Aviso com vários destinos: "3 de 5 concluídos" e quem falta. */
  destinos?: { texto: string; faltam: string[]; todos: boolean } | null;
  contagens?: Contagens;
}

export interface Contagens {
  fotos: number;
  anexos: number;
  comentarios: number;
  /** Destinatários (Aviso para vários setores ou pessoas). */
  destinos: number;
}

// ---------------------------------------------------------------------------
// Cartões (no máximo 4 por tela; clicar filtra a lista)
// ---------------------------------------------------------------------------

const EM_ABERTO: StatusChamado[] = ["aberto", "em_andamento", "aguardando"];

export interface ContextoLista {
  agora: Date;
  /** Usuário logado. */
  eu: string;
  /** Horas antes do prazo em que o selo fica amarelo (parâmetros). */
  avisoHoras: number;
}

/** O instante cai no mês corrente (Brasília)? */
export function noMesAtual(iso: string | null, agora: Date): boolean {
  if (!iso) return false;
  return (
    paraBrasilia(instante(iso)).data.slice(0, 7) ===
    hojeEmBrasilia(agora).slice(0, 7)
  );
}

const situacao = (l: LinhaChamado, c: ContextoLista) =>
  situacaoDoPrazo(l, c.agora, c.avisoHoras);

export const CARTOES = {
  atrasados: {
    titulo: "Atrasados",
    testa: (l: LinhaChamado, c: ContextoLista) =>
      EM_ABERTO.includes(l.status) && situacao(l, c) === "atrasado",
  },
  vence_hoje: {
    titulo: "Vencem hoje",
    testa: (l: LinhaChamado, c: ContextoLista) =>
      situacao(l, c) === "vence_hoje",
  },
  aguardando_confirmacao: {
    titulo: "Aguardando minha confirmação",
    testa: (l: LinhaChamado, c: ContextoLista) =>
      l.status === "concluido" && l.abertoPor === c.eu,
  },
  em_andamento: {
    titulo: "Em andamento",
    testa: (l: LinhaChamado, _c: ContextoLista) => l.status === "em_andamento",
  },
  sem_responsavel: {
    titulo: "Sem responsável",
    testa: (l: LinhaChamado, _c: ContextoLista) =>
      EM_ABERTO.includes(l.status) && l.responsavelId === null,
  },
  abertos: {
    titulo: "Abertos",
    testa: (l: LinhaChamado, _c: ContextoLista) => EM_ABERTO.includes(l.status),
  },
  concluidos_mes: {
    titulo: "Concluídos no mês",
    testa: (l: LinhaChamado, c: ContextoLista) =>
      (l.status === "concluido" || l.status === "fechado") &&
      noMesAtual(l.concluidoEm, c.agora),
  },
  fechados_mes: {
    titulo: "Fechados no mês",
    testa: (l: LinhaChamado, c: ContextoLista) =>
      l.status === "fechado" && noMesAtual(l.fechadoEm, c.agora),
  },
} as const;
export type ChaveCartao = keyof typeof CARTOES;

export const CHAVES_CARTAO = Object.keys(CARTOES) as ChaveCartao[];

export function contarCartao(
  linhas: LinhaChamado[],
  cartao: ChaveCartao,
  c: ContextoLista,
): number {
  return linhas.filter((l) => CARTOES[cartao].testa(l, c)).length;
}

// ---------------------------------------------------------------------------
// Busca e filtro do cartão
// ---------------------------------------------------------------------------

export const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Onde a busca procura: número, título, setor, pessoas, etiquetas. */
export function textoDeBusca(l: LinhaChamado): string {
  return semAcento(
    [
      `#${l.numero}`,
      String(l.numero),
      l.titulo,
      l.setor,
      l.categoria,
      l.responsavel,
      l.solicitante,
      TIPOS[l.tipo],
      STATUS[l.status],
      ...l.etiquetas,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * O que a lista mostra: com cartão ativo, só o que ele conta (inclusive o
 * que só entra pelo cartão); sem cartão, o que passou pela barra. A busca
 * exige todas as palavras.
 */
export function filtrarLinhas(
  linhas: LinhaChamado[],
  f: { cartao?: ChaveCartao | null; busca?: string },
  c: ContextoLista,
): LinhaChamado[] {
  const palavras = semAcento(f.busca ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const cartao = f.cartao ? CARTOES[f.cartao] : null;
  return linhas.filter((l) => {
    if (cartao ? !cartao.testa(l, c) : l.soNoCartao) return false;
    if (!palavras.length) return true;
    const texto = textoDeBusca(l);
    return palavras.every((p) => texto.includes(p));
  });
}

// ---------------------------------------------------------------------------
// Ordenação por coluna
// ---------------------------------------------------------------------------

export const COLUNAS_ORDEM = {
  numero: "Número",
  titulo: "Título",
  tipo: "Tipo",
  setor: "Setor",
  categoria: "Categoria",
  responsavel: "Responsável",
  solicitante: "Pedido por",
  prioridade: "Prioridade",
  status: "Status",
  prazo: "Prazo",
  criado: "Aberto em",
} as const;
export type ColunaOrdem = keyof typeof COLUNAS_ORDEM;

export interface Ordem {
  coluna: ColunaOrdem;
  sentido: 1 | -1;
}

/** Padrão: o que vence primeiro em cima. */
export const ORDEM_PADRAO: Ordem = { coluna: "prazo", sentido: 1 };

const ORDEM_STATUS = Object.keys(STATUS) as StatusChamado[];
const ORDEM_TIPO = Object.keys(TIPOS) as TipoChamado[];

function chaveDeOrdem(l: LinhaChamado, c: ColunaOrdem): string | number | null {
  switch (c) {
    case "numero":
      return l.numero;
    case "titulo":
      return l.titulo;
    case "tipo":
      return ORDEM_TIPO.indexOf(l.tipo);
    case "setor":
      return l.setor;
    case "categoria":
      return l.categoria;
    case "responsavel":
      return l.responsavel;
    case "solicitante":
      return l.solicitante;
    case "prioridade":
      return ORDEM_PRIORIDADE[l.prioridade];
    case "status":
      return ORDEM_STATUS.indexOf(l.status);
    case "prazo":
      return l.prazo ? instante(l.prazo).getTime() : null;
    case "criado":
      return instante(l.criadoEm).getTime();
  }
}

/**
 * Ordena sem mexer na lista original. Vazio vai sempre para o fim (nos dois
 * sentidos); no empate, o mais urgente e depois o número.
 */
export function ordenarLinhas(
  linhas: LinhaChamado[],
  o: Ordem = ORDEM_PADRAO,
): LinhaChamado[] {
  return [...linhas].sort((a, b) => {
    const x = chaveDeOrdem(a, o.coluna);
    const y = chaveDeOrdem(b, o.coluna);
    if (x !== y) {
      if (x === null) return 1;
      if (y === null) return -1;
      const r =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
      if (r !== 0) return r * o.sentido;
    }
    return (
      ORDEM_PRIORIDADE[b.prioridade] - ORDEM_PRIORIDADE[a.prioridade] ||
      a.numero - b.numero
    );
  });
}

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

export const AGRUPAMENTOS = {
  responsavel: "Responsável",
  categoria: "Categoria",
  status: "Status",
} as const;
export type Agrupamento = keyof typeof AGRUPAMENTOS;

export type ModoGrupo = "caixa" | Agrupamento | "nenhum";

export interface Grupo {
  chave: string;
  titulo: string;
  /** Destaque do título (atrasado em vermelho, hoje em amarelo). */
  tom?: "atrasado" | "hoje" | "confirmar";
  linhas: LinhaChamado[];
}

/** Ordem dos blocos da Minha caixa. */
const BLOCOS_CAIXA = [
  "confirmar",
  "atrasados",
  "hoje",
  "semana",
  "depois",
  "sem_prazo",
  "com_solicitante",
] as const;

const TITULOS_CAIXA: Record<(typeof BLOCOS_CAIXA)[number], string> = {
  confirmar: "Aguardando minha confirmação",
  ...GRUPOS_CAIXA,
  com_solicitante: "Concluídos, esperando quem pediu",
};

/**
 * Minha caixa: o que espera a minha confirmação primeiro; o que é para
 * fazer, pelo prazo (atrasados, hoje, esta semana, depois, sem prazo); e o
 * que eu já concluí e espera quem pediu, no fim (não é mais trabalho meu).
 */
function blocoDaCaixa(
  l: LinhaChamado,
  c: ContextoLista,
): (typeof BLOCOS_CAIXA)[number] {
  if (l.status === "concluido")
    return l.abertoPor === c.eu ? "confirmar" : "com_solicitante";
  return grupoDaCaixa(l.prazo, c.agora);
}

function agruparPor(
  linhas: LinhaChamado[],
  chave: (l: LinhaChamado) => { chave: string; titulo: string },
  ordem: (a: Grupo, b: Grupo) => number,
): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const l of linhas) {
    const g = chave(l);
    const atual = grupos.get(g.chave) ?? { ...g, linhas: [] };
    atual.linhas.push(l);
    grupos.set(g.chave, atual);
  }
  return [...grupos.values()].sort(ordem);
}

const porTitulo = (a: Grupo, b: Grupo) =>
  a.titulo.localeCompare(b.titulo, "pt-BR");

/** Agrupa mantendo a ordem das linhas dentro de cada grupo. */
export function agrupar(
  linhas: LinhaChamado[],
  modo: ModoGrupo,
  c: ContextoLista,
): Grupo[] {
  switch (modo) {
    case "nenhum":
      return linhas.length ? [{ chave: "todos", titulo: "", linhas }] : [];
    case "caixa":
      return agruparPor(
        linhas,
        (l) => {
          const b = blocoDaCaixa(l, c);
          return { chave: b, titulo: TITULOS_CAIXA[b] };
        },
        (a, b) =>
          BLOCOS_CAIXA.indexOf(a.chave as (typeof BLOCOS_CAIXA)[number]) -
          BLOCOS_CAIXA.indexOf(b.chave as (typeof BLOCOS_CAIXA)[number]),
      ).map((g) => ({
        ...g,
        tom:
          g.chave === "atrasados"
            ? "atrasado"
            : g.chave === "hoje"
              ? "hoje"
              : g.chave === "confirmar"
                ? "confirmar"
                : undefined,
      }));
    case "responsavel":
      // A fila (sem responsável) primeiro: é o que o gestor precisa distribuir.
      return agruparPor(
        linhas,
        (l) => ({
          chave: l.responsavelId ?? "",
          titulo: l.responsavel ?? "Sem responsável",
        }),
        (a, b) => (a.chave === "" ? -1 : b.chave === "" ? 1 : porTitulo(a, b)),
      );
    case "categoria":
      return agruparPor(
        linhas,
        (l) => ({
          chave: l.categoriaId ?? "",
          titulo: l.categoria ?? "Sem categoria",
        }),
        (a, b) => (a.chave === "" ? 1 : b.chave === "" ? -1 : porTitulo(a, b)),
      );
    case "status":
      return agruparPor(
        linhas,
        (l) => ({ chave: l.status, titulo: STATUS[l.status] }),
        (a, b) =>
          ORDEM_STATUS.indexOf(a.chave as StatusChamado) -
          ORDEM_STATUS.indexOf(b.chave as StatusChamado),
      );
  }
}

// ---------------------------------------------------------------------------
// Carga por pessoa (Meu setor): ajuda o gestor a distribuir
// ---------------------------------------------------------------------------

export interface Carga {
  /** null: a fila do setor (sem responsável). */
  id: string | null;
  nome: string;
  abertos: number;
  atrasados: number;
}

/**
 * Abertos e atrasados de cada pessoa do setor (inclusive quem está com zero)
 * e da fila. Quem tem mais vem primeiro; a fila fica no topo se tiver algo.
 */
export function cargaPorPessoa(
  linhas: LinhaChamado[],
  pessoas: { id: string; nome: string }[],
  c: ContextoLista,
): Carga[] {
  const cargas = new Map<string | null, Carga>(
    pessoas.map((p) => [
      p.id,
      { id: p.id, nome: p.nome, abertos: 0, atrasados: 0 },
    ]),
  );
  const fila: Carga = { id: null, nome: "Na fila", abertos: 0, atrasados: 0 };
  for (const l of linhas) {
    if (l.soNoCartao || !EM_ABERTO.includes(l.status)) continue;
    const alvo = l.responsavelId
      ? (cargas.get(l.responsavelId) ??
        cargas
          .set(l.responsavelId, {
            id: l.responsavelId,
            nome: l.responsavel ?? "Sem nome",
            abertos: 0,
            atrasados: 0,
          })
          .get(l.responsavelId))
      : fila;
    if (!alvo) continue;
    alvo.abertos++;
    if (situacao(l, c) === "atrasado") alvo.atrasados++;
  }
  const pessoasOrdenadas = [...cargas.values()].sort(
    (a, b) =>
      b.abertos - a.abertos ||
      b.atrasados - a.atrasados ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return fila.abertos ? [fila, ...pessoasOrdenadas] : pessoasOrdenadas;
}

// ---------------------------------------------------------------------------
// Filtros da barra (URL e preferências de cada usuário)
// ---------------------------------------------------------------------------

export const RECORTES = {
  minha_caixa: "Minha caixa",
  meu_setor: "Meu setor",
  abertos_por_mim: "Abertos por mim",
  todos: "Todos os setores",
} as const;
export type Recorte = keyof typeof RECORTES;

export const VISOES_CALENDARIO = {
  mes: "Mês",
  semana: "Semana",
  dia: "Dia",
} as const;
export type VisaoCalendario = keyof typeof VISOES_CALENDARIO;

const chaves = <T extends Record<string, unknown>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Cada filtro validado sozinho: um valor ruim na URL só some. */
const CAMPOS = {
  tipo: z.enum(chaves(TIPOS)),
  setor: z.guid(),
  categoria: z.guid(),
  responsavel: z.guid(),
  prioridade: z.enum(chaves(PRIORIDADES)),
  /** Sem status: o que não está fechado nem cancelado. */
  status: z.enum([...chaves(STATUS), "todos"] as const),
  etiqueta: z.string().trim().min(1).max(40),
  de: data,
  ate: data,
  agrupar: z.enum(chaves(AGRUPAMENTOS)),
  recorte: z.enum(chaves(RECORTES)),
  visao: z.enum(chaves(VISOES_CALENDARIO)),
  fechados: z.literal("1"),
};

export type CampoFiltro = keyof typeof CAMPOS;
export type Filtros = {
  [K in CampoFiltro]?: z.infer<(typeof CAMPOS)[K]>;
};

export const TELAS = {
  caixa: ["tipo", "setor", "categoria", "prioridade", "etiqueta"],
  setor: [
    "setor",
    "responsavel",
    "categoria",
    "status",
    "prioridade",
    "de",
    "ate",
    "etiqueta",
    "agrupar",
  ],
  abertos: ["tipo", "setor", "status", "prioridade", "etiqueta"],
  quadro: ["recorte", "setor", "tipo", "categoria", "prioridade", "fechados"],
  calendario: ["recorte", "setor", "tipo", "visao"],
} as const satisfies Record<string, readonly CampoFiltro[]>;
export type Tela = keyof typeof TELAS;

/** Chave em core.preferencias dos filtros lembrados de cada tela. */
export const PREFERENCIA_FILTROS: Record<Tela, string> = {
  caixa: "os.caixa.filtros",
  setor: "os.meu_setor.filtros",
  abertos: "os.abertos_por_mim.filtros",
  quadro: "os.quadro.filtros",
  calendario: "os.calendario.filtros",
};

export type Busca = Record<string, unknown>;

/** Filtros válidos da tela, de uma URL ou de uma preferência guardada. */
export function lerFiltros(
  tela: Tela,
  fonte: Busca | null | undefined,
): Filtros {
  const f: Record<string, unknown> = {};
  if (!fonte || typeof fonte !== "object") return {};
  for (const campo of TELAS[tela]) {
    const bruto = fonte[campo];
    const valor = Array.isArray(bruto) ? bruto[0] : bruto;
    const r = CAMPOS[campo].safeParse(valor);
    if (r.success) f[campo] = r.data;
  }
  return f as Filtros;
}

/**
 * A URL traz algum filtro da tela? Sem nenhum, valem os lembrados. "f=0"
 * marca a escolha do padrão (ex.: depois de "Limpar").
 */
export function temFiltrosNaUrl(tela: Tela, busca: Busca): boolean {
  return (
    busca.f !== undefined || TELAS[tela].some((c) => busca[c] !== undefined)
  );
}

/** Chave em core.preferencias do dia em que o "Seu dia" foi visto. */
export const PREFERENCIA_SEU_DIA = "os.seu_dia";

/** Status pedidos ao banco: sem filtro, o que ainda está na fila de alguém. */
export function statusDoFiltro(
  status: Filtros["status"],
): StatusChamado[] | undefined {
  if (status === "todos") return undefined;
  return status ? [status] : STATUS_ABERTOS;
}

/** Filtros → parâmetros da URL (só o que tem valor). */
export function paraParametros(f: Filtros): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, String(v));
  return p;
}

export interface NomesDosFiltros {
  setor?: string | null;
  categoria?: string | null;
  responsavel?: string | null;
}

/**
 * Linha de filtros escrita abaixo do título na exportação e na tela:
 * "Tipo: Ordem de Serviço · Setor: Operações · Status: Em aberto".
 */
export function descreverFiltros(
  tela: Tela,
  f: Filtros,
  nomes: NomesDosFiltros = {},
): string {
  const partes: string[] = [];
  const campos: readonly CampoFiltro[] = TELAS[tela];
  for (const campo of campos) {
    const v = f[campo];
    switch (campo) {
      case "tipo":
        if (f.tipo) partes.push(`Tipo: ${TIPOS[f.tipo]}`);
        break;
      case "setor":
        if (nomes.setor) partes.push(`Setor: ${nomes.setor}`);
        break;
      case "categoria":
        if (nomes.categoria) partes.push(`Categoria: ${nomes.categoria}`);
        break;
      case "responsavel":
        if (nomes.responsavel) partes.push(`Responsável: ${nomes.responsavel}`);
        break;
      case "prioridade":
        if (f.prioridade)
          partes.push(`Prioridade: ${PRIORIDADES[f.prioridade]}`);
        break;
      case "status":
        partes.push(
          `Status: ${!f.status ? "Em aberto" : f.status === "todos" ? "Todos" : STATUS[f.status]}`,
        );
        break;
      case "etiqueta":
        if (f.etiqueta) partes.push(`Etiqueta: ${f.etiqueta}`);
        break;
      case "de":
        if (f.de || f.ate)
          partes.push(
            `Aberto ${f.de ? `de ${dataBr(f.de)}` : ""}${f.de && f.ate ? " " : ""}${f.ate ? `até ${dataBr(f.ate)}` : ""}`,
          );
        break;
      case "recorte":
        partes.push(RECORTES[f.recorte ?? "minha_caixa"]);
        break;
      case "fechados":
        if (v) partes.push("Com os fechados recentes");
        break;
      default:
        break;
    }
  }
  return partes.join(" · ");
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");
