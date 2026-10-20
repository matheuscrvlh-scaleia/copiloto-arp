import { GRUPOS_RUBRICA, type GrupoRubrica } from "./rubricas";

// Custo mensal por funcionário (especificação do RH, seção 4.4). Função pura:
// o servidor carrega folha, parâmetros e benefícios e grava o resultado em
// rh.custos_colaborador. Percentuais vêm como no banco: 20 = 20%.

export type Natureza = "provento" | "desconto" | "informativa";

export interface RubricaDaFolha {
  codigo: number;
  descricao: string;
  natureza: Natureza;
  valor: number;
}

export interface EncargosDoContrato {
  inss_patronal_pct: number;
  terceiros_pct: number;
  fgts_pct: number;
  aplica_rat: boolean;
  provisiona_13: boolean;
  provisiona_ferias: boolean;
  multa_rescisoria_pct: number;
}

/** RAT e FAP da empresa vigentes na competência (null: não configurados). */
export interface RatFap {
  rat_pct: number;
  fap: number;
}

/** Benefício do funcionário com o valor cheio já resolvido. */
export interface BeneficioDoMes {
  nome: string;
  /** Valor cheio do titular (manual, padrão ou faixa); null se não deu. */
  valor: number | null;
  /** Por que o valor não saiu (ex.: falta a data de nascimento). */
  pendencia?: string;
  /** Rubricas com o que o funcionário paga do titular. */
  rubricas_desconto: number[];
  /** Rubricas com o que ele paga dos dependentes (repasse, não abate). */
  rubricas_desconto_dependente: number[];
  /** Quanto a empresa paga dos dependentes. */
  dependentes: number;
}

export interface PessoaDoMes {
  colaborador_id: string;
  tipo_contrato: string;
  departamento_id: string | null;
  cargo_id: string | null;
  salario: number | null;
  jornada_min: number | null;
  rubricas: RubricaDaFolha[];
  beneficios: BeneficioDoMes[];
  /** PJ: soma das notas do mês (o custo é a nota). */
  valor_notas?: number;
  /** Avisos de quem montou os dados (ex.: dependente sem faixa). */
  pendencias?: string[];
}

export interface LinhaMemoria {
  rotulo: string;
  valor: number;
  regra: string;
}

export interface CustoCalculado {
  colaborador_id: string;
  departamento_id: string | null;
  cargo_id: string | null;
  tipo_contrato: string;
  remuneracao: number;
  encargos: number;
  provisao_13: number;
  provisao_ferias: number;
  multa_rescisoria: number;
  beneficios: number;
  rescisao: number;
  reembolsos: number;
  custo_total: number;
  jornada_min: number | null;
  custo_hora: number | null;
  salario_hora: number | null;
  memoria: { linhas: LinhaMemoria[]; pendencias: string[] };
}

const REMUNERACAO: GrupoRubrica[] = [
  "salario",
  "pro_labore",
  "adicional",
  "hora_extra",
];

const centavos = (v: number) => Math.round(v * 100);
const arred = (v: number) => centavos(v) / 100;
const pct = (v: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(v)}%`;

/** Provento soma, desconto subtrai, informativa não conta. */
function assinado(r: RubricaDaFolha): number {
  if (r.natureza === "provento") return r.valor;
  if (r.natureza === "desconto") return -r.valor;
  return 0;
}

/** % total de encargos do contrato: INSS + Terceiros + FGTS + RAT × FAP. */
export function encargosPct(e: EncargosDoContrato, rat: RatFap | null): number {
  const ratAjustado = e.aplica_rat && rat ? rat.rat_pct * rat.fap : 0;
  return e.inss_patronal_pct + e.terceiros_pct + e.fgts_pct + ratAjustado;
}

export function calcularCusto(
  p: PessoaDoMes,
  grupoDe: (codigo: number) => GrupoRubrica | undefined,
  encargos: EncargosDoContrato | null,
  rat: RatFap | null,
): CustoCalculado {
  const linhas: LinhaMemoria[] = [];
  const pendencias: string[] = [...(p.pendencias ?? [])];
  const somaDo = (grupos: GrupoRubrica[]) =>
    p.rubricas
      .filter((r) => {
        const g = grupoDe(r.codigo);
        return g !== undefined && grupos.includes(g);
      })
      .reduce((s, r) => s + assinado(r), 0);

  for (const r of p.rubricas) {
    const g = grupoDe(r.codigo);
    if (g === undefined || g === "nao_classificada") {
      pendencias.push(
        `Rubrica ${r.codigo} (${r.descricao}) não classificada: ficou fora do custo.`,
      );
    }
  }

  // Remuneração: grupos Salário, Pró-labore, Adicionais e Horas extras; no
  // PJ, a nota do mês.
  const ehPj = p.valor_notas !== undefined;
  const remuneracao = arred(ehPj ? (p.valor_notas ?? 0) : somaDo(REMUNERACAO));
  linhas.push({
    rotulo: "Remuneração",
    valor: remuneracao,
    regra: ehPj
      ? "Notas do PJ no mês"
      : "Salário + pró-labore + adicionais + horas extras da folha",
  });

  if (!encargos) {
    pendencias.push(
      `Sem encargos cadastrados para o contrato ${p.tipo_contrato}: encargos e provisões ficaram zerados.`,
    );
  } else if (encargos.aplica_rat && !rat) {
    pendencias.push(
      "RAT e FAP não configurados em Parâmetros: encargos calculados sem o RAT.",
    );
  }

  const enc = encargos ? encargosPct(encargos, rat) : 0;
  const valorEncargos = arred((remuneracao * enc) / 100);
  linhas.push({
    rotulo: "Encargos do mês",
    valor: valorEncargos,
    regra: encargos
      ? `Remuneração × ${pct(enc)} (INSS ${pct(encargos.inss_patronal_pct)} + Terceiros ${pct(encargos.terceiros_pct)} + FGTS ${pct(encargos.fgts_pct)}${encargos.aplica_rat ? ` + RAT ${rat ? `${pct(rat.rat_pct)} × FAP ${rat.fap}` : "não configurado"}` : ""})`
      : "Sem encargos para o contrato",
  });

  // Provisões com todos os encargos do contrato por cima (não só o FGTS).
  const comEncargos = 1 + enc / 100;
  const provisao13 = encargos?.provisiona_13
    ? arred((remuneracao / 12) * comEncargos)
    : 0;
  linhas.push({
    rotulo: "Provisão de 13º",
    valor: provisao13,
    regra: encargos?.provisiona_13
      ? `Remuneração ÷ 12 × (1 + ${pct(enc)})`
      : "Contrato sem provisão de 13º",
  });
  const provisaoFerias = encargos?.provisiona_ferias
    ? arred((remuneracao / 12) * (4 / 3) * comEncargos)
    : 0;
  linhas.push({
    rotulo: "Provisão de férias",
    valor: provisaoFerias,
    regra: encargos?.provisiona_ferias
      ? `Remuneração ÷ 12 × 4/3 × (1 + ${pct(enc)})`
      : "Contrato sem provisão de férias",
  });

  // Multa rescisória: % sobre o FGTS do mês, sem dividir por 12.
  const multa = encargos
    ? arred(
        (((remuneracao * encargos.fgts_pct) / 100) *
          encargos.multa_rescisoria_pct) /
          100,
      )
    : 0;
  linhas.push({
    rotulo: "Multa rescisória provisionada",
    valor: multa,
    regra: encargos
      ? `${pct(encargos.multa_rescisoria_pct)} do FGTS do mês (remuneração × ${pct(encargos.fgts_pct)})`
      : "Sem encargos para o contrato",
  });

  // Benefícios: valor cheio − o que o funcionário paga do titular + o que a
  // empresa paga dos dependentes.
  const descontoDe = (codigos: number[]) =>
    p.rubricas
      .filter((r) => codigos.includes(r.codigo))
      .reduce((s, r) => s - assinado(r), 0);
  const vinculadas = new Set(
    p.beneficios.flatMap((b) => [
      ...b.rubricas_desconto,
      ...b.rubricas_desconto_dependente,
    ]),
  );
  let beneficios = 0;
  for (const b of p.beneficios) {
    if (b.valor === null) {
      pendencias.push(
        `${b.nome}: ${b.pendencia ?? "sem valor"}; ficou fora do custo.`,
      );
      continue;
    }
    const pago = arred(descontoDe(b.rubricas_desconto));
    const custo = arred(b.valor - pago + b.dependentes);
    beneficios += custo;
    linhas.push({
      rotulo: b.nome,
      valor: custo,
      regra: `Valor ${b.valor.toFixed(2)} − pago pelo funcionário ${pago.toFixed(2)}${b.dependentes ? ` + dependentes ${b.dependentes.toFixed(2)}` : ""}`,
    });
  }
  for (const r of p.rubricas) {
    if (grupoDe(r.codigo) === "beneficio_desconto" && !vinculadas.has(r.codigo))
      pendencias.push(
        `Desconto de benefício ${r.codigo} (${r.descricao}) sem benefício vinculado ao funcionário.`,
      );
  }
  beneficios = arred(beneficios);

  const rescisao = arred(somaDo(["rescisao"]));
  if (rescisao !== 0)
    linhas.push({
      rotulo: "Rescisão",
      valor: rescisao,
      regra: "Verbas do grupo Rescisão (ex.: aviso prévio indenizado)",
    });

  // Informativo: o que foi pago e já estava provisionado ou foi compensado.
  const provisionado = arred(somaDo(["pagamento_provisionado"]));
  if (provisionado !== 0)
    linhas.push({
      rotulo: GRUPOS_RUBRICA.pagamento_provisionado,
      valor: 0,
      regra: `Pago ${provisionado.toFixed(2)}: consome a provisão, não entra de novo`,
    });
  const salarioFamilia = arred(somaDo(["reembolso_inss"]));
  if (salarioFamilia !== 0)
    linhas.push({
      rotulo: GRUPOS_RUBRICA.reembolso_inss,
      valor: 0,
      regra: `Pago ${salarioFamilia.toFixed(2)} e compensado na guia do INSS: não entra`,
    });

  const reembolsos = 0;
  const custoTotal =
    (centavos(remuneracao) +
      centavos(valorEncargos) +
      centavos(provisao13) +
      centavos(provisaoFerias) +
      centavos(multa) +
      centavos(beneficios) +
      centavos(rescisao) -
      centavos(reembolsos)) /
    100;

  const horas = p.jornada_min ? p.jornada_min / 60 : null;
  if (!horas) pendencias.push("Sem jornada: custo por hora não calculado.");
  return {
    colaborador_id: p.colaborador_id,
    departamento_id: p.departamento_id,
    cargo_id: p.cargo_id,
    tipo_contrato: p.tipo_contrato,
    remuneracao,
    encargos: valorEncargos,
    provisao_13: provisao13,
    provisao_ferias: provisaoFerias,
    multa_rescisoria: multa,
    beneficios,
    rescisao,
    reembolsos,
    custo_total: custoTotal,
    jornada_min: p.jornada_min,
    custo_hora: horas
      ? Math.round((custoTotal / horas) * 10_000) / 10_000
      : null,
    salario_hora:
      horas && p.salario !== null
        ? Math.round((p.salario / horas) * 10_000) / 10_000
        : null,
    memoria: { linhas, pendencias },
  };
}

// ---------------------------------------------------------------------------
// Apoio: jornada em níveis, vigência, idade e faixa do plano.
// ---------------------------------------------------------------------------

export interface Jornada {
  departamento_id: string | null;
  cargo_id: string | null;
  colaborador_id: string | null;
  horas_mes_min: number;
  vigente_desde: string;
}

/**
 * Jornada vigente na competência: colaborador > cargo > departamento >
 * empresa; sem nenhuma, a "Horas Mês" da folha.
 */
export function jornadaDe(
  p: Pick<PessoaDoMes, "colaborador_id" | "cargo_id" | "departamento_id">,
  jornadas: Jornada[],
  competencia: string,
  daFolha: number | null,
): number | null {
  const vigentes = jornadas
    .filter((j) => j.vigente_desde <= competencia)
    .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde));
  const niveis = [
    vigentes.find((j) => j.colaborador_id === p.colaborador_id),
    vigentes.find((j) => p.cargo_id && j.cargo_id === p.cargo_id),
    vigentes.find(
      (j) =>
        p.departamento_id &&
        j.departamento_id === p.departamento_id &&
        !j.cargo_id &&
        !j.colaborador_id,
    ),
    vigentes.find(
      (j) => !j.colaborador_id && !j.cargo_id && !j.departamento_id,
    ),
  ];
  return niveis.find((j) => j)?.horas_mes_min ?? daFolha;
}

/** Registro vigente na competência (o mais recente com vigente_desde ≤). */
export function vigenteEm<T extends { vigente_desde: string }>(
  registros: T[],
  competencia: string,
): T | null {
  return (
    registros
      .filter((r) => r.vigente_desde <= competencia)
      .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0] ?? null
  );
}

/** Idade completa em `data` (aaaa-mm-dd). */
export function idadeEm(nascimento: string, data: string): number {
  const [an, mn, dn] = nascimento.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  return a - an - (m < mn || (m === mn && d < dn) ? 1 : 0);
}

export interface FaixaEtaria {
  idade_min: number;
  idade_max: number | null;
  mensalidade: number;
}

export function mensalidadeDaFaixa(
  faixas: FaixaEtaria[],
  idade: number,
): number | null {
  const f = faixas.find(
    (f) =>
      idade >= f.idade_min && (f.idade_max === null || idade <= f.idade_max),
  );
  return f ? f.mensalidade : null;
}

// ---------------------------------------------------------------------------
// Somas para as telas (a partir de rh.custo_agregado).
// ---------------------------------------------------------------------------

export interface CustoAgregado {
  competencia: string;
  departamento_id: string | null;
  cargo_id: string | null;
  tipo_contrato: string;
  colaboradores: number;
  remuneracao: number;
  encargos: number;
  provisoes: number;
  beneficios: number;
  rescisao: number;
  reembolsos: number;
  custo_total: number;
}

export type TotaisCusto = Omit<
  CustoAgregado,
  "competencia" | "departamento_id" | "cargo_id" | "tipo_contrato"
>;

export function somarCustos(linhas: CustoAgregado[]): TotaisCusto {
  const t: TotaisCusto = {
    colaboradores: 0,
    remuneracao: 0,
    encargos: 0,
    provisoes: 0,
    beneficios: 0,
    rescisao: 0,
    reembolsos: 0,
    custo_total: 0,
  };
  for (const l of linhas) {
    for (const k of Object.keys(t) as (keyof TotaisCusto)[]) t[k] += l[k];
  }
  for (const k of Object.keys(t) as (keyof TotaisCusto)[]) t[k] = arred(t[k]);
  return t;
}

/** Totais por chave (departamento, cargo, contrato), do maior custo ao menor. */
export function custosPor(
  linhas: CustoAgregado[],
  chave: (l: CustoAgregado) => string | null,
): { chave: string | null; totais: TotaisCusto }[] {
  const grupos = new Map<string | null, CustoAgregado[]>();
  for (const l of linhas) {
    const k = chave(l);
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  return [...grupos]
    .map(([k, ls]) => ({ chave: k, totais: somarCustos(ls) }))
    .sort((a, b) => b.totais.custo_total - a.totais.custo_total);
}

/** Custo de uma pessoa como as telas mostram (provisões já somadas). */
export interface CustoIndividual {
  colaborador_id: string;
  nome: string;
  matricula: number | null;
  departamento_id: string | null;
  departamento: string;
  cargo: string;
  tipo_contrato: string;
  remuneracao: number;
  encargos: number;
  provisoes: number;
  beneficios: number;
  rescisao: number;
  custo_total: number;
  custo_hora: number | null;
  salario_hora: number | null;
  jornada_min: number | null;
  memoria: {
    linhas: { rotulo: string; valor: number; regra: string }[];
    pendencias: string[];
  };
}
