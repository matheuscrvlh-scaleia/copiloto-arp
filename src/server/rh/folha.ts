import "server-only";
import { createHash } from "node:crypto";
import { type Conferencia, conferir } from "@/lib/rh/folha/conferencia";
import {
  type ExtratoMensal,
  type ItemTexto,
  lerExtrato,
} from "@/lib/rh/folha/extrato";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { lerTudo } from "../supabase-paginas";
import { cargosDoRh, departamentosDoRh, rubricasDoRh } from "./configuracao";

export const BUCKET = "importacoes";
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Textos de cada página do PDF, com posição. */
export async function textosDoPdf(bytes: Uint8Array): Promise<ItemTexto[][]> {
  // Só quem importa a folha carrega o leitor de PDF.
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const paginas: ItemTexto[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const { items } = await (await pdf.getPage(p)).getTextContent();
    paginas.push(
      items.flatMap((i) =>
        "str" in i
          ? [{ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width }]
          : [],
      ),
    );
  }
  return paginas;
}

export async function lerPdfDaFolha(bytes: Uint8Array): Promise<ExtratoMensal> {
  return lerExtrato(await textosDoPdf(bytes));
}

/** O que a prévia mostra e o que a confirmação precisa saber do banco. */
export async function contextoDoBanco(extrato: ExtratoMensal) {
  const supabase = await createClient();
  const rh = supabase.schema("rh");
  // Rubricas e colaboradores (todos, desde sempre) passam de mil: de mil em
  // mil. Uma matrícula ou rubrica cortada viraria "fora do Copiloto" ou
  // "rubrica nova" na prévia.
  const [rubricas, departamentos, colaboradores, folha] = await Promise.all([
    lerTudo(() => rh.from("rubricas").select("codigo, grupo").order("codigo")),
    rh
      .from("departamentos")
      .select("id, nome, codigo_folha")
      .eq("ativo", true)
      .order("nome"),
    lerTudo(() => rh.from("colaboradores").select("matricula").order("id")),
    rh
      .from("folhas")
      .select("id, status")
      .eq("competencia", extrato.competencia)
      .maybeSingle(),
  ]);
  for (const r of [departamentos, folha]) {
    if (r.error) throw new Error(`Falha ao ler o banco: ${r.error.message}`);
  }
  return {
    grupos: new Map(rubricas.map((r) => [r.codigo, r.grupo as string])),
    departamentos: departamentos.data ?? [],
    matriculas: new Set(colaboradores.map((c) => c.matricula)),
    folhaExistente: folha.data,
  };
}

/** Folha pronta para gravar, com os valores do extrato. */
export function folhaParaGravar(f: ExtratoMensal): Json {
  return {
    competencia: f.competencia,
    resumo_empresa: f.resumo,
    colaboradores: f.colaboradores.map((c) => ({
      matricula: c.matricula,
      nome: c.nome,
      situacao: c.situacao,
      tipo_contrato: c.tipo_contrato,
      departamento_codigo: c.departamento_codigo,
      cargo_codigo: c.cargo_codigo,
      cargo_nome: c.cargo_nome,
      cbo: c.cbo,
      admissao: c.admissao,
      horas_mes: c.horas_mes,
      salario: c.salario,
      base_inss: c.base_inss,
      base_fgts: c.base_fgts,
      valor_fgts: c.valor_fgts,
      liquido: c.liquido,
      rubricas: c.rubricas.map((r) => ({ ...r })),
    })),
  } as Json;
}

export interface Previa {
  importacaoId: string;
  arquivo: string;
  competencia: string;
  empresa: string | null;
  pessoas: number;
  porTipo: Record<string, number>;
  porSituacao: Record<string, number>;
  conferencia: Conferencia;
  rubricasNovas: { codigo: number; descricao: string }[];
  /** Matrícula sem par no Copiloto RH: fica fora da folha gravada. */
  foraDoCopiloto: { matricula: number; nome: string }[];
  /** Códigos de departamento da folha sem departamento cadastrado. */
  departamentosSemCodigo: { codigo: number; pessoas: number }[];
  /** Departamentos que ainda não têm código da folha (opções do de-para). */
  departamentosLivres: { id: string; nome: string }[];
  folhaExistente: { status: string } | null;
}

const contar = <T>(itens: T[], chave: (i: T) => string) =>
  itens.reduce<Record<string, number>>((m, i) => {
    const k = chave(i);
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});

export function montarPrevia(
  extrato: ExtratoMensal,
  ctx: Awaited<ReturnType<typeof contextoDoBanco>>,
  dados: { importacaoId: string; arquivo: string },
): Previa {
  const conferencia = conferir(extrato);
  const codigosComDepartamento = new Set(
    ctx.departamentos
      .map((d) => d.codigo_folha)
      .filter((c): c is number => c !== null),
  );
  const novasRubricas = new Map<number, string>();
  for (const c of extrato.colaboradores) {
    for (const r of c.rubricas) {
      if (!ctx.grupos.has(r.codigo)) novasRubricas.set(r.codigo, r.descricao);
    }
  }
  const semCodigo = contar(
    extrato.colaboradores.filter(
      (c) =>
        c.departamento_codigo !== null &&
        !codigosComDepartamento.has(c.departamento_codigo),
    ),
    (c) => String(c.departamento_codigo),
  );

  return {
    importacaoId: dados.importacaoId,
    arquivo: dados.arquivo,
    competencia: extrato.competencia,
    empresa: extrato.empresa,
    pessoas: extrato.colaboradores.length,
    porTipo: contar(extrato.colaboradores, (c) => c.tipo_contrato),
    porSituacao: contar(extrato.colaboradores, (c) => c.situacao),
    conferencia,
    rubricasNovas: [...novasRubricas].map(([codigo, descricao]) => ({
      codigo,
      descricao,
    })),
    foraDoCopiloto: extrato.colaboradores
      .filter((c) => !ctx.matriculas.has(c.matricula))
      .map((c) => ({ matricula: c.matricula, nome: c.nome })),
    departamentosSemCodigo: Object.entries(semCodigo).map(
      ([codigo, pessoas]) => ({
        codigo: Number(codigo),
        pessoas,
      }),
    ),
    departamentosLivres: ctx.departamentos
      .filter((d) => d.codigo_folha === null)
      .map((d) => ({ id: d.id, nome: d.nome })),
    folhaExistente: ctx.folhaExistente
      ? { status: ctx.folhaExistente.status }
      : null,
  };
}

export interface PessoaParaEditar {
  colaborador_id: string;
  nome: string;
  matricula: number | null;
  situacao: string;
  tipo_contrato: string;
  departamento_id: string | null;
  cargo_id: string | null;
  horas_mes_min: number | null;
  salario: number | null;
  liquido: number | null;
  rubricas: {
    codigo: number;
    descricao: string;
    grupo: string;
    natureza: string;
    referencia: number | null;
    valor: number;
  }[];
}

/**
 * Uma folha inteira para conferir e corrigir na tela: pessoas, rubricas e as
 * opções dos campos. Lê com a sessão de quem pediu (RLS: valores individuais);
 * departamentos, cargos e rubricas vêm do cache do módulo. Tudo em paralelo:
 * as consultas só dependem do id da folha. Pessoas e rubricas da folha, de
 * mil em mil.
 */
export async function folhaParaEditar(id: string) {
  const rh = (await createClient()).schema("rh");
  const [folha, pessoas, departamentos, cargos, rubricas, linhas] =
    await Promise.all([
      rh
        .from("folhas")
        .select("id, competencia, status, ficticia")
        .eq("id", id)
        .maybeSingle(),
      lerTudo(() =>
        rh
          .from("folha_colaboradores")
          .select(
            "colaborador_id, situacao, tipo_contrato, departamento_id, cargo_id, horas_mes_min, salario, liquido, colaborador:colaboradores(nome, matricula)",
          )
          .eq("folha_id", id)
          .order("colaborador_id"),
      ),
      departamentosDoRh(),
      cargosDoRh(),
      rubricasDoRh(),
      lerTudo(() =>
        rh
          .from("folha_rubricas")
          .select("colaborador_id, rubrica_codigo, natureza, referencia, valor")
          .eq("folha_id", id)
          .order("id"),
      ),
    ]);
  if (folha.error)
    throw new Error(`Falha ao ler o banco: ${folha.error.message}`);
  if (!folha.data) return null;

  const catalogo = new Map(rubricas.map((r) => [r.codigo, r]));
  const porPessoa = Map.groupBy(linhas, (l) => l.colaborador_id);
  const num = (v: number | null) => (v === null ? null : Number(v));
  return {
    folha: folha.data,
    departamentos: departamentos.map(({ id, nome }) => ({ id, nome })),
    cargos,
    rubricas,
    pessoas: pessoas
      .map(
        (p): PessoaParaEditar => ({
          colaborador_id: p.colaborador_id,
          nome: p.colaborador?.nome ?? "—",
          matricula: p.colaborador?.matricula ?? null,
          situacao: p.situacao,
          tipo_contrato: p.tipo_contrato,
          departamento_id: p.departamento_id,
          cargo_id: p.cargo_id,
          horas_mes_min: p.horas_mes_min,
          salario: num(p.salario),
          liquido: num(p.liquido),
          rubricas: (porPessoa.get(p.colaborador_id) ?? []).map((r) => ({
            codigo: r.rubrica_codigo,
            descricao: catalogo.get(r.rubrica_codigo)?.descricao ?? "",
            grupo: catalogo.get(r.rubrica_codigo)?.grupo ?? "nao_classificada",
            natureza: r.natureza,
            referencia: num(r.referencia),
            valor: Number(r.valor),
          })),
        }),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome)),
  };
}
