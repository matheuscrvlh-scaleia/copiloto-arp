// Montagem do Painel de Sustentabilidade (spec 4.9): dos números apurados
// (painel-apuracao.ts) saem os cartões com meta, variação sobre o ano anterior
// e o "desde o início", os gráficos, as equivalências confirmadas e a tabela
// de consolidados anuais. Funções puras; o mesmo resultado alimenta a tela, o
// Excel e o PDF do relatório do mês.
//
// Regras: fonte sem dado vira "sem dado em mm/aaaa", nunca zero; participações
// e produtores únicos ficam em dois números, nunca somados; valores em reais só
// com a permissão (sem ela o cartão e a coluna nem existem).

import { formatarNumero } from "../formato";
import { type Direcao, type Status, status } from "../indicadores";
import { formatarMesNumerico } from "./formatos";
import {
  avisoDeConsolidado,
  type DiferencaDoConsolidado,
  desdeOInicio,
  mesmoMesDoAnoAnterior,
  type Totais,
  valorOuSemDado,
  variacao,
} from "./painel";
import type {
  ClubeApurado,
  EntrevistasApuradas,
  Mensal,
  OcupacaoApurada,
  PeriodoApurado,
} from "./painel-apuracao";
import { competenciaDo } from "./painel-apuracao";
import {
  type ChaveDoIndicador,
  type ChaveDoTotal,
  type FiltrosDoPainel,
  hrefDeOrigem,
  INDICADORES_DO_PAINEL,
  MESES_CURTOS,
  type OrigemDoCartao,
  TOTAIS_DO_ANO,
  TOTAIS_EM_REAIS,
} from "./painel-indicadores";

export interface MetaDoPainel {
  meta: number;
  limiteAtencao: number | null;
  direcao: Direcao;
}

export interface CartaoDoPainel {
  chave: ChaveDoIndicador;
  titulo: string;
  /** Já formatado, com a unidade; "sem dado em mm/aaaa" quando falta. */
  valor: string;
  semDado: boolean;
  detalhe?: string;
  variacao?: { texto: string; sentido: "bom" | "ruim" | "neutro" };
  /** "Meta 2026: 26.000 kg (62% atingido)". */
  meta?: string;
  status?: Status;
  direcao?: Direcao;
  /** Aviso em destaque (ex.: mês incompleto em Operações). */
  aviso?: string;
  /** Tela de origem, já filtrada. */
  href: string;
  /** Texto da fonte, em letra pequena. */
  fonte: string;
}

export interface SerieDoGrafico {
  chave: string;
  rotulo: string;
  cor: 1 | 2 | 3 | 4 | 5 | "neutro";
  valores: (number | null)[];
}

export interface GraficoDoPainel {
  chave: string;
  titulo: string;
  unidade: string;
  casas: number;
  /** Rótulos do eixo: "jan"… até o mês do filtro. */
  meses: string[];
  series: SerieDoGrafico[];
  /** Classe A e B uma sobre a outra (só sem comparação). */
  empilhado: boolean;
  /** Nota em letra pequena (fonte). */
  nota?: string;
}

export interface EquivalenciaDoPainel {
  nome: string;
  fator: number;
  unidade: string | null;
  confirmado: boolean;
}

export interface LinhaDeComparacao {
  indicador: string;
  atual: string;
  anterior: string;
  /** "+5,5%", "-3,0%" ou "—". */
  variacao: string;
}

export interface EntradaDoPainel {
  filtros: FiltrosDoPainel;
  atual: PeriodoApurado;
  anterior: PeriodoApurado;
  /** Volume reciclado desde o início (null sem marco nem dado) e o último ano de marco. */
  desdeOInicio: { valor: number | null; marcoAteAno: number | null };
  /**
   * Água do último mês com leitura até o filtro (`mes`, aaaa-mm-01; é o mês
   * do filtro quando não há leitura nenhuma) e o mesmo mês do ano anterior.
   */
  agua: {
    mes: string;
    m3: number | null;
    anterior: number | null;
    incompleta: boolean;
  };
  /** Null sem nenhum participante cadastrado. */
  clube: ClubeApurado | null;
  entrevistas: EntrevistasApuradas;
  ocupacao: OcupacaoApurada;
  /** Limite de alerta de ocupação (Parâmetros › Coletores). */
  limiteOcupacao: number;
  /** Meta vigente de cada indicador (core.metas), quando houver. */
  metas: Partial<Record<ChaveDoIndicador, MetaDoPainel>>;
  comValores: boolean;
  equivalencias: readonly EquivalenciaDoPainel[];
}

export interface PainelMontado {
  cartoes: CartaoDoPainel[];
  graficos: GraficoDoPainel[];
  /** Só as confirmadas com a área, com o texto pronto. */
  equivalencias: { nome: string; texto: string }[];
  comparacao: LinhaDeComparacao[];
}

// ---------------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------------

const num = (v: number, casas: number) => formatarNumero(v, casas);

/** "12.345 kg", ou "sem dado em mm/aaaa". */
export function valorComUnidade(
  v: number | null | undefined,
  competencia: string,
  casas: number,
  unidade: string,
): string {
  return valorOuSemDado(v, competencia, (x) =>
    unidade === "R$"
      ? `R$ ${num(x, casas)}`
      : `${num(x, casas)}${unidade === "%" ? "%" : ` ${unidade}`}`,
  );
}

/** "+5,5%" / "-3,0%" / "—". */
export function textoDaVariacao(
  atual: number | null | undefined,
  anterior: number | null | undefined,
): string {
  const v = variacao(atual, anterior);
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${num(v, 1)}%`;
}

function sentidoDaVariacao(
  v: number,
  direcao: Direcao,
): "bom" | "ruim" | "neutro" {
  if (Math.abs(v) < 0.05) return "neutro";
  return v > 0 === (direcao === "maior_melhor") ? "bom" : "ruim";
}

function metaEscrita(
  chave: ChaveDoIndicador,
  valor: number | null,
  meta: MetaDoPainel | undefined,
  ano: number,
): Pick<CartaoDoPainel, "meta" | "status" | "direcao"> {
  if (!meta) return {};
  const i = INDICADORES_DO_PAINEL[chave];
  const alvo = valorComUnidade(meta.meta, "", i.casas, i.unidade);
  if (i.acumulado) {
    const atingido =
      valor !== null && meta.meta > 0
        ? ` (${num((valor / meta.meta) * 100, 0)}% atingido)`
        : "";
    return { meta: `Meta ${ano}: ${alvo}${atingido}` };
  }
  return {
    meta: `Meta: ${alvo}`,
    status: status(valor, {
      meta: meta.meta,
      limiteAtencao: meta.limiteAtencao,
      direcao: meta.direcao,
    }),
    direcao: meta.direcao,
  };
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

export function montarCartoes(e: EntradaDoPainel): CartaoDoPainel[] {
  const f = e.filtros;
  const comp = competenciaDo(f.ano, f.ateMes);
  const mes = `${MESES_CURTOS[f.ateMes - 1]}/${f.ano}`;
  const periodoAnterior = `mesmo período de ${f.ano - 1}`;
  const m = (chave: ChaveDoIndicador, valor: number | null) =>
    metaEscrita(chave, valor, e.metas[chave], f.ano);

  const simples = (
    chave: ChaveDoIndicador,
    valor: number | null,
    anterior: number | null,
    origem: OrigemDoCartao,
    fonte: string,
    extra: Partial<CartaoDoPainel> = {},
  ): CartaoDoPainel => {
    const i = INDICADORES_DO_PAINEL[chave];
    const v = f.comparar ? variacao(valor, anterior) : null;
    return {
      chave,
      titulo: i.nome,
      valor: valorComUnidade(valor, comp, i.casas, i.unidade),
      semDado: valor === null,
      variacao:
        v === null
          ? undefined
          : {
              texto: `${v > 0 ? "+" : ""}${num(v, 1)}% sobre o ${periodoAnterior}`,
              sentido: sentidoDaVariacao(v, i.direcao),
            },
      ...m(chave, valor),
      href: hrefDeOrigem(origem, f),
      fonte,
      ...extra,
    };
  };

  const cartoes: CartaoDoPainel[] = [];

  // Volume reciclado: ano e desde o início (marco + anos no sistema).
  const inicio = e.desdeOInicio;
  cartoes.push(
    simples(
      "volume_reciclado",
      e.atual.volume.total,
      e.anterior.volume.total,
      "volume",
      'Programas · grupo "Volume reciclado"',
      {
        detalhe:
          inicio.valor === null
            ? "Desde o início: sem dado"
            : `Desde o início: ${num(inicio.valor, 0)} kg (${
                inicio.marcoAteAno
                  ? `marco até dez/${inicio.marcoAteAno} + sistema`
                  : "sistema"
              })`,
      },
    ),
  );

  // Energia: leitura de Operações. CO₂: kWh × fator de emissão vigente.
  const kwhDoMes = e.atual.energia.porMes[f.ateMes - 1] ?? null;
  cartoes.push(
    simples(
      "energia_gerada",
      e.atual.energia.total,
      e.anterior.energia.total,
      "energia",
      "Módulo Operações · geração solar",
      {
        detalhe: `${mes}: ${valorComUnidade(kwhDoMes, comp, 0, "kWh")}`,
      },
    ),
    simples(
      "co2_evitado",
      e.atual.co2,
      e.anterior.co2,
      "energia",
      "Geração solar × fator de emissão (Parâmetros › Painel)",
      {
        detalhe:
          e.atual.co2 === null && e.atual.energia.total !== null
            ? "Falta o fator de emissão de algum mês em Parâmetros › Painel"
            : undefined,
      },
    ),
  );

  // Água do último mês com leitura e variação sobre o mesmo mês do ano
  // anterior (sempre).
  const compAgua = e.agua.mes;
  const anoAgua = Number(compAgua.slice(0, 4));
  const mesAgua = Number(compAgua.slice(5, 7));
  const va = variacao(e.agua.m3, e.agua.anterior);
  cartoes.push({
    chave: "consumo_agua",
    titulo: `Consumo de água – ${MESES_CURTOS[mesAgua - 1]}/${anoAgua}`,
    valor: valorComUnidade(e.agua.m3, compAgua, 0, "m³"),
    semDado: e.agua.m3 === null,
    detalhe:
      e.agua.m3 !== null && e.agua.anterior !== null
        ? `${anoAgua - 1}: ${num(e.agua.anterior, 0)} m³`
        : undefined,
    variacao:
      va === null
        ? undefined
        : {
            texto: `${va > 0 ? "+" : ""}${num(va, 1)}% sobre ${formatarMesNumerico(mesmoMesDoAnoAnterior(compAgua))}`,
            sentido: sentidoDaVariacao(va, "menor_melhor"),
          },
    aviso:
      e.agua.m3 === null
        ? undefined
        : compAgua !== comp
          ? `${mes} ainda sem leitura em Operações: mostrando o último mês importado.`
          : e.agua.incompleta
            ? "Mês incompleto em Operações: o consumo pode estar abaixo do real."
            : undefined,
    ...m("consumo_agua", e.agua.m3),
    href: hrefDeOrigem("agua", { ...f, ano: anoAgua, ateMes: mesAgua }),
    fonte: "Módulo Operações · água",
  });

  // RCC.
  const rcc = e.atual.rcc;
  cartoes.push(
    simples(
      "rcc_total",
      rcc.total.total,
      e.anterior.rcc.total.total,
      "rcc",
      "RCC",
      {
        detalhe:
          rcc.pctReciclado === null
            ? undefined
            : `${num(rcc.pctReciclado, 1)}% reciclado (classe A)`,
      },
    ),
  );
  if (e.comValores)
    cartoes.push(
      simples(
        "rcc_economia",
        rcc.economia,
        e.anterior.rcc.economia,
        "rcc",
        'RCC · "Ver valores"',
        { detalhe: "Em reais, no ano" },
      ),
    );

  // Clube.
  const c = e.clube;
  cartoes.push({
    chave: "participantes_clube",
    titulo: INDICADORES_DO_PAINEL.participantes_clube.nome,
    valor: c ? num(c.ativos, 0) : `sem dado em ${formatarMesNumerico(comp)}`,
    semDado: c === null,
    detalhe: c
      ? c.participacao === null
        ? `${num(c.locatarios, 0)} locatários · sem contrato vigente para a participação`
        : `${num(c.locatarios, 0)} locatários de ${num(c.clientes, 0)} clientes com contrato (${num(c.participacao, 1)}%)`
      : undefined,
    ...m("participantes_clube", c?.ativos ?? null),
    href: hrefDeOrigem("clube", f),
    fonte: "Clube + contratos",
  });

  // Pessoas, oficinas e produtores (programas).
  cartoes.push(
    simples(
      "pessoas_impactadas",
      e.atual.pessoas.total,
      e.anterior.pessoas.total,
      "pessoas",
      'Programas · grupo "Pessoas impactadas"',
      { detalhe: 'Soma do grupo "Pessoas impactadas"' },
    ),
    simples(
      "oficinas",
      e.atual.oficinas.total,
      e.anterior.oficinas.total,
      "oficinas",
      'Programas · grupo "Oficinas"',
      { detalhe: 'Soma do grupo "Oficinas"' },
    ),
  );

  // Produtores: dois números, nunca somados.
  const prod = e.atual.produtores;
  const prodAnterior = e.anterior.produtores;
  cartoes.push({
    ...simples(
      "produtores_participacoes",
      prod.participacoes,
      prodAnterior.participacoes,
      "produtores",
      'Programas · grupo "Produtores locais"',
      {
        detalhe:
          prod.unicos === null
            ? "Produtores únicos: sem dado"
            : `${num(prod.unicos, 0)} produtores únicos no ano (nunca somados)`,
      },
    ),
    titulo: "Produtores locais",
  });

  // Entrevistas.
  const ent = e.entrevistas;
  cartoes.push({
    chave: "cobertura_entrevistas",
    titulo: INDICADORES_DO_PAINEL.cobertura_entrevistas.nome,
    valor: valorComUnidade(ent.pct, comp, 1, "%"),
    semDado: ent.pct === null,
    detalhe:
      ent.pct === null
        ? undefined
        : `${num(ent.emDia, 0)} em dia de ${num(ent.precisam, 0)} que precisam · ${num(ent.pendentes, 0)} pendentes · ${num(ent.vencidas, 0)} vencidas`,
    ...m("cobertura_entrevistas", ent.pct),
    href: hrefDeOrigem("entrevistas", f),
    fonte: "Entrevistas",
  });

  // Ocupação média dos coletores (pretos / azuis) no mês, com o limite dos Parâmetros.
  const o = e.ocupacao;
  const pior =
    o.preto === null && o.azul === null
      ? null
      : Math.max(o.preto ?? 0, o.azul ?? 0);
  const limite = e.limiteOcupacao;
  const pc = (v: number | null) => (v === null ? "sem dado" : `${num(v, 0)}%`);
  cartoes.push({
    chave: "ocupacao_coletores",
    titulo: INDICADORES_DO_PAINEL.ocupacao_coletores.nome,
    valor:
      pior === null
        ? `sem dado em ${formatarMesNumerico(comp)}`
        : `${pc(o.preto)} / ${pc(o.azul)}`,
    semDado: pior === null,
    detalhe:
      pior === null
        ? undefined
        : `Pretos / azuis, média das ${o.rondas} ${o.rondas === 1 ? "ronda" : "rondas"} de ${mes}`,
    meta: `Limite de alerta: ${num(limite, 0)}%`,
    status:
      pior === null
        ? "sem_dado"
        : status(pior, {
            meta: limite,
            limiteAtencao: null,
            direcao: "menor_melhor",
          }),
    direcao: "menor_melhor",
    href: hrefDeOrigem("rondas", f),
    fonte: "Rondas",
  });

  return cartoes;
}

// ---------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------

function serie(
  chave: string,
  rotulo: string,
  cor: SerieDoGrafico["cor"],
  m: Mensal,
  meses: number,
): SerieDoGrafico {
  return {
    chave,
    rotulo,
    cor,
    valores: Array.from({ length: meses }, (_, k) => m.porMes[k] ?? null),
  };
}

export function montarGraficos(e: EntradaDoPainel): GraficoDoPainel[] {
  const f = e.filtros;
  const meses = MESES_CURTOS.slice(0, f.ateMes) as string[];
  const ano = String(f.ano);
  const anterior = String(f.ano - 1);
  const dois = (
    chave: string,
    titulo: string,
    unidade: string,
    casas: number,
    atual: Mensal,
    antes: Mensal,
    nota?: string,
  ): GraficoDoPainel => ({
    chave,
    titulo,
    unidade,
    casas,
    meses,
    empilhado: false,
    series: [
      serie("atual", ano, 1, atual, f.ateMes),
      ...(f.comparar ? [serie("anterior", anterior, 2, antes, f.ateMes)] : []),
    ],
    nota,
  });
  const rcc = e.atual.rcc;
  return [
    dois(
      "volume",
      "Volume reciclado por mês (kg)",
      "kg",
      0,
      e.atual.volume,
      e.anterior.volume,
      'Programas, grupo "Volume reciclado".',
    ),
    dois(
      "energia",
      "Energia gerada por mês (kWh)",
      "kWh",
      0,
      e.atual.energia,
      e.anterior.energia,
      "Lido do Módulo Operações.",
    ),
    {
      chave: "rcc",
      titulo: "RCC por mês (t)",
      unidade: "t",
      casas: 2,
      meses,
      empilhado: !f.comparar,
      series: [
        serie(
          "a",
          f.comparar ? `Classe A ${ano}` : "Classe A (reciclável)",
          1,
          rcc.a,
          f.ateMes,
        ),
        serie(
          "b",
          f.comparar ? `Classe B ${ano}` : "Classe B (descarte)",
          4,
          rcc.b,
          f.ateMes,
        ),
        ...(f.comparar
          ? [
              serie(
                "a-anterior",
                `Classe A ${anterior}`,
                2,
                e.anterior.rcc.a,
                f.ateMes,
              ),
              serie(
                "b-anterior",
                `Classe B ${anterior}`,
                5,
                e.anterior.rcc.b,
                f.ateMes,
              ),
            ]
          : []),
      ],
      nota: "Notas do RCC lançadas.",
    },
    dois(
      "pessoas",
      "Pessoas impactadas por mês",
      "pessoas",
      0,
      e.atual.pessoas,
      e.anterior.pessoas,
      'Programas, grupo "Pessoas impactadas".',
    ),
  ];
}

// ---------------------------------------------------------------------------
// Equivalências e comparação
// ---------------------------------------------------------------------------

/**
 * Equivalências do volume reciclado: toneladas × fator. Só as confirmadas
 * com a área aparecem; sem volume, nenhuma.
 */
export function equivalenciasDoVolume(
  volumeKg: number | null,
  lista: readonly EquivalenciaDoPainel[],
): { nome: string; texto: string }[] {
  if (volumeKg === null) return [];
  const toneladas = volumeKg / 1000;
  return lista
    .filter((q) => q.confirmado)
    .map((q) => ({
      nome: q.nome,
      texto: `≈ ${num(toneladas * q.fator, 0)}${q.unidade ? ` ${q.unidade}` : ""}`,
    }));
}

/** Atual × ano anterior de cada indicador que tem as duas pontas. */
export function montarComparacao(e: EntradaDoPainel): LinhaDeComparacao[] {
  const f = e.filtros;
  const comp = competenciaDo(f.ano, f.ateMes);
  const linha = (
    chave: ChaveDoIndicador,
    atual: number | null,
    anterior: number | null,
    indicador?: string,
  ): LinhaDeComparacao => {
    const i = INDICADORES_DO_PAINEL[chave];
    const formatar = (v: number | null) =>
      v === null ? "sem dado" : valorComUnidade(v, comp, i.casas, i.unidade);
    return {
      indicador: indicador ?? i.nome,
      atual: formatar(atual),
      anterior: formatar(anterior),
      variacao: textoDaVariacao(atual, anterior),
    };
  };
  const rcc = e.atual.rcc;
  const antes = e.anterior.rcc;
  return [
    linha("volume_reciclado", e.atual.volume.total, e.anterior.volume.total),
    linha("energia_gerada", e.atual.energia.total, e.anterior.energia.total),
    linha("co2_evitado", e.atual.co2, e.anterior.co2),
    linha(
      "consumo_agua",
      e.agua.m3,
      e.agua.anterior,
      `Consumo de água – ${MESES_CURTOS[Number(e.agua.mes.slice(5, 7)) - 1]}`,
    ),
    linha("rcc_total", rcc.total.total, antes.total.total),
    linha("rcc_reciclado_pct", rcc.pctReciclado, antes.pctReciclado),
    ...(e.comValores
      ? [linha("rcc_economia", rcc.economia, antes.economia)]
      : []),
    linha(
      "pessoas_impactadas",
      e.atual.pessoas.total,
      e.anterior.pessoas.total,
    ),
    linha("oficinas", e.atual.oficinas.total, e.anterior.oficinas.total),
    linha(
      "produtores_participacoes",
      e.atual.produtores.participacoes,
      e.anterior.produtores.participacoes,
      "Produtores locais (participações)",
    ),
    {
      indicador: "Produtores locais (únicos)",
      atual:
        e.atual.produtores.unicos === null
          ? "sem dado"
          : num(e.atual.produtores.unicos, 0),
      anterior:
        e.anterior.produtores.unicos === null
          ? "sem dado"
          : num(e.anterior.produtores.unicos, 0),
      variacao: textoDaVariacao(
        e.atual.produtores.unicos,
        e.anterior.produtores.unicos,
      ),
    },
  ];
}

export function montarPainel(e: EntradaDoPainel): PainelMontado {
  return {
    cartoes: montarCartoes(e),
    graficos: montarGraficos(e),
    equivalencias: equivalenciasDoVolume(e.atual.volume.total, e.equivalencias),
    comparacao: montarComparacao(e),
  };
}

// ---------------------------------------------------------------------------
// Desde o início, totais do ano e consolidados
// ---------------------------------------------------------------------------

/**
 * Volume reciclado desde o início: os marcos (anos antes do sistema) mais os
 * anos no sistema até o do filtro. Ano fechado conta pelo consolidado (não
 * muda com lançamento novo); o ano do filtro e os anos abertos, pelo vivo.
 */
export function volumeDesdeOInicio(p: {
  ano: number;
  marcos: readonly { ano: number; valor: number }[];
  /** Volume do ano calculado dos lançamentos (o do filtro, até o mês). */
  vivos: ReadonlyMap<number, number | null>;
  /** Volume dos anos fechados (consolidado). */
  fechados: ReadonlyMap<number, number | null>;
}): { valor: number | null; marcoAteAno: number | null } {
  const marcos = p.marcos.filter((m) => m.ano <= p.ano);
  const anos = [...p.vivos.keys(), ...p.fechados.keys()]
    .filter((a) => a <= p.ano)
    .filter((a, i, l) => l.indexOf(a) === i);
  const noSistema = anos.map((ano) => ({
    ano,
    valor:
      ano < p.ano && p.fechados.has(ano)
        ? (p.fechados.get(ano) ?? null)
        : (p.vivos.get(ano) ?? null),
  }));
  return {
    valor: desdeOInicio(marcos, noSistema),
    marcoAteAno: marcos.length ? Math.max(...marcos.map((m) => m.ano)) : null,
  };
}

const arredondar = (v: number | null) =>
  v === null ? null : Math.round(v * 10_000) / 10_000;

/** Os totais do ano que o "Fechar ano" grava (null onde falta dado). */
export function totaisDoAno(
  p: PeriodoApurado,
  clube: ClubeApurado | null,
): Record<ChaveDoTotal, number | null> {
  return {
    volume_reciclado: arredondar(p.volume.total),
    energia_gerada: arredondar(p.energia.total),
    co2_evitado: arredondar(p.co2),
    rcc_total: arredondar(p.rcc.total.total),
    rcc_reciclado_pct: arredondar(p.rcc.pctReciclado),
    pessoas_impactadas: arredondar(p.pessoas.total),
    oficinas: arredondar(p.oficinas.total),
    produtores_participacoes: arredondar(p.produtores.participacoes),
    produtores_unicos: arredondar(p.produtores.unicos),
    participantes_clube: clube ? clube.ativos : null,
    rcc_economia: arredondar(p.rcc.economia),
  };
}

/** Separa os totais em "sem reais" (consolidados) e "reais" (consolidado_valores). */
export function separarReais(totais: Totais): {
  semReais: Record<string, number>;
  reais: Record<string, number>;
} {
  const semReais: Record<string, number> = {};
  const reais: Record<string, number> = {};
  for (const [k, v] of Object.entries(totais)) {
    if (v === null) continue;
    (TOTAIS_EM_REAIS.includes(k as ChaveDoTotal) ? reais : semReais)[k] = v;
  }
  return { semReais, reais };
}

export interface ConsolidadoGravado {
  ano: number;
  situacao: string;
  totais: Totais;
  /** Totais em reais; null sem a permissão de valores. */
  totaisReais: Totais | null;
  fechadoEm: string | null;
  reabertoMotivo: string | null;
}

export interface LinhaConsolidada {
  ano: number;
  origem: "Marco inicial" | "Consolidado" | "Sistema";
  situacao: "Fechado" | "Reaberto" | "Aberto";
  valores: Partial<Record<ChaveDoTotal, number | null>>;
  /** Fechado e com lançamento alterado depois: o consolidado não muda. */
  aviso: DiferencaDoConsolidado[] | null;
  motivoDaReabertura: string | null;
}

/**
 * Tabela "Consolidados anuais": marco inicial dos anos antes do sistema,
 * os anos fechados (pelo consolidado, com o aviso se algo mudou depois) e os
 * abertos (ao vivo). Sem "Ver valores", as colunas em reais não existem.
 */
export function linhasDeConsolidados(p: {
  marcos: readonly { indicador: string; ano: number; valor: number }[];
  consolidados: readonly ConsolidadoGravado[];
  /** Totais de hoje dos anos que têm dado no sistema (o do filtro inclusive). */
  aoVivo: ReadonlyMap<number, Totais>;
  comValores: boolean;
}): LinhaConsolidada[] {
  const tirarReais = (t: Totais): Totais =>
    p.comValores
      ? t
      : Object.fromEntries(
          Object.entries(t).filter(
            ([k]) => !TOTAIS_EM_REAIS.includes(k as ChaveDoTotal),
          ),
        );
  const anos = [
    ...new Set([
      ...p.marcos.map((m) => m.ano),
      ...p.consolidados.map((c) => c.ano),
      ...p.aoVivo.keys(),
    ]),
  ].sort((a, b) => a - b);
  return anos.map((ano): LinhaConsolidada => {
    const cons = p.consolidados.find((c) => c.ano === ano);
    const vivo = tirarReais(p.aoVivo.get(ano) ?? {});
    if (cons?.situacao === "fechado") {
      const gravado = tirarReais({
        ...cons.totais,
        ...(cons.totaisReais ?? {}),
      });
      return {
        ano,
        origem: "Consolidado",
        situacao: "Fechado",
        valores: gravado,
        aviso: avisoDeConsolidado(
          { situacao: "fechado", totais: gravado },
          vivo,
        ),
        motivoDaReabertura: null,
      };
    }
    if (cons) {
      return {
        ano,
        origem: "Sistema",
        situacao: "Reaberto",
        valores: vivo,
        aviso: null,
        motivoDaReabertura: cons.reabertoMotivo,
      };
    }
    const dosMarcos = p.marcos.filter((m) => m.ano === ano);
    if (dosMarcos.length && !p.aoVivo.has(ano))
      return {
        ano,
        origem: "Marco inicial",
        situacao: "Fechado",
        valores: Object.fromEntries(
          dosMarcos.map((m) => [m.indicador, m.valor]),
        ),
        aviso: null,
        motivoDaReabertura: null,
      };
    return {
      ano,
      origem: "Sistema",
      situacao: "Aberto",
      valores: {
        ...Object.fromEntries(dosMarcos.map((m) => [m.indicador, m.valor])),
        ...vivo,
      },
      aviso: null,
      motivoDaReabertura: null,
    };
  });
}

/** Colunas da tabela de consolidados (as em reais só com permissão). */
export function colunasDosConsolidados(comValores: boolean): ChaveDoTotal[] {
  return (Object.keys(TOTAIS_DO_ANO) as ChaveDoTotal[]).filter(
    (c) => comValores || !TOTAIS_EM_REAIS.includes(c),
  );
}
