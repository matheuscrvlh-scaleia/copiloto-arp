import "server-only";
import { cache } from "react";
import { z } from "zod";
import { isoLocal } from "@/lib/formato";
import { diaAnterior, ultimoDiaFechado } from "@/lib/periodo";
import type { LinhaPonto } from "@/lib/rh/calculos";
import type { CustoIndividual } from "@/lib/rh/custo";
import { type Situacao, situacaoDe } from "@/lib/rh/funcionarios";
import {
  type DiaDoPonto as DiaSomavel,
  juntarPonto,
  type PontoDoPeriodo,
  planejarPonto,
  somarDias,
  type TrechoDoPonto,
} from "@/lib/rh/ponto-periodo";
import { createClient } from "@/lib/supabase/server";

// Leituras da tela de Funcionários, com a sessão do usuário (o RLS decide).
// Folha, rubricas e custo são das tabelas sensíveis: só voltam linhas para
// quem tem rh.custo_pessoal.individual.

async function rh() {
  return (await createClient()).schema("rh");
}

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

export interface Funcionario {
  id: string;
  nome: string;
  matricula: number | null;
  departamento_id: string | null;
  departamento: string;
  cargo: string | null;
  tipo_contrato: string | null;
  nascimento: string | null;
  admissao: string | null;
  desligamento: string | null;
  situacao: Situacao;
  /** De onde a pessoa vem: Copiloto RH, ponto (Secullum). */
  noCopiloto: boolean;
  noPonto: boolean;
  /** No Secullum, mas o RH tirou do ponto (não conta nas telas). */
  foraDoPonto: boolean;
}

const CAMPOS = `id, nome, matricula, copiloto_id, secullum_id, situacao_copiloto, fora_do_ponto,
  nascimento, admissao, desligamento, tipo_contrato, departamento_id,
  departamento:departamentos(nome),
  cargo:cargos(nome)`;

type LinhaColaborador = {
  id: string;
  nome: string;
  matricula: number | null;
  copiloto_id: string | null;
  secullum_id: number | null;
  situacao_copiloto: string | null;
  fora_do_ponto: boolean;
  nascimento: string | null;
  admissao: string | null;
  desligamento: string | null;
  tipo_contrato: string | null;
  departamento_id: string | null;
  departamento: { nome: string } | null;
  cargo: { nome: string } | null;
};

function paraFuncionario(
  c: LinhaColaborador,
  hoje: string,
  afastados: Set<string>,
): Funcionario {
  return {
    id: c.id,
    nome: c.nome,
    matricula: c.matricula,
    departamento_id: c.departamento_id,
    departamento: c.departamento?.nome ?? "Sem departamento",
    cargo: c.cargo?.nome ?? null,
    tipo_contrato: c.tipo_contrato,
    nascimento: c.nascimento,
    admissao: c.admissao,
    desligamento: c.desligamento,
    situacao: situacaoDe(c, hoje, afastados.has(c.id)),
    noCopiloto: c.copiloto_id !== null,
    noPonto: c.secullum_id !== null,
    foraDoPonto: c.fora_do_ponto,
  };
}

/** Quem tem afastamento do ponto cobrindo `hoje`. */
async function afastadosEm(hoje: string, id?: string): Promise<Set<string>> {
  let consulta = (await rh())
    .from("afastamentos")
    .select("colaborador_id")
    .lte("inicio", hoje)
    .gte("fim", hoje);
  if (id) consulta = consulta.eq("colaborador_id", id);
  const { data, error } = await consulta;
  falhar(error);
  return new Set((data ?? []).map((a) => a.colaborador_id));
}

/** Todos os colaboradores (Copiloto RH, ponto e folha), por nome. */
export const funcionarios = cache(async (): Promise<Funcionario[]> => {
  const hoje = isoLocal(new Date());
  const [{ data, error }, afastados] = await Promise.all([
    (await rh()).from("colaboradores").select(CAMPOS).order("nome"),
    afastadosEm(hoje),
  ]);
  falhar(error);
  return (data ?? []).map((c) => paraFuncionario(c, hoje, afastados));
});

export interface Perfil extends Funcionario {
  motivoDesligamento: string | null;
}

/** Um colaborador; null se o id não existir (ou não for um uuid). */
export const funcionario = cache(async (id: string): Promise<Perfil | null> => {
  if (!z.uuid().safeParse(id).success) return null;
  const hoje = isoLocal(new Date());
  const [{ data, error }, afastados] = await Promise.all([
    (await rh())
      .from("colaboradores")
      .select(
        `${CAMPOS}, motivo_desligamento_copiloto,
         motivo:motivos_desligamento(descricao)`,
      )
      .eq("id", id)
      .maybeSingle(),
    afastadosEm(hoje, id),
  ]);
  falhar(error);
  if (!data) return null;
  return {
    ...paraFuncionario(data, hoje, afastados),
    motivoDesligamento:
      data.motivo?.descricao ?? data.motivo_desligamento_copiloto ?? null,
  };
});

// ---------------------------------------------------------------------------
// Ponto
// ---------------------------------------------------------------------------

export type PontoDoMes = Omit<
  LinhaPonto,
  "nome" | "matricula" | "departamento_id" | "departamento"
> & { competencia: string; normais_min: number };

/** Totais do ponto da pessoa, mês a mês, do mais recente para o mais antigo. */
export const pontoMensalDe = cache(
  async (id: string): Promise<PontoDoMes[]> => {
    const { data, error } = await (await rh())
      .from("ponto_mensal")
      .select(
        `competencia, colaborador_id, previstas_min, normais_min, faltas_min,
       atrasos_min, faltas_dias, abonos_min, banco_saldo_min, banco_creditos_min,
       banco_debitos_min, extras_min, noturnas_min, dsr_debito_min`,
      )
      .eq("colaborador_id", id)
      .order("competencia", { ascending: false });
    falhar(error);
    return (data ?? []).map((l) => ({
      ...l,
      faltas_dias: Number(l.faltas_dias),
      abonos_min: (l.abonos_min ?? {}) as Record<string, number>,
      extras_min: (l.extras_min ?? {}) as Record<string, number>,
    }));
  },
);

export interface DiaDoPonto {
  data: string;
  batidas: (string | null)[];
  ocorrencia: string | null;
  previstas_min: number;
  normais_min: number;
  faltas_min: number;
  atrasos_min: number;
  abonos_min: Record<string, number>;
  extras_min: Record<string, number>;
  noturnas_min: number;
  banco_saldo_min: number;
  banco_creditos_min: number;
  banco_debitos_min: number;
}

/** Cada dia de `de` a `ate` com as batidas, em ordem. */
export const pontoDiarioDe = cache(
  async (id: string, de: string, ate: string): Promise<DiaDoPonto[]> => {
    const { data, error } = await (await rh())
      .from("ponto_diario")
      .select(
        `data, batidas, ocorrencia, previstas_min, normais_min, faltas_min,
         atrasos_min, abonos_min, extras_min, noturnas_min, banco_saldo_min,
         banco_creditos_min, banco_debitos_min`,
      )
      .eq("colaborador_id", id)
      .gte("data", de)
      .lte("data", ate)
      .order("data");
    falhar(error);
    return (data ?? []).map((d) => ({
      ...d,
      batidas: (d.batidas ?? []) as (string | null)[],
      abonos_min: (d.abonos_min ?? {}) as Record<string, number>,
      extras_min: (d.extras_min ?? {}) as Record<string, number>,
    }));
  },
);

export interface PontoDoFuncionario extends PontoDoPeriodo {
  /** Totais do período (a linha da pessoa), ou null sem dado. */
  total: LinhaPonto | null;
  /** Horas trabalhadas (Normais), que o total do período não traz. */
  normais_min: number;
  /** Os dias do período que têm batidas guardadas. */
  dias: DiaDoPonto[];
}

/**
 * Ponto da pessoa num período, com as regras das outras telas: mês inteiro
 * pelo total do mês, pedaço de mês pela soma dos dias. Pedaço sem dias
 * guardados fica fora do total (e a tela avisa).
 */
export async function pontoDoPeriodoDe(
  f: Funcionario,
  de: string,
  ate: string,
): Promise<PontoDoFuncionario> {
  const plano = planejarPonto({ de, ate }, ultimoDiaFechado());
  const [mensal, dias] = await Promise.all([
    pontoMensalDe(f.id),
    plano.efetivo
      ? pontoDiarioDe(f.id, plano.efetivo.de, plano.efetivo.ate)
      : Promise.resolve([]),
  ]);
  const quem = {
    colaborador_id: f.id,
    nome: f.nome,
    matricula: f.matricula,
    departamento_id: f.departamento_id,
    departamento: f.departamento,
  };

  const semDias: TrechoDoPonto[] = [];
  let normais = 0;
  const pedacos: { chave: string; linhas: LinhaPonto[] }[] = [];
  for (const c of plano.meses) {
    const m = mensal.find((x) => x.competencia === c);
    if (!m) continue;
    const { competencia: _, normais_min, ...resto } = m;
    normais += normais_min;
    pedacos.push({ chave: c, linhas: [{ ...resto, ...quem }] });
  }
  for (const t of plano.trechos) {
    const doTrecho = dias.filter((d) => d.data >= t.de && d.data <= t.ate);
    const primeiro = doTrecho[0]?.data;
    if (!primeiro) semDias.push(t);
    else if (primeiro > t.de)
      semDias.push({ ...t, ate: diaAnterior(primeiro) });
    normais += doTrecho.reduce((s, d) => s + d.normais_min, 0);
    pedacos.push({
      chave: t.de,
      linhas: somarDias(
        doTrecho.map(
          ({ batidas: _, normais_min: __, ...d }): DiaSomavel => ({
            ...d,
            ...quem,
          }),
        ),
      ),
    });
  }
  pedacos.sort((a, b) => a.chave.localeCompare(b.chave));
  const linhas = juntarPonto(pedacos.map((p) => p.linhas));
  return {
    linhas,
    efetivo: plano.efetivo,
    semDias,
    total: linhas[0] ?? null,
    normais_min: normais,
    dias,
  };
}

export interface Afastamento {
  inicio: string;
  fim: string;
  motivo: string | null;
  justificativa: string | null;
}

export const afastamentosDe = cache(
  async (id: string): Promise<Afastamento[]> => {
    const { data, error } = await (await rh())
      .from("afastamentos")
      .select("inicio, fim, motivo, justificativa")
      .eq("colaborador_id", id)
      .order("inicio", { ascending: false });
    falhar(error);
    return data ?? [];
  },
);

// ---------------------------------------------------------------------------
// Benefícios e dependentes (o RLS exige rh.beneficios)
// ---------------------------------------------------------------------------

export interface BeneficioDoFuncionario {
  nome: string;
  tipo: string;
  desde: string;
  ate: string | null;
  /** Valor mensal: o manual da pessoa ou o padrão do benefício. */
  valor: number | null;
  /** O valor foi digitado para a pessoa (não muda com a faixa). */
  manual: boolean;
}

export interface Dependente {
  nome: string;
  nascimento: string | null;
  tem_plano: boolean;
  tem_odonto: boolean;
}

export const beneficiosDe = cache(
  async (
    id: string,
  ): Promise<{
    beneficios: BeneficioDoFuncionario[];
    dependentes: Dependente[];
  }> => {
    const [beneficios, dependentes] = await Promise.all([
      (await rh())
        .from("colaborador_beneficios")
        .select(
          "desde, ate, valor_manual, beneficio:beneficios(nome, tipo, valor_padrao)",
        )
        .eq("colaborador_id", id)
        .order("desde", { ascending: false }),
      (await rh())
        .from("dependentes")
        .select("nome, nascimento, tem_plano, tem_odonto")
        .eq("colaborador_id", id)
        .order("nome"),
    ]);
    falhar(beneficios.error);
    falhar(dependentes.error);
    return {
      beneficios: (beneficios.data ?? []).map((b) => ({
        nome: b.beneficio?.nome ?? "—",
        tipo: b.beneficio?.tipo ?? "outro",
        desde: b.desde,
        ate: b.ate,
        valor: num(b.valor_manual) ?? num(b.beneficio?.valor_padrao ?? null),
        manual: b.valor_manual !== null,
      })),
      dependentes: dependentes.data ?? [],
    };
  },
);

// ---------------------------------------------------------------------------
// Folha e custo (o RLS exige rh.custo_pessoal.individual)
// ---------------------------------------------------------------------------

export interface FolhaDoFuncionario {
  folha_id: string;
  competencia: string;
  /** Protótipo: salário trocado por R$ 2.000,00 na importação. */
  ficticia: boolean;
  status: string;
  situacao: string;
  tipo_contrato: string;
  cargo: string | null;
  horas_mes_min: number | null;
  salario: number | null;
  base_inss: number | null;
  base_fgts: number | null;
  valor_fgts: number | null;
  liquido: number | null;
}

/** A pessoa em cada folha importada, da mais recente para a mais antiga. */
export const folhasDe = cache(
  async (id: string): Promise<FolhaDoFuncionario[]> => {
    const { data, error } = await (await rh())
      .from("folha_colaboradores")
      .select(
        `folha_id, situacao, tipo_contrato, horas_mes_min, salario, base_inss,
         base_fgts, valor_fgts, liquido,
         folha:folhas(competencia, ficticia, status),
         cargo:cargos(nome)`,
      )
      .eq("colaborador_id", id);
    falhar(error);
    return (data ?? [])
      .flatMap((f) =>
        f.folha
          ? [
              {
                folha_id: f.folha_id,
                competencia: f.folha.competencia,
                ficticia: f.folha.ficticia,
                status: f.folha.status,
                situacao: f.situacao,
                tipo_contrato: f.tipo_contrato,
                cargo: f.cargo?.nome ?? null,
                horas_mes_min: f.horas_mes_min,
                salario: num(f.salario),
                base_inss: num(f.base_inss),
                base_fgts: num(f.base_fgts),
                valor_fgts: num(f.valor_fgts),
                liquido: num(f.liquido),
              },
            ]
          : [],
      )
      .sort((a, b) => b.competencia.localeCompare(a.competencia));
  },
);

export interface RubricaDoFuncionario {
  codigo: number;
  descricao: string;
  grupo: string;
  natureza: "provento" | "desconto" | "informativa";
  referencia: number | null;
  valor: number;
}

/** Rubricas da pessoa numa folha: proventos, descontos e informativas. */
export const rubricasDe = cache(
  async (id: string, folhaId: string): Promise<RubricaDoFuncionario[]> => {
    const { data, error } = await (await rh())
      .from("folha_rubricas")
      .select(
        "rubrica_codigo, natureza, referencia, valor, rubrica:rubricas(descricao, grupo)",
      )
      .eq("colaborador_id", id)
      .eq("folha_id", folhaId)
      .order("rubrica_codigo");
    falhar(error);
    return (data ?? []).map((r) => ({
      codigo: r.rubrica_codigo,
      descricao: r.rubrica?.descricao ?? "—",
      grupo: r.rubrica?.grupo ?? "nao_classificada",
      natureza: r.natureza,
      referencia: num(r.referencia),
      valor: Number(r.valor),
    }));
  },
);

export type CustoDoMes = Omit<
  CustoIndividual,
  "nome" | "matricula" | "departamento" | "cargo"
> & {
  competencia: string;
  provisao_13: number;
  provisao_ferias: number;
  multa_rescisoria: number;
  reembolsos: number;
};

/** Custo calculado da pessoa, mês a mês, do mais recente para o mais antigo. */
export const custosDe = cache(async (id: string): Promise<CustoDoMes[]> => {
  const { data, error } = await (await rh())
    .from("custos_colaborador")
    .select(
      `competencia, colaborador_id, departamento_id, tipo_contrato, remuneracao,
       encargos, provisao_13, provisao_ferias, multa_rescisoria, beneficios,
       rescisao, reembolsos, custo_total, custo_hora, salario_hora, jornada_min,
       memoria`,
    )
    .eq("colaborador_id", id)
    .order("competencia", { ascending: false });
  falhar(error);
  return (data ?? []).map((c) => ({
    competencia: c.competencia,
    colaborador_id: c.colaborador_id,
    departamento_id: c.departamento_id,
    tipo_contrato: c.tipo_contrato,
    remuneracao: Number(c.remuneracao),
    encargos: Number(c.encargos),
    provisao_13: Number(c.provisao_13),
    provisao_ferias: Number(c.provisao_ferias),
    multa_rescisoria: Number(c.multa_rescisoria),
    provisoes:
      Number(c.provisao_13) +
      Number(c.provisao_ferias) +
      Number(c.multa_rescisoria),
    beneficios: Number(c.beneficios),
    rescisao: Number(c.rescisao),
    reembolsos: Number(c.reembolsos),
    custo_total: Number(c.custo_total),
    custo_hora: num(c.custo_hora),
    salario_hora: num(c.salario_hora),
    jornada_min: c.jornada_min,
    memoria: c.memoria as CustoIndividual["memoria"],
  }));
});
