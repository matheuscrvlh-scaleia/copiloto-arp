import { formatarData, formatarNumero } from "@/lib/formato";
import type {
  DefinicaoFormulario,
  Pergunta,
  Respostas,
} from "./formulario/tipos";
import {
  ehNaoSeAplica,
  NIVEIS_GRADE,
  validarRespostas,
} from "./formulario/tipos";
import { respostasVisiveis, respostaVazia } from "./formulario/visibilidade";
import { numeroDoValor } from "./indicadores";

// Lançamento dos programas (spec 4.8): os campos do tipo "reais" ficam em
// `lancamento_valores` (RLS "Ver valores"), o resto em `lancamentos.valores`.
// O servidor separa ao gravar e junta ao ler. Funções puras.

const perguntas = (def: DefinicaoFormulario): Pergunta[] =>
  def.secoes.flatMap((s) => s.perguntas);

/** Ids dos campos em reais da definição (ativos ou não). */
export function camposReais(def: DefinicaoFormulario): Set<string> {
  return new Set(
    perguntas(def)
      .filter((p) => p.tipo === "reais")
      .map((p) => p.id),
  );
}

/**
 * Separa as respostas: `valores` (vão para `lancamentos.valores`) e `reais`
 * (`{ campo_id: número }`, vão para `lancamento_valores`). Resposta de campo
 * em reais que não é número fica fora dos dois.
 */
export function separarReais(
  def: DefinicaoFormulario,
  respostas: Respostas,
): { valores: Respostas; reais: Record<string, number> } {
  const ids = camposReais(def);
  const valores: Respostas = {};
  const reais: Record<string, number> = {};
  for (const [k, v] of Object.entries(respostas)) {
    if (!ids.has(k)) valores[k] = v;
    else {
      const n = numeroDoValor(v);
      if (n !== null) reais[k] = n;
    }
  }
  return { valores, reais };
}

/** Junta as duas partes; sem permissão de valores (`reais` null), só os comuns. */
export function juntarReais(
  valores: Readonly<Respostas>,
  reais: Readonly<Record<string, unknown>> | null | undefined,
): Respostas {
  return { ...valores, ...(reais ?? {}) };
}

/**
 * Definição para quem não tem "Ver valores": os campos em reais saem
 * (inativos não aparecem nem são cobrados).
 */
export function definicaoSemReais(
  def: DefinicaoFormulario,
): DefinicaoFormulario {
  return {
    secoes: def.secoes.map((s) => ({
      ...s,
      perguntas: s.perguntas.map((p) =>
        p.tipo === "reais" ? { ...p, ativa: false } : p,
      ),
    })),
  };
}

/** Data do fato: o primeiro campo de data ativo e preenchido; null se não há. */
export function dataDoLancamento(
  def: DefinicaoFormulario,
  respostas: Respostas,
): string | null {
  for (const p of perguntas(def)) {
    if (!p.ativa || p.tipo !== "data") continue;
    const v = respostas[p.id];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  }
  return null;
}

/** O formulário tem campo de data ativo (senão a tela pede a data à parte). */
export function temCampoDeData(def: DefinicaoFormulario): boolean {
  return perguntas(def).some((p) => p.ativa && p.tipo === "data");
}

export interface CustoPorPessoa {
  /** Campo do número de pessoas (ex.: "participantes"). */
  pessoas: string;
  /** Campo em reais → custo por pessoa (dos Parâmetros). */
  custos: Record<string, number>;
}

/**
 * Pré-preenche os custos por pessoa (tour: álbum e copo, valores dos
 * Parâmetros × participantes) só nos campos em reais vazios: o que a
 * pessoa digitou fica (a planilha às vezes cobra o copo de parte do grupo).
 */
export function preencherCustosPorPessoa(
  def: DefinicaoFormulario,
  respostas: Respostas,
  regra: CustoPorPessoa,
): Respostas {
  const reais = camposReais(def);
  const pessoas = numeroDoValor(respostas[regra.pessoas]);
  if (pessoas === null || !perguntas(def).some((p) => p.id === regra.pessoas))
    return respostas;
  const saida = { ...respostas };
  for (const [campo, porPessoa] of Object.entries(regra.custos)) {
    if (!reais.has(campo) || !respostaVazia(saida[campo])) continue;
    saida[campo] = Math.round(pessoas * porPessoa * 100) / 100;
  }
  return saida;
}

const textoDaOpcao = (p: Pergunta, id: string) =>
  p.opcoes.find((o) => o.id === id)?.texto ?? id;

/** Resposta em texto para listas e exportação ("—" se vazia). */
export function textoDoValor(p: Pergunta, v: unknown): string {
  if (respostaVazia(v)) return "—";
  if (ehNaoSeAplica(v)) return "Não se aplica";
  switch (p.tipo) {
    case "uma":
      return textoDaOpcao(p, String(v));
    case "varias":
      return Array.isArray(v)
        ? v.map((id) => textoDaOpcao(p, String(id))).join(", ")
        : String(v);
    case "data":
      return formatarData(String(v));
    case "numero":
      return typeof v === "number"
        ? formatarNumero(v, 2).replace(/,00$/, "")
        : String(v);
    case "reais":
      return typeof v === "number" ? formatarNumero(v, 2) : String(v);
    case "numero_unidade": {
      const o = v as { n?: unknown; u?: unknown };
      const n = numeroDoValor(o.n);
      return `${n === null ? "—" : formatarNumero(n, 2).replace(/,00$/, "")} ${o.u ?? ""}`.trim();
    }
    case "sim_nao":
    case "sim_nao_quantidade":
    case "sim_nao_descricao": {
      const o = v as { r?: unknown; d?: unknown };
      const r = o.r === "sim" ? "Sim" : o.r === "nao" ? "Não" : "—";
      return o.d !== undefined && o.d !== "" ? `${r} (${o.d})` : r;
    }
    case "grade": {
      const niveis = new Map<string, string>(
        NIVEIS_GRADE.map((n) => [n.id, n.texto]),
      );
      return Object.entries(v as Record<string, string>)
        .map(([linha, n]) => `${textoDaOpcao(p, linha)}: ${niveis.get(n) ?? n}`)
        .join("; ");
    }
    default:
      return String(v);
  }
}

/**
 * Resumo do lançamento para a lista: "Campo: valor" dos primeiros campos
 * preenchidos (sem os de data, que já têm coluna própria).
 */
export function resumoDoLancamento(
  def: DefinicaoFormulario,
  respostas: Respostas,
  max = 3,
): string {
  const partes: string[] = [];
  for (const p of perguntas(def)) {
    if (partes.length >= max) break;
    if (p.tipo === "data" || respostaVazia(respostas[p.id])) continue;
    partes.push(`${p.texto}: ${textoDoValor(p, respostas[p.id])}`);
  }
  return partes.join(" · ") || "—";
}

export type LancamentoPreparado =
  | { erros: Record<string, string> }
  | { data: string; valores: Respostas; reais: Record<string, number> };

/** Chave do erro da data pedida à parte (formulário sem campo de data). */
export const ERRO_DATA = "_data";

/**
 * Do que a pessoa enviou ao que se grava: sem "Ver valores" os campos em
 * reais saem (nem cobrados, nem gravados); confere com `validarRespostas`;
 * tira as respostas de campos escondidos; pré-preenche os custos por pessoa
 * vazios (`custos`, ex.: tour) mesmo para quem não vê valores; acha a data
 * do fato (campo de data ou `data` à parte) e separa os campos em reais.
 */
export function prepararLancamento(p: {
  definicao: DefinicaoFormulario;
  respostas: Respostas;
  comValores: boolean;
  custos?: CustoPorPessoa | null;
  data?: string | null;
}): LancamentoPreparado {
  const def = p.comValores ? p.definicao : definicaoSemReais(p.definicao);
  const erros = validarRespostas(def, p.respostas);
  const visiveis = respostasVisiveis(def, p.respostas);
  const data =
    dataDoLancamento(def, visiveis) ??
    (p.data && /^\d{4}-\d{2}-\d{2}$/.test(p.data) ? p.data : null);
  if (!data) {
    const campo = perguntas(def).find((q) => q.ativa && q.tipo === "data");
    erros[campo?.id ?? ERRO_DATA] ??= "Informe a data do lançamento.";
  }
  if (Object.keys(erros).length || !data) return { erros };
  const completos = p.custos
    ? preencherCustosPorPessoa(p.definicao, visiveis, p.custos)
    : visiveis;
  return { data, ...separarReais(p.definicao, completos) };
}
