import { resumoDoQuadro } from "@arp/shared/operacoes/contratos/energia";
import type {
  DadosDoPainel,
  ObraNoPainel,
  PainelAgua,
  PainelContas,
  PainelDiario,
  PainelEnergia,
  PainelLimpeza,
  PainelObras,
} from "@arp/shared/operacoes/contratos/painel";
import { linhasDoPainel } from "@arp/shared/operacoes/diario";
import {
  centavos,
  consumoPorBloco,
  mesAnterior,
  mesDe,
  ocupacaoPorBloco,
  resumoDoDiario,
  resumoDosAlertas,
  situacaoDoRateio,
  situacaoFinanceira,
  somaM3,
} from "@arp/shared/operacoes/painel";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import { banco, type Tx } from "@/infra/banco";
import * as aguaRepo from "./agua.repository";
import { lerLeituras, lerMesDaAgua } from "./agua.service";
import { emLotes, type LinhaDeParametros, lerParametros } from "./apoio";
import * as diario from "./diario.service";
import { mesesDoRateio } from "./limpeza.service";
import * as repo from "./painel.repository";
import * as quadros from "./quadros.repository";

// Painel de Operações (spec 4.10): um resumo de cada área, com a sessão
// (RLS). Água, limpeza e Diário usam as mesmas leituras e regras das telas
// das áreas (lerMesDaAgua, mesesDoRateio, linhasDoPainel), para os números
// baterem. Cada área só é lida para quem tem a permissão dela; sem dados, a
// área volta vazia e a tela diz do que depende.

const naSessao = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

// ---------------------------------------------------------------------------
// Água
// ---------------------------------------------------------------------------

async function agua(
  ctx: Contexto,
  p: LinhaDeParametros,
  comValores: boolean,
): Promise<PainelAgua> {
  // O mês que a tela de Água abre: a importação confirmada mais nova.
  const meses = await naSessao(ctx, aguaRepo.mesesImportados);
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
  const mes = await lerMesDaAgua(ctx, referencia, p);
  const anterior = await lerLeituras(ctx, {
    referencia: mesAnterior(referencia),
  });
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

async function energia(ctx: Contexto): Promise<PainelEnergia> {
  const { resumo, ativos } = await naSessao(ctx, async (tx) => ({
    // operacoes.resumo_quadros() devolve jsonb (security invoker): confere aqui.
    resumo: z.array(resumoDoQuadro).parse(await quadros.resumoDosQuadros(tx)),
    ativos: await repo.quadrosAtivos(tx),
  }));
  const porQuadro = new Map(resumo.map((r) => [r.quadro_id, r]));
  const linhas = ativos.map((q) => {
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
    exemplo: ativos.some((q) => q.exemplo),
  };
}

// ---------------------------------------------------------------------------
// Energia: contas da área comum e créditos da geração solar
// ---------------------------------------------------------------------------

async function contas(ctx: Contexto): Promise<PainelContas> {
  const lido = await naSessao(ctx, async (tx) => {
    const referencia = await repo.ultimoMesComFatura(tx);
    if (!referencia) return null;
    return {
      referencia,
      f: await repo.faturasDoMes(tx, referencia),
      anterior: await repo.faturasDoMes(tx, mesAnterior(referencia)),
    };
  });
  if (!lido)
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
  const { referencia, f, anterior } = lido;
  const kwh = (k: "compensado_kwh" | "saldo_kwh" | "expirar_kwh") =>
    f.reduce((s, x) => s + centavos(x[k]), 0) / 100;
  return {
    referencia,
    faturas: f.length,
    totalCentavos: f.reduce((s, x) => s + centavos(x.total), 0),
    totalAnteriorCentavos: anterior.length
      ? anterior.reduce((s, x) => s + centavos(x.total), 0)
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

/**
 * O mês mais novo do rateio como a tela da Limpeza o mostra (mesesDoRateio:
 * sem meses de importação em prévia, total pelo calcularRateio, prazo com o
 * calendário dos Chamados, mês importado é histórico).
 */
async function limpeza(
  ctx: Contexto,
  p: LinhaDeParametros,
): Promise<PainelLimpeza> {
  const m = (await mesesDoRateio(ctx))[0];
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

async function obras(
  ctx: Contexto,
  p: LinhaDeParametros,
  hoje: string,
): Promise<PainelObras> {
  const { lista, vigentes, realizado, etapas, previsto } = await naSessao(
    ctx,
    async (tx) => {
      const vigentes = await repo.revisoesVigentes(tx);
      const etapas = vigentes.length
        ? await emLotes(
            vigentes.map((r) => r.id),
            500,
            (lote) => repo.etapasDasRevisoes(tx, lote),
          )
        : [];
      return {
        lista: await repo.obrasAtivas(tx),
        vigentes,
        realizado: await repo.realizado(tx),
        etapas,
        previsto: etapas.length
          ? await emLotes(
              etapas.map((e) => e.id),
              500,
              (lote) => repo.previstoAte(tx, lote, mesDe(hoje)),
            )
          : [],
      };
    },
  );
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
  const resultado = lista.map((o): ObraNoPainel => {
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
    exemplo: lista.some((o) => o.exemplo),
  };
}

// ---------------------------------------------------------------------------
// Diário de Obra (cópia da API)
// ---------------------------------------------------------------------------

/** As mesmas linhas, contas e alertas da tela do Diário de Obra. */
async function doDiario(
  ctx: Contexto,
  p: LinhaDeParametros,
  hoje: string,
): Promise<PainelDiario> {
  const d = await diario.dadosDoPainel(ctx);
  const limiteDesvio = Number(p.obras_limite_desvio);
  const linhas = linhasDoPainel(
    d.obras,
    d.relatorios,
    p.obras_dias_relatorio,
    hoje,
  );
  return {
    ...resumoDoDiario(linhas, limiteDesvio),
    atualizadoEm: d.atualizadoEm,
    limiteDesvio,
    exemplo: d.obras.some((o) => o.exemplo),
  };
}

// ---------------------------------------------------------------------------

/** Cada área só para quem tem a permissão dela (null: não aparece). */
export async function dadosDoPainel(ctx: Contexto): Promise<DadosDoPainel> {
  const p = await naSessao(ctx, lerParametros);
  const hoje = hojeEmBrasilia(new Date());
  const se = <T>(pode: boolean, ler: () => Promise<T>) =>
    pode ? ler() : Promise.resolve(null);
  const [a, e, c, l, o, d] = await Promise.all([
    se(pode(ctx, "operacoes.agua.ver"), () =>
      agua(ctx, p, pode(ctx, "operacoes.agua.valores")),
    ),
    se(pode(ctx, "operacoes.energia.ver"), () => energia(ctx)),
    se(
      pode(ctx, "operacoes.energia.contas") || pode(ctx, "operacoes.solar.ver"),
      () => contas(ctx),
    ),
    se(
      pode(ctx, "operacoes.limpeza.ver") ||
        pode(ctx, "operacoes.limpeza.fechar"),
      () => limpeza(ctx, p),
    ),
    se(pode(ctx, "operacoes.obras.ver"), () => obras(ctx, p, hoje)),
    se(pode(ctx, "operacoes.obras.diario"), () => doDiario(ctx, p, hoje)),
  ]);
  return { agua: a, energia: e, contas: c, limpeza: l, obras: o, diario: d };
}
