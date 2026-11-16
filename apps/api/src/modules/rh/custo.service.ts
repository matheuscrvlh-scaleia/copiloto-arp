import { fimDoMes } from "@arp/shared/formato";
import {
  type BeneficioDoMes,
  type CustoCalculado,
  calcularCusto,
  DIVISOES_RATEIO,
  diasNoMes,
  type FaixaEtaria,
  jornadaDe,
  type PessoaDoMes,
  type PessoaDoRateio,
  parteDoRateio,
  quemEntraNoRateio,
  type RubricaDaFolha,
  valorLancadoNoMes,
  valorPelaFaixa,
  vigenteEm,
} from "@arp/shared/rh/custo";
import type { GrupoRubrica } from "@arp/shared/rh/rubricas";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import * as repo from "./custo.repository";

// Calcula e grava o custo de pessoal de uma competência (seção 4.4; custo.ts
// do antigo). Usa a service role: chamar só depois de conferir a permissão
// de quem pediu (a sincronização do Copiloto RH chama como rotina). A conta
// é a regra pura de @arp/shared/rh/custo; aqui só se juntam os dados.

/** Os dados de uma competência, lidos numa transação só. */
async function carregar(tx: Tx, competencia: string) {
  const fim = fimDoMes(competencia);
  const folha = (await repo.folhaDaCompetencia(tx, competencia)) ?? null;
  const rubricas = await repo.gruposDasRubricas(tx);
  const pessoas = folha ? await repo.pessoasDaFolha(tx, folha.id) : [];
  const rubricasFolha = folha ? await repo.rubricasDaFolha(tx, folha.id) : [];
  const cadastro = await repo.cadastro(tx);
  const socios = await repo.socios(tx);
  const encargos = await repo.encargos(tx);
  const empresa = await repo.empresa(tx);
  const jornadas = await repo.jornadas(tx);
  const vinculos = await repo.vinculos(tx, competencia, fim);
  const porContrato = await repo.porContrato(tx, competencia, fim);
  const tabelas = await repo.tabelasDoPlano(tx, competencia);
  const dependentes = await repo.dependentes(tx);
  const valoresPj = await repo.valoresPj(tx);
  const lancados = await repo.lancados(tx, competencia);
  const rateados = await repo.rateados(tx);
  const totais = await repo.totais(tx, competencia);
  return {
    folha,
    pessoas,
    rubricasFolha,
    cadastro: new Map(cadastro.map((c) => [c.id, c])),
    socios,
    grupos: new Map(
      rubricas.map((r): [number, GrupoRubrica] => [r.codigo, r.grupo]),
    ),
    encargos,
    empresa,
    jornadas,
    vinculos,
    porContrato,
    tabelas,
    dependentes,
    valoresPj: new Map(valoresPj.map((v) => [v.colaborador_id, v.valor])),
    lancados,
    rateados,
    totais,
  };
}

export type DadosDoCusto = Awaited<ReturnType<typeof carregar>>;

type BeneficioDaConsulta = DadosDoCusto["vinculos"][number];
type Beneficios = Map<
  string,
  { beneficios: BeneficioDoMes[]; pendencias: string[] }
>;

/** Map.groupBy (ES2024), na ordem em que os itens vêm. */
function agrupar<T, K>(itens: T[], chave: (i: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const i of itens) {
    const k = chave(i);
    const lista = m.get(k);
    if (lista) lista.push(i);
    else m.set(k, [i]);
  }
  return m;
}

/**
 * Benefícios de cada pessoa com o valor cheio resolvido (lançado no mês, se
 * o benefício varia por mês; senão manual, padrão ou faixa): os vinculados a
 * ela e os do tipo de contrato dela (o dela vence).
 */
function beneficiosPorPessoa(
  d: DadosDoCusto,
  competencia: string,
  tipoDe: Map<string, string>,
): Beneficios {
  // Uma vez por benefício e por pessoa, não uma busca na lista inteira a
  // cada vínculo (a ordem dentro de cada grupo é a da consulta).
  const tabelasDe = agrupar(d.tabelas, (t) => t.beneficio_id);
  const dependentesDe = agrupar(d.dependentes, (x) => x.colaborador_id);
  const lancadosDe = agrupar(
    d.lancados,
    (l) => `${l.beneficio_id}:${l.colaborador_id}`,
  );
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

  const jaTem = new Set(d.vinculos.map((v) => `${v.colaborador_id}:${v.id}`));
  const doContrato: BeneficioDaConsulta[] = [...tipoDe].flatMap(
    ([colaborador_id, tipo]) =>
      d.porContrato.flatMap(({ tipo_contrato, ...b }) => {
        const chave = `${colaborador_id}:${b.id}`;
        if (tipo_contrato !== tipo || jaTem.has(chave)) return [];
        jaTem.add(chave);
        return [
          {
            ...b,
            colaborador_id,
            valor_manual: null,
            nascimento: d.cadastro.get(colaborador_id)?.nascimento ?? null,
          },
        ];
      }),
  );

  const mapa: Beneficios = new Map();
  for (const b of [...d.vinculos, ...doContrato]) {
    // Rateado entra pela divisão (rateadosPorPessoa), não pelo vínculo.
    if (!b.ativo || b.forma_calculo === "rateado") continue;
    const item = mapa.get(b.colaborador_id) ?? {
      beneficios: [],
      pendencias: [],
    };
    const faixas =
      b.tipo === "plano_saude" || b.tipo === "odonto" ? faixasDe(b.id) : null;
    const titular = b.valor_por_mes
      ? valorLancadoNoMes(
          lancadosDe.get(`${b.id}:${b.colaborador_id}`) ?? [],
          competencia,
        )
      : b.valor_manual !== null
        ? { valor: Number(b.valor_manual) }
        : b.valor_padrao !== null
          ? { valor: Number(b.valor_padrao) }
          : porFaixa(faixas, b.nascimento);
    if ("aviso" in titular && titular.aviso)
      item.pendencias.push(`${b.nome}: ${titular.aviso}.`);

    // Dependentes: só plano e odonto; a empresa paga o que a regra mandar.
    let dependentes = 0;
    if (b.dependente_regra !== "nao_paga" && b.dependente_valor !== null) {
      const deps = (dependentesDe.get(b.colaborador_id) ?? []).filter(
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
      pendencia: "pendencia" in titular ? titular.pendencia : undefined,
      rubricas_desconto: b.rubricas_desconto,
      rubricas_desconto_dependente: b.rubricas_desconto_dependente,
      dependentes: Math.round(dependentes * 100) / 100,
    });
    mapa.set(b.colaborador_id, item);
  }
  return mapa;
}

/**
 * Benefícios rateados de cada pessoa: o total do mês (o padrão ou, se varia
 * por mês, o lançado) ÷ quem entra na divisão entre as pessoas do custo.
 */
function rateadosPorPessoa(
  d: DadosDoCusto,
  competencia: string,
  pessoas: PessoaDoRateio[],
): Beneficios {
  const mapa: Beneficios = new Map();
  const totaisDe = agrupar(d.totais, (t) => t.beneficio_id);
  for (const b of d.rateados) {
    const divisao = quemEntraNoRateio(b, pessoas);
    if (divisao.length === 0) continue;
    const total: { valor: number | null; aviso?: string; pendencia?: string } =
      b.valor_por_mes
        ? valorLancadoNoMes(totaisDe.get(b.id) ?? [], competencia)
        : { valor: b.valor_padrao === null ? null : Number(b.valor_padrao) };
    const parte =
      total.valor === null ? null : parteDoRateio(total.valor, divisao.length);
    const quem =
      b.dividir_entre === "ativos" ||
      b.dividir_entre === "ativos_nao_afastados" ||
      b.dividir_entre === "departamento"
        ? DIVISOES_RATEIO[b.dividir_entre]
        : "pessoas";
    for (const p of divisao) {
      const item = mapa.get(p.colaborador_id) ?? {
        beneficios: [],
        pendencias: [],
      };
      if (total.aviso) item.pendencias.push(`${b.nome}: ${total.aviso}.`);
      item.beneficios.push({
        nome: b.nome,
        valor: parte,
        pendencia: total.pendencia
          ? `total do rateio ${total.pendencia}`
          : undefined,
        rubricas_desconto: b.rubricas_desconto,
        rubricas_desconto_dependente: b.rubricas_desconto_dependente,
        dependentes: 0,
        regra:
          total.valor === null
            ? undefined
            : `Rateio: total ${total.valor.toFixed(2)} ÷ ${divisao.length} ${divisao.length === 1 ? "pessoa" : "pessoas"} (${quem.toLowerCase()})`,
      });
      mapa.set(p.colaborador_id, item);
    }
  }
  return mapa;
}

export function montarCustos(
  d: DadosDoCusto,
  competencia: string,
): CustoCalculado[] {
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
      descricao: r.descricao ?? String(r.rubrica_codigo),
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
      folha?: DadosDoCusto["pessoas"][number];
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
  const rateados = rateadosPorPessoa(
    d,
    competencia,
    [...doMes].map(([colaborador_id, p]) => ({
      colaborador_id,
      departamento_id: p.departamento_id,
      situacao: p.folha?.situacao ?? null,
    })),
  );
  for (const [id, r] of rateados) {
    const item = beneficios.get(id) ?? { beneficios: [], pendencias: [] };
    item.beneficios.push(...r.beneficios);
    item.pendencias.push(...r.pendencias);
    beneficios.set(id, item);
  }
  const pessoas: PessoaDoMes[] = [...doMes].map(([colaborador_id, p]) => {
    const b = beneficios.get(colaborador_id);
    const c = d.cadastro.get(colaborador_id);
    const base = {
      colaborador_id,
      dias_no_mes: diasNoMes(
        competencia,
        c?.admissao ?? null,
        c?.desligamento ?? null,
      ),
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
      valor_fgts:
        p.folha.valor_fgts === null ? null : Number(p.folha.valor_fgts),
      situacao: p.folha.situacao,
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

/** Os dados da competência e a conta, sem gravar (conferência e testes). */
export async function calcularCompetencia(
  competencia: string,
): Promise<{ status: string | null; custos: CustoCalculado[] }> {
  const dados = await banco.comoServico((tx) => carregar(tx, competencia));
  return {
    status: dados.folha?.status ?? null,
    custos: dados.folha ? montarCustos(dados, competencia) : [],
  };
}

export interface ResultadoCusto {
  competencia: string;
  pessoas: number;
  comPendencia: number;
}

/**
 * Recalcula e grava o custo da competência. Só mês com folha; folha fechada
 * fica como está. Lê numa transação, calcula fora dela e grava em outra.
 */
export async function recalcularCusto(
  competencia: string,
): Promise<ResultadoCusto | null> {
  const { status, custos } = await calcularCompetencia(competencia);
  if (status === null || status === "fechada") return null;
  await banco.comoServico((tx) => repo.gravarCustos(tx, competencia, custos));
  return {
    competencia,
    pessoas: custos.length,
    comPendencia: custos.filter((c) => c.memoria.pendencias.length > 0).length,
  };
}

/**
 * Recalcula todas as competências em aberto (folha não fechada). Usado
 * quando muda algo que vale para todos os meses: rubrica, encargo, RAT/FAP.
 * Com `desde`, só as competências a partir dela (o que mudou não alcança os
 * meses anteriores). Uma competência por vez, na ordem dos meses.
 */
export async function recalcularEmAberto(
  desde?: string,
): Promise<ResultadoCusto[]> {
  const folhas = await banco.comoServico((tx) =>
    repo.competenciasEmAberto(tx, desde),
  );
  const feitos: ResultadoCusto[] = [];
  for (const f of folhas) {
    const r = await recalcularCusto(f.competencia);
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
  } catch (err) {
    log.error({ err }, "recálculo do custo");
    return false;
  }
}
