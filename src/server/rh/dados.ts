import "server-only";
import { cache } from "react";
import type { AvisoDaPagina } from "@/components/avisos-da-pagina";
import { CONFIGURACOES_RH } from "@/config/navigation";
import type { Meta } from "@/lib/indicadores";
import { metaVigente } from "@/lib/indicadores";
import { diaAnterior, ultimoDiaFechado } from "@/lib/periodo";
import type { ColaboradorQuadro, LinhaPonto } from "@/lib/rh/calculos";
import {
  type CustoAgregado,
  type CustoIndividual,
  vigenteEm,
} from "@/lib/rh/custo";
import {
  type DiaDoPonto,
  juntarPonto,
  type PontoDoPeriodo,
  planejarPonto,
  somarDias,
  type TrechoDoPonto,
} from "@/lib/rh/ponto-periodo";
import { tipoDoDesligamento } from "@/lib/rh/turnover";

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

/** Ponto do mês de todos, menos quem o RH tirou do ponto. */
export const pontoDoMes = cache(
  async (competencia: string): Promise<LinhaPonto[]> => {
    const { data, error } = await (await rh())
      .from("ponto_mensal")
      .select(
        `colaborador_id, departamento_id, previstas_min, faltas_min, atrasos_min,
         faltas_dias, abonos_min, banco_saldo_min, banco_creditos_min, banco_debitos_min,
         extras_min, noturnas_min, dsr_debito_min,
         colaborador:colaboradores!inner(nome, matricula),
         departamento:departamentos(nome)`,
      )
      .eq("competencia", competencia)
      .eq("colaborador.fora_do_ponto", false);
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
      extras_min: (l.extras_min ?? {}) as Record<string, number>,
      noturnas_min: l.noturnas_min,
      dsr_debito_min: l.dsr_debito_min,
    }));
  },
);

/**
 * Dias do ponto de um trecho (rh.ponto_diario), com nome e departamento,
 * menos quem o RH tirou do ponto.
 */
const diasDoTrecho = cache(
  async (de: string, ate: string): Promise<DiaDoPonto[]> => {
    const { data, error } = await (await rh())
      .from("ponto_diario")
      .select(
        `colaborador_id, data, ocorrencia, previstas_min, faltas_min, atrasos_min,
         abonos_min, extras_min, noturnas_min,
         banco_saldo_min, banco_creditos_min, banco_debitos_min,
         colaborador:colaboradores!inner(nome, matricula, departamento_id,
           departamento:departamentos(nome))`,
      )
      .gte("data", de)
      .lte("data", ate)
      .eq("colaborador.fora_do_ponto", false);
    falhar(error);
    return (data ?? []).map((d) => ({
      colaborador_id: d.colaborador_id,
      data: d.data,
      ocorrencia: d.ocorrencia,
      nome: d.colaborador?.nome ?? "—",
      matricula: d.colaborador?.matricula ?? null,
      departamento_id: d.colaborador?.departamento_id ?? null,
      departamento: d.colaborador?.departamento?.nome ?? "Sem departamento",
      previstas_min: d.previstas_min,
      faltas_min: d.faltas_min,
      atrasos_min: d.atrasos_min,
      abonos_min: (d.abonos_min ?? {}) as Record<string, number>,
      extras_min: (d.extras_min ?? {}) as Record<string, number>,
      noturnas_min: d.noturnas_min,
      banco_saldo_min: d.banco_saldo_min,
      banco_creditos_min: d.banco_creditos_min,
      banco_debitos_min: d.banco_debitos_min,
    }));
  },
);

export type { PontoDoPeriodo };

/**
 * Ponto de um período: meses inteiros pelo total do mês, pedaços de mês
 * pela soma dos dias (regras em lib/rh/ponto-periodo.ts).
 */
export const pontoDoPeriodo = cache(
  async (de: string, ate: string): Promise<PontoDoPeriodo> => {
    const plano = planejarPonto({ de, ate }, ultimoDiaFechado());
    const semDias: TrechoDoPonto[] = [];
    const pedacos = await Promise.all([
      ...plano.meses.map(async (c) => ({
        chave: c,
        linhas: await pontoDoMes(c),
      })),
      ...plano.trechos.map(async (t) => {
        const dias = await diasDoTrecho(t.de, t.ate);
        // Dias guardados só a partir de quando o ponto do dia começou a ser
        // gravado: o que vem antes fica de fora (e a tela avisa).
        const primeiro = dias.reduce<string | null>(
          (m, d) => (m === null || d.data < m ? d.data : m),
          null,
        );
        if (primeiro === null) semDias.push(t);
        else if (primeiro > t.de)
          semDias.push({ ...t, ate: diaAnterior(primeiro) });
        return { chave: t.de, linhas: somarDias(dias) };
      }),
    ]);
    pedacos.sort((a, b) => a.chave.localeCompare(b.chave));
    return {
      linhas: juntarPonto(pedacos.map((p) => p.linhas)),
      efetivo: plano.efetivo,
      semDias: semDias.sort((a, b) => a.de.localeCompare(b.de)),
    };
  },
);

/**
 * Quadro e turnover: todos vêm do Copiloto RH (fonte da especificação para
 * ativos, admissões, desligamentos e turnover). Departamento e cargo seguem
 * do ponto e da folha.
 */
export const colaboradoresDoQuadro = cache(
  async (): Promise<ColaboradorQuadro[]> => {
    const { data, error } = await (await rh())
      .from("colaboradores")
      .select(
        `id, nome, matricula, departamento_id, admissao, desligamento,
         tipo_contrato, motivo_desligamento_copiloto,
         decisao_desligamento_copiloto,
         departamento:departamentos(nome),
         cargo:cargos(nome)`,
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
      motivo_desligamento: c.motivo_desligamento_copiloto,
      decisao_desligamento: c.decisao_desligamento_copiloto,
      tipo_turnover: c.desligamento
        ? tipoDoDesligamento(
            c.decisao_desligamento_copiloto,
            c.motivo_desligamento_copiloto,
          )
        : null,
      cargo: c.cargo?.nome ?? null,
      tipo_contrato: c.tipo_contrato,
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

/**
 * Adicional do banco de horas vigente no mês (Parâmetros); sem nenhum
 * vigente, o da primeira configuração (como rh.banco_horas_em_reais).
 */
export const adicionalDoBanco = cache(
  async (competencia: string): Promise<number | null> => {
    const { data, error } = await (await rh())
      .from("parametros_empresa")
      .select("vigente_desde, banco_horas_adicional_pct")
      .order("vigente_desde");
    falhar(error);
    const p = vigenteEm(data ?? [], competencia) ?? data?.[0];
    return p ? Number(p.banco_horas_adicional_pct) : null;
  },
);

export interface ValorDaHora {
  /** Folha de onde vem o salário/hora: a última calculada até o mês. */
  folha: string | null;
  adicional: number | null;
  salarioHora: Map<string, number | null>;
}

/**
 * Salário/hora de cada pessoa e adicional do banco, para mostrar horas em R$
 * por pessoa (o RLS exige rh.custo_pessoal.individual).
 */
export const valorDaHora = cache(
  async (competencia: string): Promise<ValorDaHora> => {
    const [ultima, adicional] = await Promise.all([
      (await rh())
        .from("custos_colaborador")
        .select("competencia")
        .lte("competencia", competencia)
        .order("competencia", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adicionalDoBanco(competencia),
    ]);
    falhar(ultima.error);
    const folha = ultima.data?.competencia ?? null;
    if (!folha) return { folha, adicional, salarioHora: new Map() };
    const { data, error } = await (await rh())
      .from("custos_colaborador")
      .select("colaborador_id, salario_hora")
      .eq("competencia", folha);
    falhar(error);
    return {
      folha,
      adicional,
      salarioHora: new Map(
        (data ?? []).map((c) => [
          c.colaborador_id,
          c.salario_hora === null ? null : Number(c.salario_hora),
        ]),
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
export const faltasDoCusto = cache(async (): Promise<AvisoDaPagina[]> => {
  const [empresa, beneficios] = await Promise.all([
    (await rh()).from("parametros_empresa").select("vigente_desde").limit(1),
    (await rh())
      .from("beneficios")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true),
  ]);
  falhar(empresa.error);
  falhar(beneficios.error);
  const faltas: AvisoDaPagina[] = [];
  if (!empresa.data?.length)
    faltas.push({
      id: "rat-fap",
      tipo: "atencao",
      titulo: "RAT e FAP não configurados",
      texto:
        "Os encargos estão saindo sem o RAT. Preencha em Parâmetros e o custo é recalculado na hora.",
      acao: { href: CONFIGURACOES_RH.parametros, rotulo: "Abrir Parâmetros" },
    });
  if (!beneficios.count)
    faltas.push({
      id: "sem-beneficios",
      tipo: "atencao",
      titulo: "Nenhum benefício cadastrado",
      texto: "Plano de saúde, VR, VT e os demais ainda não entram no custo.",
      acao: {
        href: `${CONFIGURACOES_RH.cadastros}#beneficios`,
        rotulo: "Cadastrar benefícios",
      },
    });
  return faltas;
});

export interface DadosFinanceiros {
  competencia: string;
  faturamento_bruto: number | null;
  custo_despesa_total: number | null;
  custos_operacionais_sem_pessoal: number | null;
  lucro: number | null;
  endomarketing: number | null;
  origem: string;
}

/** Valores financeiros do mês lançados (manual até o ENET), do mais recente. */
export const dadosFinanceiros = cache(async (): Promise<DadosFinanceiros[]> => {
  const { data, error } = await (await rh())
    .from("dados_financeiros_mensais")
    .select(
      "competencia, faturamento_bruto, custo_despesa_total, custos_operacionais_sem_pessoal, lucro, endomarketing, origem",
    )
    .order("competencia", { ascending: false });
  falhar(error);
  const n = (v: number | null) => (v === null ? null : Number(v));
  return (data ?? []).map((d) => ({
    ...d,
    faturamento_bruto: n(d.faturamento_bruto),
    custo_despesa_total: n(d.custo_despesa_total),
    custos_operacionais_sem_pessoal: n(d.custos_operacionais_sem_pessoal),
    lucro: n(d.lucro),
    endomarketing: n(d.endomarketing),
  }));
});
