import type { Detalhe, TabelaDetalhe } from "@/components/modal-detalhe";
import {
  formatarData,
  formatarHoras,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { descreverPeriodo } from "@/lib/periodo";
import {
  ativosEm,
  type ColaboradorQuadro,
  type LinhaPonto,
  porSetor,
  somarPonto,
  type TotaisSetor,
} from "./calculos";
import type { CustoIndividual, MemoriaDoCusto, TotaisCusto } from "./custo";
import {
  movimentoEntre,
  tabelaDeHorasPerdidas,
  tabelaDeSaidas,
  tabelaDoBanco,
  tabelaDoPonto,
  tabelaDoQuadro,
} from "./detalhes";
import type { Receita, ValorDoMes } from "./retorno";
import { ROTULO_CONTRATO } from "./rubricas";
import type { NumerosTurnover } from "./turnover";

// Modais "de onde vem este número" das telas do RH: fonte, fórmula e quem
// forma o valor. Lista de pessoas só para quem já as vê nas telas (o
// chamador decide pela permissão); sem ela, o modal mostra só as somas.

type Link = Detalhe["link"];

export const FONTES = {
  ponto: (mes: string, ate: string) =>
    `Ponto (Secullum), de ${formatarData(mes)} a ${formatarData(ate)}; sincronizado todo dia`,
  cadastro:
    "Copiloto RH: colaboradores, admissão, desligamento e motivo (departamento do ponto, cargo da folha)",
  folha: (competencia: string, ficticia: boolean) =>
    `Extrato Mensal da Sousa e Couto de ${formatarMes(competencia)}${ficticia ? " (protótipo: todo salário gravado como R$ 2.000,00)" : ""}`,
  calculo:
    "Recalculado ao importar a folha, classificar rubrica e salvar encargos ou RAT/FAP",
};

const moeda = (v: number) => formatarMoeda(v, 0);

// ---------------------------------------------------------------------------
// Tabelas de somas (sem pessoas)
// ---------------------------------------------------------------------------

function tabelaDePontoPorSetor(setores: TotaisSetor[]): TabelaDetalhe {
  return {
    titulo: "Por setor",
    colunas: [
      { titulo: "Setor" },
      { titulo: "Pessoas", numero: true },
      { titulo: "Previstas", numero: true },
      { titulo: "Faltas", numero: true },
      { titulo: "Atrasos", numero: true },
      { titulo: "Absenteísmo", numero: true },
    ],
    linhas: setores.map((s) => ({
      chave: s.departamento_id ?? "sem",
      celulas: [
        s.departamento,
        String(s.colaboradores),
        formatarHoras(s.previstas_min),
        formatarHoras(s.faltas_min),
        formatarHoras(s.atrasos_min),
        formatarPct(s.absenteismo),
      ],
      ordem: [
        s.departamento,
        s.colaboradores,
        s.previstas_min,
        s.faltas_min,
        s.atrasos_min,
        s.absenteismo,
      ],
    })),
    vazio: "Ninguém no ponto deste período.",
  };
}

function tabelaDeBancoPorSetor(
  setores: TotaisSetor[],
  reais?: Map<string | null, number | null>,
): TabelaDetalhe {
  return {
    titulo: "Por setor",
    colunas: [
      { titulo: "Setor" },
      { titulo: "Pessoas", numero: true },
      { titulo: "Positivo", numero: true },
      { titulo: "Negativo", numero: true },
      { titulo: "Saldo", numero: true },
      ...(reais ? [{ titulo: "Positivo em R$", numero: true }] : []),
    ],
    linhas: setores.map((s) => {
      const r = reais?.get(s.departamento_id) ?? null;
      return {
        chave: s.departamento_id ?? "sem",
        celulas: [
          s.departamento,
          String(s.colaboradores),
          `+${formatarHoras(s.banco_positivo_min)}`,
          formatarHoras(s.banco_negativo_min),
          formatarHoras(s.banco_saldo_min),
          ...(reais ? [r === null ? "—" : moeda(r)] : []),
        ],
        ordem: [
          s.departamento,
          s.colaboradores,
          s.banco_positivo_min,
          s.banco_negativo_min,
          s.banco_saldo_min,
          ...(reais ? [r] : []),
        ],
      };
    }),
    vazio: "Ninguém com banco de horas neste período.",
  };
}

function tabelaDeQuadroPorSetor(
  colaboradores: ColaboradorQuadro[],
  titulo: string,
): TabelaDetalhe {
  const n = new Map<string, number>();
  for (const c of colaboradores)
    n.set(c.departamento, (n.get(c.departamento) ?? 0) + 1);
  return {
    titulo,
    colunas: [{ titulo: "Setor" }, { titulo: "Pessoas", numero: true }],
    linhas: [...n]
      .sort((a, b) => b[1] - a[1])
      .map(([setor, q]) => ({
        chave: setor,
        celulas: [setor, String(q)],
        ordem: [setor, q],
      })),
    vazio: "Ninguém aqui.",
  };
}

// ---------------------------------------------------------------------------
// Quadro
// ---------------------------------------------------------------------------

export type FocoQuadro = "ativos" | "admissoes" | "desligamentos" | "turnover";

/**
 * Quadro de um período (de `de` até `fim`): ativos no fim, admissões,
 * desligamentos e turnover.
 */
export function origemDoQuadro(
  colaboradores: ColaboradorQuadro[],
  de: string,
  fim: string,
  opcoes: {
    foco?: FocoQuadro;
    pessoas: boolean;
    link?: Link;
    /**
     * Números do período vindos do Copiloto (GET /v1/turnover). Sem eles
     * (API fora), as contagens saem da lista e o turnover fica em branco,
     * com `semTurnover` explicando por quê.
     */
    numeros?: NumerosTurnover | null;
    semTurnover?: string;
    /** Nome do período nos títulos (ex.: "out/2026"); sem ele, as datas. */
    rotulo?: string;
  },
): Detalhe {
  const foco = opcoes.foco ?? "ativos";
  const n = opcoes.numeros ?? null;
  const nome =
    opcoes.rotulo ?? descreverPeriodo({ de, ate: fim, atalho: null });
  const ativos = ativosEm(colaboradores, fim).sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );
  const { admitidos, desligados } = movimentoEntre(colaboradores, de, fim);

  const tabelas: Record<
    "ativos" | "admissoes" | "desligamentos",
    TabelaDetalhe
  > = opcoes.pessoas
    ? {
        ativos: tabelaDoQuadro(ativos, fim, `Ativos em ${formatarData(fim)}`),
        admissoes: {
          ...tabelaDoQuadro(admitidos, fim, `Admitidos em ${nome}`),
          vazio: "Nenhuma admissão no período.",
        },
        desligamentos: {
          ...tabelaDeSaidas(desligados, `Desligados em ${nome}`),
          vazio: "Nenhum desligamento no período.",
        },
      }
    : {
        ativos: tabelaDeQuadroPorSetor(ativos, "Ativos por setor"),
        admissoes: {
          ...tabelaDeQuadroPorSetor(admitidos, "Admissões por setor"),
          vazio: "Nenhuma admissão no período.",
        },
        desligamentos: {
          ...tabelaDeQuadroPorSetor(desligados, "Desligamentos por setor"),
          vazio: "Nenhum desligamento no período.",
        },
      };
  const ordem: ("ativos" | "admissoes" | "desligamentos")[] =
    foco === "admissoes"
      ? ["admissoes", "desligamentos", "ativos"]
      : foco === "desligamentos"
        ? ["desligamentos", "admissoes", "ativos"]
        : foco === "turnover"
          ? ["admissoes", "desligamentos", "ativos"]
          : ["ativos", "admissoes", "desligamentos"];

  const regra: Record<FocoQuadro, string> = {
    ativos: "Admitido até a data e sem desligamento até ela",
    admissoes: "Data de admissão dentro do período",
    desligamentos:
      "Data de desligamento dentro do período; o tipo vem da decisão (ou do motivo) no Copiloto",
    turnover:
      "Calculado pelo Copiloto RH (Relatórios › Turnover), com as fórmulas configuradas lá; denominador: ativos no primeiro dia",
  };
  const titulos: Record<FocoQuadro, string> = {
    ativos: `Colaboradores ativos em ${formatarData(fim)}`,
    admissoes: `Admissões em ${nome}`,
    desligamentos: `Desligamentos em ${nome}`,
    turnover: `Turnover em ${nome}`,
  };

  return {
    secao: "Quadro",
    titulo: titulos[foco],
    subtitulo: opcoes.pessoas
      ? undefined
      : "Somas por setor (a lista de pessoas fica na tela Quadro e turnover)",
    resumo: [
      { rotulo: "Ativos no fim", valor: String(ativos.length) },
      {
        rotulo: "Admissões",
        valor: String(n?.admissoes ?? admitidos.length),
      },
      {
        rotulo: "Desligamentos",
        valor: String(n?.desligamentos ?? desligados.length),
      },
      ...(n
        ? n.taxas.map((t) => ({
            rotulo: t.rotulo,
            valor: formatarPct(t.valor),
          }))
        : [{ rotulo: "Turnover", valor: "—" }]),
    ],
    fontes: [
      { rotulo: "Fonte", valor: FONTES.cadastro },
      { rotulo: "Regra", valor: regra[foco] },
      ...(foco === "turnover" && n
        ? [{ rotulo: `Ativos em ${formatarData(de)}`, valor: String(n.inicio) }]
        : []),
      ...(!n && opcoes.semTurnover
        ? [{ rotulo: "Turnover", valor: opcoes.semTurnover }]
        : []),
      {
        rotulo: "Atualização",
        valor: "Sincronização diária com o Copiloto RH",
      },
    ],
    tabelas: ordem.map((k) => tabelas[k]),
    link: opcoes.link,
  };
}

/** Desligamentos de um tipo (ex.: voluntário) num período. */
export function origemDeSaidasPorTipo(
  desligados: ColaboradorQuadro[],
  rotulo: string,
  periodo: string,
  pessoas: boolean,
  link?: Link,
): Detalhe {
  return {
    secao: "Desligamentos por tipo",
    titulo: rotulo,
    subtitulo: periodo,
    resumo: [{ rotulo: "Saídas", valor: String(desligados.length) }],
    fontes: [
      { rotulo: "Fonte", valor: FONTES.cadastro },
      {
        rotulo: "Tipo",
        valor:
          "Pelo motivo do desligamento no Copiloto, com a classificação de lá",
      },
    ],
    tabelas: [
      pessoas
        ? tabelaDeSaidas(desligados)
        : tabelaDeQuadroPorSetor(desligados, "Por setor"),
    ],
    link,
  };
}

// ---------------------------------------------------------------------------
// Jornada (ponto)
// ---------------------------------------------------------------------------

interface OpcoesPonto {
  mes: string;
  ate: string;
  pessoas: boolean;
  meta?: string;
  link?: Link;
}

export function origemDoAbsenteismo(
  ponto: LinhaPonto[],
  o: OpcoesPonto,
): Detalhe {
  const t = somarPonto(ponto);
  return {
    secao: "Absenteísmo",
    titulo: `Absenteísmo de ${formatarMes(o.mes)}`,
    resumo: [
      { rotulo: "Absenteísmo", valor: formatarPct(t.absenteismo) },
      { rotulo: "Faltas", valor: formatarHoras(t.faltas_min) },
      { rotulo: "Atrasos", valor: formatarHoras(t.atrasos_min) },
      { rotulo: "Horas previstas", valor: formatarHoras(t.previstas_min) },
    ],
    fontes: [
      { rotulo: "Fonte", valor: FONTES.ponto(o.mes, o.ate) },
      {
        rotulo: "Fórmula",
        valor: "(faltas + atrasos) ÷ horas previstas × 100",
      },
      {
        rotulo: "Fora da conta",
        valor: "Abonos (atestados e afins) aparecem separados na Jornada",
      },
      ...(o.meta ? [{ rotulo: "Meta", valor: `${o.meta} (Parâmetros)` }] : []),
    ],
    tabelas: [
      tabelaDePontoPorSetor(porSetor(ponto)),
      ...(o.pessoas ? [tabelaDoPonto(ponto, "Por pessoa")] : []),
    ],
    link: o.link,
  };
}

export function origemDasHorasPerdidas(
  ponto: LinhaPonto[],
  motivo: "faltas" | "atrasos",
  o: OpcoesPonto,
): Detalhe {
  const t = somarPonto(ponto);
  const total = motivo === "faltas" ? t.faltas_min : t.atrasos_min;
  return {
    secao: "Horas perdidas",
    titulo: motivo === "faltas" ? "Faltas" : "Atrasos",
    subtitulo: `${formatarMes(o.mes)}, da maior para a menor`,
    resumo: [
      { rotulo: "Total", valor: formatarHoras(total) },
      ...(motivo === "faltas"
        ? [{ rotulo: "Dias", valor: formatarNumero(t.faltas_dias, 1) }]
        : []),
      {
        rotulo: "Pessoas",
        valor: String(
          ponto.filter((l) =>
            motivo === "faltas" ? l.faltas_min > 0 : l.atrasos_min > 0,
          ).length,
        ),
      },
    ],
    fontes: [
      { rotulo: "Fonte", valor: FONTES.ponto(o.mes, o.ate) },
      {
        rotulo: "Coluna",
        valor:
          motivo === "faltas"
            ? "Faltas e FaltasDias do cálculo do Secullum"
            : "Atrasos do cálculo do Secullum",
      },
    ],
    tabelas: o.pessoas
      ? [tabelaDeHorasPerdidas(ponto, motivo)]
      : [tabelaDePontoPorSetor(porSetor(ponto))],
    link: o.link,
  };
}

export function origemDosAbonos(
  ponto: LinhaPonto[],
  colunas: string[],
  o: OpcoesPonto,
): Detalhe {
  const t = somarPonto(ponto);
  const com = ponto
    .map((l) => ({
      l,
      total: colunas.reduce((s, c) => s + (l.abonos_min[c] ?? 0), 0),
    }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
  return {
    secao: "Abonos",
    titulo: `Abonos de ${formatarMes(o.mes)}`,
    resumo: [
      { rotulo: "Total", valor: formatarHoras(t.abonos_min) },
      { rotulo: "Pessoas", valor: String(com.length) },
    ],
    fontes: [
      { rotulo: "Fonte", valor: FONTES.ponto(o.mes, o.ate) },
      {
        rotulo: "Colunas",
        valor: `${colunas.join(", ") || "nenhuma"}: separadas até a Gestora confirmar qual é atestado`,
      },
      { rotulo: "Regra", valor: "Não entram no absenteísmo" },
    ],
    tabelas: o.pessoas
      ? [
          {
            colunas: [
              { titulo: "Colaborador", pessoa: true },
              { titulo: "Setor" },
              ...colunas.map((c) => ({ titulo: c, numero: true })),
              { titulo: "Total", numero: true },
            ],
            linhas: com.map(({ l, total }) => ({
              chave: l.colaborador_id,
              celulas: [
                l.nome,
                l.departamento,
                ...colunas.map((c) => formatarHoras(l.abonos_min[c] ?? 0)),
                formatarHoras(total),
              ],
              ordem: [
                l.nome,
                l.departamento,
                ...colunas.map((c) => l.abonos_min[c] ?? 0),
                total,
              ],
            })),
            vazio: "Ninguém com abono no mês.",
          },
        ]
      : [],
    link: o.link,
  };
}

export interface BancoEmReaisResumo {
  valor: number | null;
  folha: string | null;
  adicional: number | null;
  porDepartamento: Map<string | null, number | null>;
}

export function origemDoBanco(
  ponto: LinhaPonto[],
  o: OpcoesPonto & {
    /** Só positivos (card "Banco positivo") ou todos os saldos. */
    soPositivo?: boolean;
    reais?: BancoEmReaisResumo | null;
    /** Saldo em R$ de cada pessoa (só com rh.custo_pessoal.individual). */
    porPessoa?: Map<string, number | null>;
  },
): Detalhe {
  const t = somarPonto(ponto);
  const r = o.reais;
  const emReais =
    r?.folha && r.adicional !== null
      ? `Horas positivas × salário/hora da folha de ${formatarMes(r.folha)} × (1 + ${formatarNumero(r.adicional)}% de adicional)`
      : r?.folha
        ? "Configure o ciclo e o adicional do banco de horas em Parâmetros"
        : r === null
          ? "Precisa de folha importada e de acesso ao custo de pessoal"
          : undefined;
  return {
    secao: "Banco de horas",
    titulo: o.soPositivo
      ? `Banco positivo de ${formatarMes(o.mes)}`
      : `Banco de horas de ${formatarMes(o.mes)}`,
    subtitulo: o.soPositivo
      ? "Quem tem horas a folgar ou a receber"
      : "De quem mais deve para quem mais tem crédito",
    resumo: [
      { rotulo: "Positivo", valor: `+${formatarHoras(t.banco_positivo_min)}` },
      { rotulo: "Negativo", valor: formatarHoras(t.banco_negativo_min) },
      { rotulo: "Saldo", valor: formatarHoras(t.banco_saldo_min) },
      ...(r?.valor !== null && r?.valor !== undefined
        ? [{ rotulo: "Positivo em R$", valor: moeda(r.valor) }]
        : []),
    ],
    fontes: [
      { rotulo: "Fonte", valor: FONTES.ponto(o.mes, o.ate) },
      {
        rotulo: "Saldo",
        valor:
          "BSaldo do Secullum por pessoa; positivo soma só quem tem crédito",
      },
      ...(emReais ? [{ rotulo: "Valor em R$", valor: emReais }] : []),
      ...(o.pessoas && o.porPessoa
        ? [
            {
              rotulo: "Saldo em R$",
              valor:
                "Saldo × salário/hora da pessoa: positivo com o adicional, negativo (o que deve) pela hora simples",
            },
          ]
        : []),
      ...(o.meta ? [{ rotulo: "Meta", valor: `${o.meta} (Parâmetros)` }] : []),
    ],
    tabelas: [
      tabelaDeBancoPorSetor(porSetor(ponto), r?.porDepartamento),
      ...(o.pessoas
        ? [tabelaDePessoasNoBanco(ponto, !!o.soPositivo, o.porPessoa)]
        : []),
    ],
    link: o.link,
  };
}

/** Por pessoa; no banco positivo, de quem tem mais crédito. */
function tabelaDePessoasNoBanco(
  ponto: LinhaPonto[],
  soPositivo: boolean,
  emReais?: Map<string, number | null>,
): TabelaDetalhe {
  if (!soPositivo) return tabelaDoBanco(ponto, "Por pessoa", emReais);
  const t = tabelaDoBanco(
    ponto.filter((l) => l.banco_saldo_min > 0),
    "Por pessoa",
    emReais,
  );
  return { ...t, linhas: [...t.linhas].reverse() };
}

/** Pessoas de um setor no ponto do mês (barras por setor). */
export function origemDoSetor(
  s: TotaisSetor,
  linhas: LinhaPonto[],
  o: OpcoesPonto,
): Detalhe {
  return {
    secao: "Absenteísmo por setor",
    titulo: s.departamento,
    subtitulo: "Do maior absenteísmo para o menor",
    resumo: [
      { rotulo: "Pessoas", valor: String(s.colaboradores) },
      { rotulo: "Absenteísmo", valor: formatarPct(s.absenteismo) },
      { rotulo: "Faltas", valor: formatarHoras(s.faltas_min) },
      { rotulo: "Atrasos", valor: formatarHoras(s.atrasos_min) },
    ],
    fontes: [
      { rotulo: "Fonte", valor: FONTES.ponto(o.mes, o.ate) },
      {
        rotulo: "Fórmula",
        valor: "(faltas + atrasos) ÷ horas previstas do setor × 100",
      },
    ],
    tabelas: o.pessoas ? [tabelaDoPonto(linhas)] : [],
    link: o.link,
  };
}

// ---------------------------------------------------------------------------
// Custo de pessoal
// ---------------------------------------------------------------------------

export type ComponenteCusto =
  | "remuneracao"
  | "encargos"
  | "provisoes"
  | "beneficios"
  | "rescisao";

export const COMPONENTES: Record<
  ComponenteCusto,
  { rotulo: string; regra: string; fonte: string }
> = {
  remuneracao: {
    rotulo: "Remuneração",
    regra:
      "Salário, adicionais, horas extras, banco de horas pago e afastamento pago pela empresa − faltas e atrasos + verbas sem encargos (grupos das rubricas); PJ: Salário no Copiloto RH. Sócio (pró-labore) fica fora",
    fonte: "Rubricas da folha, classificadas em Importar folha",
  },
  encargos: {
    rotulo: "Encargos",
    regra:
      "Remuneração × (INSS patronal + Terceiros + FGTS + RAT × FAP) do tipo de contrato",
    fonte: "Parâmetros: encargos por contrato e RAT/FAP da empresa",
  },
  provisoes: {
    rotulo: "Provisões",
    regra:
      "13º = remuneração ÷ 12; férias = ÷ 12 × 4/3, ambos com todos os encargos; multa rescisória = % do FGTS do mês. Estagiário: só o recesso (bolsa ÷ 12); PJ: 13º e férias se marcados, sem encargos",
    fonte: "Parâmetros: provisões e multa por tipo de contrato",
  },
  beneficios: {
    rotulo: "Benefícios",
    regra:
      "Valor do benefício (manual, padrão ou faixa etária) − o que o funcionário paga na folha + parte da empresa nos dependentes",
    fonte: "Cadastro de Benefícios + descontos da folha",
  },
  rescisao: {
    rotulo: "Rescisões",
    regra:
      "Verbas do grupo Rescisão (ex.: aviso prévio indenizado); férias e 13º pagos consomem a provisão",
    fonte: "Rubricas da folha, classificadas em Importar folha",
  },
};

interface OpcoesCusto {
  competencia: string;
  ficticia: boolean;
  /** Totais por departamento, já com o nome. */
  porSetor: { nome: string; totais: TotaisCusto }[];
  /** Pessoas, só com rh.custo_pessoal.individual. */
  pessoas?: CustoIndividual[] | null;
  link?: Link;
}

const fontesDoCusto = (o: OpcoesCusto, extra: Detalhe["fontes"] = []) => [
  { rotulo: "Folha", valor: FONTES.folha(o.competencia, o.ficticia) },
  ...(extra ?? []),
  { rotulo: "Atualização", valor: FONTES.calculo },
];

function tabelaDeCustoPorSetor(
  o: OpcoesCusto,
  valor: (t: TotaisCusto) => number,
  rotulo: string,
): TabelaDetalhe {
  return {
    titulo: "Por departamento",
    colunas: [
      { titulo: "Departamento" },
      { titulo: "Pessoas", numero: true },
      { titulo: rotulo, numero: true },
      { titulo: "Por pessoa", numero: true },
    ],
    linhas: [...o.porSetor]
      .sort((a, b) => valor(b.totais) - valor(a.totais))
      .map((d) => ({
        chave: d.nome,
        celulas: [
          d.nome,
          String(d.totais.colaboradores),
          moeda(valor(d.totais)),
          moeda(valor(d.totais) / (d.totais.colaboradores || 1)),
        ],
        ordem: [
          d.nome,
          d.totais.colaboradores,
          valor(d.totais),
          valor(d.totais) / (d.totais.colaboradores || 1),
        ],
      })),
    vazio: "Sem custo calculado.",
  };
}

function tabelaDeCustoPorPessoa(
  pessoas: CustoIndividual[],
  valor: (p: CustoIndividual) => number,
  rotulo: string,
): TabelaDetalhe {
  return {
    titulo: "Por pessoa",
    colunas: [
      { titulo: "Colaborador", pessoa: true },
      { titulo: "Setor" },
      { titulo: "Contrato" },
      { titulo: rotulo, numero: true },
      { titulo: "Custo total", numero: true },
    ],
    linhas: [...pessoas]
      .sort((a, b) => valor(b) - valor(a))
      .map((p) => ({
        chave: p.colaborador_id,
        celulas: [
          p.nome,
          p.departamento,
          ROTULO_CONTRATO[p.tipo_contrato] ?? p.tipo_contrato,
          moeda(valor(p)),
          moeda(p.custo_total),
        ],
        ordem: [
          p.nome,
          p.departamento,
          p.tipo_contrato,
          valor(p),
          p.custo_total,
        ],
      })),
    vazio: "Ninguém com custo calculado.",
  };
}

/** Custo total: a escada da remuneração ao custo e quem forma cada parte. */
export function origemDoCustoTotal(t: TotaisCusto, o: OpcoesCusto): Detalhe {
  const degraus: [string, number, string][] = [
    ["Remuneração", t.remuneracao, COMPONENTES.remuneracao.fonte],
    ["+ Rescisões", t.rescisao, COMPONENTES.rescisao.fonte],
    ["+ Encargos", t.encargos, COMPONENTES.encargos.fonte],
    ["+ Provisões", t.provisoes, COMPONENTES.provisoes.fonte],
    ["+ Benefícios", t.beneficios, COMPONENTES.beneficios.fonte],
    ["= Custo total", t.custo_total, "Soma dos degraus"],
  ];
  return {
    secao: "Custo de pessoal",
    titulo: `Custo total de ${formatarMes(o.competencia)}`,
    subtitulo: `${t.colaboradores} pessoas na folha`,
    resumo: [
      { rotulo: "Custo total", valor: moeda(t.custo_total) },
      { rotulo: "Remuneração", valor: moeda(t.remuneracao) },
      {
        rotulo: "Encargos e provisões",
        valor: moeda(t.encargos + t.provisoes),
      },
      { rotulo: "Benefícios", valor: moeda(t.beneficios) },
    ],
    fontes: fontesDoCusto(o, [
      { rotulo: "Encargos e provisões", valor: COMPONENTES.encargos.fonte },
      { rotulo: "Benefícios", valor: COMPONENTES.beneficios.fonte },
      {
        rotulo: "Fórmula",
        valor: "Remuneração + rescisões + encargos + provisões + benefícios",
      },
    ]),
    tabelas: [
      {
        titulo: "Da remuneração ao custo",
        colunas: [
          { titulo: "Degrau" },
          { titulo: "Valor", numero: true },
          { titulo: "De onde vem" },
        ],
        linhas: degraus.map(([d, v, f], i) => ({
          chave: d,
          celulas: [d, moeda(v), f],
          ordem: [i, v, f],
        })),
      },
      tabelaDeCustoPorSetor(o, (x) => x.custo_total, "Custo total"),
      ...(o.pessoas
        ? [
            tabelaDeCustoPorPessoa(
              o.pessoas,
              (p) => p.custo_total,
              "Custo total",
            ),
          ]
        : []),
    ],
    link: o.link,
  };
}

/** Uma parte do custo (encargos, provisões…): regra, setores e pessoas. */
export function origemDoComponente(
  c: ComponenteCusto,
  t: TotaisCusto,
  o: OpcoesCusto,
): Detalhe {
  const info = COMPONENTES[c];
  const valorPessoa = (p: CustoIndividual) => p[c];
  return {
    secao: "Custo de pessoal",
    titulo: `${info.rotulo} de ${formatarMes(o.competencia)}`,
    resumo: [
      { rotulo: info.rotulo, valor: moeda(t[c]) },
      {
        rotulo: "% do custo total",
        valor: formatarPct(t.custo_total ? (t[c] / t.custo_total) * 100 : null),
      },
      ...(c === "encargos" || c === "provisoes"
        ? [
            {
              rotulo: "% da remuneração",
              valor: formatarPct(
                t.remuneracao ? (t[c] / t.remuneracao) * 100 : null,
              ),
            },
          ]
        : []),
      ...(o.pessoas
        ? [
            {
              rotulo: "Pessoas com valor",
              valor: String(
                o.pessoas.filter((p) => valorPessoa(p) !== 0).length,
              ),
            },
          ]
        : []),
    ],
    fontes: fontesDoCusto(o, [
      { rotulo: "Fonte", valor: info.fonte },
      { rotulo: "Regra", valor: info.regra },
    ]),
    tabelas: [
      tabelaDeCustoPorSetor(o, (x) => x[c], info.rotulo),
      ...(o.pessoas
        ? [tabelaDeCustoPorPessoa(o.pessoas, valorPessoa, info.rotulo)]
        : []),
    ],
    link: o.link,
  };
}

export function origemDoCustoMedio(
  t: TotaisCusto,
  ativos: number,
  o: OpcoesCusto,
): Detalhe {
  const pessoas = ativos - t.sem_valor;
  return {
    secao: "Custo de pessoal",
    titulo: `Custo médio por pessoa em ${formatarMes(o.competencia)}`,
    resumo: [
      {
        rotulo: "Custo médio",
        valor: pessoas > 0 ? moeda(t.custo_total / pessoas) : "—",
      },
      { rotulo: "Custo total", valor: moeda(t.custo_total) },
      { rotulo: "Ativos no Copiloto RH", valor: String(ativos) },
      ...(t.sem_valor
        ? [{ rotulo: "PJ sem valor (fora)", valor: String(t.sem_valor) }]
        : []),
    ],
    fontes: fontesDoCusto(o, [
      {
        rotulo: "Fórmula",
        valor:
          "Custo total ÷ colaboradores ativos no Copiloto RH no último dia do mês da folha (sem sócios e sem os PJ sem valor informado). O custo inclui quem saiu no mês (rescisão)",
      },
    ]),
    tabelas: [
      tabelaDeCustoPorSetor(o, (x) => x.custo_total, "Custo total"),
      ...(o.pessoas
        ? [
            tabelaDeCustoPorPessoa(
              o.pessoas,
              (p) => p.custo_total,
              "Custo total",
            ),
          ]
        : []),
    ],
    link: o.link,
  };
}

/** % sobre a receita: custo ÷ faturamento, com o que falta para sair. */
export function origemDoCustoSobreReceita(
  t: TotaisCusto | null,
  faturamento: number | null,
  o: Omit<OpcoesCusto, "porSetor"> & { meta?: string },
): Detalhe {
  const pct = t && faturamento ? (t.custo_total / faturamento) * 100 : null;
  return {
    secao: "Custo de pessoal",
    titulo: "Custo de pessoal sobre a receita",
    subtitulo: `Competência ${formatarMes(o.competencia)}`,
    resumo: [
      { rotulo: "Custo total", valor: t ? moeda(t.custo_total) : "—" },
      {
        rotulo: "Faturamento bruto",
        valor: faturamento ? moeda(faturamento) : "Pendente",
      },
      { rotulo: "Custo ÷ receita", valor: formatarPct(pct) },
      ...(o.meta ? [{ rotulo: "Meta", valor: o.meta }] : []),
    ],
    fontes: [
      { rotulo: "Custo", valor: FONTES.folha(o.competencia, o.ficticia) },
      {
        rotulo: "Faturamento",
        valor: faturamento
          ? "Faturamento bruto da competência (ENET)"
          : "Faturamento bruto do ENET: integração pendente, ainda sem valor para o mês",
      },
      {
        rotulo: "Fórmula",
        valor: "Custo total ÷ faturamento bruto da mesma competência × 100",
      },
      { rotulo: "Meta", valor: "Configurável em Parâmetros (hoje até 10%)" },
    ],
    tabelas: [],
    link: o.link,
  };
}

/** Memória de cálculo de uma pessoa: cada linha da conta e as pendências. */
export function tabelasDaMemoria(memoria: MemoriaDoCusto): TabelaDetalhe[] {
  return [
    {
      titulo: "Cada linha da conta",
      colunas: [
        { titulo: "Linha" },
        { titulo: "Valor", numero: true },
        { titulo: "Regra" },
      ],
      linhas: memoria.linhas.map((l, i) => ({
        chave: `${i}`,
        celulas: [l.rotulo, formatarMoeda(l.valor), l.regra],
        ordem: [i, l.valor, l.regra],
      })),
    },
    ...(memoria.pendencias.length
      ? [
          {
            titulo: "Pendências",
            colunas: [{ titulo: "O que ficou de fora" }],
            linhas: memoria.pendencias.map((t, i) => ({
              chave: `${i}`,
              celulas: [t],
            })),
          },
        ]
      : []),
  ];
}

// ---------------------------------------------------------------------------
// Retorno sobre pessoal (receita por colaborador, índice, participação)
// ---------------------------------------------------------------------------

interface OpcoesRetorno {
  competencia: string;
  ficticia: boolean;
  receita: Receita | null;
  /** Meta de % do custo sobre a receita (base do faturamento ilustrativo). */
  metaPct: number | null;
  /** Mês do faturamento usado como ilustrativo, quando vem de outro mês. */
  exemploDe?: string | null;
  link?: Link;
}

function fonteDaReceita(o: OpcoesRetorno) {
  if (!o.receita)
    return "Pendente: lance o faturamento bruto em Cadastros > Faturamento do mês (ou defina a meta de % sobre a receita em Parâmetros para ver um ilustrativo)";
  if (o.receita.base === "outro_mes" && o.exemploDe)
    return `Ilustrativo: o faturamento lançado de ${formatarMes(o.exemploDe)}, no lugar do mês da folha. Troca sozinho pelo real quando o faturamento do mês for lançado em Cadastros`;
  if (o.receita.ilustrativa)
    return `Ilustrativo: custo total da ARP ÷ meta de ${formatarPct(o.metaPct)} (o faturamento que deixaria o custo na meta). Troca sozinho pelo real quando o faturamento do mês for lançado em Cadastros`;
  return "Faturamento bruto lançado em Cadastros > Faturamento do mês (até a integração com o ENET)";
}

export function origemDaReceitaPorColaborador(
  valor: number | null,
  ativos: number,
  o: OpcoesRetorno,
): Detalhe {
  return {
    secao: "Custo de pessoal",
    titulo: "Receita por colaborador",
    subtitulo: `Competência ${formatarMes(o.competencia)}${o.receita?.ilustrativa ? " · dados ilustrativos" : ""}`,
    resumo: [
      { rotulo: "Receita por colaborador", valor: formatarMoeda(valor, 0) },
      {
        rotulo: "Faturamento bruto",
        valor: o.receita ? moeda(o.receita.valor) : "Pendente",
      },
      { rotulo: "Pessoas", valor: formatarNumero(ativos) },
    ],
    fontes: [
      { rotulo: "Faturamento", valor: fonteDaReceita(o) },
      {
        rotulo: "Pessoas",
        valor:
          "As mesmas do custo médio: ativos no Copiloto RH no fim do mês, sem os PJ sem valor informado (com vários meses, a soma: receita por pessoa e por mês)",
      },
      { rotulo: "Fórmula", valor: "Faturamento bruto ÷ pessoas" },
    ],
    tabelas: [],
    link: o.link,
  };
}

export function origemDoIndiceDeRetorno(
  indice: number | null,
  receitaPorPessoa: number | null,
  custoMedio: number | null,
  o: OpcoesRetorno,
): Detalhe {
  return {
    secao: "Custo de pessoal",
    titulo: "Índice de retorno sobre pessoal",
    subtitulo: `Competência ${formatarMes(o.competencia)}${o.receita?.ilustrativa ? " · dados ilustrativos" : ""}`,
    resumo: [
      {
        rotulo: "Cada R$ 1 de folha gera",
        valor: indice === null ? "—" : `${formatarMoeda(indice)} de receita`,
      },
      {
        rotulo: "Receita por colaborador",
        valor: formatarMoeda(receitaPorPessoa, 0),
      },
      {
        rotulo: "Custo médio por colaborador",
        valor: formatarMoeda(custoMedio, 0),
      },
    ],
    fontes: [
      { rotulo: "Faturamento", valor: fonteDaReceita(o) },
      { rotulo: "Custo", valor: FONTES.folha(o.competencia, o.ficticia) },
      {
        rotulo: "Fórmula",
        valor: "Receita por colaborador ÷ custo médio por colaborador",
      },
    ],
    tabelas: [],
    link: o.link,
  };
}

export function origemDaParticipacaoDaFolha(
  pct: number | null,
  custo: number,
  custoDespesa: ValorDoMes | null,
  o: Omit<OpcoesRetorno, "receita" | "metaPct">,
): Detalhe {
  return {
    secao: "Custo de pessoal",
    titulo: "Participação da folha no custo total",
    subtitulo: `Competência ${formatarMes(o.competencia)}${custoDespesa?.ilustrativa ? " · dados ilustrativos" : ""}`,
    resumo: [
      { rotulo: "Participação", valor: formatarPct(pct) },
      { rotulo: "Custo de pessoal", valor: moeda(custo) },
      {
        rotulo: "Custo + despesa total",
        valor: custoDespesa ? moeda(custoDespesa.valor) : "Pendente",
      },
    ],
    fontes: [
      { rotulo: "Custo", valor: FONTES.folha(o.competencia, o.ficticia) },
      {
        rotulo: "Custo + despesa total",
        valor: !custoDespesa
          ? "Pendente: lance em Cadastros > Faturamento do mês"
          : custoDespesa.ilustrativa && o.exemploDe
            ? `Ilustrativo: o lançado de ${formatarMes(o.exemploDe)}, no lugar do mês da folha. Troca sozinho pelo real quando o do mês for lançado em Cadastros`
            : "Lançado em Cadastros > Faturamento do mês (até a integração com o ENET)",
      },
      {
        rotulo: "Fórmula",
        valor: "Custo total de pessoal ÷ custo + despesa total do mês × 100",
      },
    ],
    tabelas: [],
    link: o.link,
  };
}

/** % sobre a receita de um departamento ou cargo (célula da tabela). */
export function origemDaReceitaDoGrupo(
  nome: string,
  custo: number,
  pct: number,
  o: OpcoesRetorno,
): Detalhe {
  return {
    secao: "Custo de pessoal sobre a receita",
    titulo: nome,
    subtitulo: `Competência ${formatarMes(o.competencia)}${o.receita?.ilustrativa ? " · dados ilustrativos" : ""}`,
    resumo: [
      { rotulo: "% sobre a receita", valor: formatarPct(pct) },
      { rotulo: "Custo total", valor: moeda(custo) },
      {
        rotulo: "Faturamento bruto da ARP",
        valor: o.receita ? moeda(o.receita.valor) : "Pendente",
      },
      ...(o.metaPct !== null
        ? [{ rotulo: "Meta", valor: `até ${formatarPct(o.metaPct)}` }]
        : []),
    ],
    fontes: [
      { rotulo: "Custo", valor: FONTES.folha(o.competencia, o.ficticia) },
      { rotulo: "Faturamento", valor: fonteDaReceita(o) },
      {
        rotulo: "Fórmula",
        valor:
          "Custo total do departamento (ou cargo) ÷ faturamento bruto total da ARP no mês × 100",
      },
      {
        rotulo: "Semáforo",
        valor:
          "Mesma meta de “% do custo de pessoal sobre a receita” dos Parâmetros",
      },
    ],
    tabelas: [],
    link: o.link,
  };
}
