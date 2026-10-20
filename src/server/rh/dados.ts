import "server-only";
import { cache } from "react";
import type { Meta } from "@/lib/indicadores";
import { metaVigente } from "@/lib/indicadores";
import type { ColaboradorQuadro, LinhaPonto } from "@/lib/rh/calculos";
import type { CustoAgregado, CustoIndividual } from "@/lib/rh/custo";

export type { CustoIndividual };

import { createClient } from "@/lib/supabase/server";

// Todas as leituras usam a sessão do usuário: o RLS decide o que ele vê.

async function rh() {
  return (await createClient()).schema("rh");
}

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

export interface Departamento {
  id: string;
  nome: string;
}

export const departamentos = cache(async (): Promise<Departamento[]> => {
  const { data, error } = await (await rh())
    .from("departamentos")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  falhar(error);
  return data ?? [];
});

/** Competências com ponto sincronizado, da mais recente para a mais antiga. */
export const competenciasDoPonto = cache(async (): Promise<string[]> => {
  const { data, error } = await (await rh())
    .from("ponto_mensal")
    .select("competencia");
  falhar(error);
  return [...new Set((data ?? []).map((l) => l.competencia))].sort().reverse();
});

export const pontoDoMes = cache(
  async (competencia: string): Promise<LinhaPonto[]> => {
    const { data, error } = await (await rh())
      .from("ponto_mensal")
      .select(
        `colaborador_id, departamento_id, previstas_min, faltas_min, atrasos_min,
         faltas_dias, abonos_min, banco_saldo_min, banco_creditos_min, banco_debitos_min,
         colaborador:colaboradores(nome, matricula),
         departamento:departamentos(nome)`,
      )
      .eq("competencia", competencia);
    falhar(error);
    return (data ?? []).map((l) => ({
      colaborador_id: l.colaborador_id,
      nome: l.colaborador?.nome ?? "—",
      matricula: l.colaborador?.matricula ?? null,
      departamento_id: l.departamento_id,
      departamento: l.departamento?.nome ?? "Sem departamento",
      previstas_min: l.previstas_min,
      faltas_min: l.faltas_min,
      atrasos_min: l.atrasos_min,
      faltas_dias: Number(l.faltas_dias),
      abonos_min: (l.abonos_min ?? {}) as Record<string, number>,
      banco_saldo_min: l.banco_saldo_min,
      banco_creditos_min: l.banco_creditos_min,
      banco_debitos_min: l.banco_debitos_min,
    }));
  },
);

export const colaboradoresDoQuadro = cache(
  async (): Promise<ColaboradorQuadro[]> => {
    const { data, error } = await (await rh())
      .from("colaboradores")
      .select(
        `id, nome, matricula, departamento_id, admissao, desligamento,
         departamento:departamentos(nome),
         motivo:motivos_desligamento(tipo_turnover)`,
      )
      .order("nome");
    falhar(error);
    return (data ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      matricula: c.matricula,
      departamento_id: c.departamento_id,
      departamento: c.departamento?.nome ?? "Sem departamento",
      admissao: c.admissao,
      desligamento: c.desligamento,
      tipo_turnover: c.motivo?.tipo_turnover ?? null,
    }));
  },
);

export interface MetaRegistrada {
  indicador: string;
  vigente_desde: string;
  meta: number;
  limite_atencao: number | null;
  direcao: "maior_melhor" | "menor_melhor";
}

export const metasDoRh = cache(async (): Promise<MetaRegistrada[]> => {
  const { data, error } = await (await createClient())
    .schema("core")
    .from("metas")
    .select("indicador, vigente_desde, meta, limite_atencao, direcao")
    .like("indicador", "rh.%");
  falhar(error);
  return (data ?? []).map((m) => ({
    ...m,
    meta: Number(m.meta),
    limite_atencao: m.limite_atencao === null ? null : Number(m.limite_atencao),
  }));
});

/** Meta vigente do indicador na competência, no formato do semáforo. */
export async function metaDe(
  indicador: string,
  competencia: string,
): Promise<Meta | null> {
  const m = metaVigente(await metasDoRh(), indicador, competencia);
  return m
    ? { meta: m.meta, limiteAtencao: m.limite_atencao, direcao: m.direcao }
    : null;
}

export interface FolhaImportada {
  id: string;
  competencia: string;
  status: string;
  ficticia: boolean;
  pessoas: number;
  arquivo: string | null;
  importadaEm: string | null;
}

/** Folhas importadas, da mais recente para a mais antiga (sem expor salário). */
export const folhasImportadas = cache(async (): Promise<FolhaImportada[]> => {
  const supabase = await createClient();
  const { data: folhas, error } = await supabase
    .schema("rh")
    .from("folhas")
    .select("id, competencia, status, ficticia, importacao_id")
    .order("competencia", { ascending: false });
  falhar(error);
  if (!folhas?.length) return [];

  const ids = folhas
    .map((f) => f.importacao_id)
    .filter((i): i is string => !!i);
  const competencias = folhas.map((f) => f.competencia).sort();
  const [importacoes, quadro] = await Promise.all([
    supabase
      .schema("core")
      .from("importacoes")
      .select("id, arquivo_nome, confirmado_em")
      .in("id", ids),
    supabase.schema("rh").rpc("quadro_mensal", {
      inicio: competencias[0] as string,
      fim: competencias.at(-1) as string,
    }),
  ]);
  falhar(importacoes.error);
  falhar(quadro.error);
  const porId = new Map((importacoes.data ?? []).map((i) => [i.id, i]));
  const pessoas = new Map<string, number>();
  for (const q of quadro.data ?? []) {
    pessoas.set(
      q.competencia,
      (pessoas.get(q.competencia) ?? 0) + Number(q.colaboradores),
    );
  }
  return folhas.map((f) => {
    const imp = f.importacao_id ? porId.get(f.importacao_id) : undefined;
    return {
      id: f.id,
      competencia: f.competencia,
      status: f.status,
      ficticia: f.ficticia,
      pessoas: pessoas.get(f.competencia) ?? 0,
      arquivo: imp?.arquivo_nome ?? null,
      importadaEm: imp?.confirmado_em ?? null,
    };
  });
});

export const rubricasNaoClassificadas = cache(async () => {
  const { data, error } = await (await rh())
    .from("rubricas")
    .select("codigo, descricao")
    .eq("grupo", "nao_classificada")
    .order("codigo");
  falhar(error);
  return data ?? [];
});

// ---------------------------------------------------------------------------
// Custo de pessoal (calculado por src/server/rh/custo.ts)
// ---------------------------------------------------------------------------

export interface FolhaDoCusto {
  competencia: string;
  status: string;
  ficticia: boolean;
}

/** Folhas importadas, da mais recente para a mais antiga. */
export const folhasDoCusto = cache(async (): Promise<FolhaDoCusto[]> => {
  const { data, error } = await (await rh())
    .from("folhas")
    .select("competencia, status, ficticia")
    .order("competencia", { ascending: false });
  falhar(error);
  return data ?? [];
});

/** Somas por competência, departamento, cargo e contrato (exige rh.custo_pessoal). */
export const custoAgregado = cache(
  async (inicio: string, fim: string): Promise<CustoAgregado[]> => {
    const { data, error } = await (await rh()).rpc("custo_agregado", {
      inicio,
      fim,
    });
    falhar(error);
    return (data ?? []).map((l) => ({
      competencia: l.competencia,
      departamento_id: l.departamento_id,
      cargo_id: l.cargo_id,
      tipo_contrato: l.tipo_contrato,
      colaboradores: Number(l.colaboradores),
      remuneracao: Number(l.remuneracao),
      encargos: Number(l.encargos),
      provisoes: Number(l.provisoes),
      beneficios: Number(l.beneficios),
      rescisao: Number(l.rescisao),
      reembolsos: Number(l.reembolsos),
      custo_total: Number(l.custo_total),
    }));
  },
);

/** Custo de cada pessoa na competência (o RLS exige rh.custo_pessoal.individual). */
export const custosIndividuais = cache(
  async (competencia: string): Promise<CustoIndividual[]> => {
    const { data, error } = await (await rh())
      .from("custos_colaborador")
      .select(
        `colaborador_id, departamento_id, tipo_contrato, remuneracao, encargos,
         provisao_13, provisao_ferias, multa_rescisoria, beneficios, rescisao,
         custo_total, custo_hora, salario_hora, jornada_min, memoria,
         colaborador:colaboradores(nome, matricula),
         departamento:departamentos(nome),
         cargo:cargos(nome)`,
      )
      .eq("competencia", competencia);
    falhar(error);
    return (data ?? [])
      .map((c) => ({
        colaborador_id: c.colaborador_id,
        nome: c.colaborador?.nome ?? "—",
        matricula: c.colaborador?.matricula ?? null,
        departamento_id: c.departamento_id,
        departamento: c.departamento?.nome ?? "Sem departamento",
        cargo: c.cargo?.nome ?? "—",
        tipo_contrato: c.tipo_contrato,
        remuneracao: Number(c.remuneracao),
        encargos: Number(c.encargos),
        provisoes:
          Number(c.provisao_13) +
          Number(c.provisao_ferias) +
          Number(c.multa_rescisoria),
        beneficios: Number(c.beneficios),
        rescisao: Number(c.rescisao),
        custo_total: Number(c.custo_total),
        custo_hora: c.custo_hora === null ? null : Number(c.custo_hora),
        salario_hora: c.salario_hora === null ? null : Number(c.salario_hora),
        jornada_min: c.jornada_min,
        memoria: c.memoria as CustoIndividual["memoria"],
      }))
      .sort((a, b) => b.custo_total - a.custo_total);
  },
);

export interface BancoEmReais {
  valor: number | null;
  positivo_min: number;
  semSalario: number;
  folha: string | null;
  adicional: number | null;
  porDepartamento: Map<string | null, number | null>;
}
/** Banco de horas positivo × salário/hora × (1 + adicional), por departamento. */
export const bancoHorasEmReais = cache(
  async (competencia: string): Promise<BancoEmReais | null> => {
    const { data, error } = await (await rh()).rpc("banco_horas_em_reais", {
      p_competencia: competencia,
    });
    falhar(error);
    if (!data?.length) return null;
    const valores = data.map((d) =>
      d.valor === null ? null : Number(d.valor),
    );
    return {
      valor: valores.some((v) => v === null)
        ? null
        : valores.reduce<number>((s, v) => s + (v ?? 0), 0),
      positivo_min: data.reduce((s, d) => s + Number(d.positivo_min), 0),
      semSalario: data.reduce((s, d) => s + Number(d.sem_salario), 0),
      folha: data[0]?.folha ?? null,
      adicional:
        data[0]?.adicional_pct === null || data[0]?.adicional_pct === undefined
          ? null
          : Number(data[0].adicional_pct),
      porDepartamento: new Map(
        data.map((d, i) => [d.departamento_id, valores[i] ?? null]),
      ),
    };
  },
);

export const cargos = cache(async (): Promise<Departamento[]> => {
  const { data, error } = await (await rh())
    .from("cargos")
    .select("id, nome")
    .order("nome");
  falhar(error);
  return data ?? [];
});

/** Faturamento bruto da competência (manual até a integração com o ENET). */
export const faturamentoDe = cache(
  async (competencia: string): Promise<number | null> => {
    const { data, error } = await (await rh())
      .from("dados_financeiros_mensais")
      .select("faturamento_bruto")
      .eq("competencia", competencia)
      .maybeSingle();
    falhar(error);
    return data?.faturamento_bruto == null
      ? null
      : Number(data.faturamento_bruto);
  },
);

/** O que ainda falta configurar para o custo sair completo. */
export const faltasDoCusto = cache(async (): Promise<string[]> => {
  const [empresa, beneficios] = await Promise.all([
    (await rh()).from("parametros_empresa").select("vigente_desde").limit(1),
    (await rh())
      .from("beneficios")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
  ]);
  falhar(empresa.error);
  falhar(beneficios.error);
  const faltas: string[] = [];
  if (!empresa.data?.length)
    faltas.push(
      "RAT e FAP não configurados em Parâmetros: os encargos saem sem o RAT.",
    );
  if (!beneficios.count)
    faltas.push(
      "Nenhum benefício cadastrado: plano, VR, VT e os demais ainda não entram no custo.",
    );
  return faltas;
});
