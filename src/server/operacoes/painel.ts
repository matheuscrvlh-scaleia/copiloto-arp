import "server-only";
import { z } from "zod";
import { linhasDoPainel } from "@/lib/operacoes/diario";
import {
  centavos,
  consumoPorBloco,
  mesAnterior,
  mesDe,
  type ObraNoDiario,
  ocupacaoPorBloco,
  type ResumoDosAlertas,
  resumoDoDiario,
  resumoDosAlertas,
  type SituacaoRateio,
  situacaoDoRateio,
  situacaoFinanceira,
  somaM3,
} from "@/lib/operacoes/painel";
import { lerTudo } from "@/server/supabase-paginas";
import { leiturasDoMes, mesDaAgua, mesesImportados } from "./agua";
import { type ContextoOp, falhar, op, type Parametros } from "./base";
import { datasDosRelatorios, obrasDoDiario } from "./diario";
import { mesesDoRateio } from "./limpeza";

// Painel de Operações (spec 4.10): um resumo de cada área, com a sessão
// (RLS). Água, limpeza e Diário usam as mesmas leituras e regras das telas
// das áreas (mesDaAgua, mesesDoRateio, linhasDoPainel), para os números
// baterem. Cada área só é lida para quem tem a permissão dela; sem dados, a
// área volta vazia e a tela diz do que depende.

type Banco = Awaited<ReturnType<typeof op>>;

// ---------------------------------------------------------------------------
// Água
// ---------------------------------------------------------------------------

export interface PainelAgua {
  /** Último mês importado (aaaa-mm-01); null sem leitura. */
  referencia: string | null;
  leituras: number;
  consumo: number;
  consumoAnterior: number | null;
  /** null: sem a permissão de valores (só m³). */
  valorCentavos: number | null;
  /** As mesmas regras e contagens da tela de Água. */
  alertas: ResumoDosAlertas;
  incompletos: number;
  blocos: { bloco: string; atual: number; anterior: number }[];
  limite: number;
  exemplo: boolean;
}

async function agua(p: Parametros, comValores: boolean): Promise<PainelAgua> {
  // O mês que a tela de Água abre: a importação confirmada mais nova.
  const meses = await mesesImportados();
  const incompletos = meses.filter((m) => m.incompleta).length;
  const limite = Number(p.agua_limite_m3);
  const referencia = meses[0]?.referencia ?? null;
  if (!referencia)
    return {
      referencia: null,
      leituras: 0,
      consumo: 0,
      consumoAnterior: null,
      valorCentavos: null,
      alertas: resumoDosAlertas([], 0),
      incompletos,
      blocos: [],
      limite,
      exemplo: false,
    };
  const [mes, anterior] = await Promise.all([
    mesDaAgua(referencia),
    leiturasDoMes(mesAnterior(referencia)),
  ]);
  const a = mes.leituras;
  return {
    referencia,
    leituras: a.length,
    consumo: somaM3(a.map((l) => l.consumo)),
    consumoAnterior: anterior.length
      ? somaM3(anterior.map((l) => l.consumo))
      : null,
    // Sem a permissão de valores o RLS esconde agua_valores (valor null).
    valorCentavos: comValores
      ? a.reduce((s, l) => s + centavos(l.valor), 0)
      : null,
    alertas: resumoDosAlertas(a, mes.sumidos.length),
    incompletos,
    blocos: consumoPorBloco(a, anterior),
    limite,
    exemplo: a.some((l) => l.exemplo),
  };
}

// ---------------------------------------------------------------------------
// Energia: caixas por status e locatários sem termo
// ---------------------------------------------------------------------------

export interface PainelEnergia {
  caixas: number;
  ocupadas: number;
  reservadas: number;
  livres: number;
  semTermo: number;
  blocos: ReturnType<typeof ocupacaoPorBloco>;
  exemplo: boolean;
}

// operacoes.resumo_quadros() devolve jsonb (security invoker): confere aqui.
const resumoQuadros = z.array(
  z.object({
    quadro_id: z.uuid(),
    caixas: z.number().int(),
    ocupadas: z.number().int(),
    reservadas: z.number().int(),
    livres: z.number().int(),
    sem_termo: z.number().int(),
  }),
);

async function energia(db: Banco): Promise<PainelEnergia> {
  const [resumo, quadros] = await Promise.all([
    db.rpc("resumo_quadros"),
    db.from("quadros").select("id, bloco, exemplo").eq("ativo", true),
  ]);
  falhar(resumo.error);
  falhar(quadros.error);
  const porQuadro = new Map(
    resumoQuadros.parse(resumo.data ?? []).map((r) => [r.quadro_id, r]),
  );
  const linhas = (quadros.data ?? []).map((q) => {
    const r = porQuadro.get(q.id);
    return {
      bloco: q.bloco,
      caixas: r?.caixas ?? 0,
      ocupadas: r?.ocupadas ?? 0,
      reservadas: r?.reservadas ?? 0,
      livres: r?.livres ?? 0,
      semTermo: r?.sem_termo ?? 0,
    };
  });
  const soma = (
    k: "caixas" | "ocupadas" | "reservadas" | "livres" | "semTermo",
  ) => linhas.reduce((s, l) => s + l[k], 0);
  return {
    caixas: soma("caixas"),
    ocupadas: soma("ocupadas"),
    reservadas: soma("reservadas"),
    livres: soma("livres"),
    semTermo: soma("semTermo"),
    blocos: ocupacaoPorBloco(linhas),
    exemplo: (quadros.data ?? []).some((q) => q.exemplo),
  };
}

// ---------------------------------------------------------------------------
// Energia: contas da área comum e créditos da geração solar
// ---------------------------------------------------------------------------

export interface PainelContas {
  referencia: string | null;
  faturas: number;
  totalCentavos: number;
  totalAnteriorCentavos: number | null;
  compensadoCentavos: number;
  compensadoKwh: number;
  saldoKwh: number;
  expirarKwh: number;
  exemplo: boolean;
}

async function contas(db: Banco): Promise<PainelContas> {
  const ultima = await db
    .from("energia_faturas")
    .select("referencia")
    .eq("vigente", true)
    .order("referencia", { ascending: false })
    .limit(1);
  falhar(ultima.error);
  const referencia = ultima.data?.[0]?.referencia ?? null;
  if (!referencia)
    return {
      referencia: null,
      faturas: 0,
      totalCentavos: 0,
      totalAnteriorCentavos: null,
      compensadoCentavos: 0,
      compensadoKwh: 0,
      saldoKwh: 0,
      expirarKwh: 0,
      exemplo: false,
    };
  const [mes, anterior] = await Promise.all([
    db
      .from("energia_faturas")
      .select(
        "total, valor_compensado, compensado_kwh, saldo_kwh, expirar_kwh, exemplo",
      )
      .eq("vigente", true)
      .eq("referencia", referencia),
    db
      .from("energia_faturas")
      .select("total")
      .eq("vigente", true)
      .eq("referencia", mesAnterior(referencia)),
  ]);
  falhar(mes.error);
  falhar(anterior.error);
  const f = mes.data ?? [];
  const kwh = (k: "compensado_kwh" | "saldo_kwh" | "expirar_kwh") =>
    f.reduce((s, x) => s + centavos(x[k]), 0) / 100;
  return {
    referencia,
    faturas: f.length,
    totalCentavos: f.reduce((s, x) => s + centavos(x.total), 0),
    totalAnteriorCentavos: anterior.data?.length
      ? anterior.data.reduce((s, x) => s + centavos(x.total), 0)
      : null,
    compensadoCentavos: f.reduce((s, x) => s + centavos(x.valor_compensado), 0),
    compensadoKwh: kwh("compensado_kwh"),
    saldoKwh: kwh("saldo_kwh"),
    expirarKwh: kwh("expirar_kwh"),
    exemplo: f.some((x) => x.exemplo),
  };
}

// ---------------------------------------------------------------------------
// Rateio da limpeza
// ---------------------------------------------------------------------------

export interface PainelLimpeza {
  referencia: string | null;
  totalCentavos: number | null;
  contratoCentavos: number | null;
  conferencia: "bate" | "nao_bate" | "sem_contrato" | "sem_total";
  situacao: SituacaoRateio | null;
  prazo: string | null;
  enviadoEm: string | null;
  empresa: string;
  exemplo: boolean;
}

/**
 * O mês mais novo do rateio como a tela da Limpeza o mostra (mesesDoRateio:
 * sem meses de importação em prévia, total pelo calcularRateio, prazo com o
 * calendário dos Chamados, mês importado é histórico).
 */
async function limpeza(p: Parametros): Promise<PainelLimpeza> {
  const m = (await mesesDoRateio())[0];
  if (!m)
    return {
      referencia: null,
      totalCentavos: null,
      contratoCentavos: null,
      conferencia: "sem_total",
      situacao: null,
      prazo: null,
      enviadoEm: null,
      empresa: p.limpeza_empresa,
      exemplo: false,
    };
  return {
    referencia: m.referencia,
    totalCentavos: m.total,
    contratoCentavos: m.conferencia === "sem_contrato" ? null : m.contrato,
    conferencia: m.total === null ? "sem_total" : m.conferencia,
    situacao: situacaoDoRateio(m),
    prazo: m.prazo,
    enviadoEm: m.enviadoEm,
    empresa: p.limpeza_empresa,
    exemplo: m.exemplo,
  };
}

// ---------------------------------------------------------------------------
// Obras: previsto × realizado
// ---------------------------------------------------------------------------

export interface ObraNoPainel {
  id: string;
  nome: string;
  revisao: string | null;
  orcamentoCentavos: number;
  previstoAteCentavos: number;
  realizadoCentavos: number;
  saldoCentavos: number;
  desvioPct: number | null;
  indice: number | null;
  alerta: boolean;
}

export interface PainelObras {
  obras: ObraNoPainel[];
  limitePct: number;
  exemplo: boolean;
}

async function obras(
  db: Banco,
  p: Parametros,
  hoje: string,
): Promise<PainelObras> {
  const [lista, revisoes, realizado] = await Promise.all([
    db
      .from("obras")
      .select("id, nome, exemplo")
      .eq("ativa", true)
      .order("nome"),
    db
      .from("orcamento_revisoes")
      .select("id, obra_id, codigo, total")
      .eq("vigente", true),
    lerTudo(() =>
      db.from("obra_realizado").select("id, obra_id, valor").order("id"),
    ),
  ]);
  falhar(lista.error);
  falhar(revisoes.error);
  const vigentes = revisoes.data ?? [];
  const etapas = vigentes.length
    ? await lerTudo(() =>
        db
          .from("orcamento_etapas")
          .select("id, revisao_id")
          .in(
            "revisao_id",
            vigentes.map((r) => r.id),
          )
          .order("id"),
      )
    : [];
  const previsto = etapas.length
    ? await lerTudo(() =>
        db
          .from("orcamento_previsto")
          .select("etapa_id, mes, valor")
          .in(
            "etapa_id",
            etapas.map((e) => e.id),
          )
          .lte("mes", mesDe(hoje))
          .order("etapa_id")
          .order("mes"),
      )
    : [];
  const revisaoDaEtapa = new Map(etapas.map((e) => [e.id, e.revisao_id]));
  const obraDaRevisao = new Map(vigentes.map((r) => [r.id, r.obra_id]));
  const previstoPorObra = new Map<string, number>();
  for (const v of previsto) {
    const obra = obraDaRevisao.get(revisaoDaEtapa.get(v.etapa_id) ?? "");
    if (obra)
      previstoPorObra.set(
        obra,
        (previstoPorObra.get(obra) ?? 0) + centavos(v.valor),
      );
  }
  const realizadoPorObra = new Map<string, number>();
  for (const r of realizado)
    realizadoPorObra.set(
      r.obra_id,
      (realizadoPorObra.get(r.obra_id) ?? 0) + centavos(r.valor),
    );
  const limitePct = Number(p.obras_limite_orcamento_pct);
  const resultado = (lista.data ?? []).map((o): ObraNoPainel => {
    const rev = vigentes.find((r) => r.obra_id === o.id);
    const base = {
      orcamentoCentavos: centavos(rev?.total),
      previstoAteCentavos: previstoPorObra.get(o.id) ?? 0,
      realizadoCentavos: realizadoPorObra.get(o.id) ?? 0,
    };
    return {
      id: o.id,
      nome: o.nome,
      revisao: rev?.codigo ?? null,
      ...base,
      ...situacaoFinanceira(base, limitePct),
    };
  });
  return {
    obras: resultado,
    limitePct,
    exemplo: (lista.data ?? []).some((o) => o.exemplo),
  };
}

// ---------------------------------------------------------------------------
// Diário de Obra (cópia da API)
// ---------------------------------------------------------------------------

export interface PainelDiario {
  obras: ObraNoDiario[];
  aAprovar: number;
  emAndamento: number;
  vencidas: number;
  comAlerta: number;
  atualizadoEm: string | null;
  limiteDesvio: number;
  exemplo: boolean;
}

/** As mesmas linhas, contas e alertas da tela do Diário de Obra. */
async function diario(
  db: Banco,
  p: Parametros,
  hoje: string,
): Promise<PainelDiario> {
  const [obrasDoApp, relatorios, ultima] = await Promise.all([
    obrasDoDiario(),
    datasDosRelatorios(),
    db
      .from("diario_obras")
      .select("atualizado_em")
      .order("atualizado_em", { ascending: false })
      .limit(1),
  ]);
  falhar(ultima.error);
  const limiteDesvio = Number(p.obras_limite_desvio);
  const linhas = linhasDoPainel(
    obrasDoApp,
    relatorios,
    p.obras_dias_relatorio,
    hoje,
  );
  return {
    ...resumoDoDiario(linhas, limiteDesvio),
    atualizadoEm: ultima.data?.[0]?.atualizado_em ?? null,
    limiteDesvio,
    exemplo: obrasDoApp.some((o) => o.exemplo),
  };
}

// ---------------------------------------------------------------------------

export interface DadosDoPainel {
  agua: PainelAgua | null;
  energia: PainelEnergia | null;
  contas: PainelContas | null;
  limpeza: PainelLimpeza | null;
  obras: PainelObras | null;
  diario: PainelDiario | null;
}

/** Cada área só para quem tem a permissão dela (null: não aparece). */
export async function dadosDoPainel(
  ctx: ContextoOp,
  p: Parametros,
): Promise<DadosDoPainel> {
  const db = await op();
  const se = <T>(pode: boolean, ler: () => Promise<T>) =>
    pode ? ler() : Promise.resolve(null);
  const [a, e, c, l, o, d] = await Promise.all([
    se(ctx.pode("operacoes.agua.ver"), () =>
      agua(p, ctx.pode("operacoes.agua.valores")),
    ),
    se(ctx.pode("operacoes.energia.ver"), () => energia(db)),
    se(
      ctx.pode("operacoes.energia.contas") || ctx.pode("operacoes.solar.ver"),
      () => contas(db),
    ),
    se(
      ctx.pode("operacoes.limpeza.ver") || ctx.pode("operacoes.limpeza.fechar"),
      () => limpeza(p),
    ),
    se(ctx.pode("operacoes.obras.ver"), () => obras(db, p, ctx.hoje)),
    se(ctx.pode("operacoes.obras.diario"), () => diario(db, p, ctx.hoje)),
  ]);
  return { agua: a, energia: e, contas: c, limpeza: l, obras: o, diario: d };
}
