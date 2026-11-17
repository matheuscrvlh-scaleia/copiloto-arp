// Respostas das entrevistas (spec 4.4, Tela 2 e Tela 3): campos
// automáticos, texto de cada resposta (tela, PDF e Excel), colunas da
// planilha "igual ao Forms" com o texto da versão em que cada entrevista foi
// respondida, filtros e as distribuições dos gráficos. Funções puras.

import { formatarData, formatarNumero } from "../formato";
import { SEPARADOR_SETOR } from "./entrevistas-controle";
import {
  type DefinicaoFormulario,
  ehNaoSeAplica,
  NIVEIS_GRADE,
  type Pergunta,
  type Respostas,
} from "./formulario/tipos";
import { respostaVazia } from "./formulario/visibilidade";

/**
 * Perguntas que a tela usa por id (estáveis desde a versão 1; ver
 * questionario-inicial.ts). Se alguma for inativada, o filtro dela some.
 */
export const PERGUNTA = {
  setor: "q3",
  respondente: "q6",
  grau: "q7",
  conhece: "q12",
  clube: "q13",
  pgrs: "q16",
  especiais: "q23",
} as const;

/** Opção "não" da 13: mostra "Apresentar o clube" e o atalho do interesse. */
export const CLUBE_NAO = ["q13_nao", "q13_ainda_nao"] as const;

export function todasAsPerguntas(def: DefinicaoFormulario): Pergunta[] {
  return def.secoes.flatMap((s) => s.perguntas);
}

export function acharPergunta(
  def: DefinicaoFormulario,
  id: string,
): Pergunta | undefined {
  return todasAsPerguntas(def).find((p) => p.id === id);
}

export const ROTULO_TIPO_ENTREVISTA = {
  primeira: "1ª vez",
  atualizacao: "Atualização",
} as const;

/** Valores dos campos automáticos (empresa, LUC, situação, data). */
export function valoresAutomaticos(
  def: DefinicaoFormulario,
  d: {
    empresa: string;
    lucs: readonly string[];
    tipo: keyof typeof ROTULO_TIPO_ENTREVISTA;
    data: string;
  },
): Respostas {
  const fica: Respostas = {};
  for (const p of todasAsPerguntas(def)) {
    if (p.tipo !== "auto" || !p.auto) continue;
    fica[p.id] =
      p.auto === "empresa"
        ? d.empresa
        : p.auto === "luc"
          ? d.lucs.join("/")
          : p.auto === "situacao"
            ? ROTULO_TIPO_ENTREVISTA[d.tipo]
            : d.data;
  }
  return fica;
}

const textoDaOpcao = (p: Pergunta, id: string) =>
  p.opcoes.find((o) => o.id === id)?.texto ?? id;

/** Textos das opções marcadas (uma ou várias). */
export function opcoesMarcadas(p: Pergunta, valor: unknown): string[] {
  if (typeof valor === "string") return [textoDaOpcao(p, valor)];
  if (Array.isArray(valor))
    return valor
      .filter((v) => typeof v === "string")
      .map((v) => textoDaOpcao(p, v));
  return [];
}

/** Setor econômico (pergunta 3) como texto: "Saúde; Gastronômico". */
export function textoDoSetor(
  def: DefinicaoFormulario,
  respostas: Respostas,
): string | null {
  const p = acharPergunta(def, PERGUNTA.setor);
  if (!p) return null;
  const textos = opcoesMarcadas(p, respostas[p.id]);
  return textos.length ? textos.join(SEPARADOR_SETOR) : null;
}

const SIM_NAO: Record<string, string> = { sim: "Sim", nao: "Não" };

/** A resposta como texto (tela, PDF e Excel). Sem resposta: "". */
export function textoDaResposta(p: Pergunta, valor: unknown): string {
  if (ehNaoSeAplica(valor)) return "Não se aplica";
  if (respostaVazia(valor)) return "";
  switch (p.tipo) {
    case "uma":
    case "varias":
      return opcoesMarcadas(p, valor).join("; ");
    case "numero":
      return typeof valor === "number"
        ? formatarNumero(valor, Number.isInteger(valor) ? 0 : 2)
        : String(valor);
    case "reais":
      return typeof valor === "number"
        ? formatarNumero(valor, 2)
        : String(valor);
    case "numero_unidade": {
      const v = valor as { n?: unknown; u?: unknown };
      return typeof v.n === "number"
        ? `${formatarNumero(v.n, Number.isInteger(v.n) ? 0 : 2)} ${String(v.u ?? "")}`.trim()
        : "";
    }
    case "data":
      return typeof valor === "string" ? formatarData(valor) : "";
    case "auto":
      return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
        ? formatarData(valor)
        : String(valor);
    case "sim_nao":
    case "sim_nao_quantidade":
    case "sim_nao_descricao": {
      const v = valor as { r?: string; d?: unknown };
      const r = SIM_NAO[v.r ?? ""] ?? "";
      const d =
        typeof v.d === "number"
          ? formatarNumero(v.d)
          : typeof v.d === "string"
            ? v.d.trim()
            : "";
      return d ? `${r}: ${d}` : r;
    }
    case "grade": {
      const v = valor as Record<string, string>;
      return p.opcoes
        .filter((o) => v[o.id])
        .map(
          (o) =>
            `${o.texto}: ${NIVEIS_GRADE.find((n) => n.id === v[o.id])?.texto ?? v[o.id]}`,
        )
        .join("; ");
    }
    default:
      return typeof valor === "string" ? valor : JSON.stringify(valor);
  }
}

// ---- Planilha "Respostas das entrevistas" (igual ao Forms) ----

export interface ColunaResposta {
  id: string;
  titulo: string;
}

const tituloDe = (p: Pergunta) => `${p.numero}. ${p.texto}`;

/**
 * Uma coluna por pergunta de todas as versões: a ordem da versão mais nova
 * e, logo depois da vizinha, as que só existiram nas antigas. O título é o
 * da versão mais nova que tem a pergunta. `versoes` em qualquer ordem.
 */
export function colunasDasRespostas(
  versoes: readonly { versao: number; definicao: DefinicaoFormulario }[],
): ColunaResposta[] {
  const ordem = [...versoes].sort((a, b) => b.versao - a.versao);
  const colunas: ColunaResposta[] = [];
  const vistas = new Set<string>();
  for (const { definicao } of ordem) {
    let depoisDe = -1;
    for (const p of todasAsPerguntas(definicao)) {
      const ja = colunas.findIndex((c) => c.id === p.id);
      if (ja >= 0) {
        depoisDe = ja;
        continue;
      }
      if (vistas.has(p.id)) continue;
      vistas.add(p.id);
      colunas.splice(depoisDe + 1, 0, { id: p.id, titulo: tituloDe(p) });
      depoisDe++;
    }
  }
  return colunas;
}

/** Células de uma entrevista, com o texto da versão em que foi respondida. */
export function celulasDasRespostas(
  def: DefinicaoFormulario,
  respostas: Respostas,
  colunas: readonly ColunaResposta[],
): string[] {
  const mapa = new Map(todasAsPerguntas(def).map((p) => [p.id, p]));
  return colunas.map((c) => {
    const p = mapa.get(c.id);
    return p ? textoDaResposta(p, respostas[c.id]) : "";
  });
}

// ---- Filtros da Tela 3 ----

export interface EntrevistaParaFiltro {
  data: string;
  tipo: string;
  bloco: string | null;
  respostas: Respostas;
}

export interface FiltrosRespostas {
  de: string;
  ate: string;
  tipo: string;
  /** Ids de opção (estáveis entre versões). */
  setor: string;
  grau: string;
  pgrs: string;
  clube: string;
  especial: string;
  bloco: string;
}

/** A resposta tem a opção (uma: igual; várias: contém). */
export function marcou(valor: unknown, opcao: string): boolean {
  return Array.isArray(valor) ? valor.includes(opcao) : valor === opcao;
}

export function filtrarRespostas<T extends EntrevistaParaFiltro>(
  lista: readonly T[],
  f: FiltrosRespostas,
): T[] {
  const opcao = (e: T, pergunta: string, valor: string) =>
    !valor || marcou(e.respostas[pergunta], valor);
  return lista.filter(
    (e) =>
      e.data >= f.de &&
      e.data <= f.ate &&
      (!f.tipo || e.tipo === f.tipo) &&
      (!f.bloco || e.bloco === f.bloco) &&
      opcao(e, PERGUNTA.setor, f.setor) &&
      opcao(e, PERGUNTA.grau, f.grau) &&
      opcao(e, PERGUNTA.pgrs, f.pgrs) &&
      opcao(e, PERGUNTA.clube, f.clube) &&
      opcao(e, PERGUNTA.especiais, f.especial),
  );
}

// ---- Gráficos das perguntas marcadas como fonte de indicador ----

export interface Fatia {
  id: string;
  texto: string;
  n: number;
}

export interface Distribuicao {
  pergunta: Pergunta;
  /** Entrevistas com resposta (sem "Não se aplica" e sem vazio). */
  respondidas: number;
  /** uma/várias: uma fatia por opção. Grade: uma por linha × nível. */
  fatias: Fatia[];
  /** Só na grade: contagem por linha e nível. */
  grade?: { linha: string; niveis: Record<string, number> }[];
}

/**
 * Contagem das respostas de uma pergunta (uma, várias ou grade). Opções
 * inativas só aparecem se alguém marcou.
 */
export function distribuicao(
  p: Pergunta,
  lista: readonly Respostas[],
): Distribuicao | null {
  if (p.tipo !== "uma" && p.tipo !== "varias" && p.tipo !== "grade")
    return null;
  const validas = lista
    .map((r) => r[p.id])
    .filter((v) => !respostaVazia(v) && !ehNaoSeAplica(v));
  if (p.tipo === "grade") {
    const grade = p.opcoes.map((o) => {
      const niveis: Record<string, number> = {};
      for (const n of NIVEIS_GRADE) niveis[n.id] = 0;
      for (const v of validas) {
        const nivel = (v as Record<string, string>)[o.id];
        if (nivel && nivel in niveis) niveis[nivel] = (niveis[nivel] ?? 0) + 1;
      }
      return { linha: o.texto, niveis, ativa: o.ativa };
    });
    return {
      pergunta: p,
      respondidas: validas.length,
      fatias: [],
      grade: grade
        .filter((g) => g.ativa || Object.values(g.niveis).some((n) => n > 0))
        .map(({ linha, niveis }) => ({ linha, niveis })),
    };
  }
  const fatias = p.opcoes
    .map((o) => ({
      id: o.id,
      texto: o.texto,
      n: validas.filter((v) => marcou(v, o.id)).length,
      ativa: o.ativa,
    }))
    .filter((f) => f.ativa || f.n > 0)
    .map(({ id, texto, n }) => ({ id, texto, n }));
  return { pergunta: p, respondidas: validas.length, fatias };
}

/** Opções de filtro de uma pergunta (ativas, na ordem do questionário). */
export function opcoesDaPergunta(
  def: DefinicaoFormulario | null,
  id: string,
): { valor: string; rotulo: string }[] {
  const p = def ? acharPergunta(def, id) : undefined;
  if (!p || !p.ativa) return [];
  return p.opcoes
    .filter((o) => o.ativa)
    .map((o) => ({ valor: o.id, rotulo: o.texto }));
}
