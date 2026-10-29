import { z } from "zod";
import { formatarDataHora } from "@/lib/formato";
import type { CelulaExportar, ColunaExportar } from "./exportar";
import {
  GRUPOS_CAIXA,
  grupoDaCaixa,
  SITUACOES_PRAZO,
  situacaoDoPrazo,
} from "./prazo";
import {
  MOTIVOS_AGUARDANDO,
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
import {
  deBrasilia,
  hojeEmBrasilia,
  instante,
  paraBrasilia,
  somarDias,
} from "./tempo";

// Listas do dia a dia (Minha caixa, Meu setor, Abertos por mim, Quadro e
// Calendário): filtros da barra, cartões que filtram, busca, ordenação,
// grupos e a carga por pessoa. Regras puras; o servidor monta as linhas e
// pagina no banco (o critério dos cartões, a busca e a ordem viram filtro).

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
  ordem: ((a: Grupo, b: Grupo) => number) | null,
): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const l of linhas) {
    const g = chave(l);
    const atual = grupos.get(g.chave) ?? { ...g, linhas: [] };
    atual.linhas.push(l);
    grupos.set(g.chave, atual);
  }
  return ordem ? [...grupos.values()].sort(ordem) : [...grupos.values()];
}

const porTitulo = (a: Grupo, b: Grupo) =>
  a.titulo.localeCompare(b.titulo, "pt-BR");

/**
 * Agrupa mantendo a ordem das linhas dentro de cada grupo. Numa página que
 * o banco já ordenou pelo grupo (`naOrdemDasLinhas`), responsável e
 * categoria saem na ordem em que aparecem: o grupo que continua da página
 * anterior fica em cima, e não no meio pela ordem alfabética.
 */
export function agrupar(
  linhas: LinhaChamado[],
  modo: ModoGrupo,
  c: ContextoLista,
  opcoes: { naOrdemDasLinhas?: boolean } = {},
): Grupo[] {
  const naOrdem = opcoes.naOrdemDasLinhas ?? false;
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
        naOrdem
          ? null
          : (a, b) =>
              a.chave === "" ? -1 : b.chave === "" ? 1 : porTitulo(a, b),
      );
    case "categoria":
      return agruparPor(
        linhas,
        (l) => ({
          chave: l.categoriaId ?? "",
          titulo: l.categoria ?? "Sem categoria",
        }),
        naOrdem
          ? null
          : (a, b) =>
              a.chave === "" ? 1 : b.chave === "" ? -1 : porTitulo(a, b),
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
  return ordenarCarga([...cargas.values()], fila);
}

/**
 * Carga do Meu setor a partir das contagens por responsável (o banco já
 * filtrou e contou: barra, "Em aberto" e atrasados; null é a fila). Só
 * entram as pessoas do setor (inclusive quem está com zero) e a fila; quem
 * tem mais vem primeiro.
 */
export function cargaDasContagens(
  contagens: {
    responsavel_id: string | null;
    abertos: number;
    atrasados: number;
  }[],
  membros: { id: string; nome: string }[],
): Carga[] {
  const cargas = new Map<string | null, Carga>([
    ...membros.map((p): [string, Carga] => [
      p.id,
      { id: p.id, nome: p.nome, abertos: 0, atrasados: 0 },
    ]),
    [null, { id: null, nome: "Na fila", abertos: 0, atrasados: 0 }],
  ]);
  for (const c of contagens) {
    const alvo = cargas.get(c.responsavel_id);
    if (!alvo) continue;
    alvo.abertos += c.abertos;
    alvo.atrasados += c.atrasados;
  }
  const fila = cargas.get(null) as Carga;
  cargas.delete(null);
  return ordenarCarga([...cargas.values()], fila);
}

/**
 * Carga já contada (no banco, por pessoa): quem tem mais vem primeiro; a
 * fila fica no topo se tiver algo.
 */
export function ordenarCarga(pessoas: Carga[], fila: Carga): Carga[] {
  const ordenadas = [...pessoas].sort(
    (a, b) =>
      b.abertos - a.abertos ||
      b.atrasados - a.atrasados ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return fila.abertos ? [fila, ...ordenadas] : ordenadas;
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
  /** De / até escolhidos (filtros "de" e "ate"). */
  periodo: "Período",
} as const;
export type VisaoCalendario = keyof typeof VISOES_CALENDARIO;

const chaves = <T extends Record<string, unknown>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Cada filtro validado sozinho: um valor ruim na URL só some. */
const CAMPOS = {
  tipo: z.enum(chaves(TIPOS)),
  setor: z.guid(),
  /** Geral: um ou mais setores, separados por vírgula (sem: todos). */
  setores: z
    .string()
    .refine((s) => s.split(",").every((id) => z.guid().safeParse(id).success)),
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
  /** Só os que eu abri (na Minha caixa, troca a lista por eles). */
  aberto_por: z.literal("eu"),
};

export type CampoFiltro = keyof typeof CAMPOS;
export type Filtros = {
  [K in CampoFiltro]?: z.infer<(typeof CAMPOS)[K]>;
};

export const TELAS = {
  caixa: [
    "aberto_por",
    "tipo",
    "setor",
    "categoria",
    "status",
    "prioridade",
    "etiqueta",
  ],
  setor: [
    "setores",
    "responsavel",
    "categoria",
    "status",
    "prioridade",
    "de",
    "ate",
    "etiqueta",
    "agrupar",
    "aberto_por",
  ],
  quadro: ["recorte", "setor", "tipo", "categoria", "prioridade", "fechados"],
  calendario: ["recorte", "setor", "tipo", "visao", "de", "ate"],
  /** A Minha caixa só dos avisos (que não aparecem nas outras abas). */
  avisos: [
    "aberto_por",
    "setor",
    "categoria",
    "status",
    "prioridade",
    "etiqueta",
  ],
} as const satisfies Record<string, readonly CampoFiltro[]>;
export type Tela = keyof typeof TELAS;

/** Chave em core.preferencias dos filtros lembrados de cada tela. */
export const PREFERENCIA_FILTROS: Record<Tela, string> = {
  caixa: "os.caixa.filtros",
  setor: "os.meu_setor.filtros",
  quadro: "os.quadro.filtros",
  calendario: "os.calendario.filtros",
  avisos: "os.avisos.filtros",
};

/** Telas com lista paginada (a de Avisos é a Minha caixa dos avisos). */
export type TelaComLista = "caixa" | "setor" | "avisos";

/** Tipos das abas de tickets: os avisos têm a aba deles; a OS, a tela dela. */
export const TIPOS_SEM_AVISO = (Object.keys(TIPOS) as TipoChamado[]).filter(
  (t) => t !== "aviso" && t !== "os",
);

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
  setores?: string[] | null;
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
      case "setores":
        if (nomes.setores?.length)
          partes.push(
            `${nomes.setores.length > 1 ? "Setores" : "Setor"}: ${nomes.setores.join(", ")}`,
          );
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
        // A Minha caixa só tem status na lista dos abertos por mim.
        if ((tela === "caixa" || tela === "avisos") && !f.aberto_por) break;
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
      case "aberto_por":
        if (v) partes.push("Abertos por mim");
        break;
      default:
        break;
    }
  }
  return partes.join(" · ");
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

// ---------------------------------------------------------------------------
// Lista paginada no servidor: cartões, busca e ordem viram filtro do banco
// ---------------------------------------------------------------------------

/** Listas com cartões, busca e paginação (o Quadro pagina por coluna). */
export type TelaLista = "caixa" | "setor" | "abertos";

/** Cartões de cada lista (no máximo 4), na ordem da tela. */
export const CARTOES_DA_TELA: Record<TelaLista, readonly ChaveCartao[]> = {
  caixa: ["atrasados", "vence_hoje", "aguardando_confirmacao", "em_andamento"],
  setor: ["sem_responsavel", "atrasados", "abertos", "concluidos_mes"],
  abertos: [
    "aguardando_confirmacao",
    "em_andamento",
    "atrasados",
    "fechados_mes",
  ],
};

export interface ColunasVisiveis {
  setor?: boolean;
  solicitante?: boolean;
  responsavel?: boolean;
}

/** Colunas de cada lista (a tela e a exportação usam as mesmas). */
export const COLUNAS_DA_TELA: Record<TelaLista, ColunasVisiveis> = {
  caixa: { setor: true, solicitante: true },
  setor: { solicitante: true },
  abertos: { setor: true },
};

/** Cartão da URL, se for um dos cartões da tela. */
export function lerCartao(tela: TelaLista, valor: unknown): ChaveCartao | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return CARTOES_DA_TELA[tela].find((c) => c === v) ?? null;
}

/**
 * O que um cartão conta, como filtro do banco (as mesmas regras de
 * CARTOES[...].testa). `foraDaBarra`: o status da barra não vale (os
 * encerrados no mês aparecem mesmo com a barra em "Em aberto").
 */
export interface CriterioCartao {
  status: StatusChamado[];
  foraDaBarra?: boolean;
  abertoPor?: string;
  semResponsavel?: boolean;
  /** Prazo a partir de / antes de (ISO). */
  prazoDesde?: string;
  prazoAntes?: string;
  /** Encerrado a partir de (ISO), no campo indicado. */
  encerradoDesde?: { campo: "concluido_em" | "fechado_em"; iso: string };
}

/** Começo do mês corrente em Brasília (ISO). */
export function inicioDoMes(agora: Date): string {
  return deBrasilia(`${hojeEmBrasilia(agora).slice(0, 7)}-01`).toISOString();
}

export function criterioDoCartao(
  cartao: ChaveCartao,
  c: Pick<ContextoLista, "agora" | "eu">,
): CriterioCartao {
  const agora = c.agora.toISOString();
  switch (cartao) {
    case "atrasados":
      return { status: EM_ABERTO, prazoAntes: agora };
    case "vence_hoje":
      // Ainda à frente e no mesmo dia em Brasília (não encerrado).
      return {
        status: EM_ABERTO,
        prazoDesde: agora,
        prazoAntes: deBrasilia(
          somarDias(hojeEmBrasilia(c.agora), 1),
        ).toISOString(),
      };
    case "aguardando_confirmacao":
      return { status: ["concluido"], abertoPor: c.eu };
    case "em_andamento":
      return { status: ["em_andamento"] };
    case "sem_responsavel":
      return { status: EM_ABERTO, semResponsavel: true };
    case "abertos":
      return { status: EM_ABERTO };
    case "concluidos_mes":
      return {
        status: ["concluido", "fechado"],
        foraDaBarra: true,
        encerradoDesde: { campo: "concluido_em", iso: inicioDoMes(c.agora) },
      };
    case "fechados_mes":
      return {
        status: ["fechado"],
        foraDaBarra: true,
        encerradoDesde: { campo: "fechado_em", iso: inicioDoMes(c.agora) },
      };
  }
}

/**
 * Status pedidos ao banco com o cartão: o que a barra pede E o que o cartão
 * conta (vazio: nada passa). Sem barra, ou fora dela, só o do cartão.
 */
export function statusComCartao(
  barra: StatusChamado[] | undefined,
  criterio: CriterioCartao,
): StatusChamado[] {
  if (!barra?.length || criterio.foraDaBarra) return criterio.status;
  return criterio.status.filter((s) => barra.includes(s));
}

/** Busca da URL (?q=), aparada e com tamanho limitado. */
export function lerBusca(valor: unknown): string {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return typeof v === "string" ? v.trim().slice(0, 80) : "";
}

/**
 * Busca do topo da lista → um filtro `.or()` por palavra (o banco exige
 * todas): título ou descrição contém a palavra, ou o número é ela (#123).
 * Vírgula, parênteses, aspas e dois-pontos são sintaxe do PostgREST; `*` e
 * `%` são curingas: tudo isso vira espaço.
 */
export function filtrosDaBusca(texto: string): string[] {
  return texto
    .replace(/[,()"\\:*%]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((palavra) => {
      const p = palavra.slice(0, 40);
      const partes = [`titulo.ilike.*${p}*`, `descricao.ilike.*${p}*`];
      const n = p.replace(/^#/, "");
      if (/^\d{1,9}$/.test(n)) partes.push(`numero.eq.${n}`);
      return partes.join(",");
    });
}

/** Colunas que o banco sabe ordenar (nomes de setor e de pessoas, não). */
export const COLUNAS_NO_BANCO = {
  numero: "numero",
  titulo: "titulo",
  prioridade: "prioridade",
  prazo: "prazo",
  status: "status",
  criado: "criado_em",
} as const satisfies Partial<Record<ColunaOrdem, string>>;
export type ColunaOrdemBanco = keyof typeof COLUNAS_NO_BANCO;

export const ordenavelNoBanco = (c: ColunaOrdem): c is ColunaOrdemBanco =>
  c in COLUNAS_NO_BANCO;

/** Ordem da URL (?ordem=prazo.desc); inválida vira null (a padrão). */
export function lerOrdem(valor: unknown): Ordem | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  if (typeof v !== "string") return null;
  const [coluna, sentido] = v.split(".");
  if (!coluna || !(coluna in COLUNAS_NO_BANCO)) return null;
  if (sentido !== "asc" && sentido !== "desc") return null;
  return {
    coluna: coluna as ColunaOrdemBanco,
    sentido: sentido === "asc" ? 1 : -1,
  };
}

export const ordemNaUrl = (o: Ordem): string =>
  `${o.coluna}.${o.sentido === 1 ? "asc" : "desc"}`;

/** Um passo do `.order()` do banco. */
export interface PassoOrdem {
  coluna: string;
  asc: boolean;
  nullsFirst: boolean;
}

/**
 * Grupo de cada lista. A caixa só agrupa na ordem padrão (pelo prazo):
 * ordenada por outra coluna, os blocos de prazo se espalhariam pelas
 * páginas, então ela vira uma lista corrida.
 */
export function modoDaLista(
  tela: TelaLista,
  agrupar: Agrupamento | undefined,
  ordem: Ordem | null,
): ModoGrupo {
  if (tela === "caixa")
    return !ordem || (ordem.coluna === "prazo" && ordem.sentido === 1)
      ? "caixa"
      : "nenhum";
  if (tela === "setor") return agrupar ?? "responsavel";
  return "status";
}

/**
 * Ordem da página no banco: primeiro a coluna do grupo (os grupos saem em
 * sequência entre as páginas), depois a escolhida (padrão: prazo; vazio
 * sempre no fim) e, no empate, o mais urgente e o número (ordem estável).
 */
export function ordemDaConsulta(
  modo: ModoGrupo,
  ordem: Ordem | null,
): PassoOrdem[] {
  const passos: PassoOrdem[] = [];
  if (modo === "responsavel")
    passos.push({ coluna: "responsavel_id", asc: true, nullsFirst: true });
  else if (modo === "categoria")
    passos.push({ coluna: "categoria_id", asc: true, nullsFirst: false });
  else if (modo === "status")
    passos.push({ coluna: "status", asc: true, nullsFirst: false });
  const o = ordem && ordenavelNoBanco(ordem.coluna) ? ordem : ORDEM_PADRAO;
  const coluna = COLUNAS_NO_BANCO[o.coluna as ColunaOrdemBanco];
  passos.push({ coluna, asc: o.sentido === 1, nullsFirst: false });
  if (coluna !== "prioridade")
    passos.push({ coluna: "prioridade", asc: false, nullsFirst: false });
  if (coluna !== "numero")
    passos.push({ coluna: "numero", asc: true, nullsFirst: false });
  return passos;
}

// ---------------------------------------------------------------------------
// Período de abertura (painel de filtros): atalhos ou datas escolhidas
// ---------------------------------------------------------------------------

export const ATALHOS_PERIODO = {
  mes: "Este mês",
  dias30: "Últimos 30 dias",
  ano: "Este ano",
} as const;
export type AtalhoPeriodo = keyof typeof ATALHOS_PERIODO;

/** De / até (aaaa-mm-dd) do atalho, contado a partir de hoje (Brasília). */
export function periodoDoAtalho(
  atalho: AtalhoPeriodo,
  hoje: string,
): { de: string; ate: string } {
  switch (atalho) {
    case "mes":
      return { de: `${hoje.slice(0, 7)}-01`, ate: hoje };
    case "dias30":
      return { de: somarDias(hoje, -29), ate: hoje };
    case "ano":
      return { de: `${hoje.slice(0, 4)}-01-01`, ate: hoje };
  }
}

/** Que atalho as datas formam (null: sem período; "personalizado": outras). */
export function atalhoDoPeriodo(
  de: string | undefined,
  ate: string | undefined,
  hoje: string,
): AtalhoPeriodo | "personalizado" | null {
  if (!de && !ate) return null;
  for (const a of Object.keys(ATALHOS_PERIODO) as AtalhoPeriodo[]) {
    const p = periodoDoAtalho(a, hoje);
    if (p.de === de && p.ate === ate) return a;
  }
  return "personalizado";
}

/** "Este mês", "01/10/2026 a 15/10/2026", "Desde 01/10/2026"… */
export function descreverPeriodo(
  de: string | undefined,
  ate: string | undefined,
  hoje: string,
): string | null {
  const atalho = atalhoDoPeriodo(de, ate, hoje);
  if (!atalho) return null;
  if (atalho !== "personalizado") return ATALHOS_PERIODO[atalho];
  if (de && ate) return `${dataBr(de)} a ${dataBr(ate)}`;
  return de ? `Desde ${dataBr(de)}` : `Até ${dataBr(ate ?? "")}`;
}

// ---------------------------------------------------------------------------
// Exportação: o resultado filtrado inteiro, agrupado como na tela
// ---------------------------------------------------------------------------

export function paraExportar(
  grupos: Grupo[],
  modo: ModoGrupo,
  colunas: ColunasVisiveis,
  ctx: Pick<ContextoLista, "agora" | "avisoHoras">,
): { colunas: ColunaExportar[]; linhas: CelulaExportar[][] } {
  const comGrupo = modo !== "nenhum";
  const cols: ColunaExportar[] = [
    ...(comGrupo ? [{ titulo: "Grupo" }] : []),
    { titulo: "Número", numero: true },
    { titulo: "Tipo" },
    { titulo: "Título" },
    ...(colunas.setor ? [{ titulo: "Setor" }] : []),
    { titulo: "Categoria" },
    ...(colunas.solicitante ? [{ titulo: "Pedido por" }] : []),
    ...(colunas.responsavel !== false ? [{ titulo: "Responsável" }] : []),
    { titulo: "Prioridade" },
    { titulo: "Prazo" },
    { titulo: "Situação do prazo" },
    { titulo: "Status" },
    { titulo: "Aberto em" },
  ];
  const linhas = grupos.flatMap((g) =>
    g.linhas.map((l) => [
      ...(comGrupo ? [g.titulo] : []),
      l.numero,
      TIPOS[l.tipo],
      l.titulo,
      ...(colunas.setor ? [l.setor] : []),
      l.categoria ?? "",
      ...(colunas.solicitante ? [l.solicitante ?? ""] : []),
      ...(colunas.responsavel !== false ? [l.responsavel ?? "Na fila"] : []),
      PRIORIDADES[l.prioridade],
      l.prazo ? formatarDataHora(l.prazo) : "",
      SITUACOES_PRAZO[situacaoDoPrazo(l, ctx.agora, ctx.avisoHoras)],
      `${STATUS[l.status]}${l.aguardando ? ` (${MOTIVOS_AGUARDANDO[l.aguardando]})` : ""}${l.destinos ? ` · ${l.destinos.texto}` : ""}`,
      formatarDataHora(l.criadoEm),
    ]),
  );
  return { colunas: cols, linhas };
}
