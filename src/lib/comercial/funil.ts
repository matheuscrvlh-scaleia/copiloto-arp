import { paraBrasilia } from "@/lib/os/tempo";
import { diasEntre } from "./datas";
import {
  campoDa,
  type Estado,
  estadoDa,
  type FontesRd,
  type RdOportunidade,
} from "./fontes";

// Funil comercial (spec 4.4): oportunidades do RD CRM como a aba DASHBOARD
// da planilha Gestão Comercial. O período é sempre pela data de criação;
// conversão e perdidas são sobre as criadas no período. Contato e valores só
// entram na linha quando a pessoa tem a permissão (o servidor nem os manda).

export interface ContatoFunil {
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
}

export interface OportunidadeFunil {
  id: string;
  /** Data de criação, "aaaa-mm-dd" em Brasília. */
  criacao: string;
  ano: number;
  /** 1 a 12. */
  mes: number;
  nome: string;
  empresa: string | null;
  qualificacao: number;
  funil: string;
  etapa: string;
  estado: Estado;
  motivoPerda: string | null;
  anotacaoPerda: string | null;
  /** null: sem a permissão de valores. */
  valorUnico: number | null;
  valorRecorrente: number | null;
  pausada: boolean;
  primeiraInteracao: string | null;
  ultimaInteracao: string | null;
  /** Hoje menos a última interação; null = "Sem interação". */
  diasSemInteracao: number | null;
  proximaTarefa: { data: string; assunto: string } | null;
  previsaoFechamento: string | null;
  dataFechamento: string | null;
  fonte: string;
  /** Pelo de-para dos parâmetros; fonte sem de-para fica com o nome do RD. */
  fonteAjustada: string;
  campanha: string;
  responsavel: string;
  imovel: string;
  perfil: string;
  tamanho: string;
  segmento: string;
  /** conversion_identifier da landing page de origem (RD Marketing). */
  landingPage: string | null;
  /** null: sem a permissão de contato. */
  contatos: ContatoFunil[] | null;
}

export const SEM_FONTE = "Sem fonte";
export const NAO_INFORMADO = "Não informado";

const dia = (iso: string | null) =>
  iso ? paraBrasilia(new Date(iso)).data : null;

/**
 * Landing page de origem: a última conversão do contato até a criação da
 * oportunidade (sem nenhuma antes, a primeira depois).
 */
function landingPageDe(
  o: RdOportunidade,
  porEmail: Map<string, { quando: string; lp: string }[]>,
): string | null {
  const conv = o.contacts
    .flatMap((c) => c.emails.map((e) => e.email.toLowerCase()))
    .flatMap((e) => porEmail.get(e) ?? [])
    .sort((a, b) => a.quando.localeCompare(b.quando));
  if (!conv.length) return null;
  const antes = conv.filter((c) => c.quando <= o.created_at);
  return (antes.at(-1) ?? conv[0])?.lp ?? null;
}

export function montarOportunidades(
  rd: FontesRd,
  dePara: ReadonlyMap<string, string>,
  hoje: string,
  pode: { contato: boolean; valores: boolean },
): OportunidadeFunil[] {
  const porEmail = new Map<string, { quando: string; lp: string }[]>();
  for (const c of rd.conversoes) {
    const e = c.email.toLowerCase();
    porEmail.set(e, [
      ...(porEmail.get(e) ?? []),
      { quando: c.created_at, lp: c.conversion_identifier },
    ]);
  }
  return rd.oportunidades.map((o) => {
    const criacao = dia(o.created_at) as string;
    const ultima = dia(o.last_activity_at);
    const fonte = o.deal_source?.name ?? SEM_FONTE;
    return {
      id: o._id,
      criacao,
      ano: Number(criacao.slice(0, 4)),
      mes: Number(criacao.slice(5, 7)),
      nome: o.name,
      empresa: o.organization?.name ?? null,
      qualificacao: o.rating,
      funil: o.deal_pipeline.name,
      etapa: o.deal_stage.name,
      estado: estadoDa(o),
      motivoPerda: o.deal_lost_reason?.name ?? null,
      anotacaoPerda: o.deal_lost_note,
      valorUnico: pode.valores ? o.amount_unique : null,
      valorRecorrente: pode.valores ? o.amount_montly : null,
      pausada: o.hold,
      primeiraInteracao: dia(o.first_activity_at),
      ultimaInteracao: ultima,
      diasSemInteracao: ultima ? Math.max(0, diasEntre(ultima, hoje)) : null,
      proximaTarefa: o.next_task
        ? { data: o.next_task.date.slice(0, 10), assunto: o.next_task.subject }
        : null,
      previsaoFechamento: o.prediction_date?.slice(0, 10) ?? null,
      dataFechamento: dia(o.closed_at),
      fonte,
      fonteAjustada: dePara.get(fonte) ?? fonte,
      campanha: o.campaign?.name ?? "",
      responsavel: o.user.name,
      imovel: campoDa(o, "imovel"),
      perfil: campoDa(o, "perfil"),
      tamanho: campoDa(o, "tamanho"),
      segmento: campoDa(o, "segmento"),
      landingPage: landingPageDe(o, porEmail),
      contatos: pode.contato
        ? o.contacts.map((c) => ({
            nome: c.name,
            cargo: c.title,
            email: c.emails[0]?.email ?? null,
            telefone: c.phones[0]?.phone ?? null,
          }))
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export interface FiltroFunil {
  ano: number;
  /** 1 a 12; null = todos. */
  mes: number | null;
  /** null = todos os funis. */
  funil: string | null;
  campanha: string | null;
  fonteAjustada: string | null;
  responsavel: string | null;
  estado: Estado | null;
  landingPage: string | null;
}

/** O que vale para os cartões: tudo menos o estado (os cartões são o estado). */
export function filtrarFunil(
  ops: OportunidadeFunil[],
  f: Omit<FiltroFunil, "estado">,
): OportunidadeFunil[] {
  return ops.filter(
    (o) =>
      o.ano === f.ano &&
      (f.mes === null || o.mes === f.mes) &&
      (f.funil === null || o.funil === f.funil) &&
      (f.campanha === null || o.campanha === f.campanha) &&
      (f.fonteAjustada === null || o.fonteAjustada === f.fonteAjustada) &&
      (f.responsavel === null || o.responsavel === f.responsavel) &&
      (f.landingPage === null || o.landingPage === f.landingPage),
  );
}

export const doEstado = (ops: OportunidadeFunil[], estado: Estado | null) =>
  estado === null ? ops : ops.filter((o) => o.estado === estado);

// ---------------------------------------------------------------------------
// Cartões e cálculos
// ---------------------------------------------------------------------------

/** a ÷ b em %, null sem base. */
export const pct = (a: number, b: number): number | null =>
  b ? (a / b) * 100 : null;

export interface ContagemFunil {
  criadas: number;
  andamento: number;
  vendidas: number;
  perdidas: number;
  /** Vendidas ÷ criadas, em %. */
  conversao: number | null;
  perdidasPct: number | null;
  andamentoPct: number | null;
  /** Soma do valor recorrente das vendidas (null sem a permissão). */
  recorrentes: number | null;
  /** Soma do valor único das vendidas (null sem a permissão). */
  pontuais: number | null;
}

export function contarFunil(ops: OportunidadeFunil[]): ContagemFunil {
  const de = (e: Estado) => ops.filter((o) => o.estado === e);
  const vendidas = de("Vendida");
  const andamento = de("Em andamento").length;
  const perdidas = de("Perdida").length;
  const comValores = ops.every((o) => o.valorUnico !== null);
  const soma = (k: "valorUnico" | "valorRecorrente") =>
    comValores ? vendidas.reduce((t, o) => t + (o[k] ?? 0), 0) : null;
  return {
    criadas: ops.length,
    andamento,
    vendidas: vendidas.length,
    perdidas,
    conversao: pct(vendidas.length, ops.length),
    perdidasPct: pct(perdidas, ops.length),
    andamentoPct: pct(andamento, ops.length),
    recorrentes: soma("valorRecorrente"),
    pontuais: soma("valorUnico"),
  };
}

// ---------------------------------------------------------------------------
// Quadros (os mesmos da planilha) e gráficos
// ---------------------------------------------------------------------------

/**
 * Meses do período: o do filtro, ou o ano (no ano corrente, até o mês de
 * hoje; ano que ainda não chegou, nenhum).
 */
export function mesesDoPeriodo(
  ano: number,
  mes: number | null,
  hoje: string,
): number[] {
  if (mes !== null) return [mes];
  const anoHoje = Number(hoje.slice(0, 4));
  const ate =
    ano < anoHoje ? 12 : ano === anoHoje ? Number(hoje.slice(5, 7)) : 0;
  return Array.from({ length: ate }, (_, i) => i + 1);
}

export interface LinhaContagem {
  rotulo: string;
  quantidade: number;
  pct: number | null;
}

/** Quantidade e % por um campo, da maior para a menor. */
export function contarPor(
  ops: OportunidadeFunil[],
  campo: (o: OportunidadeFunil) => string | null,
): LinhaContagem[] {
  const n = new Map<string, number>();
  for (const o of ops) {
    const k = campo(o) || NAO_INFORMADO;
    n.set(k, (n.get(k) ?? 0) + 1);
  }
  return [...n.entries()]
    .map(([rotulo, quantidade]) => ({
      rotulo,
      quantidade,
      pct: pct(quantidade, ops.length),
    }))
    .sort(
      (a, b) =>
        b.quantidade - a.quantidade ||
        a.rotulo.localeCompare(b.rotulo, "pt-BR"),
    );
}

export interface LinhaMensal {
  rotulo: string;
  /** Um valor por mês de `meses`. */
  porMes: number[];
  total: number;
  pct: number | null;
  /** Total ÷ meses do período. */
  media: number | null;
}

export interface QuadroMensal {
  meses: number[];
  linhas: LinhaMensal[];
  total: LinhaMensal;
}

/** Quadro mês × campo (fonte ajustada, segmento), com total do ano e média. */
export function quadroMensal(
  ops: OportunidadeFunil[],
  campo: (o: OportunidadeFunil) => string | null,
  meses: number[],
): QuadroMensal {
  const media = (t: number) => (meses.length ? t / meses.length : null);
  const linha = (rotulo: string, doGrupo: OportunidadeFunil[]): LinhaMensal => {
    const porMes = meses.map((m) => doGrupo.filter((o) => o.mes === m).length);
    const total = porMes.reduce((t, v) => t + v, 0);
    return {
      rotulo,
      porMes,
      total,
      pct: pct(total, ops.length),
      media: media(total),
    };
  };
  const doPeriodo = ops.filter((o) => meses.includes(o.mes));
  const linhas = contarPor(doPeriodo, campo).map((g) =>
    linha(
      g.rotulo,
      doPeriodo.filter((o) => (campo(o) || NAO_INFORMADO) === g.rotulo),
    ),
  );
  const total = linha("Total", doPeriodo);
  return {
    meses,
    linhas: linhas.map((l) => ({ ...l, pct: pct(l.total, total.total) })),
    total: { ...total, pct: total.total ? 100 : null },
  };
}

/** Oportunidades por mês, em cada estado (colunas empilhadas). */
export function porMesEEstado(
  ops: OportunidadeFunil[],
  meses: number[],
): Record<Estado, number[]> {
  const conta = (e: Estado) =>
    meses.map((m) => ops.filter((o) => o.mes === m && o.estado === e).length);
  return {
    "Em andamento": conta("Em andamento"),
    Vendida: conta("Vendida"),
    Perdida: conta("Perdida"),
  };
}

/** Valores distintos de um campo, em ordem alfabética (opções dos filtros). */
export function opcoesDe(
  ops: OportunidadeFunil[],
  campo: (o: OportunidadeFunil) => string | null,
): string[] {
  return [...new Set(ops.map(campo).filter((v): v is string => !!v))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
}
