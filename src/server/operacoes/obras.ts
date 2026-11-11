import "server-only";
import { cache } from "react";
import {
  centavosDe,
  type EtapaPrevista,
  type Lancado,
  type Limites,
  type ValorMes,
} from "@/lib/operacoes/obras";
import type { AvisoOrcamento } from "@/lib/operacoes/orcamento";
import type { Json } from "@/lib/supabase/database.types";
import { linksDeLeitura } from "@/server/arquivos";
import { podeAgora } from "@/server/auth";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { lerTudo } from "@/server/supabase-paginas";
import { falhar, op, opAdmin, type Parametros, parametros } from "./base";

// Leituras das Obras — previsto e realizado (spec 4.9). Dado de negócio:
// com a sessão (RLS de operacoes.obras.ver), sem cache no servidor.
//
// Uma revisão só vale quando a importação dela foi confirmada (as linhas da
// prévia já ficam gravadas, com vigente = false). Do mesmo jeito, o
// realizado trazido por uma planilha só conta depois da confirmação.

/** Validade do link de anexo e da planilha (segundos). */
const LINK_SEGUNDOS = 3600;

export const limitesDe = (p: Parametros): Limites => ({
  desvioPontos: Number(p.obras_limite_desvio),
  orcamentoPct: Number(p.obras_limite_orcamento_pct),
});

type StatusImportacao = { status: string } | null;

/** A linha vale: sem importação (tela) ou com a importação confirmada. */
const valeImportacao = (
  importacaoId: string | null,
  imp: StatusImportacao | StatusImportacao[],
) => {
  if (!importacaoId) return true;
  const i = Array.isArray(imp) ? imp[0] : imp;
  return i?.status === "confirmada";
};

export interface Revisao {
  id: string;
  codigo: string;
  data: string | null;
  titulo: string | null;
  /** Soma das etapas, em centavos. */
  total: number;
  /** Total escrito na planilha, em centavos. */
  totalArquivo: number | null;
  vigente: boolean;
  exemplo: boolean;
  importacaoId: string | null;
  /** "confirmada", "previa"… (null: sem importação). */
  status: string | null;
  avisos: AvisoOrcamento[];
  importadaEm: string | null;
}

export interface ObraLinha {
  id: string;
  nome: string;
  responsavel: string | null;
  ativa: boolean;
  exemplo: boolean;
  diarioObraId: string | null;
  vigente: Revisao | null;
  previsto: ValorMes[];
  realizado: ValorMes[];
  /** Data do último lançamento (ou da importação) do realizado. */
  ultimoLancamento: string | null;
}

function avisosDe(j: Json | undefined): AvisoOrcamento[] {
  if (!Array.isArray(j)) return [];
  return j.flatMap((a) => {
    if (!a || typeof a !== "object" || Array.isArray(a)) return [];
    const o = a as Record<string, Json | undefined>;
    if (typeof o.mensagem !== "string") return [];
    const nivel =
      o.nivel === "erro" || o.nivel === "aviso" || o.nivel === "info"
        ? o.nivel
        : "aviso";
    return [
      {
        nivel,
        mensagem: o.mensagem,
        ...(typeof o.linha === "number" ? { linha: o.linha } : {}),
      },
    ];
  });
}

const COLUNAS_REVISAO =
  "id, obra_id, codigo, data, titulo, total, total_arquivo, vigente, exemplo, importacao_id, criado_em, importacoes(status, avisos, confirmado_em)";

interface LinhaRevisao {
  id: string;
  obra_id: string;
  codigo: string;
  data: string | null;
  titulo: string | null;
  total: number;
  total_arquivo: number | null;
  vigente: boolean;
  exemplo: boolean;
  importacao_id: string | null;
  criado_em: string;
  importacoes: {
    status: string;
    avisos: Json;
    confirmado_em: string | null;
  } | null;
}

function revisaoDe(r: LinhaRevisao): Revisao {
  const imp = r.importacoes;
  const status = r.importacao_id ? (imp?.status ?? null) : null;
  return {
    id: r.id,
    codigo: r.codigo,
    data: r.data,
    titulo: r.titulo,
    total: centavosDe(Number(r.total)),
    totalArquivo:
      r.total_arquivo === null ? null : centavosDe(Number(r.total_arquivo)),
    // Vigente só com a importação confirmada (ou sem importação).
    vigente: r.vigente && (status === null || status === "confirmada"),
    exemplo: r.exemplo,
    importacaoId: r.importacao_id,
    status,
    avisos: avisosDe(imp?.avisos),
    importadaEm: imp?.confirmado_em ?? r.criado_em,
  };
}

const valorMes = (r: { mes: string; valor: number }): ValorMes => ({
  mes: r.mes,
  centavos: centavosDe(Number(r.valor)),
});

/** Todas as obras com a revisão vigente, o previsto dela e o realizado. */
export const obrasComValores = cache(async (): Promise<ObraLinha[]> => {
  const banco = await op();
  const [obras, revisoes, etapas, realizado] = await Promise.all([
    banco
      .from("obras")
      .select("id, nome, responsavel, ativa, exemplo, diario_obra_id")
      .order("nome"),
    banco
      .from("orcamento_revisoes")
      .select(COLUNAS_REVISAO)
      .eq("vigente", true),
    banco
      .from("orcamento_etapas")
      .select(
        "revisao_id, orcamento_previsto(mes, valor), orcamento_revisoes!inner(vigente)",
      )
      .eq("orcamento_revisoes.vigente", true),
    lerTudo(() =>
      banco
        .from("obra_realizado")
        .select(
          "obra_id, mes, valor, importacao_id, lancado_em, importacoes(status)",
        )
        .order("id"),
    ),
  ]);
  falhar(obras.error);
  falhar(revisoes.error);
  falhar(etapas.error);

  const vigentes = new Map<string, Revisao>();
  for (const r of revisoes.data ?? []) {
    const rev = revisaoDe(r);
    if (rev.vigente) vigentes.set(r.obra_id, rev);
  }
  const previstoDaRevisao = new Map<string, ValorMes[]>();
  for (const e of etapas.data ?? []) {
    const lista = previstoDaRevisao.get(e.revisao_id) ?? [];
    for (const p of e.orcamento_previsto) lista.push(valorMes(p));
    previstoDaRevisao.set(e.revisao_id, lista);
  }
  const realizadoDaObra = new Map<string, ValorMes[]>();
  const ultimo = new Map<string, string>();
  for (const r of realizado) {
    if (!valeImportacao(r.importacao_id, r.importacoes)) continue;
    const lista = realizadoDaObra.get(r.obra_id) ?? [];
    lista.push(valorMes(r));
    realizadoDaObra.set(r.obra_id, lista);
    if ((ultimo.get(r.obra_id) ?? "") < r.lancado_em)
      ultimo.set(r.obra_id, r.lancado_em);
  }

  return (obras.data ?? []).map((o) => {
    const vigente = vigentes.get(o.id) ?? null;
    return {
      id: o.id,
      nome: o.nome,
      responsavel: o.responsavel,
      ativa: o.ativa,
      exemplo: o.exemplo,
      diarioObraId: o.diario_obra_id,
      vigente,
      previsto: vigente ? (previstoDaRevisao.get(vigente.id) ?? []) : [],
      realizado: realizadoDaObra.get(o.id) ?? [],
      ultimoLancamento: ultimo.get(o.id) ?? null,
    };
  });
});

export interface Lancamento extends Lancado {
  id: string;
  descricao: string | null;
  /** Caminho no bucket "operacoes". */
  anexo: string | null;
  /** Link temporário para abrir o anexo. */
  link: string | null;
  origem: "tela" | "planilha";
  exemplo: boolean;
  lancadoPor: string;
  lancadoEm: string;
}

export interface EtapaDaRevisao extends EtapaPrevista {
  revisaoId: string;
}

export interface DadosDaObra {
  obra: Omit<
    ObraLinha,
    "vigente" | "previsto" | "realizado" | "ultimoLancamento"
  >;
  /** Todas as revisões (confirmadas e a prévia, se houver), da mais nova à mais velha. */
  revisoes: Revisao[];
  etapas: EtapaDaRevisao[];
  lancamentos: Lancamento[];
  limites: Limites;
}

/** Obra com as revisões, as etapas de todas elas e o realizado. null: não existe ou sem acesso. */
export const dadosDaObra = cache(
  async (id: string): Promise<DadosDaObra | null> => {
    const banco = await op();
    const [obra, revisoes, etapas, realizado, p] = await Promise.all([
      banco
        .from("obras")
        .select("id, nome, responsavel, ativa, exemplo, diario_obra_id")
        .eq("id", id)
        .maybeSingle(),
      banco
        .from("orcamento_revisoes")
        .select(COLUNAS_REVISAO)
        .eq("obra_id", id)
        .order("codigo", { ascending: false }),
      banco
        .from("orcamento_etapas")
        .select(
          "revisao_id, ordem, nome, observacao, orcamento_previsto(mes, valor), orcamento_revisoes!inner(obra_id)",
        )
        .eq("orcamento_revisoes.obra_id", id)
        .order("ordem"),
      lerTudo(() =>
        banco
          .from("obra_realizado")
          .select(
            "id, etapa, mes, valor, descricao, anexo, origem, importacao_id, exemplo, lancado_por, lancado_em, importacoes(status)",
          )
          .eq("obra_id", id)
          .order("mes")
          .order("lancado_em")
          .order("id"),
      ),
      parametros(),
    ]);
    falhar(obra.error);
    falhar(revisoes.error);
    falhar(etapas.error);
    if (!obra.data) return null;

    const validos = realizado.filter((r) =>
      valeImportacao(r.importacao_id, r.importacoes),
    );
    const [nomes, links] = await Promise.all([
      nomesDeUsuarios(
        validos.map((r) => r.lancado_por),
        ["operacoes.obras.ver"],
      ),
      linksDeLeitura(
        "operacoes",
        validos.flatMap((r) => (r.anexo ? [r.anexo] : [])),
        LINK_SEGUNDOS,
      ),
    ]);

    const o = obra.data;
    return {
      obra: {
        id: o.id,
        nome: o.nome,
        responsavel: o.responsavel,
        ativa: o.ativa,
        exemplo: o.exemplo,
        diarioObraId: o.diario_obra_id,
      },
      revisoes: (revisoes.data ?? []).map(revisaoDe),
      etapas: (etapas.data ?? []).map((e) => ({
        revisaoId: e.revisao_id,
        ordem: e.ordem,
        nome: e.nome,
        observacao: e.observacao,
        previsto: e.orcamento_previsto.map(valorMes),
      })),
      lancamentos: validos.map((r) => ({
        id: r.id,
        etapa: r.etapa,
        mes: r.mes,
        centavos: centavosDe(Number(r.valor)),
        descricao: r.descricao,
        anexo: r.anexo,
        link: r.anexo ? (links.get(r.anexo) ?? null) : null,
        origem: r.origem === "planilha" ? "planilha" : "tela",
        exemplo: r.exemplo,
        lancadoPor: r.lancado_por
          ? (nomes.get(r.lancado_por) ?? "Usuário removido")
          : r.exemplo
            ? "Exemplo"
            : "—",
        lancadoEm: r.lancado_em,
      })),
      limites: limitesDe(p),
    };
  },
);

export interface ObraDoDiario {
  id: string;
  nome: string;
}

/**
 * Obras do Diário de Obra para o vínculo. Quem liga é quem importa o
 * orçamento, que pode não ter a permissão do Diário: só id e nome, pela
 * service role, depois de conferir operacoes.obras.importar no banco.
 */
export async function obrasDoDiario(): Promise<ObraDoDiario[]> {
  if (!(await podeAgora("operacoes.obras.importar"))) return [];
  const { data, error } = await opAdmin()
    .from("diario_obras")
    .select("id, nome")
    .order("nome");
  falhar(error);
  return data ?? [];
}

/**
 * Obra do orçamento ligada a uma obra do Diário de Obra, para o atalho da
 * ficha do Diário. Com a sessão (RLS de operacoes.obras.ver).
 */
export async function obraLigadaAoDiario(
  diarioObraId: string,
): Promise<{ id: string; nome: string } | null> {
  const { data, error } = await (await op())
    .from("obras")
    .select("id, nome")
    .eq("diario_obra_id", diarioObraId)
    .order("nome")
    .limit(1)
    .maybeSingle();
  falhar(error);
  return data;
}
