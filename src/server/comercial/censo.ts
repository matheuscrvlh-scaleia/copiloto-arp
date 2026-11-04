import "server-only";
import { cache } from "react";
import type { OpcoesQuestionario } from "@/lib/comercial/censo";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { lerTudo } from "@/server/supabase-paginas";
import {
  type CensoConvite,
  type CensoResposta,
  type CensoRodada,
  com,
  comAdmin,
  listas,
} from "./base";

// Leituras do Censo (4.8 e 4.9). Rodadas, respostas, temas e contatos de
// feedback são dado de negócio: lidos com a sessão, pelo RLS, sem cache no
// servidor. O link público (/censo/[token]) lê pela service role só depois
// de conferir o token, e só o convite daquele token.

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o banco: ${erro.message}`);
}

export type RodadaCenso = Pick<
  CensoRodada,
  | "id"
  | "nome"
  | "inicio"
  | "fim"
  | "situacao"
  | "exemplo"
  | "importacao_id"
  | "encerrada_em"
>;

/** Rodadas da mais recente para a mais antiga. */
export const rodadasCenso = cache(async (): Promise<RodadaCenso[]> => {
  const { data, error } = await (await com())
    .from("censo_rodadas")
    .select(
      "id, nome, inicio, fim, situacao, exemplo, importacao_id, encerrada_em",
    )
    .order("inicio", { ascending: false })
    .order("id");
  falhar(error);
  return data ?? [];
});

export const COLUNAS_INDICADOR =
  "id, rodada_id, bloco, segmento, colaboradores, visitantes_dia, ticket_ajustado, conversoes_dia, expectativas" as const;

export type RespostaDoIndicador = Pick<
  CensoResposta,
  | "id"
  | "rodada_id"
  | "bloco"
  | "segmento"
  | "colaboradores"
  | "visitantes_dia"
  | "ticket_ajustado"
  | "conversoes_dia"
  | "expectativas"
>;

/** Respostas que contam (sem as repetidas) das rodadas, para os indicadores. */
export const respostasDosIndicadores = cache(
  async (rodadas: string[]): Promise<RespostaDoIndicador[]> => {
    if (!rodadas.length) return [];
    const db = await com();
    const linhas = await lerTudo(() =>
      db
        .from("censo_respostas")
        .select(COLUNAS_INDICADOR)
        .in("rodada_id", rodadas)
        .eq("considerada", true)
        .order("id"),
    );
    return linhas.map((r) => ({
      ...r,
      ticket_ajustado:
        r.ticket_ajustado === null ? null : Number(r.ticket_ajustado),
    }));
  },
);

/** Todas as respostas de uma rodada (aba Rodadas e Feedbacks). */
export const respostasDaRodada = cache(
  async (rodada: string): Promise<CensoResposta[]> => {
    const db = await com();
    const linhas = await lerTudo(() =>
      db
        .from("censo_respostas")
        .select("*")
        .eq("rodada_id", rodada)
        .order("respondida_em", { ascending: false })
        .order("id"),
    );
    return linhas.map((r) => ({
      ...r,
      ticket: r.ticket === null ? null : Number(r.ticket),
      ticket_ajustado:
        r.ticket_ajustado === null ? null : Number(r.ticket_ajustado),
    }));
  },
);

export type ConviteDaRodada = Pick<
  CensoConvite,
  | "id"
  | "token"
  | "empresa_nome"
  | "luc"
  | "bloco"
  | "enviado_em"
  | "locatario_enet_id"
>;

/** Convites da rodada (só quem aplica o Censo: o RLS esconde o token dos outros). */
export const convitesDaRodada = cache(
  async (rodada: string): Promise<ConviteDaRodada[]> => {
    const db = await com();
    return lerTudo(() =>
      db
        .from("censo_convites")
        .select(
          "id, token, empresa_nome, luc, bloco, enviado_em, locatario_enet_id",
        )
        .eq("rodada_id", rodada)
        .order("empresa_nome")
        .order("id"),
    );
  },
);

/** Quantos convites e respostas cada rodada tem. */
export const contagemDasRodadas = cache(
  async (
    ids: string[],
    comConvites: boolean,
  ): Promise<Map<string, { convites: number; respostas: number }>> => {
    const db = await com();
    const contar = async (
      tabela: "censo_convites" | "censo_respostas",
      id: string,
    ) => {
      const { count, error } = await (tabela === "censo_respostas"
        ? db
            .from(tabela)
            .select("id", { count: "exact", head: true })
            .eq("rodada_id", id)
            .eq("considerada", true)
        : db
            .from(tabela)
            .select("id", { count: "exact", head: true })
            .eq("rodada_id", id));
      falhar(error);
      return count ?? 0;
    };
    const pares = await Promise.all(
      ids.map(async (id) => {
        const [convites, respostas] = await Promise.all([
          comConvites ? contar("censo_convites", id) : Promise.resolve(0),
          contar("censo_respostas", id),
        ]);
        return [id, { convites, respostas }] as const;
      }),
    );
    return new Map(pares);
  },
);

export interface TemaDoCenso {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
}

export const temasCenso = cache(async (): Promise<TemaDoCenso[]> => {
  const { data, error } = await (await com())
    .from("censo_temas")
    .select("id, nome, ordem, ativo")
    .order("ordem")
    .order("nome");
  falhar(error);
  return data ?? [];
});

export interface VinculoTema {
  id: string;
  tema_id: string;
  resposta_id: string | null;
  contato_id: string | null;
  trecho: string | null;
  origem: string;
  movido_por: string | null;
  movido_em: string | null;
}

/** Sugestões já ligadas a um tema (das respostas e dos contatos lidos). */
export const vinculosDosTemas = cache(
  async (respostas: string[], contatos: string[]): Promise<VinculoTema[]> => {
    const db = await com();
    const colunas =
      "id, tema_id, resposta_id, contato_id, trecho, origem, movido_por, movido_em";
    const pedacos = <T>(ids: T[]) =>
      Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) =>
        ids.slice(i * 200, i * 200 + 200),
      );
    const lidos = await Promise.all([
      ...pedacos(respostas).map((ids) =>
        db.from("censo_sugestao_temas").select(colunas).in("resposta_id", ids),
      ),
      ...pedacos(contatos).map((ids) =>
        db.from("censo_sugestao_temas").select(colunas).in("contato_id", ids),
      ),
    ]);
    return lidos.flatMap(({ data, error }) => {
      falhar(error);
      return data ?? [];
    });
  },
);

export interface ContatoDeFeedback {
  id: string;
  data: string;
  locatario_enet_id: string | null;
  locatario_nome: string;
  bloco: string | null;
  tipo: string;
  descricao: string;
}

/** Tipos de contato que entram em Feedbacks (listas.extra.feedback). */
export async function tiposDeFeedback(): Promise<string[]> {
  return (await listas())
    .filter(
      (l) =>
        l.lista === "tipo_contato" &&
        l.ativo &&
        (l.extra as { feedback?: boolean } | null)?.feedback === true,
    )
    .map((l) => l.valor);
}

/** Registros de contato de feedback no período (de exclusivo, até inclusivo). */
export const contatosDeFeedback = cache(
  async (de: string | null, ate: string): Promise<ContatoDeFeedback[]> => {
    const tipos = await tiposDeFeedback();
    if (!tipos.length) return [];
    const db = await com();
    return lerTudo(() => {
      let q = db
        .from("contatos")
        .select(
          "id, data, locatario_enet_id, locatario_nome, bloco, tipo, descricao",
        )
        .in("tipo", tipos)
        .lte("data", ate);
      if (de) q = q.gt("data", de);
      return q.order("data", { ascending: false }).order("id");
    });
  },
);

// ---------------------------------------------------------------------------
// Link público do questionário
// ---------------------------------------------------------------------------

const FORMATO_TOKEN = /^[A-Za-z0-9]{32,64}$/;

export interface ConviteDoLink {
  convite: Pick<
    CensoConvite,
    | "id"
    | "rodada_id"
    | "token"
    | "empresa_nome"
    | "luc"
    | "bloco"
    | "locatario_enet_id"
  >;
  rodada: Pick<CensoRodada, "id" | "nome" | "inicio" | "fim" | "situacao">;
  resposta: CensoResposta | null;
  opcoes: OpcoesQuestionario;
  diasPadrao: number;
  hoje: string;
}

/** Opções das listas do Censo e o dia padrão de mensalidade (service role). */
async function opcoesDoQuestionario(): Promise<{
  opcoes: OpcoesQuestionario;
  diasPadrao: number;
}> {
  const db = comAdmin();
  const [l, p] = await Promise.all([
    db
      .from("listas")
      .select("lista, valor")
      .in("lista", ["censo_bloco", "censo_segmento", "censo_expectativa"])
      .eq("ativo", true)
      .order("ordem")
      .order("valor"),
    db
      .from("parametros")
      .select("censo_dias_mensalidade")
      .eq("id", true)
      .single(),
  ]);
  falhar(l.error);
  falhar(p.error);
  const de = (lista: string) =>
    (l.data ?? []).filter((x) => x.lista === lista).map((x) => x.valor);
  return {
    opcoes: {
      blocos: de("censo_bloco"),
      segmentos: de("censo_segmento"),
      expectativas: de("censo_expectativa"),
    },
    diasPadrao: p.data.censo_dias_mensalidade,
  };
}

async function montarConvite(
  filtro: { token: string } | { id: string },
): Promise<ConviteDoLink | null> {
  const db = comAdmin();
  let q = db
    .from("censo_convites")
    .select(
      "id, rodada_id, token, empresa_nome, luc, bloco, locatario_enet_id, censo_rodadas!inner(id, nome, inicio, fim, situacao)",
    );
  q = "token" in filtro ? q.eq("token", filtro.token) : q.eq("id", filtro.id);
  const { data, error } = await q.maybeSingle();
  falhar(error);
  if (!data) return null;
  const { censo_rodadas: rodada, ...convite } = data;
  const [resposta, extra] = await Promise.all([
    db
      .from("censo_respostas")
      .select("*")
      .eq("convite_id", convite.id)
      .maybeSingle(),
    opcoesDoQuestionario(),
  ]);
  falhar(resposta.error);
  return {
    convite,
    rodada,
    resposta: resposta.data
      ? {
          ...resposta.data,
          ticket:
            resposta.data.ticket === null ? null : Number(resposta.data.ticket),
        }
      : null,
    ...extra,
    hoje: hojeEmBrasilia(new Date()),
  };
}

/** O convite do link, pela service role depois de conferir o formato do token. */
export async function conviteDoLink(
  token: string,
): Promise<ConviteDoLink | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  return montarConvite({ token });
}

/**
 * Convite para lançar em nome da empresa (presencial). Quem chama já
 * conferiu comercial.censo.aplicar: a leitura do convite pela sessão
 * confirma pelo RLS antes de usar a service role.
 */
export async function conviteParaLancar(
  id: string,
): Promise<ConviteDoLink | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await (await com())
    .from("censo_convites")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  return montarConvite({ id });
}

/** Valores do formulário: a resposta já dada ou o que vem do convite (ENET). */
export function valoresIniciais(c: ConviteDoLink) {
  const r = c.resposta;
  const texto = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  return {
    email: r?.email ?? "",
    bloco: r?.bloco ?? c.convite.bloco ?? "",
    segmento: r?.segmento ?? "",
    empresa_nome: r?.empresa_nome ?? c.convite.empresa_nome,
    colaboradores: texto(r?.colaboradores),
    visitantes_dia: texto(r?.visitantes_dia),
    ticket:
      r?.ticket === null || r?.ticket === undefined
        ? ""
        : String(r.ticket).replace(".", ","),
    mensalidade: r?.mensalidade === true,
    dias_uso: texto(r?.dias_uso),
    conversoes_dia: texto(r?.conversoes_dia),
    expectativas: r?.expectativas ?? [],
    sugestao: r?.sugestao ?? "",
  };
}
