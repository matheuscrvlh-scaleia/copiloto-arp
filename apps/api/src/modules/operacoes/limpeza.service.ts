import {
  blocosDoMes,
  type CalendarioEnvio,
  calcularRateio,
  centavos,
  type EntradaRateio,
  prazoDoEnvio,
  type RegraBl04,
  type ResultadoRateio,
  type SituacaoEnvio,
  situacaoDoEnvio,
} from "@arp/shared/operacoes/limpeza";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Contexto } from "@/contexto";
import { banco } from "@/infra/banco";
import { exigirModulo, lerParametros } from "./apoio";
import * as repo from "./limpeza.repository";

// Leituras do rateio da limpeza (spec 4.8) que o Painel usa, com as mesmas
// regras da tela da Limpeza: a lista dos meses com o total da conta, o prazo
// do envio (calendário dos Chamados) e a situação. Dado de negócio: com a
// sessão, pelo RLS (operacoes.limpeza.ver ou .fechar). A parte B (tela da
// Limpeza, importação, fechamento) completa este arquivo.

/** Dias úteis e feriados (Parâmetros dos Chamados), para o prazo do envio. */
export async function calendarioDoEnvio(
  ctx: Contexto,
): Promise<CalendarioEnvio> {
  exigirModulo(ctx);
  const c = await banco.comoServico(repo.calendarioDosChamados);
  return { diasUteis: c.diasUteis, feriados: new Set(c.feriados) };
}

const regraBl04 = (r: string): RegraBl04 =>
  r === "area_comum" ? "area_comum" : "separado";

/** Linhas do banco → entrada do cálculo. */
export function entradaDoMes(
  m: {
    valor_base: number | null;
    base_composicao: string | null;
    func_base: number | null;
    func_area_comum: number | null;
    func_rateados: number | null;
    regra_bl04: string;
    status: string;
  },
  extras: {
    descricao: string;
    quantidade: number | null;
    valor_unitario: number | null;
    valor: number;
  }[],
  minutos: { bloco: string; limpeza: number; manutencao: number }[],
  contrato: { descricao: string; valor: number; entra_conferencia: boolean }[],
  blocosParametros: string[],
): EntradaRateio {
  const doMes = minutos.map((x) => x.bloco);
  // Mês fechado fica com os blocos que tinha; aberto segue os parâmetros.
  const blocos =
    m.status === "fechado" && doMes.length
      ? blocosDoMes(
          blocosParametros.filter((b) => doMes.includes(b)),
          doMes,
        )
      : blocosDoMes(blocosParametros, doMes);
  return {
    valorBase: m.valor_base === null ? null : centavos(m.valor_base),
    composicao: m.base_composicao,
    funcBase: m.func_base,
    funcAreaComum: m.func_area_comum,
    funcRateados: m.func_rateados,
    extras: extras.map((x) => ({
      descricao: x.descricao,
      quantidade: x.quantidade === null ? null : Number(x.quantidade),
      valorUnitario:
        x.valor_unitario === null ? null : centavos(x.valor_unitario),
      valor: centavos(x.valor),
    })),
    blocos,
    minutos: minutos.map((x) => ({
      bloco: x.bloco,
      limpeza: x.limpeza,
      manutencao: x.manutencao,
    })),
    contrato: contrato.map((c) => ({
      descricao: c.descricao,
      valor: centavos(c.valor),
      entraConferencia: c.entra_conferencia,
    })),
    regraBl04: regraBl04(m.regra_bl04),
  };
}

export interface ResumoDoMes {
  referencia: string;
  status: "aberto" | "fechado";
  incompleto: boolean;
  origem: "tela" | "importacao";
  regraBl04: RegraBl04;
  exemplo: boolean;
  fechadoEm: string | null;
  enviadoEm: string | null;
  prazo: string;
  envio: SituacaoEnvio;
  total: number | null;
  /** Área comum como a tela mostra (com o Bloco 04 na regra antiga). */
  areaComum: number | null;
  blocos: Record<string, number | null>;
  conferencia: ResultadoRateio["conferencia"]["situacao"];
  /** Soma dos itens do contrato que entram na conferência (centavos). */
  contrato: number;
  /** A conta refeita difere do total da planilha importada. */
  difereDaPlanilha: boolean;
}

function totalDaPlanilha(v: unknown): number | null {
  const t = v && typeof v === "object" && "total" in v ? v.total : null;
  return typeof t === "number" ? centavos(t) : null;
}

function agrupar<T extends { referencia: string }>(xs: T[]) {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(x.referencia, [...(m.get(x.referencia) ?? []), x]);
  return m;
}

/**
 * Todos os meses do rateio, do mais novo ao mais antigo, com o total da
 * conta. Meses de uma importação ainda em prévia ficam de fora.
 */
export async function mesesDoRateio(ctx: Contexto): Promise<ResumoDoMes[]> {
  const cal = await calendarioDoEnvio(ctx);
  const { meses, extras, minutos, contrato, param } = await banco.comoUsuario(
    ctx.usuario.id,
    async (tx) => ({
      meses: await repo.meses(tx),
      extras: await repo.extras(tx),
      minutos: await repo.minutos(tx),
      contrato: await repo.contratoDaConferencia(tx),
      param: await lerParametros(tx),
    }),
  );
  const hoje = hojeEmBrasilia(new Date());
  const exPorMes = agrupar(extras);
  const minPorMes = agrupar(minutos);
  const ctrPorMes = agrupar(contrato);

  return meses
    .filter((m) => !m.importacao_id || m.importacao_status === "confirmada")
    .map((m): ResumoDoMes => {
      const entrada = entradaDoMes(
        m,
        (exPorMes.get(m.referencia) ?? []).map((x) => ({
          descricao: "",
          quantidade: null,
          valor_unitario: null,
          valor: x.valor,
        })),
        minPorMes.get(m.referencia) ?? [],
        (ctrPorMes.get(m.referencia) ?? []).map((c) => ({
          descricao: "",
          valor: c.valor,
          entra_conferencia: c.entra_conferencia,
        })),
        param.limpeza_blocos,
      );
      const r = calcularRateio(entrada);
      const prazo = prazoDoEnvio(
        m.referencia,
        param.limpeza_dia_util_envio,
        cal,
      );
      const totalPlanilha = totalDaPlanilha(m.valores_planilha);
      return {
        referencia: m.referencia,
        status: m.status === "fechado" ? "fechado" : "aberto",
        incompleto: m.incompleto,
        origem: m.origem === "importacao" ? "importacao" : "tela",
        regraBl04: regraBl04(m.regra_bl04),
        exemplo: m.exemplo,
        fechadoEm: m.fechado_em,
        enviadoEm: m.enviado_em,
        prazo,
        envio: situacaoDoEnvio(
          { origem: m.origem, enviadoEm: m.enviado_em },
          prazo,
          hoje,
        ),
        total: r.total,
        areaComum: r.areaComumExibida,
        blocos: Object.fromEntries(r.blocos.map((b) => [b.bloco, b.valor])),
        conferencia: r.conferencia.situacao,
        contrato: r.conferencia.contrato,
        difereDaPlanilha:
          totalPlanilha !== null &&
          r.total !== null &&
          totalPlanilha !== r.total,
      };
    });
}
