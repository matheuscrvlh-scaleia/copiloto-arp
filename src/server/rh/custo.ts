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
import { lerTudo } from "../supabase-paginas";

// Calcula e grava o custo de pessoal de uma competência (seção 4.4).
// Usa a service role: chamar só depois de conferir a permissão de quem pediu.
// O que cresce com o quadro (pessoas, rubricas, jornadas, vínculos,
// dependentes) é lido de mil em mil (lerTudo), com ordem por chave única.

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

async function carregar(admin: AdminClient, competencia: string) {
  const rh = admin.schema("rh");
  const fim = fimDoMes(competencia);
  // Tudo começa junto; só as pessoas e as rubricas da folha esperam o id da
  // folha (e não o resto).
  const folhaDoMes = rh
    .from("folhas")
    .select("id, status")
    .eq("competencia", competencia)
    .maybeSingle()
    .then(({ data, error }) => {
      falhar(error);
      return data;
    });
  const [
    folha,
    rubricas,
    pessoas,
    rubricasFolha,
    cadastro,
    deFora,
    encargos,
    empresa,
    jornadas,
    vinculos,
    porContrato,
    tabelas,
    dependentes,
    valoresPj,
  ] = await Promise.all([
    folhaDoMes,
    lerTudo(() => rh.from("rubricas").select("codigo, grupo").order("codigo")),
    folhaDoMes.then((folha) =>
      folha
        ? lerTudo(() =>
            rh
              .from("folha_colaboradores")
              .select(
                "colaborador_id, tipo_contrato, departamento_id, cargo_id, horas_mes_min, salario",
              )
              .eq("folha_id", folha.id)
              .order("colaborador_id"),
          )
        : [],
    ),
    folhaDoMes.then((folha) =>
      folha
        ? lerTudo(() =>
            rh
              .from("folha_rubricas")
              .select(
                "colaborador_id, rubrica_codigo, natureza, valor, rubrica:rubricas(descricao)",
              )
              .eq("folha_id", folha.id)
              .order("id"),
          )
        : [],
    ),
    lerTudo(() =>
      rh
        .from("colaboradores")
        .select(
          "id, tipo_contrato, departamento_id, cargo_id, admissao, desligamento, nascimento",
        )
        .order("id"),
    ),
    sociosDoCusto(admin),
    rh
      .from("encargos_por_contrato")
      .select(
        "tipo_contrato, vigente_desde, inss_patronal_pct, terceiros_pct, fgts_pct, aplica_rat, provisiona_13, provisiona_ferias, provisiona_recesso, multa_rescisoria_pct",
      ),
    rh.from("parametros_empresa").select("vigente_desde, rat_pct, fap"),
    // Uma por funcionário (e por vigência), além das de cargo e departamento.
    lerTudo(() =>
      rh
        .from("jornadas")
        .select(
          "departamento_id, cargo_id, colaborador_id, horas_mes_min, vigente_desde",
        )
        .order("id"),
    ),
    lerTudo(() =>
      rh
        .from("colaborador_beneficios")
        .select(
          `colaborador_id, valor_manual,
           beneficio:beneficios(id, nome, tipo, valor_padrao, rubricas_desconto,
             rubricas_desconto_dependente, dependente_regra, dependente_valor, ativo),
           colaborador:colaboradores(nascimento)`,
        )
        .lte("desde", fim)
        .or(`ate.is.null,ate.gte.${competencia}`)
        .order("id"),
    ),
    rh
      .from("beneficio_contratos")
      .select(
        `tipo_contrato,
         beneficio:beneficios(id, nome, tipo, valor_padrao, rubricas_desconto,
           rubricas_desconto_dependente, dependente_regra, dependente_valor, ativo)`,
      )
      .lte("desde", fim)
      .or(`ate.is.null,ate.gte.${competencia}`),
    rh
      .from("plano_tabelas")
      .select(
        "beneficio_id, vigente_desde, faixas:plano_faixas_etarias(idade_min, idade_max, mensalidade)",
      )
      .lte("vigente_desde", competencia),
    lerTudo(() =>
      rh
        .from("dependentes")
        .select("colaborador_id, nascimento, tem_plano, tem_odonto")
        .order("id"),
    ),
    lerTudo(() =>
      rh
        .from("valores_pj")
        .select("colaborador_id, valor")
        .order("colaborador_id"),
    ),
  ]);
  for (const r of [encargos, empresa, porContrato, tabelas]) falhar(r.error);

  return {
    folha,
    pessoas,
    rubricasFolha,
    cadastro: new Map(cadastro.map((c) => [c.id, c])),
    socios: deFora,
    grupos: new Map(rubricas.map((r) => [r.codigo, r.grupo as GrupoRubrica])),
    encargos: encargos.data ?? [],
    empresa: empresa.data ?? [],
    jornadas,
    vinculos,
    porContrato: porContrato.data ?? [],
    tabelas: tabelas.data ?? [],
    dependentes,
    valoresPj: new Map(
      valoresPj.map((v) => [v.colaborador_id, Number(v.valor)]),
    ),
  };
}

/**
 * Sócios (como rh.socios(), que a service role não roda por não ter usuário):
 * contrato de pró-labore no Copiloto ou em alguma folha, ou rubrica de
 * pró-labore em alguma folha (o grupo vem junto, pela rubrica). As duas da
 * folha juntam todos os meses: de mil em mil.
 */
async function sociosDoCusto(admin: AdminClient): Promise<Set<string>> {
  const rh = admin.schema("rh");
  const [cadastro, folha, rubricas] = await Promise.all([
    lerTudo(() =>
      rh
        .from("colaboradores")
        .select("id")
        .eq("tipo_contrato", "pro_labore")
        .order("id"),
    ),
    lerTudo(() =>
      rh
        .from("folha_colaboradores")
        .select("colaborador_id")
        .eq("tipo_contrato", "pro_labore")
        .order("folha_id")
        .order("colaborador_id"),
    ),
    lerTudo(() =>
      rh
        .from("folha_rubricas")
        .select("colaborador_id, rubrica:rubricas!inner(grupo)")
        .eq("rubrica.grupo", "pro_labore")
        .order("id"),
    ),
  ]);
  return new Set([
    ...cadastro.map((c) => c.id),
    ...folha.map((c) => c.colaborador_id),
    ...rubricas.map((c) => c.colaborador_id),
  ]);
}

type Dados = Awaited<ReturnType<typeof carregar>>;

/**
 * Benefícios de cada pessoa com o valor cheio resolvido (manual, padrão ou
 * faixa): os vinculados a ela e os do tipo de contrato dela (o dela vence).
 */
function beneficiosPorPessoa(
  d: Dados,
  competencia: string,
  tipoDe: Map<string, string>,
): Map<string, { beneficios: BeneficioDoMes[]; pendencias: string[] }> {
  // Uma vez por benefício e por pessoa, não uma busca na lista inteira a
  // cada vínculo (a ordem dentro de cada grupo é a da consulta).
  const tabelasDe = Map.groupBy(d.tabelas, (t) => t.beneficio_id);
  const dependentesDe = Map.groupBy(d.dependentes, (x) => x.colaborador_id);
  const faixasPorBeneficio = new Map<string, FaixaEtaria[] | null>();
  const faixasDe = (beneficioId: string): FaixaEtaria[] | null => {
    if (faixasPorBeneficio.has(beneficioId))
      return faixasPorBeneficio.get(beneficioId) ?? null;
    const t = vigenteEm(tabelasDe.get(beneficioId) ?? [], competencia);
    const faixas = t
      ? t.faixas.map((f) => ({
          idade_min: f.idade_min,
          idade_max: f.idade_max,
          mensalidade: Number(f.mensalidade),
        }))
      : null;
    faixasPorBeneficio.set(beneficioId, faixas);
    return faixas;
  };
  const porFaixa = (faixas: FaixaEtaria[] | null, nascimento: string | null) =>
    valorPelaFaixa(faixas, nascimento, competencia);

  const jaTem = new Set(
    d.vinculos.map((v) => `${v.colaborador_id}:${v.beneficio?.id}`),
  );
  const doContrato = [...tipoDe].flatMap(([colaborador_id, tipo]) =>
    d.porContrato.flatMap((c) => {
      const chave = `${colaborador_id}:${c.beneficio?.id}`;
      if (c.tipo_contrato !== tipo || !c.beneficio || jaTem.has(chave))
        return [];
      jaTem.add(chave);
      return [
        {
          colaborador_id,
          valor_manual: null,
          beneficio: c.beneficio,
          colaborador: {
            nascimento: d.cadastro.get(colaborador_id)?.nascimento ?? null,
          },
        },
      ];
    }),
  );

  const mapa = new Map<
    string,
    { beneficios: BeneficioDoMes[]; pendencias: string[] }
  >();
  for (const v of [...d.vinculos, ...doContrato]) {
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
      const deps = (dependentesDe.get(v.colaborador_id) ?? []).filter(
        (x) =>
          (b.tipo === "plano_saude" && x.tem_plano) ||
          (b.tipo === "odonto" && x.tem_odonto),
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
          provisiona_recesso: e.provisiona_recesso,
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
  const jornadas = d.jornadas.map((j) => ({
    ...j,
    horas_mes_min: Number(j.horas_mes_min),
  }));
  const fim = fimDoMes(competencia);

  // Só quem está no Copiloto RH (todo colaborador do sistema vem de lá; a
  // folha se liga pela matrícula). Departamento, cargo e contrato são os do
  // cadastro; a folha só completa o que faltar. Sócio fica fora; desligado
  // só entra até o mês da rescisão. PJ sai do cadastro, não da folha.
  const doMes = new Map<
    string,
    {
      tipo_contrato: string;
      departamento_id: string | null;
      cargo_id: string | null;
      folha?: (typeof d.pessoas)[number];
    }
  >();
  for (const p of d.pessoas) {
    const c = d.cadastro.get(p.colaborador_id);
    if (!c || d.socios.has(c.id) || c.tipo_contrato === "pj") continue;
    if (c.desligamento && c.desligamento < competencia) continue;
    doMes.set(c.id, {
      tipo_contrato: c.tipo_contrato ?? p.tipo_contrato,
      departamento_id: c.departamento_id ?? p.departamento_id,
      cargo_id: c.cargo_id ?? p.cargo_id,
      folha: p,
    });
  }
  for (const c of d.cadastro.values()) {
    if (c.tipo_contrato !== "pj" || d.socios.has(c.id)) continue;
    if (!c.admissao || c.admissao > fim) continue;
    if (c.desligamento && c.desligamento < competencia) continue;
    doMes.set(c.id, {
      tipo_contrato: "pj",
      departamento_id: c.departamento_id,
      cargo_id: c.cargo_id,
    });
  }

  const beneficios = beneficiosPorPessoa(
    d,
    competencia,
    new Map([...doMes].map(([id, p]) => [id, p.tipo_contrato])),
  );
  const pessoas: PessoaDoMes[] = [...doMes].map(([colaborador_id, p]) => {
    const b = beneficios.get(colaborador_id);
    const base = {
      colaborador_id,
      tipo_contrato: p.tipo_contrato,
      departamento_id: p.departamento_id,
      cargo_id: p.cargo_id,
      beneficios: b?.beneficios ?? [],
      pendencias: b?.pendencias,
    };
    // PJ: o custo é o valor mensal do contrato (Salário no Copiloto RH).
    if (!p.folha)
      return {
        ...base,
        salario: null,
        jornada_min: jornadaDe(base, jornadas, competencia, null),
        rubricas: [],
        valor_pj: d.valoresPj.get(colaborador_id) ?? null,
      };
    return {
      ...base,
      salario: p.folha.salario === null ? null : Number(p.folha.salario),
      jornada_min: jornadaDe(
        base,
        jornadas,
        competencia,
        p.folha.horas_mes_min,
      ),
      rubricas: rubricasDe.get(colaborador_id) ?? [],
    };
  });

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

/**
 * Recalcula e grava o custo da competência. Só mês com folha; folha fechada
 * fica como está.
 */
export async function recalcularCusto(
  competencia: string,
  admin: AdminClient = createAdminClient(),
): Promise<ResultadoCusto | null> {
  const dados = await carregar(admin, competencia);
  if (!dados.folha || dados.folha.status === "fechada") return null;
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
  // Cada competência é independente (lê e grava só o próprio mês): todas ao
  // mesmo tempo, na ordem dos meses no resultado.
  const feitos = await Promise.all(
    (data ?? []).map((f) => recalcularCusto(f.competencia, admin)),
  );
  return feitos.filter((r): r is ResultadoCusto => r !== null);
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
