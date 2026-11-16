import { formatarDataHora } from "@arp/shared/formato";
import type { DetalheDoMesNaTela } from "@arp/shared/operacoes/contratos/limpeza";
import {
  blocosDoMes,
  type CalendarioEnvio,
  calcularRateio,
  centavos,
  type EntradaRateio,
  lerMes,
  prazoDoEnvio,
  type RegraBl04,
  type ResultadoRateio,
  type SituacaoEnvio,
  situacaoDoEnvio,
} from "@arp/shared/operacoes/limpeza";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import type { Permissao } from "@arp/shared/permissions";
import type { Contexto } from "@/contexto";
import { ErroDePermissao, ErroDeValidacao, ErroNaoEncontrado } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import {
  exigirModulo,
  type LinhaDeParametros,
  lerParametros,
  nomesDeUsuarios,
  podeAgora,
  podeAlguma,
} from "./apoio";
import * as repo from "./limpeza.repository";
import { gerarDemonstrativo } from "./limpeza-pdf";
import { planilhaDoRateio } from "./limpeza-planilha";

// Leituras do rateio da limpeza (spec 4.8) que o Painel usa, com as mesmas
// regras da tela da Limpeza: a lista dos meses com o total da conta, o prazo
// do envio (calendário dos Chamados) e a situação. Dado de negócio: com a
// sessão, pelo RLS (operacoes.limpeza.ver ou .fechar).

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

// ---------------------------------------------------------------------------
// Tela da Limpeza (parte B): um mês com tudo o que a tela, o PDF e o Excel
// mostram. Quem vê o rateio lê pela sessão; o Financeiro (quem vê o
// faturamento: o rateio vira boleto) só o mês já enviado, pela service role
// depois de conferir a permissão no banco.
// ---------------------------------------------------------------------------

export const PERMISSOES_RATEIO: Permissao[] = [
  "operacoes.limpeza.ver",
  "operacoes.limpeza.fechar",
];

/** Quem é "o Financeiro" no aviso do envio e no acesso ao resultado enviado. */
export const PERMISSAO_FINANCEIRO: Permissao = "financeiro.faturamento";

export const veRateio = (ctx: Contexto) => podeAlguma(ctx, PERMISSOES_RATEIO);

export interface PessoaDoMes {
  nome: string;
  em: string | null;
}

export type DetalheDoMes = Omit<DetalheDoMesNaTela, "mes"> & {
  mes: repo.LinhaDoMes;
  resultado: ResultadoRateio;
};

async function lerDoMes(
  ctx: Contexto,
  ref: string,
  param: LinhaDeParametros,
  servico: boolean,
  podeVerNomes: Permissao[],
): Promise<DetalheDoMes | null> {
  const ler = async (tx: Tx) => {
    const m = await repo.mes(tx, ref);
    if (!m) return null;
    return {
      m,
      extras: await repo.extrasDoMes(tx, ref),
      minutos: await repo.minutosDoMes(tx, ref),
      contrato: await repo.contratoDoMes(tx, ref),
      equipe: await repo.equipeDoMes(tx, ref),
      anexos: await repo.anexosDoMes(tx, ref),
    };
  };
  const lido = servico
    ? await banco.comoServico(ler)
    : await banco.comoUsuario(ctx.usuario.id, ler);
  if (!lido) return null;
  const { m, extras, minutos, contrato, equipe, anexos } = lido;
  const emPrevia = !!m.importacao_id && m.importacao_status !== "confirmada";

  const nomes = await nomesDeUsuarios(
    ctx,
    [
      m.criado_por,
      m.fechado_por,
      m.reaberto_por,
      m.enviado_por,
      ...anexos.map((a) => a.enviado_por),
    ],
    podeVerNomes,
  );
  const nome = (id: string | null) =>
    id ? (nomes.get(id) ?? "Usuário removido") : "—";
  const pessoa = (id: string | null, em: string | null): PessoaDoMes | null =>
    id || em ? { nome: id ? nome(id) : "—", em } : null;

  const entrada = entradaDoMes(
    m,
    extras,
    minutos,
    contrato,
    param.limpeza_blocos,
  );
  const reabriu = pessoa(m.reaberto_por, m.reaberto_em);
  return {
    mes: m,
    extras,
    minutos,
    contrato,
    equipe,
    anexos: anexos.map((a) => ({
      id: a.id,
      nome: a.nome,
      tipo: a.tipo,
      enviado_em: a.enviado_em,
      enviadoPor: nome(a.enviado_por),
    })),
    blocos: entrada.blocos,
    entrada,
    resultado: calcularRateio(entrada),
    lancou: pessoa(m.criado_por, m.criado_em),
    fechou: m.status === "fechado" ? pessoa(m.fechado_por, m.fechado_em) : null,
    reabriu:
      m.reaberto_em && reabriu
        ? { ...reabriu, motivo: m.reaberto_motivo }
        : null,
    enviou: m.enviado_em ? pessoa(m.enviado_por, m.enviado_em) : null,
    emPrevia,
  };
}

/** O mês com tudo o que a tela mostra (sessão, RLS). */
export async function detalheDoMes(
  ctx: Contexto,
  ref: string,
): Promise<DetalheDoMes | null> {
  exigirModulo(ctx);
  const param = await banco.comoUsuario(ctx.usuario.id, lerParametros);
  return lerDoMes(ctx, ref, param, false, PERMISSOES_RATEIO);
}

/** Meses da tela: sem a permissão do rateio, 403 (a tela mostra "sem acesso"). */
export function mesesDaTela(ctx: Contexto) {
  if (!veRateio(ctx)) throw new ErroDePermissao();
  return mesesDoRateio(ctx);
}

export async function mesDaTela(ctx: Contexto, mes: string) {
  if (!veRateio(ctx)) throw new ErroDePermissao();
  const ref = lerMes(mes);
  return ref ? detalheDoMes(ctx, ref) : null;
}

/**
 * O mês para o Excel e o PDF: quem vê o rateio lê pela sessão; quem é do
 * Financeiro (sem ver o rateio) só o mês já enviado, pela service role.
 */
export async function mesParaArquivo(
  ctx: Contexto,
  ref: string,
): Promise<{ detalhe: DetalheDoMes; parametros: LinhaDeParametros }> {
  if (veRateio(ctx)) {
    const param = await banco.comoUsuario(ctx.usuario.id, lerParametros);
    const d = await lerDoMes(ctx, ref, param, false, PERMISSOES_RATEIO);
    if (!d || d.emPrevia)
      throw new ErroNaoEncontrado("Mês do rateio não encontrado.");
    return { detalhe: d, parametros: param };
  }
  if (!(await podeAgora(ctx, PERMISSAO_FINANCEIRO)))
    throw new ErroDePermissao("Você não tem acesso ao rateio da limpeza.");
  // Financeiro: conferido no banco agora; só o mês enviado.
  const param = await banco.comoServico(lerParametros);
  const d = await lerDoMes(ctx, ref, param, true, [PERMISSAO_FINANCEIRO]);
  if (!d || !d.mes.enviado_em || d.mes.status !== "fechado")
    throw new ErroNaoEncontrado(
      "Este mês do rateio ainda não foi enviado ao Financeiro.",
    );
  return { detalhe: d, parametros: param };
}

/**
 * Demonstrativo do rateio em PDF, no papel timbrado: todos os locais e a
 * memória, ou só o do `bloco` (para o locatário).
 */
export async function demonstrativo(
  ctx: Contexto,
  mes: string,
  pedido: string | undefined,
): Promise<{ pdf: Uint8Array; nome: string }> {
  const ref = lerMes(mes);
  if (!ref) throw new ErroDeValidacao("Mês inválido.");
  const { detalhe, parametros } = await mesParaArquivo(ctx, ref);
  const bloco = pedido && detalhe.blocos.includes(pedido) ? pedido : undefined;
  if (pedido && !bloco)
    throw new ErroNaoEncontrado("Bloco fora do rateio deste mês.");
  const pdf = await gerarDemonstrativo({
    detalhe,
    empresa: parametros.limpeza_empresa,
    bloco,
    geradoEm: `${formatarDataHora(new Date().toISOString())} por ${ctx.usuario.nome}`,
  });
  return {
    pdf,
    nome: `rateio-limpeza-${ref.slice(0, 7)}${bloco ? `-bloco-${bloco}` : ""}.pdf`,
  };
}

/**
 * Resultado do rateio por local em Excel (o que vai ao Financeiro). Quem vê
 * o rateio precisa também de operacoes.exportar; o Financeiro baixa o mês
 * enviado (mesParaArquivo confere).
 */
export async function planilha(
  ctx: Contexto,
  mes: string,
): Promise<{ bytes: Uint8Array; nome: string }> {
  const ref = lerMes(mes);
  if (!ref) throw new ErroDeValidacao("Mês inválido.");
  if (veRateio(ctx) && !(await podeAgora(ctx, "operacoes.exportar")))
    throw new ErroDePermissao("Você não tem permissão para exportar.");
  const { detalhe, parametros } = await mesParaArquivo(ctx, ref);
  const bytes = await planilhaDoRateio(
    detalhe,
    parametros.limpeza_empresa,
    `${formatarDataHora(new Date().toISOString())} por ${ctx.usuario.nome}`,
  );
  return { bytes, nome: `rateio-limpeza-${ref.slice(0, 7)}.xlsx` };
}
