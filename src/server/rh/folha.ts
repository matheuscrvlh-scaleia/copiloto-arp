import "server-only";
import { createHash } from "node:crypto";
import { getDocumentProxy } from "unpdf";
import { type Conferencia, conferir } from "@/lib/rh/folha/conferencia";
import {
  type ExtratoMensal,
  type ItemTexto,
  lerExtrato,
} from "@/lib/rh/folha/extrato";
import { aplicarSalarioFicticio } from "@/lib/rh/folha/ficticio";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export const BUCKET = "importacoes";
export const TAMANHO_MAXIMO = 10 * 1024 * 1024;

/**
 * Protótipo: salário real nunca é gravado nem exibido (especificação do RH).
 * Só desliga com FOLHA_SALARIO_FICTICIO=false, quando a ARP liberar.
 */
export function salarioFicticioAtivo(): boolean {
  return process.env.FOLHA_SALARIO_FICTICIO?.trim().toLowerCase() !== "false";
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Textos de cada página do PDF, com posição. */
export async function textosDoPdf(bytes: Uint8Array): Promise<ItemTexto[][]> {
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
  const [rubricas, departamentos, colaboradores, folha] = await Promise.all([
    rh.from("rubricas").select("codigo, grupo"),
    rh
      .from("departamentos")
      .select("id, nome, codigo_folha")
      .eq("ativo", true)
      .order("nome"),
    rh.from("colaboradores").select("matricula"),
    rh
      .from("folhas")
      .select("id, status")
      .eq("competencia", extrato.competencia)
      .maybeSingle(),
  ]);
  for (const r of [rubricas, departamentos, colaboradores, folha]) {
    if (r.error) throw new Error(`Falha ao ler o banco: ${r.error.message}`);
  }
  return {
    grupos: new Map(
      (rubricas.data ?? []).map((r) => [r.codigo, r.grupo as string]),
    ),
    departamentos: departamentos.data ?? [],
    matriculas: new Set((colaboradores.data ?? []).map((c) => c.matricula)),
    folhaExistente: folha.data,
  };
}

/** Folha pronta para gravar: no protótipo, já com o salário fictício. */
export function folhaParaGravar(
  extrato: ExtratoMensal,
  grupos: Map<number, string>,
  ficticia: boolean,
): Json {
  const f = ficticia
    ? aplicarSalarioFicticio(extrato, (c) => grupos.get(c))
    : extrato;
  return {
    competencia: f.competencia,
    ficticia,
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
  ficticia: boolean;
  pessoas: number;
  porTipo: Record<string, number>;
  porSituacao: Record<string, number>;
  conferencia: Conferencia;
  rubricasNovas: { codigo: number; descricao: string }[];
  colaboradoresNovos: { matricula: number; nome: string }[];
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
  dados: { importacaoId: string; arquivo: string; ficticia: boolean },
): Previa {
  const conferencia = conferir(extrato);
  // No protótipo, nenhum valor em reais sai do servidor: só se bate ou não.
  if (dados.ficticia) {
    for (const i of conferencia.itens) {
      i.importado = null;
      i.resumo = null;
    }
  }
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
    ficticia: dados.ficticia,
    pessoas: extrato.colaboradores.length,
    porTipo: contar(extrato.colaboradores, (c) => c.tipo_contrato),
    porSituacao: contar(extrato.colaboradores, (c) => c.situacao),
    conferencia,
    rubricasNovas: [...novasRubricas].map(([codigo, descricao]) => ({
      codigo,
      descricao,
    })),
    colaboradoresNovos: extrato.colaboradores
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

const PAGINA = 1000;

/**
 * Uma folha inteira para conferir e corrigir na tela: pessoas, rubricas e as
 * opções dos campos. Lê com a sessão de quem pediu (RLS: valores individuais).
 */
export async function folhaParaEditar(id: string) {
  const rh = (await createClient()).schema("rh");
  const { data: folha, error } = await rh
    .from("folhas")
    .select("id, competencia, status, ficticia")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o banco: ${error.message}`);
  if (!folha) return null;

  const [pessoas, departamentos, cargos, rubricas] = await Promise.all([
    rh
      .from("folha_colaboradores")
      .select(
        "colaborador_id, situacao, tipo_contrato, departamento_id, cargo_id, horas_mes_min, salario, liquido, colaborador:colaboradores(nome, matricula)",
      )
      .eq("folha_id", id),
    rh.from("departamentos").select("id, nome").order("nome"),
    rh.from("cargos").select("id, nome").order("nome"),
    rh.from("rubricas").select("codigo, descricao, grupo").order("codigo"),
  ]);
  for (const r of [pessoas, departamentos, cargos, rubricas])
    if (r.error) throw new Error(`Falha ao ler o banco: ${r.error.message}`);

  const linhas: {
    colaborador_id: string;
    rubrica_codigo: number;
    natureza: string;
    referencia: number | null;
    valor: number;
  }[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error: e } = await rh
      .from("folha_rubricas")
      .select("colaborador_id, rubrica_codigo, natureza, referencia, valor")
      .eq("folha_id", id)
      .order("id")
      .range(de, de + PAGINA - 1);
    if (e) throw new Error(`Falha ao ler o banco: ${e.message}`);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) break;
  }

  const catalogo = new Map((rubricas.data ?? []).map((r) => [r.codigo, r]));
  const porPessoa = Map.groupBy(linhas, (l) => l.colaborador_id);
  const num = (v: number | null) => (v === null ? null : Number(v));
  return {
    folha,
    departamentos: departamentos.data ?? [],
    cargos: cargos.data ?? [],
    rubricas: rubricas.data ?? [],
    pessoas: (pessoas.data ?? [])
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
