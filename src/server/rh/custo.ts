import "server-only";
import { fimDoMes } from "@/lib/formato";
import {
  type BeneficioDoMes,
  type CustoCalculado,
  calcularCusto,
  type FaixaEtaria,
  jornadaDe,
  type PessoaDoMes,
  type RubricaDaFolha,
  valorPelaFaixa,
  vigenteEm,
} from "@/lib/rh/custo";
import type { GrupoRubrica } from "@/lib/rh/rubricas";
import { type AdminClient, createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

// Calcula e grava o custo de pessoal de uma competência (seção 4.4).
// Usa a service role: chamar só depois de conferir a permissão de quem pediu.

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

const PAGINA = 1000;

/** Todas as linhas de uma consulta, de mil em mil (limite da API). */
async function todas<T>(
  consulta: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    falhar(error);
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

async function carregar(admin: AdminClient, competencia: string) {
  const rh = admin.schema("rh");
  const fim = fimDoMes(competencia);
  const { data: folha, error } = await rh
    .from("folhas")
    .select("id, status")
    .eq("competencia", competencia)
    .maybeSingle();
  falhar(error);

  const [
    pessoas,
    rubricasFolha,
    rubricas,
    encargos,
    empresa,
    jornadas,
    vinculos,
    tabelas,
    dependentes,
    notas,
  ] = await Promise.all([
    folha
      ? todas((de, ate) =>
          rh
            .from("folha_colaboradores")
            .select(
              "colaborador_id, tipo_contrato, departamento_id, cargo_id, horas_mes_min, salario",
            )
            .eq("folha_id", folha.id)
            .order("colaborador_id")
            .range(de, ate),
        )
      : [],
    folha
      ? todas((de, ate) =>
          rh
            .from("folha_rubricas")
            .select(
              "colaborador_id, rubrica_codigo, natureza, valor, rubrica:rubricas(descricao)",
            )
            .eq("folha_id", folha.id)
            .order("id")
            .range(de, ate),
        )
      : [],
    todas((de, ate) =>
      rh
        .from("rubricas")
        .select("codigo, grupo")
        .order("codigo")
        .range(de, ate),
    ),
    rh.from("encargos_por_contrato").select("*"),
    rh.from("parametros_empresa").select("vigente_desde, rat_pct, fap"),
    rh
      .from("jornadas")
      .select(
        "departamento_id, cargo_id, colaborador_id, horas_mes_min, vigente_desde",
      ),
    rh
      .from("colaborador_beneficios")
      .select(
        `colaborador_id, valor_manual,
         beneficio:beneficios(id, nome, tipo, valor_padrao, rubricas_desconto,
           rubricas_desconto_dependente, dependente_regra, dependente_valor, ativo),
         colaborador:colaboradores(nascimento)`,
      )
      .lte("desde", fim)
      .or(`ate.is.null,ate.gte.${competencia}`),
    rh
      .from("plano_tabelas")
      .select(
        "beneficio_id, vigente_desde, faixas:plano_faixas_etarias(idade_min, idade_max, mensalidade)",
      )
      .lte("vigente_desde", competencia),
    rh
      .from("dependentes")
      .select("colaborador_id, nascimento, tem_plano, tem_odonto"),
    rh
      .from("notas_pj")
      .select(
        "colaborador_id, valor, colaborador:colaboradores(departamento_id, cargo_id, tipo_contrato)",
      )
      .eq("competencia", competencia),
  ]);
  for (const r of [
    encargos,
    empresa,
    jornadas,
    vinculos,
    tabelas,
    dependentes,
    notas,
  ])
    falhar(r.error);

  return {
    folha,
    pessoas,
    rubricasFolha,
    grupos: new Map(rubricas.map((r) => [r.codigo, r.grupo as GrupoRubrica])),
    encargos: encargos.data ?? [],
    empresa: empresa.data ?? [],
    jornadas: jornadas.data ?? [],
    vinculos: vinculos.data ?? [],
    tabelas: tabelas.data ?? [],
    dependentes: dependentes.data ?? [],
    notas: notas.data ?? [],
  };
}

type Dados = Awaited<ReturnType<typeof carregar>>;

/** Benefícios de cada pessoa com o valor cheio resolvido (manual, padrão ou faixa). */
function beneficiosPorPessoa(
  d: Dados,
  competencia: string,
): Map<string, { beneficios: BeneficioDoMes[]; pendencias: string[] }> {
  const faixasDe = (beneficioId: string): FaixaEtaria[] | null => {
    const t = vigenteEm(
      d.tabelas.filter((t) => t.beneficio_id === beneficioId),
      competencia,
    );
    return t
      ? t.faixas.map((f) => ({
          idade_min: f.idade_min,
          idade_max: f.idade_max,
          mensalidade: Number(f.mensalidade),
        }))
      : null;
  };
  const porFaixa = (faixas: FaixaEtaria[] | null, nascimento: string | null) =>
    valorPelaFaixa(faixas, nascimento, competencia);

  const mapa = new Map<
    string,
    { beneficios: BeneficioDoMes[]; pendencias: string[] }
  >();
  for (const v of d.vinculos) {
    const b = v.beneficio;
    if (!b?.ativo) continue;
    const item = mapa.get(v.colaborador_id) ?? {
      beneficios: [],
      pendencias: [],
    };
    const faixas =
      b.tipo === "plano_saude" || b.tipo === "odonto" ? faixasDe(b.id) : null;
    const titular =
      v.valor_manual !== null
        ? { valor: Number(v.valor_manual) }
        : b.valor_padrao !== null
          ? { valor: Number(b.valor_padrao) }
          : porFaixa(faixas, v.colaborador?.nascimento ?? null);

    // Dependentes: só plano e odonto; a empresa paga o que a regra mandar.
    let dependentes = 0;
    if (b.dependente_regra !== "nao_paga" && b.dependente_valor !== null) {
      const deps = d.dependentes.filter(
        (x) =>
          x.colaborador_id === v.colaborador_id &&
          ((b.tipo === "plano_saude" && x.tem_plano) ||
            (b.tipo === "odonto" && x.tem_odonto)),
      );
      for (const dep of deps) {
        if (b.dependente_regra === "valor_fixo") {
          dependentes += Number(b.dependente_valor);
          continue;
        }
        const m = porFaixa(faixas, dep.nascimento);
        if (m.valor === null)
          item.pendencias.push(`${b.nome}, dependente: ${m.pendencia}.`);
        else dependentes += (m.valor * Number(b.dependente_valor)) / 100;
      }
    }

    item.beneficios.push({
      nome: b.nome,
      valor: titular.valor,
      pendencia: titular.pendencia,
      rubricas_desconto: b.rubricas_desconto,
      rubricas_desconto_dependente: b.rubricas_desconto_dependente,
      dependentes: Math.round(dependentes * 100) / 100,
    });
    mapa.set(v.colaborador_id, item);
  }
  return mapa;
}

export function montarCustos(d: Dados, competencia: string): CustoCalculado[] {
  // Sem RAT/FAP vigente no mês, vale a primeira configuração: ela é gravada
  // a partir do mês em que a Gestora preenche, depois das folhas antigas.
  const rat =
    vigenteEm(d.empresa, competencia) ??
    [...d.empresa].sort((a, b) =>
      a.vigente_desde.localeCompare(b.vigente_desde),
    )[0] ??
    null;
  const ratFap = rat
    ? { rat_pct: Number(rat.rat_pct), fap: Number(rat.fap) }
    : null;
  const encargosDe = (tipo: string) => {
    const e = vigenteEm(
      d.encargos.filter((e) => e.tipo_contrato === tipo),
      competencia,
    );
    return e
      ? {
          inss_patronal_pct: Number(e.inss_patronal_pct),
          terceiros_pct: Number(e.terceiros_pct),
          fgts_pct: Number(e.fgts_pct),
          aplica_rat: e.aplica_rat,
          provisiona_13: e.provisiona_13,
          provisiona_ferias: e.provisiona_ferias,
          multa_rescisoria_pct: Number(e.multa_rescisoria_pct),
        }
      : null;
  };
  const rubricasDe = new Map<string, RubricaDaFolha[]>();
  for (const r of d.rubricasFolha) {
    const lista = rubricasDe.get(r.colaborador_id) ?? [];
    lista.push({
      codigo: r.rubrica_codigo,
      descricao: r.rubrica?.descricao ?? String(r.rubrica_codigo),
      natureza: r.natureza,
      valor: Number(r.valor),
    });
    rubricasDe.set(r.colaborador_id, lista);
  }
  const beneficios = beneficiosPorPessoa(d, competencia);
  const jornadas = d.jornadas.map((j) => ({
    ...j,
    horas_mes_min: Number(j.horas_mes_min),
  }));

  const pessoas: PessoaDoMes[] = d.pessoas.map((p) => {
    const b = beneficios.get(p.colaborador_id);
    return {
      colaborador_id: p.colaborador_id,
      tipo_contrato: p.tipo_contrato,
      departamento_id: p.departamento_id,
      cargo_id: p.cargo_id,
      salario: p.salario === null ? null : Number(p.salario),
      jornada_min: jornadaDe(p, jornadas, competencia, p.horas_mes_min),
      rubricas: rubricasDe.get(p.colaborador_id) ?? [],
      beneficios: b?.beneficios ?? [],
      pendencias: b?.pendencias,
    };
  });

  // PJ: não está na folha; o custo é a soma das notas do mês.
  const naFolha = new Set(pessoas.map((p) => p.colaborador_id));
  const notas = new Map<
    string,
    { valor: number; nota: (typeof d.notas)[number] }
  >();
  for (const n of d.notas) {
    if (naFolha.has(n.colaborador_id)) continue;
    const atual = notas.get(n.colaborador_id);
    notas.set(n.colaborador_id, {
      valor: (atual?.valor ?? 0) + Number(n.valor),
      nota: n,
    });
  }
  for (const [colaborador_id, { valor, nota }] of notas) {
    const b = beneficios.get(colaborador_id);
    const base = {
      colaborador_id,
      departamento_id: nota.colaborador?.departamento_id ?? null,
      cargo_id: nota.colaborador?.cargo_id ?? null,
    };
    pessoas.push({
      ...base,
      tipo_contrato: nota.colaborador?.tipo_contrato ?? "pj",
      salario: null,
      jornada_min: jornadaDe(base, jornadas, competencia, null),
      rubricas: [],
      beneficios: b?.beneficios ?? [],
      pendencias: b?.pendencias,
      valor_notas: valor,
    });
  }

  return pessoas.map((p) =>
    calcularCusto(
      p,
      (c) => d.grupos.get(c),
      encargosDe(p.tipo_contrato),
      ratFap,
    ),
  );
}

export interface ResultadoCusto {
  competencia: string;
  pessoas: number;
  comPendencia: number;
}

/** Recalcula e grava o custo da competência. Folha fechada fica como está. */
export async function recalcularCusto(
  competencia: string,
  admin: AdminClient = createAdminClient(),
): Promise<ResultadoCusto | null> {
  const dados = await carregar(admin, competencia);
  if (dados.folha?.status === "fechada") return null;
  if (!dados.folha && dados.notas.length === 0) return null;
  const custos = montarCustos(dados, competencia);
  const { error } = await admin.schema("rh").rpc("gravar_custos", {
    p_competencia: competencia,
    p_linhas: custos as unknown as Json,
  });
  if (error) throw new Error(`Falha ao gravar o custo: ${error.message}`);
  return {
    competencia,
    pessoas: custos.length,
    comPendencia: custos.filter((c) => c.memoria.pendencias.length > 0).length,
  };
}

/**
 * Recalcula todas as competências em aberto (folha não fechada). Usado
 * quando muda algo que vale para todos os meses: rubrica, encargo, RAT/FAP.
 */
export async function recalcularEmAberto(): Promise<ResultadoCusto[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("rh")
    .from("folhas")
    .select("competencia")
    .neq("status", "fechada")
    .order("competencia");
  falhar(error);
  const feitos: ResultadoCusto[] = [];
  for (const f of data ?? []) {
    const r = await recalcularCusto(f.competencia, admin);
    if (r) feitos.push(r);
  }
  return feitos;
}

/**
 * Recalcula sem derrubar a ação que pediu: a gravação principal já deu
 * certo; se o custo falhar, a tela avisa e o botão Recalcular resolve.
 */
export async function tentarRecalcular(
  tarefa: () => Promise<unknown>,
): Promise<boolean> {
  try {
    await tarefa();
    return true;
  } catch (e) {
    console.error("recálculo do custo", e);
    return false;
  }
}
