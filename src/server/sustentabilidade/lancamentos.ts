import "server-only";
import { cache } from "react";
import type { Json } from "@/lib/supabase/database.types";
import type { DefinicaoFormulario } from "@/lib/sustentabilidade/formulario/tipos";
import { normalizadoDoCadastro } from "@/lib/sustentabilidade/lancamento-cadastro";
import {
  type CustoPorPessoa,
  juntarReais,
} from "@/lib/sustentabilidade/lancamento-valores";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, su, suAdmin } from "./base";
import { definicaoPublicada, lerDefinicao } from "./formularios";

// Leituras dos lançamentos dos programas (aba Lançamentos e "Lançar pela
// equipe"), com a sessão: o RLS mostra os do programa a quem gerencia, vê
// o painel ou lança nele; os campos em reais vêm de `lancamento_valores`
// (null sem "Ver valores") e são juntados aqui.

export type Origem = "equipe" | "link" | "importacao";

export const ROTULO_ORIGEM: Record<Origem, string> = {
  equipe: "Equipe",
  link: "Via link",
  importacao: "Importação",
};

export interface LancamentoDaLista {
  id: string;
  formularioId: string;
  versao: number;
  data: string;
  origem: Origem;
  /** Comuns + em reais (sem "Ver valores", só os comuns). */
  valores: Record<string, unknown>;
  lancadoPor: string | null;
  criadoEm: string;
  exemplo: boolean;
}

const objeto = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const origemDe = (o: string): Origem =>
  o === "link" || o === "importacao" ? o : "equipe";

/** Lançamentos do programa com data do fato entre `de` e `ate`. */
export async function lancamentosDoPrograma(
  programaId: string,
  de: string,
  ate: string,
): Promise<LancamentoDaLista[]> {
  const db = await su();
  const linhas = await lerTudo(() =>
    db
      .from("lancamentos")
      .select(
        "id, formulario_id, formulario_versao, data, valores, origem, lancado_por, criado_em, exemplo, lancamento_valores(valores)",
      )
      .eq("programa_id", programaId)
      .gte("data", de)
      .lte("data", ate)
      .order("data", { ascending: false })
      .order("id"),
  );
  const nomes = await nomesDeUsuarios(
    linhas.map((l) => l.lancado_por),
    ["sustentabilidade.programas.gerenciar"],
  );
  return linhas.map((l) => ({
    id: l.id,
    formularioId: l.formulario_id,
    versao: l.formulario_versao,
    data: l.data,
    origem: origemDe(l.origem),
    valores: juntarReais(
      objeto(l.valores),
      l.lancamento_valores ? objeto(l.lancamento_valores.valores) : null,
    ),
    lancadoPor: l.lancado_por ? (nomes.get(l.lancado_por) ?? null) : null,
    criadoEm: l.criado_em,
    exemplo: l.exemplo,
  }));
}

/**
 * Definições das versões usadas (formulário + versão), com a sessão
 * (`formulario_versoes` é lida por quem usa o módulo).
 */
export async function definicoesDasVersoes(
  pares: { formularioId: string; versao: number }[],
): Promise<Map<string, DefinicaoFormulario>> {
  const chave = (f: string, v: number) => `${f}:${v}`;
  const ids = [...new Set(pares.map((p) => p.formularioId))];
  const mapa = new Map<string, DefinicaoFormulario>();
  if (!ids.length) return mapa;
  const { data, error } = await (await su())
    .from("formulario_versoes")
    .select("formulario_id, versao, definicao")
    .in("formulario_id", ids);
  falhar(error);
  const quero = new Set(pares.map((p) => chave(p.formularioId, p.versao)));
  for (const v of data) {
    const k = chave(v.formulario_id, v.versao);
    if (quero.has(k)) mapa.set(k, lerDefinicao(v.definicao));
  }
  return mapa;
}

export interface LancamentoParaCorrigir {
  id: string;
  programaId: string;
  formularioId: string;
  versao: number;
  data: string;
  valores: Record<string, unknown>;
  exemplo: boolean;
}

/** Um lançamento (com a sessão) para corrigir. */
export async function lancamentoParaCorrigir(
  id: string,
): Promise<LancamentoParaCorrigir | null> {
  const { data, error } = await (await su())
    .from("lancamentos")
    .select(
      "id, programa_id, formulario_id, formulario_versao, data, valores, exemplo, lancamento_valores(valores)",
    )
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  return {
    id: data.id,
    programaId: data.programa_id,
    formularioId: data.formulario_id,
    versao: data.formulario_versao,
    data: data.data,
    valores: juntarReais(
      objeto(data.valores),
      data.lancamento_valores ? objeto(data.lancamento_valores.valores) : null,
    ),
    exemplo: data.exemplo,
  };
}

/** Uma versão de formulário (service role: quem chama conferiu o acesso). */
export async function definicaoDaVersao(
  formularioId: string,
  versao: number,
): Promise<DefinicaoFormulario | null> {
  const { data, error } = await suAdmin()
    .from("formulario_versoes")
    .select("definicao")
    .eq("formulario_id", formularioId)
    .eq("versao", versao)
    .maybeSingle();
  falhar(error);
  return data ? lerDefinicao(data.definicao) : null;
}

export interface FormularioParaLancar {
  id: string;
  nome: string;
  versao: number;
  definicao: DefinicaoFormulario;
}

/**
 * Formulários ativos e publicados do programa, com a versão publicada.
 * Service role: quem chama já conferiu que a pessoa (ou o link) lança no
 * programa.
 */
export const formulariosParaLancar = cache(
  async (programaId: string): Promise<FormularioParaLancar[]> => {
    const { data, error } = await suAdmin()
      .from("formularios")
      .select("id, nome")
      .eq("tipo", "programa")
      .eq("programa_id", programaId)
      .eq("ativo", true)
      .gt("versao_publicada", 0)
      .order("nome");
    falhar(error);
    const defs = await Promise.all(data.map((f) => definicaoPublicada(f.id)));
    return data
      .map((f, i) => ({
        id: f.id,
        nome: f.nome,
        versao: defs[i]?.versao ?? 0,
        definicao: defs[i]?.definicao ?? { secoes: [] },
      }))
      .filter((f) => f.versao > 0);
  },
);

/**
 * Nomes já cadastrados em cada campo "lista de cadastro" do programa
 * (service role: quem chama conferiu o acesso ao programa).
 */
export async function listasDoPrograma(
  programaId: string,
): Promise<Record<string, string[]>> {
  const linhas = await lerTudo(() =>
    suAdmin()
      .from("cadastros_lista")
      .select("id, campo_id, valor")
      .eq("programa_id", programaId)
      .order("valor")
      .order("id"),
  );
  const listas: Record<string, string[]> = {};
  for (const l of linhas) {
    const lista = listas[l.campo_id] ?? [];
    lista.push(l.valor);
    listas[l.campo_id] = lista;
  }
  return listas;
}

/**
 * Custos por pessoa do tour (álbum e copo, dos Parâmetros com valores),
 * pré-preenchidos pelo número de participantes nos formulários que têm
 * esses campos. Service role: quem chama conferiu que pode lançar.
 * atalho: os ids dos campos são os do formulário do tour (dados iniciais);
 * outro formulário com os mesmos ids recebe o mesmo pré-preenchimento.
 */
export async function custosDoTour(): Promise<CustoPorPessoa | null> {
  const { data, error } = await suAdmin()
    .from("parametros_valores")
    .select("tour_custo_album, tour_custo_copo")
    .eq("id", true)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  return {
    pessoas: "participantes",
    custos: {
      custo_album: Number(data.tour_custo_album),
      custo_copo: Number(data.tour_custo_copo),
    },
  };
}

// ---------------------------------------------------------------- gravar
// Usado pelas ações (equipe, com a sessão) e pelo link do parceiro (service
// role, depois de conferir o token). Quem chama já conferiu a permissão.

export type DbSu = ReturnType<typeof suAdmin>;

export interface NovoLancamento {
  programa_id: string;
  formulario_id: string;
  formulario_versao: number;
  data: string;
  valores: Record<string, unknown>;
  origem: Origem;
  link_id?: string | null;
  lancado_por?: string | null;
}

/**
 * Grava o lançamento e, à parte, os campos em reais. Se a parte em reais
 * falhar, o lançamento sai (nada fica pela metade). Devolve o id ou null.
 */
export async function inserirLancamento(
  db: DbSu,
  l: NovoLancamento,
  reais: Record<string, number>,
): Promise<string | null> {
  const { data, error } = await db
    .from("lancamentos")
    .insert({ ...l, valores: l.valores as Json })
    .select("id")
    .single();
  if (error) {
    console.error("gravar lançamento", error);
    return null;
  }
  if (Object.keys(reais).length) {
    const r = await db
      .from("lancamento_valores")
      .insert({ lancamento_id: data.id, valores: reais as Json });
    if (r.error) {
      console.error("gravar valores do lançamento", r.error);
      await db.from("lancamentos").delete().eq("id", data.id);
      return null;
    }
  }
  return data.id;
}

/**
 * Nomes novos dos campos "lista de cadastro" entram na lista do programa
 * (o mesmo nome sem acento/caixa não duplica).
 */
export async function cadastrarNomes(
  db: DbSu,
  programaId: string,
  def: DefinicaoFormulario,
  valores: Record<string, unknown>,
): Promise<void> {
  const linhas = def.secoes
    .flatMap((s) => s.perguntas)
    .filter((p) => p.tipo === "lista_cadastro")
    .map((p) => ({ campo: p.id, valor: valores[p.id] }))
    .filter(
      (x): x is { campo: string; valor: string } =>
        typeof x.valor === "string" && x.valor.trim().length > 0,
    )
    .map((x) => ({
      programa_id: programaId,
      campo_id: x.campo,
      valor: x.valor.trim().slice(0, 200),
      normalizado: normalizadoDoCadastro(x.valor),
    }))
    .filter((x) => x.normalizado);
  if (!linhas.length) return;
  const { error } = await db.from("cadastros_lista").upsert(linhas, {
    onConflict: "programa_id,campo_id,normalizado",
    ignoreDuplicates: true,
  });
  if (error) console.error("lista de cadastro", error);
}
