import type { Tom } from "@/components/estilos";
import type { Detalhe, TabelaDetalhe } from "@/components/modal-detalhe";
import { formatarData } from "@/lib/formato";
import type { Direcao, Status } from "@/lib/indicadores";
import { formatarNumeroChamado } from "@/lib/os/numeros";

// O que um painel mostra, já calculado no servidor e pronto para virar tela
// ou PDF. Os chamados vão uma vez só (linhas); cada número leva só os ids
// de quem o forma, e o modal monta a lista no navegador. Assim a lista que
// abre tem exatamente a quantidade do número.

/** Um chamado como aparece nas listas dos painéis (textos prontos). */
export interface LinhaChamado {
  id: string;
  numero: number;
  titulo: string;
  setor: string;
  categoria: string;
  status: string;
  responsavel: string;
  /** aaaa-mm-dd (Brasília). */
  aberto: string;
  prazo: string | null;
  concluido: string | null;
  exemplo: boolean;
}

/** Coluna a mais numa lista (ex.: dias em aberto, custo da OS). */
export interface ColunaExtra {
  titulo: string;
  numero?: boolean;
  valores: Record<string, string>;
  /** Para ordenar pela coluna (ex.: minutos em vez de "2h 10min"). */
  ordem?: Record<string, number>;
}

export interface ParteLista {
  titulo?: string;
  ids: string[];
  extra?: ColunaExtra;
  vazio?: string;
}

/** Os chamados que formam um número (abre no modal de detalhe). */
export interface ListaChamados {
  tipo: "chamados";
  secao?: string;
  titulo: string;
  subtitulo?: string;
  resumo?: { rotulo: string; valor: string }[];
  fontes?: { rotulo: string; valor: string }[];
  partes: ParteLista[];
  link?: { href: string; rotulo: string };
  /** Sem a coluna Setor (painel de um setor só). */
  semSetor?: boolean;
}

/** Lista de chamados ou um detalhe pronto (ativos, vistorias, agenda). */
export type Origem = ListaChamados | Detalhe;

export function ehLista(o: Origem): o is ListaChamados {
  return (o as ListaChamados).tipo === "chamados";
}

export interface ItemBloco {
  chave: string;
  rotulo: string;
  valor: number;
  texto: string;
  titulo?: string;
  detalhe?: string;
  destaque?: boolean;
  origem?: Origem;
  /** Posição fixa na paleta (rosca). */
  cor?: 1 | 2 | 3 | 4 | 5 | "neutro";
}

export interface NumeroBloco {
  rotulo: string;
  valor: string;
  detalhe?: string;
  status?: Status;
  direcao?: Direcao;
  /** Destaque vermelho (atrasos), sempre com texto. */
  alerta?: boolean;
  origem?: Origem;
}

export interface CelulaTabela {
  texto: string;
  origem?: Origem;
  status?: Status;
  direcao?: Direcao;
}

export type Conteudo =
  | {
      tipo: "barras";
      itens: ItemBloco[];
      meta?: { valor: number; texto: string };
      vazio?: string;
      rotuloLargo?: boolean;
    }
  | { tipo: "colunas"; itens: ItemBloco[]; rotularTodas?: boolean }
  | {
      tipo: "espelhadas";
      itens: {
        chave: string;
        rotulo: string;
        titulo: string;
        acima: number;
        abaixo: number;
        origem?: Origem;
      }[];
      rotulos: { acima: string; abaixo: string };
    }
  | {
      tipo: "rosca";
      itens: ItemBloco[];
      centro: { valor: string; rotulo: string };
    }
  | { tipo: "faixas"; itens: ItemBloco[] }
  | { tipo: "numeros"; numeros: NumeroBloco[] }
  | {
      tipo: "tabela";
      colunas: { titulo: string; numero?: boolean }[];
      linhas: { chave: string; celulas: CelulaTabela[] }[];
      vazio?: string;
    }
  | {
      tipo: "matriz";
      origens: { chave: string; rotulo: string }[];
      destinos: { chave: string; rotulo: string }[];
      /** "origem>destino" → quantidade e quem forma. */
      celulas: Record<string, { n: number; origem: Origem }>;
      vazio?: string;
    }
  | { tipo: "texto"; texto: string };

export interface Bloco {
  id: string;
  titulo: string;
  descricao?: string;
  /** Colunas da grade de 12 no computador. */
  largura?: 4 | 5 | 6 | 7 | 8 | 12;
  tom?: Tom;
  partes: Conteudo[];
  /** Aviso embaixo (ex.: período sem a medida no sistema anterior). */
  nota?: string;
  /** Lista do bloco para o botão Excel (só com os.exportar). */
  exportar?: ListaChamados;
  links?: { href: string; rotulo: string }[];
}

export interface CartaoPainel {
  titulo: string;
  valor: string;
  detalhe?: string;
  meta?: string;
  status?: Status;
  direcao?: Direcao;
  tom?: Tom;
  origem?: Origem;
}

export interface PainelMontado {
  titulo: string;
  rotulo: string;
  atualizadoAs: string;
  temExemplo: boolean;
  cartoes: CartaoPainel[];
  blocos: Bloco[];
  linhas: LinhaChamado[];
  avisos: string[];
}

// ---------------------------------------------------------------------------
// Lista → modal e Excel
// ---------------------------------------------------------------------------

const COLUNAS = [
  "Nº",
  "Título",
  "Setor",
  "Categoria",
  "Status",
  "Responsável",
  "Aberto em",
  "Prazo",
  "Concluído em",
] as const;

/** Colunas e células de uma parte da lista (modal e Excel usam as mesmas). */
export function tabelaDaParte(
  parte: ParteLista,
  linhas: Map<string, LinhaChamado>,
  semSetor = false,
): {
  colunas: string[];
  numericas: Set<string>;
  linhas: TabelaDetalhe["linhas"];
} {
  const colunas = COLUNAS.filter((c) => !(semSetor && c === "Setor"));
  const todas = parte.extra ? [...colunas, parte.extra.titulo] : [...colunas];
  return {
    colunas: todas,
    numericas: new Set(parte.extra?.numero ? [parte.extra.titulo] : []),
    linhas: parte.ids.flatMap((id) => {
      const l = linhas.get(id);
      if (!l) return [];
      const valores: Record<(typeof COLUNAS)[number], string> = {
        Nº: `${formatarNumeroChamado(l.numero)}${l.exemplo ? " (exemplo)" : ""}`,
        Título: l.titulo,
        Setor: l.setor,
        Categoria: l.categoria,
        Status: l.status,
        Responsável: l.responsavel,
        "Aberto em": formatarData(l.aberto),
        Prazo: l.prazo ? formatarData(l.prazo) : "Sem prazo",
        "Concluído em": l.concluido ? formatarData(l.concluido) : "—",
      };
      const ordens: Record<(typeof COLUNAS)[number], string | number | null> = {
        Nº: l.numero,
        Título: l.titulo,
        Setor: l.setor,
        Categoria: l.categoria,
        Status: l.status,
        Responsável: l.responsavel,
        "Aberto em": l.aberto,
        Prazo: l.prazo,
        "Concluído em": l.concluido,
      };
      const extra = parte.extra;
      return [
        {
          chave: id,
          celulas: [
            ...colunas.map((c) => valores[c]),
            ...(extra ? [extra.valores[id] ?? "—"] : []),
          ],
          ordem: [
            ...colunas.map((c) => ordens[c]),
            ...(extra ? [extra.ordem?.[id] ?? extra.valores[id] ?? null] : []),
          ],
        },
      ];
    }),
  };
}

/** A lista vira o detalhe do modal padrão do sistema. */
export function detalheDaLista(
  lista: ListaChamados,
  linhas: Map<string, LinhaChamado>,
): Detalhe {
  return {
    secao: lista.secao,
    titulo: lista.titulo,
    subtitulo: lista.subtitulo,
    resumo: lista.resumo,
    fontes: lista.fontes,
    link: lista.link,
    tabelas: lista.partes.map((p) => {
      const t = tabelaDaParte(p, linhas, lista.semSetor);
      return {
        titulo: lista.partes.length > 1 ? p.titulo : undefined,
        colunas: t.colunas.map((c) => ({
          titulo: c,
          numero: c === "Nº" || t.numericas.has(c),
        })),
        linhas: t.linhas,
        vazio: p.vazio ?? "Nenhum chamado.",
      };
    }),
  };
}
