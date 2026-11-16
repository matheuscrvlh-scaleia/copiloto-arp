import "server-only";
import { cache } from "react";
import { numeroDo } from "@/lib/os/numeros";
import { rotaDo } from "@/lib/os/rotas";
import { STATUS, type StatusChamado } from "@/lib/os/rotulos";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import {
  type ChamadoDoContrato,
  type ConfigControle,
  type ContratoControle,
  type EntrevistaResumo,
  type LinhaControle,
  linhasDoControle,
} from "@/lib/sustentabilidade/entrevistas-controle";
import {
  type DefinicaoFormulario,
  definicaoSchema,
  type Respostas,
} from "@/lib/sustentabilidade/formulario/tipos";
import { linkDeLeitura, linksDeLeitura } from "@/server/arquivos";
import { osAdmin } from "@/server/os/base";
import { type Busca, filtrosLembrados } from "@/server/preferencias/filtros";
import { lerTudo } from "@/server/supabase-paginas";
import {
  type ContextoSu,
  contextoSu,
  falhar,
  type Parametros,
  parametros,
  parametrosDaEntrevista,
  su,
} from "./base";
import { COLUNAS_CONTRATO } from "./rotinas";

// Leituras das telas de entrevistas (spec 4.4): controle, ficha, aplicar e
// respostas. Tudo com a sessão (RLS); a service role só lê o que a pessoa já
// alcançou pelo RLS (o chamado e o nome de quem está nos contratos e
// entrevistas que ela vê). Arquivos: bucket "sustentabilidade".

export const BUCKET = "sustentabilidade" as const;
const LINK_SEGUNDOS = 3600;

export type { Busca };

export interface FiltrosSu {
  ctx: ContextoSu;
  busca: Busca;
  lembrado: string | null;
  um: (chave: string) => string;
}

/** Filtros da URL ou os últimos da pessoa. Lê a sessão: use em <Suspense>. */
export async function lerFiltros(
  tela: string,
  buscaUrl: Busca,
): Promise<FiltrosSu> {
  const [ctx, { busca, lembrado }] = await Promise.all([
    contextoSu(),
    filtrosLembrados("sustentabilidade", tela, buscaUrl),
  ]);
  const um = (chave: string) => {
    const v = busca[chave];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  return { ctx, busca, lembrado, um };
}

/** Nome de cada pessoa pelo id (só ids que vieram de linhas que a pessoa vê). */
async function nomesDe(ids: (string | null)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unicos.length) return new Map();
  const { data, error } = await createAdminClient()
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .in("id", unicos);
  falhar(error);
  return new Map(data.map((u) => [u.id, u.nome]));
}

/** Número, situação e responsável dos chamados (ids dos contratos que a pessoa vê). */
async function chamadosDe(
  ids: (string | null)[],
): Promise<Map<string, ChamadoDoContrato>> {
  const unicos = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unicos.length) return new Map();
  const { data, error } = await osAdmin()
    .from("chamados")
    .select("id, numero, tipo, status, responsavel_id")
    .in("id", unicos);
  if (error) throw new Error(`Chamados: ${error.message}`);
  const nomes = await nomesDe(data.map((c) => c.responsavel_id));
  return new Map(
    data.map((c) => [
      c.id,
      {
        id: c.id,
        numero: numeroDo(c),
        status: c.status,
        situacao: STATUS[c.status as StatusChamado] ?? c.status,
        responsavel: c.responsavel_id
          ? (nomes.get(c.responsavel_id) ?? null)
          : null,
        href: rotaDo(c),
      },
    ]),
  );
}

/** Entrevistas salvas sem as respostas (sustentabilidade.entrevistas_resumo). */
export const resumoDasEntrevistas = cache(
  async (): Promise<EntrevistaResumo[]> => {
    const db = await su();
    const linhas = await lerTudo(() =>
      db.rpc("entrevistas_resumo").order("id"),
    );
    // atalho: o tipo gerado do retorno da função está errado (string[]).
    return linhas as unknown as EntrevistaResumo[];
  },
);

const contratosVisiveis = cache(async (): Promise<ContratoControle[]> => {
  const db = await su();
  return lerTudo(() =>
    db.from("contratos").select(COLUNAS_CONTRATO).order("id"),
  );
});

export interface DadosDoControle {
  contratos: ContratoControle[];
  entrevistas: EntrevistaResumo[];
  linhas: LinhaControle[];
  config: ConfigControle;
  parametros: Parametros;
  /** Há contrato de exemplo na lista (nota de dado fictício). */
  exemplo: boolean;
}

/** Tudo da tela de controle (todos os contratos, com a situação). */
export const dadosDoControle = cache(async (): Promise<DadosDoControle> => {
  const [ctx, contratos, entrevistas, p, pe] = await Promise.all([
    contextoSu(),
    contratosVisiveis(),
    resumoDasEntrevistas(),
    parametros(),
    parametrosDaEntrevista(),
  ]);
  const [chamados, nomes] = await Promise.all([
    chamadosDe(contratos.map((c) => c.chamado_id)),
    nomesDe(entrevistas.map((e) => e.entrevistador_id)),
  ]);
  const config: ConfigControle = {
    hoje: ctx.hoje,
    parametros: pe,
    tiposLojaDispensados: p.tipos_loja_dispensados,
    dataInauguracao: p.data_inauguracao,
  };
  const linhas = linhasDoControle({
    contratos,
    entrevistas,
    chamados,
    nomes,
    config,
  });
  return {
    contratos,
    entrevistas,
    linhas,
    config,
    parametros: p,
    exemplo: contratos.some((c) => c.exemplo),
  };
});

// ---------------------------------------------------------------------------
// Ficha da entrevista
// ---------------------------------------------------------------------------

export interface Anexo {
  nome: string;
  caminho: string;
}

export interface EntrevistaDaFicha {
  id: string;
  data: string;
  tipo: string;
  setor: string | null;
  versao: number;
  origem: string;
  entrevistador: string | null;
  validaAte: string | null;
  exemplo: boolean;
  /** Linha completa visível pelo RLS (respostas, PDF e anexos). */
  completa: boolean;
  respondente: string | null;
  pdf: string | null;
  anexos: (Anexo & { url: string | null })[];
  /** Veio de outro contrato (transferida). */
  transferidaDe: string | null;
}

export interface Transferencia {
  quando: string;
  quem: string | null;
  motivo: string;
  de: string;
  para: string;
  entrevistaId: string;
}

export interface FichaDoContrato {
  contrato: ContratoControle & {
    ativacao_corrigida_motivo: string | null;
    ativacao_corrigida_em: string | null;
    dispensada_por: string | null;
  };
  linha: LinhaControle;
  entrevistas: EntrevistaDaFicha[];
  transferencias: Transferencia[];
  /** Outros contratos do mesmo cliente (destino da transferência). */
  mesmoCliente: { id: string; rotulo: string }[];
  dispensadaPor: string | null;
  parametros: Parametros;
}

export function anexosDe(json: Json): Anexo[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((a) =>
    a &&
    typeof a === "object" &&
    !Array.isArray(a) &&
    typeof a.caminho === "string"
      ? [{ nome: String(a.nome ?? "anexo"), caminho: a.caminho }]
      : [],
  );
}

const rotuloDoContrato = (c: {
  contrato: string | null;
  lucs: string[];
  cliente_nome: string;
}) =>
  [c.contrato ?? "Sem número", c.lucs.join("/"), c.cliente_nome]
    .filter(Boolean)
    .join(" · ");

export async function fichaDoContrato(
  id: string,
): Promise<FichaDoContrato | null> {
  const db = await su();
  const { data: contrato, error } = await db
    .from("contratos")
    .select(
      `${COLUNAS_CONTRATO}, ativacao_corrigida_motivo, ativacao_corrigida_em, dispensada_por`,
    )
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!contrato) return null;

  const [ctx, resumo, completas, transf, outros, p, pe] = await Promise.all([
    contextoSu(),
    resumoDasEntrevistas(),
    db
      .from("entrevistas")
      .select("id, pdf, anexos, respondente_nome")
      .eq("contrato_id", id)
      .eq("situacao", "salva"),
    db
      .from("entrevista_transferencias")
      .select(
        "entrevista_id, de_contrato_id, para_contrato_id, motivo, quem, quando",
      )
      .or(`de_contrato_id.eq.${id},para_contrato_id.eq.${id}`)
      .order("quando", { ascending: false }),
    contrato.cliente_doc
      ? db
          .from("contratos")
          .select("id, contrato, lucs, cliente_nome")
          .eq("cliente_doc", contrato.cliente_doc)
          .neq("id", id)
          .order("contrato")
      : Promise.resolve({ data: [], error: null }),
    parametros(),
    parametrosDaEntrevista(),
  ]);
  falhar(completas.error);
  falhar(transf.error);
  falhar(outros.error);

  const doContrato = resumo.filter((e) => e.contrato_id === id);
  const outrosIds = [
    ...new Set(
      transf.data.flatMap((t) => [t.de_contrato_id, t.para_contrato_id]),
    ),
  ].filter((x) => x !== id);
  const [chamados, nomes, nomesContratos] = await Promise.all([
    chamadosDe([contrato.chamado_id]),
    nomesDe([
      ...doContrato.map((e) => e.entrevistador_id),
      ...transf.data.map((t) => t.quem),
      contrato.dispensada_por,
    ]),
    outrosIds.length
      ? db
          .from("contratos")
          .select("id, contrato, lucs, cliente_nome")
          .in("id", outrosIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  falhar(nomesContratos.error);
  const rotulos = new Map<string, string>([
    [id, rotuloDoContrato(contrato)],
    ...(nomesContratos.data ?? []).map(
      (c) => [c.id, rotuloDoContrato(c)] as [string, string],
    ),
  ]);

  const porId = new Map(completas.data.map((e) => [e.id, e]));
  const caminhos = completas.data.flatMap((e) => [
    ...(e.pdf ? [e.pdf] : []),
    ...anexosDe(e.anexos).map((a) => a.caminho),
  ]);
  const links = await linksDeLeitura(BUCKET, caminhos, LINK_SEGUNDOS);

  const [linha] = linhasDoControle({
    contratos: [contrato],
    entrevistas: doContrato,
    chamados,
    nomes,
    config: {
      hoje: ctx.hoje,
      parametros: pe,
      tiposLojaDispensados: p.tipos_loja_dispensados,
      dataInauguracao: p.data_inauguracao,
    },
  });

  const entrevistas = [...doContrato]
    .sort((a, b) => (a.data < b.data ? 1 : -1))
    .map((e): EntrevistaDaFicha => {
      const c = porId.get(e.id);
      const veio = transf.data.find(
        (t) => t.entrevista_id === e.id && t.para_contrato_id === id,
      );
      return {
        id: e.id,
        data: e.data,
        tipo: e.tipo,
        setor: e.setor,
        versao: e.formulario_versao,
        origem: e.origem,
        entrevistador: e.entrevistador_id
          ? (nomes.get(e.entrevistador_id) ?? null)
          : null,
        validaAte: e.valida_ate,
        exemplo: e.exemplo,
        completa: !!c,
        respondente: c?.respondente_nome ?? null,
        pdf: c?.pdf ? (links.get(c.pdf) ?? null) : null,
        anexos: c
          ? anexosDe(c.anexos).map((a) => ({
              ...a,
              url: links.get(a.caminho) ?? null,
            }))
          : [],
        transferidaDe: veio
          ? (rotulos.get(veio.de_contrato_id) ?? "outro contrato")
          : null,
      };
    });

  return {
    contrato,
    linha: linha as LinhaControle,
    entrevistas,
    transferencias: transf.data.map((t) => ({
      quando: t.quando,
      quem: t.quem ? (nomes.get(t.quem) ?? null) : null,
      motivo: t.motivo,
      de: rotulos.get(t.de_contrato_id) ?? "outro contrato",
      para: rotulos.get(t.para_contrato_id) ?? "outro contrato",
      entrevistaId: t.entrevista_id,
    })),
    mesmoCliente: (outros.data ?? []).map((c) => ({
      id: c.id,
      rotulo: rotuloDoContrato(c),
    })),
    dispensadaPor: contrato.dispensada_por
      ? (nomes.get(contrato.dispensada_por) ?? null)
      : null,
    parametros: p,
  };
}

// ---------------------------------------------------------------------------
// Respostas de uma entrevista (ficha) e versões do questionário
// ---------------------------------------------------------------------------

export interface Questionario {
  id: string;
  publicada: number;
}

export const questionario = cache(async (): Promise<Questionario | null> => {
  const db = await su();
  const { data, error } = await db
    .from("formularios")
    .select("id, versao_publicada")
    .eq("tipo", "questionario")
    .maybeSingle();
  falhar(error);
  return data ? { id: data.id, publicada: data.versao_publicada } : null;
});

/** Definição de cada versão publicada do questionário. */
export const versoesDoQuestionario = cache(
  async (): Promise<Map<number, DefinicaoFormulario>> => {
    const q = await questionario();
    if (!q) return new Map();
    const db = await su();
    const { data, error } = await db
      .from("formulario_versoes")
      .select("versao, definicao")
      .eq("formulario_id", q.id);
    falhar(error);
    const mapa = new Map<number, DefinicaoFormulario>();
    for (const v of data) {
      const def = definicaoSchema.safeParse(v.definicao);
      if (def.success) mapa.set(v.versao, def.data);
      else console.error("versão do questionário inválida", v.versao);
    }
    return mapa;
  },
);

export interface EntrevistaCompleta {
  id: string;
  contrato_id: string;
  data: string;
  tipo: string;
  setor: string | null;
  formulario_versao: number;
  respostas: Respostas;
  respondente_nome: string | null;
  entrevistador_id: string | null;
  origem: string;
  pdf: string | null;
  exemplo: boolean;
}

const COLUNAS_COMPLETA =
  "id, contrato_id, data, tipo, setor, formulario_versao, respostas, respondente_nome, entrevistador_id, origem, pdf, exemplo" as const;

const comoRespostas = (j: Json): Respostas =>
  j && typeof j === "object" && !Array.isArray(j) ? (j as Respostas) : {};

/** Uma entrevista salva com as respostas (RLS: ver respostas, corrigir ou quem aplicou). */
export async function entrevistaCompleta(
  id: string,
): Promise<EntrevistaCompleta | null> {
  const db = await su();
  const { data, error } = await db
    .from("entrevistas")
    .select(COLUNAS_COMPLETA)
    .eq("id", id)
    .eq("situacao", "salva")
    .maybeSingle();
  falhar(error);
  return data ? { ...data, respostas: comoRespostas(data.respostas) } : null;
}

// ---------------------------------------------------------------------------
// Aplicar
// ---------------------------------------------------------------------------

export interface RascunhoDoServidor {
  chave: string;
  versao: number;
  respostas: Respostas;
  alteradoEm: number;
  respondente: string | null;
  assinaturaRespondente: string | null;
  assinaturaEntrevistador: string | null;
  urlRespondente: string | null;
  urlEntrevistador: string | null;
}

export interface DadosDeAplicar {
  contrato: ContratoControle;
  tipo: "primeira" | "atualizacao";
  versao: number;
  definicao: DefinicaoFormulario;
  rascunho: RascunhoDoServidor | null;
  unidades: string[];
}

export type ProblemaDeAplicar = "contrato" | "questionario" | "versao";

export async function dadosDeAplicar(
  contratoId: string,
): Promise<DadosDeAplicar | { problema: ProblemaDeAplicar }> {
  const db = await su();
  const [ctx, c, q, resumo, p] = await Promise.all([
    contextoSu(),
    db
      .from("contratos")
      .select(COLUNAS_CONTRATO)
      .eq("id", contratoId)
      .maybeSingle(),
    questionario(),
    resumoDasEntrevistas(),
    parametros(),
  ]);
  falhar(c.error);
  if (!c.data) return { problema: "contrato" };
  if (!q || q.publicada < 1) return { problema: "questionario" };

  const { data: r, error } = await db
    .from("entrevistas")
    .select(
      "rascunho_chave, formulario_versao, respostas, atualizado_em, respondente_nome, assinatura_respondente, assinatura_entrevistador",
    )
    .eq("contrato_id", contratoId)
    .eq("situacao", "rascunho")
    .eq("entrevistador_id", ctx.usuario.id)
    .not("rascunho_chave", "is", null)
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  falhar(error);

  const versao = r?.formulario_versao ?? q.publicada;
  const versoes = await versoesDoQuestionario();
  const definicao = versoes.get(versao);
  if (!definicao) return { problema: "versao" };

  const [urlR, urlE] = await Promise.all([
    r?.assinatura_respondente
      ? linkDeLeitura(BUCKET, r.assinatura_respondente, {
          segundos: LINK_SEGUNDOS,
        })
      : null,
    r?.assinatura_entrevistador
      ? linkDeLeitura(BUCKET, r.assinatura_entrevistador, {
          segundos: LINK_SEGUNDOS,
        })
      : null,
  ]);
  const anterior = resumo.some(
    (e) => e.contrato_id === contratoId && e.data <= ctx.hoje,
  );
  return {
    contrato: c.data,
    tipo: anterior ? "atualizacao" : "primeira",
    versao,
    definicao,
    unidades: p.unidades,
    rascunho: r?.rascunho_chave
      ? {
          chave: r.rascunho_chave,
          versao: r.formulario_versao,
          respostas: comoRespostas(r.respostas),
          alteradoEm: new Date(r.atualizado_em).getTime(),
          respondente: r.respondente_nome,
          assinaturaRespondente: r.assinatura_respondente,
          assinaturaEntrevistador: r.assinatura_entrevistador,
          urlRespondente: urlR,
          urlEntrevistador: urlE,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Respostas (Tela 3)
// ---------------------------------------------------------------------------

export interface EntrevistaDaLista extends EntrevistaCompleta {
  bloco: string | null;
  cliente: string;
  lucs: string[];
  entrevistador: string | null;
}

/** Entrevistas salvas no período, com respostas (RLS: ver respostas). */
export async function respostasDoPeriodo(
  de: string,
  ate: string,
): Promise<EntrevistaDaLista[]> {
  const db = await su();
  const [linhas, contratos] = await Promise.all([
    lerTudo(() =>
      db
        .from("entrevistas")
        .select(COLUNAS_COMPLETA)
        .eq("situacao", "salva")
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: false })
        .order("id"),
    ),
    contratosVisiveis(),
  ]);
  const porId = new Map(contratos.map((c) => [c.id, c]));
  const nomes = await nomesDe(linhas.map((e) => e.entrevistador_id));
  return linhas.map((e) => {
    const c = porId.get(e.contrato_id);
    return {
      ...e,
      respostas: comoRespostas(e.respostas),
      bloco: c?.bloco ?? null,
      cliente: c?.cliente_nome ?? "Contrato sem acesso",
      lucs: c?.lucs ?? [],
      entrevistador: e.entrevistador_id
        ? (nomes.get(e.entrevistador_id) ?? null)
        : null,
    };
  });
}

/** Links dos PDFs assinados (só das entrevistas que a pessoa já leu). */
export async function linksDosPdfs(
  caminhos: string[],
): Promise<Map<string, string>> {
  return linksDeLeitura(BUCKET, caminhos, LINK_SEGUNDOS);
}
