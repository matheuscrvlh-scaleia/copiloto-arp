import { z } from "zod";
import { diasEntre, fimDoMesDe } from "./datas";
import type { EnetContaReceber, EnetContrato, EnetLuc } from "./fontes";
import { fotoDaOcupacao } from "./ocupacao";

// Painel de indicadores comerciais (spec 4.10): a aba "Painel de Indicadores
// Anual" da planilha. Uma linha por indicador com Plan (core.metas
// comercial.<indicador>, um valor por mês), Real (ENET e RD) e % atingido,
// de janeiro a dezembro e o acumulado. Percentuais ficam em % (96 = 96%),
// no Plan e no Real.

export type Formato = "moeda" | "numero" | "pct";
export type Direcao = "maior_melhor" | "menor_melhor";
/** Como o acumulado junta os meses. */
export type Acumulo = "soma" | "media" | "ultimo";

interface DefIndicador {
  nome: string;
  formato: Formato;
  direcao: Direcao;
  acumulo: Acumulo;
  calculo: string;
  /** Tem Plan (metas cadastradas). */
  meta: boolean;
  /** Número parcial: rótulo do que cobre (spec 4.3). */
  parcial?: string;
}

export const INDICADORES_PAINEL = {
  faturamento: {
    nome: "Faturamento (contas a receber de locações)",
    formato: "moeda",
    direcao: "maior_melhor",
    acumulo: "soma",
    meta: true,
    calculo: "Soma do valor faturado na competência (ENET, contas a receber).",
  },
  contratos_fechados: {
    nome: "Contratos fechados (em reais)",
    formato: "moeda",
    direcao: "maior_melhor",
    acumulo: "soma",
    meta: true,
    calculo: "Soma do aluguel dos contratos com data de início no mês (ENET).",
  },
  contratos_rescindidos: {
    nome: "Contratos rescindidos (em reais)",
    formato: "moeda",
    direcao: "menor_melhor",
    acumulo: "soma",
    meta: true,
    calculo:
      "Soma do aluguel dos contratos com data de rescisão no mês (ENET). Menor é melhor.",
  },
  aumento_receita: {
    nome: "Aumento de receita de contratos",
    formato: "moeda",
    direcao: "maior_melhor",
    acumulo: "soma",
    meta: true,
    calculo: "Contratos fechados menos contratos rescindidos, em reais.",
  },
  leads: {
    nome: "Leads (oportunidades abertas no RD)",
    formato: "numero",
    direcao: "maior_melhor",
    acumulo: "soma",
    meta: true,
    calculo:
      "Oportunidades com data de criação no mês, no funil padrão dos parâmetros (RD CRM).",
  },
  ocupacao: {
    nome: "% Ocupação",
    formato: "pct",
    direcao: "maior_melhor",
    acumulo: "media",
    meta: true,
    calculo:
      "ABL locada ÷ ABL total na foto do último dia do mês (ENET LUCs), só com os tipos de LUC que contam na ocupação. Acumulado: média dos meses.",
  },
  valor_m2: {
    nome: "Valor por m²",
    formato: "moeda",
    direcao: "maior_melhor",
    acumulo: "media",
    meta: true,
    calculo:
      "Faturamento do mês ÷ ABL locada no fim do mês. Acumulado: média dos meses.",
  },
  churn: {
    nome: "% Churn",
    formato: "pct",
    direcao: "menor_melhor",
    acumulo: "media",
    meta: true,
    calculo:
      "Contratos rescindidos (em reais) ÷ faturamento do mês. Menor é melhor. Acumulado: média dos meses.",
  },
  receita_midia: {
    nome: "Receita com mídia",
    formato: "moeda",
    direcao: "maior_melhor",
    acumulo: "soma",
    meta: true,
    calculo:
      "Faturamento do mês dos LUCs dos tipos marcados como receita de mídia nos parâmetros (tipos de LUC; ENET).",
  },
  receita_eventos: {
    nome: "Receita com eventos",
    formato: "moeda",
    direcao: "maior_melhor",
    acumulo: "soma",
    meta: true,
    calculo:
      "Faturamento do mês dos LUCs dos tipos marcados como receita de eventos nos parâmetros (tipos de LUC; ENET).",
  },
  clientes: {
    nome: "Quantidade de clientes",
    formato: "numero",
    direcao: "maior_melhor",
    acumulo: "ultimo",
    meta: true,
    calculo:
      "Locatários com contrato ativo no fim do mês (ENET). Acumulado: o último mês.",
  },
  carencia: {
    nome: "Faturamento em carência",
    formato: "moeda",
    direcao: "menor_melhor",
    acumulo: "soma",
    meta: false,
    parcial: "só contratos feitos no sistema",
    calculo:
      "Soma do aluguel em período de carência no mês, proporcional aos dias, só dos contratos feitos no assistente (não rascunho).",
  },
} as const satisfies Record<string, DefIndicador>;

export type IndicadorPainel = keyof typeof INDICADORES_PAINEL;
export const ORDEM_PAINEL = Object.keys(
  INDICADORES_PAINEL,
) as IndicadorPainel[];
export const COM_META = ORDEM_PAINEL.filter((i) => INDICADORES_PAINEL[i].meta);

/** Nome do indicador em core.metas. */
export const chaveMeta = (i: IndicadorPainel) => `comercial.${i}`;

/** Nome do campo da célula na grade de metas. */
export const campoMeta = (i: IndicadorPainel, mes: number) => `${i}.${mes}`;

export const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

/** "aaaa-mm-01" do mês (1 a 12). */
export const competencia = (ano: number, mes: number) =>
  `${ano}-${String(mes).padStart(2, "0")}-01`;

// ---------------------------------------------------------------------------
// Regras de cada número
// ---------------------------------------------------------------------------

/** a ÷ b em %, null sem base. */
export const pct = (a: number | null, b: number | null): number | null =>
  a === null || b === null || b === 0 ? null : (a / b) * 100;

/** % atingido: Real ÷ Plan (sem Plan positivo ou sem Real, vazio). */
export function atingido(
  real: number | null,
  plan: number | null,
): number | null {
  if (real === null || plan === null || plan <= 0) return null;
  return (real / plan) * 100;
}

/**
 * Bom ou ruim: abaixo de 100% é ruim; nos indicadores em que menor é
 * melhor (churn, rescindidos), acima de 100% é que é ruim.
 */
export function atingiuMeta(pctAtingido: number, direcao: Direcao): boolean {
  return direcao === "menor_melhor" ? pctAtingido <= 100 : pctAtingido >= 100;
}

export function acumular(
  valores: (number | null)[],
  acumulo: Acumulo,
): number | null {
  const v = valores.filter((x): x is number => x !== null);
  if (!v.length) return null;
  if (acumulo === "ultimo") return v.at(-1) ?? null;
  const soma = v.reduce((t, x) => t + x, 0);
  return acumulo === "media" ? soma / v.length : soma;
}

export const aumentoDeReceita = (
  fechados: number | null,
  rescindidos: number | null,
) =>
  fechados === null || rescindidos === null ? null : fechados - rescindidos;

export const churn = (rescindidos: number | null, faturamento: number | null) =>
  pct(rescindidos, faturamento);

export const valorPorM2 = (
  faturamento: number | null,
  ablLocada: number | null,
) =>
  faturamento === null || ablLocada === null || ablLocada === 0
    ? null
    : faturamento / ablLocada;

// ---------------------------------------------------------------------------
// Faturamento em carência (contratos do assistente, comercial.contratos)
// ---------------------------------------------------------------------------

const diaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Linhas de "Carência e desconto" da etapa 3 do contrato (spec 4.11), em
 * dados.condicoes.carencias_descontos. Só o tipo "carencia" entra aqui.
 */
const condicoesSchema = z.object({
  carencias_descontos: z
    .array(
      z.object({
        tipo: z.string(),
        inicio: diaIso,
        fim: diaIso,
      }),
    )
    .catch([]),
});

export interface CarenciaContrato {
  aluguel: number;
  periodos: { inicio: string; fim: string }[];
}

/** Os períodos de carência de um contrato, a partir de dados.condicoes. */
export function carenciaDoContrato(
  aluguel: number | null,
  condicoes: unknown,
): CarenciaContrato | null {
  const c = condicoesSchema.safeParse(condicoes);
  if (!aluguel || !c.success) return null;
  const periodos = c.data.carencias_descontos
    .filter((l) => l.tipo === "carencia" && l.inicio <= l.fim)
    .map(({ inicio, fim }) => ({ inicio, fim }));
  return periodos.length ? { aluguel, periodos } : null;
}

/** Aluguel em carência no mês, proporcional aos dias de carência. */
export function faturamentoEmCarencia(
  contratos: CarenciaContrato[],
  mes: string,
): number {
  const fim = fimDoMesDe(mes);
  const dias = diasEntre(mes, fim) + 1;
  let total = 0;
  for (const c of contratos)
    for (const p of c.periodos) {
      const de = p.inicio > mes ? p.inicio : mes;
      const ate = p.fim < fim ? p.fim : fim;
      if (de <= ate) total += (c.aluguel * (diasEntre(de, ate) + 1)) / dias;
    }
  return Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------------------
// Ocupação no fim do mês
// ---------------------------------------------------------------------------

/** Foto guardada pela rotina (comercial.ocupacao_fotos). */
export interface FotoGuardada {
  /** "aaaa-mm-01". */
  mes: string;
  abl_total: number;
  abl_locada: number;
  clientes_ativos: number | null;
}

/**
 * De onde veio o número de ocupação do mês: a foto guardada, o ENET de hoje
 * (mês corrente), o cálculo pelos contratos (dado de exemplo) ou nada.
 */
export type OrigemOcupacao = "foto" | "hoje" | "calculado" | "sem_historico";

export interface OcupacaoMes {
  ablTotal: number | null;
  ablLocada: number | null;
  origem: OrigemOcupacao;
}

// ---------------------------------------------------------------------------
// Montagem do painel
// ---------------------------------------------------------------------------

export interface EntradaPainel {
  ano: number;
  /** "aaaa-mm-dd". */
  hoje: string;
  contas: EnetContaReceber[];
  contratos: EnetContrato[];
  lucs: EnetLuc[];
  /** Tipos de LUC que contam na ocupação e os das receitas (parâmetros). */
  tiposOcupacao: ReadonlySet<string>;
  tiposMidia: ReadonlySet<string>;
  tiposEventos: ReadonlySet<string>;
  /** Data de criação ("aaaa-mm-dd") de cada oportunidade do funil padrão. */
  leads: string[];
  fotos: FotoGuardada[];
  carencias: CarenciaContrato[];
  /** Dados de exemplo: sem foto, a ocupação é calculada pelos contratos. */
  exemplo: boolean;
  /** Metas: indicador (comercial.x) e mês ("aaaa-mm-01"). */
  metas: { indicador: string; vigente_desde: string; meta: number }[];
}

export interface LinhaPainel {
  indicador: IndicadorPainel;
  plan: (number | null)[];
  real: (number | null)[];
  atingido: (number | null)[];
  /** Por mês, o que explica um Real vazio ou estimado (só na ocupação). */
  marcas: (OrigemOcupacao | null)[];
  acumulado: {
    plan: number | null;
    real: number | null;
    atingido: number | null;
  };
}

const arred = (v: number) => Math.round(v * 100) / 100;

/** Meses com Real: o ano todo no passado, até o mês de hoje no corrente. */
export function mesesComReal(ano: number, hoje: string): number {
  const anoHoje = Number(hoje.slice(0, 4));
  if (ano < anoHoje) return 12;
  if (ano > anoHoje) return 0;
  return Number(hoje.slice(5, 7));
}

export function montarPainel(e: EntradaPainel): LinhaPainel[] {
  const ate = mesesComReal(e.ano, e.hoje);
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const comp = meses.map((m) => competencia(e.ano, m));
  const temReal = (i: number) => i < ate;
  const mesCorrente = (i: number) =>
    e.hoje.slice(0, 7) === (comp[i] as string).slice(0, 7);
  // Fim do mês, ou hoje no mês corrente.
  const fimOuHoje = (i: number) => {
    const f = fimDoMesDe(comp[i] as string);
    return f > e.hoje ? e.hoje : f;
  };
  const porMes = <T>(f: (i: number, mes: string) => T): (T | null)[] =>
    comp.map((c, i) => (temReal(i) ? f(i, c) : null));

  const somaContas = (mes: string, tipos?: ReadonlySet<string>) =>
    arred(
      e.contas
        .filter(
          (c) =>
            c.competencia === mes &&
            (tipos === undefined || tipos.has(c.tipo_luc)),
        )
        .reduce((t, c) => t + c.valor_faturado, 0),
    );
  const somaAluguel = (mes: string, campo: "data_inicio" | "data_rescisao") =>
    arred(
      e.contratos
        .filter((c) => c[campo]?.slice(0, 7) === mes.slice(0, 7))
        .reduce((t, c) => t + c.valor_aluguel, 0),
    );

  const faturamento = porMes((_, m) => somaContas(m));
  const fechados = porMes((_, m) => somaAluguel(m, "data_inicio"));
  const rescindidos = porMes((_, m) => somaAluguel(m, "data_rescisao"));
  const fotos = new Map(e.fotos.map((f) => [f.mes, f]));
  // Mesmo critério da tela e da rotina (lib/comercial/ocupacao).
  const noDia = porMes((i) =>
    fotoDaOcupacao(e, fimOuHoje(i), e.hoje, e.tiposOcupacao),
  );
  const ocupacao: (OcupacaoMes | null)[] = porMes((i, m) => {
    const foto = fotos.get(m);
    if (foto)
      return {
        ablTotal: foto.abl_total,
        ablLocada: foto.abl_locada,
        origem: "foto" as const,
      };
    const calc = noDia[i];
    if (calc && (mesCorrente(i) || e.exemplo))
      return {
        ablTotal: calc.abl_total,
        ablLocada: calc.abl_locada,
        origem: mesCorrente(i) ? ("hoje" as const) : ("calculado" as const),
      };
    return {
      ablTotal: null,
      ablLocada: null,
      origem: "sem_historico" as const,
    };
  });
  const ablLocada = (i: number) => ocupacao[i]?.ablLocada ?? null;

  const real: Record<IndicadorPainel, (number | null)[]> = {
    faturamento,
    contratos_fechados: fechados,
    contratos_rescindidos: rescindidos,
    aumento_receita: porMes((i) =>
      aumentoDeReceita(fechados[i] ?? null, rescindidos[i] ?? null),
    ),
    leads: porMes(
      (_, m) => e.leads.filter((d) => d.slice(0, 7) === m.slice(0, 7)).length,
    ),
    ocupacao: porMes((i) =>
      pct(ocupacao[i]?.ablLocada ?? null, ocupacao[i]?.ablTotal ?? null),
    ),
    valor_m2: porMes((i) => valorPorM2(faturamento[i] ?? null, ablLocada(i))),
    churn: porMes((i) => churn(rescindidos[i] ?? null, faturamento[i] ?? null)),
    receita_midia: porMes((_, m) => somaContas(m, e.tiposMidia)),
    receita_eventos: porMes((_, m) => somaContas(m, e.tiposEventos)),
    clientes: porMes(
      (i, m) =>
        fotos.get(m)?.clientes_ativos ?? noDia[i]?.clientes_ativos ?? null,
    ),
    // Nenhum contrato com carência no sistema: vazio (não zero).
    carencia: e.carencias.length
      ? porMes((_, m) => faturamentoEmCarencia(e.carencias, m))
      : comp.map(() => null),
  };

  const metas = new Map(
    e.metas.map((m) => [`${m.indicador}|${m.vigente_desde}`, m.meta]),
  );
  return ORDEM_PAINEL.map((indicador) => {
    const def: DefIndicador = INDICADORES_PAINEL[indicador];
    const plan = comp.map((c) =>
      def.meta ? (metas.get(`${chaveMeta(indicador)}|${c}`) ?? null) : null,
    );
    const r = real[indicador];
    // Plan acumulado nos mesmos meses do Real, para o % comparar igual.
    const planDosMeses = plan.map((p, i) =>
      ate === 0 || (r[i] !== null && i < ate) ? p : null,
    );
    const accPlan = acumular(ate === 0 ? plan : planDosMeses, def.acumulo);
    const accReal = acumular(r, def.acumulo);
    return {
      indicador,
      plan,
      real: r,
      atingido: r.map((v, i) => atingido(v, plan[i] ?? null)),
      marcas:
        indicador === "ocupacao" || indicador === "valor_m2"
          ? ocupacao.map((o) => o?.origem ?? null)
          : comp.map(() => null),
      acumulado: {
        plan: accPlan,
        real: accReal,
        atingido: atingido(accReal, accPlan),
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Metas (tela de metas): o que gravar e o que apagar
// ---------------------------------------------------------------------------

export interface MetaGravada {
  id: string;
  indicador: string;
  vigente_desde: string;
  meta: number;
}

export interface MetaNova {
  indicador: string;
  vigente_desde: string;
  /** null: a célula ficou vazia (apaga a meta, se havia). */
  meta: number | null;
}

/** Só o que mudou: grava as novas e alteradas, apaga as esvaziadas. */
export function mudancasDeMetas(
  atuais: MetaGravada[],
  novas: MetaNova[],
): {
  gravar: { indicador: string; vigente_desde: string; meta: number }[];
  apagar: string[];
} {
  const porChave = new Map(
    atuais.map((m) => [`${m.indicador}|${m.vigente_desde}`, m]),
  );
  const gravar: { indicador: string; vigente_desde: string; meta: number }[] =
    [];
  const apagar: string[] = [];
  for (const n of novas) {
    const atual = porChave.get(`${n.indicador}|${n.vigente_desde}`);
    if (n.meta === null) {
      if (atual) apagar.push(atual.id);
    } else if (!atual || Math.abs(atual.meta - n.meta) > 1e-9)
      gravar.push({
        indicador: n.indicador,
        vigente_desde: n.vigente_desde,
        meta: n.meta,
      });
  }
  return { gravar, apagar };
}

/** Faixa aceita na meta de cada formato (aumento de receita pode ser negativo). */
export function metaValida(i: IndicadorPainel, v: number): string | null {
  if (!Number.isFinite(v)) return "número inválido";
  const def: DefIndicador = INDICADORES_PAINEL[i];
  if (def.formato === "pct" && (v < 0 || v > 100)) return "use de 0 a 100 (%)";
  if (i !== "aumento_receita" && v < 0) return "não pode ser negativo";
  if (def.formato === "numero" && !Number.isInteger(v))
    return "use um número inteiro";
  return null;
}
