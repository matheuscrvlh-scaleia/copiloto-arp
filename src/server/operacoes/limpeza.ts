import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
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
} from "@/lib/operacoes/limpeza";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { lerTudo } from "@/server/supabase-paginas";
import {
  contextoOp,
  falhar,
  op,
  opAdmin,
  type Parametros,
  parametros,
  type Tabela,
} from "./base";

// Leituras do rateio da limpeza (spec 4.8). Dado de negócio: com a sessão,
// pelo RLS (operacoes.limpeza.ver ou .fechar), sem cache. A exceção é o
// Financeiro, que recebe o resultado do mês enviado (Excel e PDF): quem tem
// PERMISSAO_FINANCEIRO lê pela service role, só o mês já enviado e só depois
// de conferir a permissão no banco (podeAgora). O calendário do prazo
// (dias úteis e feriados dos Parâmetros dos Chamados) é configuração: cache.

export const PERMISSOES_RATEIO: Permissao[] = [
  "operacoes.limpeza.ver",
  "operacoes.limpeza.fechar",
];

/**
 * Quem é "o Financeiro" no aviso do envio e no acesso ao resultado enviado:
 * quem vê o faturamento (o rateio vira boleto).
 */
export const PERMISSAO_FINANCEIRO: Permissao = "financeiro.faturamento";

type Mes = Tabela<"limpeza_meses">;
type Extra = Tabela<"limpeza_extras">;
type Minuto = Tabela<"limpeza_minutos">;
type ItemContrato = Tabela<"limpeza_contrato">;
type Membro = Tabela<"limpeza_equipe">;
type Anexo = Tabela<"limpeza_anexos">;

const COLUNAS_MES =
  "referencia, importacao_id, apontamento, valor_base, base_composicao, func_base, func_area_comum, func_rateados, regra_bl04, status, incompleto, origem, valores_planilha, fechado_por, fechado_em, reaberto_por, reaberto_em, reaberto_motivo, enviado_por, enviado_em, exemplo, criado_por, criado_em, atualizado_em";

type LinhaMes = Mes;

export function veRateio(permissoes: readonly Permissao[]): boolean {
  return PERMISSOES_RATEIO.some((p) => permissoes.includes(p));
}

// ---------------------------------------------------------------------------
// Calendário do prazo de envio
// ---------------------------------------------------------------------------

/** Dias úteis e feriados (Parâmetros dos Chamados), para o prazo do envio. */
export const calendarioDoEnvio = cache(async (): Promise<CalendarioEnvio> => {
  const u = await usuarioAtual();
  if (!u.ativo || !u.permissoes.some((p) => p.startsWith("operacoes.")))
    throw new Error("Sem acesso ao módulo Operações.");
  const c = await calendarioDosChamados();
  return { diasUteis: c.diasUteis, feriados: new Set(c.feriados) };
});

async function calendarioDosChamados(): Promise<{
  diasUteis: number[];
  feriados: string[];
}> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.os.parametros, TAG.os.feriados);
  const os = createAdminClient().schema("os");
  const [p, f] = await Promise.all([
    os.from("parametros").select("dias_uteis").eq("id", 1).single(),
    os.from("feriados").select("data"),
  ]);
  falhar(p.error);
  falhar(f.error);
  return {
    diasUteis: p.data.dias_uteis,
    feriados: (f.data ?? []).map((x) => x.data),
  };
}

// ---------------------------------------------------------------------------
// Lista dos meses (histórico, gráfico, seletor)
// ---------------------------------------------------------------------------

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
  /** A conta refeita difere do total da planilha importada. */
  difereDaPlanilha: boolean;
}

/**
 * Todos os meses do rateio, do mais novo ao mais antigo, com o total da
 * conta. Meses de uma importação ainda em prévia ficam de fora.
 */
export const mesesDoRateio = cache(async (): Promise<ResumoDoMes[]> => {
  const db = await op();
  const [meses, extras, minutos, contrato, param, cal, ctx] = await Promise.all(
    [
      lerTudo(() =>
        db
          .from("limpeza_meses")
          .select(`${COLUNAS_MES}, importacoes(status)`)
          .order("referencia", { ascending: false }),
      ),
      lerTudo(() =>
        db
          .from("limpeza_extras")
          .select("id, referencia, valor")
          .order("referencia")
          .order("id"),
      ),
      lerTudo(() =>
        db
          .from("limpeza_minutos")
          .select("referencia, bloco, limpeza, manutencao")
          .order("referencia")
          .order("bloco"),
      ),
      lerTudo(() =>
        db
          .from("limpeza_contrato")
          .select("id, referencia, valor, entra_conferencia")
          .eq("entra_conferencia", true)
          .order("referencia")
          .order("id"),
      ),
      parametros(),
      calendarioDoEnvio(),
      contextoOp(),
    ],
  );
  const agrupar = <T extends { referencia: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs)
      m.set(x.referencia, [...(m.get(x.referencia) ?? []), x]);
    return m;
  };
  const exPorMes = agrupar(extras);
  const minPorMes = agrupar(minutos);
  const ctrPorMes = agrupar(contrato);

  return meses
    .filter((m) => !m.importacao_id || m.importacoes?.status === "confirmada")
    .map((m) => {
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
      const regra = m.regra_bl04 as RegraBl04;
      const prazo = prazoDoEnvio(
        m.referencia,
        param.limpeza_dia_util_envio,
        cal,
      );
      const totalPlanilha = totalDaPlanilha(m.valores_planilha);
      return {
        referencia: m.referencia,
        status: m.status as ResumoDoMes["status"],
        incompleto: m.incompleto,
        origem: m.origem as ResumoDoMes["origem"],
        regraBl04: regra,
        exemplo: m.exemplo,
        fechadoEm: m.fechado_em,
        enviadoEm: m.enviado_em,
        prazo,
        envio: situacaoDoEnvio(
          { origem: m.origem, enviadoEm: m.enviado_em },
          prazo,
          ctx.hoje,
        ),
        total: r.total,
        areaComum: r.areaComumExibida,
        blocos: Object.fromEntries(r.blocos.map((b) => [b.bloco, b.valor])),
        conferencia: r.conferencia.situacao,
        difereDaPlanilha:
          totalPlanilha !== null &&
          r.total !== null &&
          totalPlanilha !== r.total,
      };
    });
});

function totalDaPlanilha(v: unknown): number | null {
  const t =
    v && typeof v === "object" && "total" in v
      ? (v as { total: unknown }).total
      : null;
  return typeof t === "number" ? centavos(t) : null;
}

// ---------------------------------------------------------------------------
// Um mês
// ---------------------------------------------------------------------------

export interface PessoaDoMes {
  nome: string;
  em: string | null;
}

export interface DetalheDoMes {
  mes: LinhaMes;
  extras: Pick<
    Extra,
    "descricao" | "quantidade" | "valor_unitario" | "valor"
  >[];
  minutos: Minuto[];
  contrato: Pick<ItemContrato, "descricao" | "valor" | "entra_conferencia">[];
  equipe: Omit<Membro, "id" | "referencia">[];
  anexos: (Pick<Anexo, "id" | "nome" | "tipo" | "enviado_em"> & {
    enviadoPor: string;
  })[];
  blocos: string[];
  entrada: EntradaRateio;
  resultado: ResultadoRateio;
  lancou: PessoaDoMes | null;
  fechou: PessoaDoMes | null;
  reabriu: (PessoaDoMes & { motivo: string | null }) | null;
  enviou: PessoaDoMes | null;
  /** Importação ainda em prévia (o mês não vale até confirmar). */
  emPrevia: boolean;
}

type Cliente = Awaited<ReturnType<typeof op>>;

async function lerMes(
  db: Cliente,
  ref: string,
  param: Parametros,
  podeVerNomes: Permissao[] | (() => Promise<boolean>),
): Promise<DetalheDoMes | null> {
  const [mes, extras, minutos, contrato, equipe, anexos] = await Promise.all([
    db
      .from("limpeza_meses")
      .select(`${COLUNAS_MES}, importacoes(status)`)
      .eq("referencia", ref)
      .maybeSingle(),
    db
      .from("limpeza_extras")
      .select("descricao, quantidade, valor_unitario, valor")
      .eq("referencia", ref)
      .order("ordem"),
    db
      .from("limpeza_minutos")
      .select("referencia, bloco, limpeza, manutencao")
      .eq("referencia", ref)
      .order("bloco"),
    db
      .from("limpeza_contrato")
      .select("descricao, valor, entra_conferencia")
      .eq("referencia", ref)
      .order("ordem"),
    db
      .from("limpeza_equipe")
      .select("ordem, nome, funcao, grupo, blocos, turno, minutos_dia")
      .eq("referencia", ref)
      .order("ordem"),
    db
      .from("limpeza_anexos")
      .select("id, nome, tipo, enviado_em, enviado_por")
      .eq("referencia", ref)
      .order("enviado_em", { ascending: false }),
  ]);
  for (const r of [mes, extras, minutos, contrato, equipe, anexos])
    falhar(r.error);
  if (!mes.data) return null;
  const m = mes.data as LinhaMes & { importacoes: { status: string } | null };
  const emPrevia = !!m.importacao_id && m.importacoes?.status !== "confirmada";

  const nomes = await nomesDeUsuarios(
    [
      m.criado_por,
      m.fechado_por,
      m.reaberto_por,
      m.enviado_por,
      ...(anexos.data ?? []).map((a) => a.enviado_por),
    ],
    podeVerNomes,
  );
  const nome = (id: string | null) =>
    id ? (nomes.get(id) ?? "Usuário removido") : "—";
  const pessoa = (id: string | null, em: string | null) =>
    id || em ? { nome: id ? nome(id) : "—", em } : null;

  const entrada = entradaDoMes(
    m,
    extras.data ?? [],
    minutos.data ?? [],
    contrato.data ?? [],
    param.limpeza_blocos,
  );
  return {
    mes: m,
    extras: extras.data ?? [],
    minutos: minutos.data ?? [],
    contrato: contrato.data ?? [],
    equipe: equipe.data ?? [],
    anexos: (anexos.data ?? []).map((a) => ({
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
    reabriu: m.reaberto_em
      ? {
          ...(pessoa(m.reaberto_por, m.reaberto_em) as PessoaDoMes),
          motivo: m.reaberto_motivo,
        }
      : null,
    enviou: m.enviado_em ? pessoa(m.enviado_por, m.enviado_em) : null,
    emPrevia,
  };
}

/** O mês com tudo o que a tela mostra (sessão, RLS). */
export const detalheDoMes = cache(
  async (ref: string): Promise<DetalheDoMes | null> => {
    const [db, param] = await Promise.all([op(), parametros()]);
    return lerMes(db, ref, param, PERMISSOES_RATEIO);
  },
);

/**
 * O mês para o Excel e o PDF: quem vê o rateio lê pela sessão; quem é do
 * Financeiro (sem ver o rateio) só o mês já enviado, pela service role.
 */
export async function mesParaArquivo(
  ref: string,
): Promise<
  | { ok: true; detalhe: DetalheDoMes; parametros: Parametros }
  | { ok: false; status: 403 | 404; erro: string }
> {
  const u = await usuarioAtual();
  if (u.ativo && veRateio(u.permissoes)) {
    const [db, param] = await Promise.all([op(), parametros()]);
    const d = await lerMes(db, ref, param, PERMISSOES_RATEIO);
    return d && !d.emPrevia
      ? { ok: true, detalhe: d, parametros: param }
      : { ok: false, status: 404, erro: "Mês do rateio não encontrado." };
  }
  if (!u.ativo || !(await podeAgora(PERMISSAO_FINANCEIRO)))
    return {
      ok: false,
      status: 403,
      erro: "Você não tem acesso ao rateio da limpeza.",
    };
  // Financeiro: conferido no banco agora; só o mês enviado.
  const admin = opAdmin();
  const { data: param, error } = await admin
    .from("parametros")
    .select("*")
    .eq("id", true)
    .single();
  falhar(error);
  const d = await lerMes(admin as unknown as Cliente, ref, param, async () =>
    podeAgora(PERMISSAO_FINANCEIRO),
  );
  if (!d || !d.mes.enviado_em || d.mes.status !== "fechado")
    return {
      ok: false,
      status: 404,
      erro: "Este mês do rateio ainda não foi enviado ao Financeiro.",
    };
  return { ok: true, detalhe: d, parametros: param };
}

// ---------------------------------------------------------------------------
// Linhas do banco → entrada do cálculo
// ---------------------------------------------------------------------------

export function entradaDoMes(
  m: Pick<
    Mes,
    | "valor_base"
    | "base_composicao"
    | "func_base"
    | "func_area_comum"
    | "func_rateados"
    | "regra_bl04"
    | "status"
  >,
  extras: Pick<
    Extra,
    "descricao" | "quantidade" | "valor_unitario" | "valor"
  >[],
  minutos: Pick<Minuto, "bloco" | "limpeza" | "manutencao">[],
  contrato: Pick<ItemContrato, "descricao" | "valor" | "entra_conferencia">[],
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
    regraBl04: m.regra_bl04 as RegraBl04,
  };
}
