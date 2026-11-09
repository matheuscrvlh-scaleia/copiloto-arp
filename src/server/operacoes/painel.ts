import "server-only";
import { z } from "zod";
import {
  type AlertaAgua,
  alertasDaAgua,
  centavos,
  consumoPorBloco,
  DIAS_UTEIS_PADRAO,
  type LeituraPainel,
  mesAnterior,
  mesDe,
  ocupacaoPorBloco,
  prazoDoEnvio,
  RELATORIO_APROVADO,
  type SituacaoRateio,
  situacaoDoDiario,
  situacaoDoRateio,
  situacaoFinanceira,
  somaM3,
  totalDoRateio,
} from "@/lib/operacoes/painel";
import { createClient } from "@/lib/supabase/server";
import { lerTudo } from "@/server/supabase-paginas";
import { type ContextoOp, falhar, op, type Parametros } from "./base";

// Painel de Operações (spec 4.10): um resumo de cada área, lido direto das
// tabelas com a sessão (RLS). Cada área só é lida para quem tem a permissão
// dela; sem dados, a área volta vazia e a tela diz do que depende.

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
  alertas: { total: number; porTipo: Record<AlertaAgua, number> };
  incompletos: number;
  blocos: { bloco: string; atual: number; anterior: number }[];
  limite: number;
  exemplo: boolean;
}

const COLUNAS_LEITURA =
  "id, bloco, hidrometro, consumo, leitura_anterior, leitura_atual, foto, exemplo" as const;

async function agua(
  db: Banco,
  p: Parametros,
  comValores: boolean,
): Promise<PainelAgua> {
  const ultima = await db
    .from("agua_leituras")
    .select("referencia")
    .eq("vigente", true)
    .order("referencia", { ascending: false })
    .limit(1);
  falhar(ultima.error);
  const referencia = ultima.data?.[0]?.referencia ?? null;
  const incompletos = db
    .from("importacoes")
    .select("id", { count: "exact", head: true })
    .eq("tipo", "agua")
    .eq("status", "confirmada")
    .eq("incompleta", true);
  if (!referencia) {
    const { count, error } = await incompletos;
    falhar(error);
    return {
      referencia: null,
      leituras: 0,
      consumo: 0,
      consumoAnterior: null,
      valorCentavos: null,
      alertas: alertasDaAgua([], [], Number(p.agua_limite_m3)),
      incompletos: count ?? 0,
      blocos: [],
      limite: Number(p.agua_limite_m3),
      exemplo: false,
    };
  }
  const anteriorRef = mesAnterior(referencia);
  const doMes = (ref: string) =>
    lerTudo(() =>
      db
        .from("agua_leituras")
        .select(COLUNAS_LEITURA)
        .eq("vigente", true)
        .eq("referencia", ref)
        .order("id"),
    );
  const [atual, anterior, nIncompletos, valores] = await Promise.all([
    doMes(referencia),
    doMes(anteriorRef),
    incompletos,
    comValores
      ? lerTudo(() =>
          db
            .from("agua_valores")
            .select(
              "leitura_id, valor, leitura:agua_leituras!inner(referencia, vigente)",
            )
            .eq("leitura.referencia", referencia)
            .eq("leitura.vigente", true)
            .order("leitura_id"),
        )
      : null,
  ]);
  falhar(nIncompletos.error);
  const comoLeitura = (l: (typeof atual)[number]): LeituraPainel => ({
    bloco: l.bloco,
    hidrometro: l.hidrometro,
    consumo: Number(l.consumo),
    leitura_anterior:
      l.leitura_anterior === null ? null : Number(l.leitura_anterior),
    leitura_atual: l.leitura_atual === null ? null : Number(l.leitura_atual),
    foto: l.foto,
  });
  const a = atual.map(comoLeitura);
  const b = anterior.map(comoLeitura);
  return {
    referencia,
    leituras: a.length,
    consumo: somaM3(a.map((l) => l.consumo)),
    consumoAnterior: b.length ? somaM3(b.map((l) => l.consumo)) : null,
    valorCentavos: valores
      ? valores.reduce((s, v) => s + centavos(v.valor), 0)
      : null,
    alertas: alertasDaAgua(a, b, Number(p.agua_limite_m3)),
    incompletos: nIncompletos.count ?? 0,
    blocos: consumoPorBloco(a, b),
    limite: Number(p.agua_limite_m3),
    exemplo: atual.some((l) => l.exemplo),
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

async function limpeza(
  db: Banco,
  p: Parametros,
  hoje: string,
): Promise<PainelLimpeza> {
  const ultimo = await db
    .from("limpeza_meses")
    .select(
      "referencia, valor_base, func_base, func_area_comum, func_rateados, status, incompleto, enviado_em, exemplo",
    )
    .order("referencia", { ascending: false })
    .limit(1);
  falhar(ultimo.error);
  const m = ultimo.data?.[0];
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
  const [extras, contrato, feriados] = await Promise.all([
    db.from("limpeza_extras").select("valor").eq("referencia", m.referencia),
    db
      .from("limpeza_contrato")
      .select("valor")
      .eq("referencia", m.referencia)
      .eq("entra_conferencia", true),
    // Os feriados do Chamados (RLS libera a quem usa Operações).
    (await createClient()).schema("os").from("feriados").select("data"),
  ]);
  falhar(extras.error);
  falhar(contrato.error);
  falhar(feriados.error);
  const total = totalDoRateio({
    valorBase: m.valor_base,
    funcBase: m.func_base,
    funcAreaComum: m.func_area_comum,
    funcRateados: m.func_rateados,
    extras: (extras.data ?? []).map((e) => e.valor),
  });
  const itensContrato = contrato.data ?? [];
  const contratoCentavos = itensContrato.length
    ? itensContrato.reduce((s, c) => s + centavos(c.valor), 0)
    : null;
  const prazo = prazoDoEnvio(m.referencia, p.limpeza_dia_util_envio, {
    feriados: new Set((feriados.data ?? []).map((f) => f.data)),
    diasUteis: DIAS_UTEIS_PADRAO,
  });
  return {
    referencia: m.referencia,
    totalCentavos: total,
    contratoCentavos,
    conferencia:
      total === null
        ? "sem_total"
        : contratoCentavos === null
          ? "sem_contrato"
          : total === contratoCentavos
            ? "bate"
            : "nao_bate",
    situacao: situacaoDoRateio({
      status: m.status as "aberto" | "fechado",
      incompleto: m.incompleto,
      enviado: m.enviado_em !== null,
      prazo,
      hoje,
    }),
    prazo,
    enviadoEm: m.enviado_em,
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

export interface ObraDoDiario {
  id: string;
  nome: string;
  statusId: number;
  avancoPct: number | null;
  prazoPct: number | null;
  desvio: number | null;
  vencido: boolean;
  alerta: boolean;
}

export interface PainelDiario {
  obras: ObraDoDiario[];
  aAprovar: number;
  emAndamento: number;
  vencidas: number;
  comAlerta: number;
  atualizadoEm: string | null;
  limiteDesvio: number;
  exemplo: boolean;
}

async function diario(
  db: Banco,
  p: Parametros,
  hoje: string,
): Promise<PainelDiario> {
  const [lista, aAprovar] = await Promise.all([
    db
      .from("diario_obras")
      .select(
        "id, nome, status_id, realizado, prazo_contratual, prazo_decorrido, prazo_a_vencer, data_fim, atualizado_em, exemplo",
      )
      .order("nome"),
    db
      .from("diario_relatorios")
      .select("id", { count: "exact", head: true })
      .neq("status_id", RELATORIO_APROVADO),
  ]);
  falhar(lista.error);
  falhar(aAprovar.error);
  const limiteDesvio = Number(p.obras_limite_desvio);
  const linhas = lista.data ?? [];
  const obrasDoDiario = linhas.map((o): ObraDoDiario => {
    const s = situacaoDoDiario(o, hoje, limiteDesvio);
    return {
      id: o.id,
      nome: o.nome,
      statusId: o.status_id,
      avancoPct: s.avancoPct,
      prazoPct: s.prazoPct,
      desvio: s.desvio,
      vencido: s.vencido,
      alerta: s.alerta,
    };
  });
  const atualizadoEm = linhas.reduce<string | null>(
    (max, o) => (!max || o.atualizado_em > max ? o.atualizado_em : max),
    null,
  );
  return {
    obras: obrasDoDiario,
    aAprovar: aAprovar.count ?? 0,
    emAndamento: obrasDoDiario.filter((o) => o.statusId === 3).length,
    vencidas: obrasDoDiario.filter((o) => o.vencido).length,
    comAlerta: obrasDoDiario.filter((o) => o.alerta).length,
    atualizadoEm,
    limiteDesvio,
    exemplo: linhas.some((o) => o.exemplo),
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
      agua(db, p, ctx.pode("operacoes.agua.valores")),
    ),
    se(ctx.pode("operacoes.energia.ver"), () => energia(db)),
    se(
      ctx.pode("operacoes.energia.contas") || ctx.pode("operacoes.solar.ver"),
      () => contas(db),
    ),
    se(
      ctx.pode("operacoes.limpeza.ver") || ctx.pode("operacoes.limpeza.fechar"),
      () => limpeza(db, p, ctx.hoje),
    ),
    se(ctx.pode("operacoes.obras.ver"), () => obras(db, p, ctx.hoje)),
    se(ctx.pode("operacoes.obras.diario"), () => diario(db, p, ctx.hoje)),
  ]);
  return { agua: a, energia: e, contas: c, limpeza: l, obras: o, diario: d };
}
