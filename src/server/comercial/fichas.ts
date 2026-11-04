import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { after } from "next/server";
import { cache } from "react";
import {
  type DocumentoExigido,
  dadosDaFichaParaContrato,
  lerRespostas,
  type PartesDaFicha,
  type RespostasFicha,
  type SituacaoFicha,
  TIPOS_FICHA,
  type TipoFicha,
} from "@/lib/comercial/ficha";
import type { EnetLuc } from "@/lib/comercial/fontes";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { urlDoSistema } from "@/server/os/base";
import { com, comAdmin, contextoCom, listas, parametros } from "./base";
import { dadosEnet, dadosEnetSemSessao } from "./fontes";
import { nomesDeUsuarios } from "./usuarios";

// Leituras das fichas cadastrais (4.12). A tela interna lê com a sessão
// (RLS: a lista para quem vê fichas, gera link ou monta contrato; dados,
// documentos e acessos só com comercial.formulario.ver). A ficha pública
// lê pela service role SÓ depois de conferir o token, e só a ficha dele.

export const BUCKET_COMERCIAL = "comercial";
export const ROTA_FICHAS = "/comercial/fichas";
export const rotaDaFicha = (id: string) => `${ROTA_FICHAS}/${id}`;
export const linkDaFicha = (token: string) => urlDoSistema(`/ficha/${token}`);

/** Token do link: 32 a 128 caracteres de base64url ou hex. */
export const tokenDeFichaValido = (t: string) =>
  /^[A-Za-z0-9_-]{32,128}$/.test(t);

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler as fichas: ${erro.message}`);
}

const ehTipo = (t: string | null): t is TipoFicha =>
  (TIPOS_FICHA as readonly string[]).includes(t ?? "");

// ---------------------------------------------------------------------------
// LUCs vagos do ENET (pergunta 3 e "Gerar link")
// ---------------------------------------------------------------------------

export interface OpcaoLuc {
  valor: string;
  rotulo: string;
}

function opcoesDeLuc(lucs: EnetLuc[]): OpcaoLuc[] {
  return lucs
    .filter((l) => l.status === "Vago" && l.abl > 0)
    .sort((a, b) => a.numero.localeCompare(b.numero))
    .map((l) => ({
      valor: l.numero,
      rotulo: `${l.numero} — ${l.local}, ${l.piso}`,
    }));
}

/** LUCs vagos para quem está logado (fachada do ENET). */
export async function lucsVagos(): Promise<{
  opcoes: OpcaoLuc[];
  exemplo: boolean;
}> {
  const enet = await dadosEnet();
  return { opcoes: opcoesDeLuc(enet.lucs), exemplo: enet.exemplo };
}

/** LUCs vagos para a ficha pública (sem sessão; o token já foi conferido). */
const lucsVagosPublicos = async () =>
  opcoesDeLuc((await dadosEnetSemSessao()).lucs);

// ---------------------------------------------------------------------------
// Configuração da ficha (parâmetros e listas ficha_documento_*)
// ---------------------------------------------------------------------------

export interface TextosDaFicha {
  boasVindas: string;
  termoLgpd: string;
  validadeDias: number;
}

export type DocumentosPorTipo = Record<TipoFicha, DocumentoExigido[]>;

const LISTA_DO_TIPO: Record<TipoFicha, string> = {
  pj: "ficha_documento_pj",
  pf: "ficha_documento_pf",
  fiador: "ficha_documento_fiador",
};

function documentosDasListas(
  l: { lista: string; valor: string; ativo: boolean; extra: unknown }[],
): DocumentosPorTipo {
  const de = (t: TipoFicha) =>
    l
      .filter((x) => x.lista === LISTA_DO_TIPO[t] && x.ativo)
      .map((x) => ({
        documento: x.valor,
        obrigatorio:
          typeof x.extra === "object" &&
          x.extra !== null &&
          (x.extra as Record<string, unknown>).obrigatorio === true,
      }));
  return { pj: de("pj"), pf: de("pf"), fiador: de("fiador") };
}

/** Documentos exigidos por tipo, para a tela interna (com sessão). */
export async function documentosExigidos(): Promise<DocumentosPorTipo> {
  return documentosDasListas(await listas());
}

async function textosPublicos(): Promise<TextosDaFicha> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.parametros);
  const { data, error } = await comAdmin()
    .from("parametros")
    .select("ficha_boas_vindas, ficha_termo_lgpd, ficha_validade_dias")
    .eq("id", true)
    .single();
  falhar(error);
  return {
    boasVindas: data.ficha_boas_vindas,
    termoLgpd: data.ficha_termo_lgpd,
    validadeDias: data.ficha_validade_dias,
  };
}

async function documentosPublicos(): Promise<DocumentosPorTipo> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.comercial.listas);
  const { data, error } = await comAdmin()
    .from("listas")
    .select("lista, valor, ativo, extra")
    .in("lista", Object.values(LISTA_DO_TIPO))
    .order("ordem")
    .order("valor");
  falhar(error);
  return documentosDasListas(data ?? []);
}

/** Validade do link (parâmetro), para quem gera o link. */
export async function validadeDoLink(): Promise<number> {
  return (await parametros()).ficha_validade_dias;
}

// ---------------------------------------------------------------------------
// Ficha pública (/ficha/[token])
// ---------------------------------------------------------------------------

export type MotivoInativo =
  | "inexistente"
  | "expirada"
  | "cancelada"
  | "enviada";

export interface FichaDoLink {
  id: string;
  token: string;
  tipo: TipoFicha | null;
  luc: string | null;
  situacao: SituacaoFicha;
  respostas: RespostasFicha | null;
  documentos: { id: string; documento: string; arquivo_nome: string }[];
  iniciada: boolean;
  consentimentoEm: string | null;
  geradaPor: string | null;
  nome: string | null;
  ultimoAcesso: string | null;
}

export type AcessoDaFicha =
  | { ok: true; ficha: FichaDoLink }
  | { ok: false; motivo: MotivoInativo };

/**
 * Confere o token: existe, não venceu, não foi cancelado e ainda está em
 * preenchimento. Uma vez por requisição.
 */
export const fichaPeloToken = cache(
  async (token: string): Promise<AcessoDaFicha> => {
    if (!tokenDeFichaValido(token)) return { ok: false, motivo: "inexistente" };
    const { data, error } = await comAdmin()
      .from("fichas")
      .select(
        "id, token, tipo, luc, nome, situacao, expira_em, cancelada_em, iniciada_em, consentimento_em, gerada_por, ultimo_acesso_em, dados:ficha_dados(respostas), documentos:ficha_documentos(id, documento, arquivo_nome)",
      )
      .eq("token", token)
      .maybeSingle();
    falhar(error);
    if (!data) return { ok: false, motivo: "inexistente" };
    if (data.situacao !== "em_preenchimento")
      return { ok: false, motivo: "enviada" };
    if (data.cancelada_em) return { ok: false, motivo: "cancelada" };
    if (data.expira_em && new Date(data.expira_em) <= new Date())
      return { ok: false, motivo: "expirada" };
    return {
      ok: true,
      ficha: {
        id: data.id,
        token: data.token,
        tipo: ehTipo(data.tipo) ? data.tipo : null,
        luc: data.luc,
        situacao: "em_preenchimento",
        respostas: data.dados ? lerRespostas(data.dados.respostas) : null,
        documentos: data.documentos ?? [],
        iniciada: !!data.iniciada_em,
        consentimentoEm: data.consentimento_em,
        geradaPor: data.gerada_por,
        nome: data.nome,
        ultimoAcesso: data.ultimo_acesso_em,
      },
    };
  },
);

export interface PaginaDaFicha {
  ficha: FichaDoLink;
  textos: TextosDaFicha;
  documentos: DocumentosPorTipo;
  lucs: OpcaoLuc[];
}

/** Tudo o que a ficha pública mostra, depois de conferir o token. */
export async function paginaDaFicha(
  token: string,
): Promise<PaginaDaFicha | { motivo: MotivoInativo }> {
  const acesso = await fichaPeloToken(token);
  if (!acesso.ok) return { motivo: acesso.motivo };
  const [textos, documentos] = await Promise.all([
    textosPublicos(),
    documentosPublicos(),
  ]);
  const lucs = await lucsVagosPublicos();
  const luc = acesso.ficha.luc;
  if (luc && !lucs.some((l) => l.valor === luc))
    lucs.unshift({ valor: luc, rotulo: luc });
  const id = acesso.ficha.id;
  const ultimo = acesso.ficha.ultimoAcesso;
  // Último acesso do interessado (no máximo um registro a cada 5 minutos).
  if (!ultimo || Date.now() - new Date(ultimo).getTime() > 5 * 60_000)
    after(async () => {
      const { error } = await comAdmin()
        .from("fichas")
        .update({ ultimo_acesso_em: new Date().toISOString() })
        .eq("id", id);
      if (error) console.error("último acesso da ficha", error);
    });
  return { ficha: acesso.ficha, textos, documentos, lucs };
}

// ---------------------------------------------------------------------------
// Lista (/comercial/fichas)
// ---------------------------------------------------------------------------

const COLUNAS_LISTA =
  "id, tipo, situacao, luc, nome, origem, gerada_em, recebida_em, expira_em, cancelada_em, iniciada_em, exemplo, ficha_principal_id";

export interface FichaDaLista {
  id: string;
  tipo: TipoFicha | null;
  situacao: SituacaoFicha;
  luc: string | null;
  nome: string | null;
  origem: string;
  gerada_em: string;
  recebida_em: string | null;
  expira_em: string | null;
  cancelada_em: string | null;
  iniciada_em: string | null;
  exemplo: boolean;
  ficha_principal_id: string | null;
}

/** Fichas geradas desde `desde` ("aaaa-mm-dd" ou null = todas), pelo RLS. */
export const listaDeFichas = cache(
  async (
    desde: string | null,
    tipo: TipoFicha | null,
  ): Promise<FichaDaLista[]> => {
    const sb = await com();
    const linhas: FichaDaLista[] = [];
    // atalho: lê de 1000 em 1000 (o volume é de poucas fichas por semana).
    for (let de = 0; ; de += 1000) {
      let q = sb.from("fichas").select(COLUNAS_LISTA);
      if (desde) q = q.gte("gerada_em", `${desde}T00:00:00-03:00`);
      if (tipo) q = q.eq("tipo", tipo);
      const { data, error } = await q
        .order("gerada_em", { ascending: false })
        .order("id")
        .range(de, de + 999);
      falhar(error);
      for (const f of data ?? [])
        linhas.push({
          ...f,
          tipo: ehTipo(f.tipo) ? f.tipo : null,
          situacao: f.situacao as SituacaoFicha,
        });
      if ((data ?? []).length < 1000) return linhas;
    }
  },
);

// ---------------------------------------------------------------------------
// Detalhe (/comercial/fichas/[id])
// ---------------------------------------------------------------------------

export interface DetalheDaFicha {
  ficha: FichaDaLista & {
    /** Só com comercial.formulario.link e ficha em preenchimento. */
    token: string | null;
    rd_oportunidade: string | null;
    consentimento_em: string | null;
    usada_em: string | null;
    ultimo_acesso_em: string | null;
  };
  /** Só com comercial.formulario.ver (o RLS não devolve sem ela). */
  dados: {
    documento: string | null;
    respostas: RespostasFicha;
    assinatura: string | null;
  } | null;
  documentos: {
    id: string;
    documento: string;
    arquivo_nome: string;
    tamanho: number | null;
    enviado_em: string;
  }[];
  acessos: { em: string; acao: string; nome: string }[];
  /** Outras fichas com o mesmo CPF/CNPJ (aviso à equipe). */
  mesmoDocumento: {
    id: string;
    nome: string | null;
    situacao: string;
    gerada_em: string;
  }[];
  principal: { id: string; nome: string | null } | null;
  fiadores: { id: string; nome: string | null; situacao: string }[];
}

export const detalheDaFicha = cache(
  async (id: string, verDados: boolean): Promise<DetalheDaFicha | null> => {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const sb = await com();
    const [f, fiadores] = await Promise.all([
      sb
        .from("fichas")
        .select(
          `${COLUNAS_LISTA}, rd_oportunidade, consentimento_em, usada_em, ultimo_acesso_em`,
        )
        .eq("id", id)
        .maybeSingle(),
      sb
        .from("fichas")
        .select("id, nome, situacao")
        .eq("ficha_principal_id", id)
        .order("gerada_em"),
    ]);
    falhar(f.error);
    falhar(fiadores.error);
    if (!f.data) return null;
    // O banco não deixa a sessão ler o token: o servidor lê para quem gera link.
    const token =
      f.data.situacao === "em_preenchimento" &&
      (await podeAgora("comercial.formulario.link"))
        ? await comAdmin()
            .from("fichas")
            .select("token")
            .eq("id", id)
            .maybeSingle()
            .then((r) => {
              falhar(r.error);
              return r.data?.token ?? null;
            })
        : null;
    const ficha = {
      ...f.data,
      token,
      tipo: ehTipo(f.data.tipo) ? f.data.tipo : null,
      situacao: f.data.situacao as SituacaoFicha,
    };
    const principal = ficha.ficha_principal_id
      ? await sb
          .from("fichas")
          .select("id, nome")
          .eq("id", ficha.ficha_principal_id)
          .maybeSingle()
          .then((r) => r.data)
      : null;
    const base = {
      ficha,
      principal,
      fiadores: fiadores.data ?? [],
      dados: null,
      documentos: [],
      acessos: [],
      mesmoDocumento: [],
    };
    if (!verDados) return base;

    const [dados, docs, acessos] = await Promise.all([
      sb
        .from("ficha_dados")
        .select("documento, respostas, assinatura_nome")
        .eq("ficha_id", id)
        .maybeSingle(),
      sb
        .from("ficha_documentos")
        .select("id, documento, arquivo_nome, tamanho, enviado_em")
        .eq("ficha_id", id)
        .order("enviado_em"),
      sb
        .from("ficha_acessos")
        .select("em, acao, usuario_id")
        .eq("ficha_id", id)
        .order("em", { ascending: false })
        .limit(30),
    ]);
    falhar(dados.error);
    falhar(docs.error);
    falhar(acessos.error);
    const documento = dados.data?.documento ?? null;
    const [iguais, nomes] = await Promise.all([
      documento
        ? sb
            .from("ficha_dados")
            .select("ficha_id")
            .eq("documento", documento)
            .neq("ficha_id", id)
            .limit(10)
            .then(async (r) => {
              const ids = (r.data ?? []).map((x) => x.ficha_id);
              if (!ids.length) return [];
              const { data } = await sb
                .from("fichas")
                .select("id, nome, situacao, gerada_em")
                .in("id", ids)
                .order("gerada_em", { ascending: false });
              return data ?? [];
            })
        : Promise.resolve([]),
      nomesDeUsuarios(
        (acessos.data ?? []).map((a) => a.usuario_id),
        ["comercial.formulario.ver"],
      ),
    ]);
    return {
      ...base,
      dados: dados.data
        ? {
            documento,
            respostas: lerRespostas(dados.data.respostas),
            assinatura: dados.data.assinatura_nome,
          }
        : null,
      documentos: docs.data ?? [],
      acessos: (acessos.data ?? []).map((a) => ({
        em: a.em,
        acao: a.acao,
        nome: nomes.get(a.usuario_id) ?? "Usuário removido",
      })),
      mesmoDocumento: iguais,
    };
  },
);

/**
 * Registra quem abriu a ficha, viu o PDF ou baixou um documento (LGPD).
 * Chame só depois de ler a ficha pelo RLS com comercial.formulario.ver.
 */
export function registrarAcessoDepois(
  fichaId: string,
  usuarioId: string,
  acao: "abriu" | "pdf" | "documento",
) {
  after(async () => {
    const { error } = await comAdmin()
      .from("ficha_acessos")
      .insert({ ficha_id: fichaId, usuario_id: usuarioId, acao });
    if (error) console.error("acesso à ficha", error);
  });
}

// ---------------------------------------------------------------------------
// Para os Contratos (etapa Partes)
// ---------------------------------------------------------------------------

export interface FichaParaEscolher {
  id: string;
  nome: string | null;
  tipo: TipoFicha | null;
  /** recebida_em (ou gerada_em, se veio sem). */
  data: string;
  luc: string | null;
  situacao: SituacaoFicha;
}

/**
 * Fichas recebidas (e já usadas) para a lista "Escolher ficha cadastral",
 * com busca por nome e filtro por tipo. Pelo RLS (quem monta contrato vê).
 */
export async function fichasParaEscolher(
  busca = "",
  tipo: TipoFicha | null = null,
): Promise<FichaParaEscolher[]> {
  let q = (await com())
    .from("fichas")
    .select("id, nome, tipo, luc, situacao, recebida_em, gerada_em")
    .in("situacao", ["recebida", "usada"]);
  if (tipo) q = q.eq("tipo", tipo);
  const termo = busca.trim().replace(/[%_,()]/g, " ");
  if (termo) q = q.ilike("nome", `%${termo}%`);
  const { data, error } = await q
    .order("recebida_em", { ascending: false })
    .limit(200);
  falhar(error);
  return (data ?? []).map((f) => ({
    id: f.id,
    nome: f.nome,
    tipo: ehTipo(f.tipo) ? f.tipo : null,
    data: f.recebida_em ?? f.gerada_em,
    luc: f.luc,
    situacao: f.situacao as SituacaoFicha,
  }));
}

/**
 * Campos da etapa Partes a partir da ficha (dadosDaFichaParaContrato).
 * Null se a ficha não existe ou se a pessoa não tem comercial.formulario.ver
 * (o RLS não devolve os dados pessoais).
 */
export async function partesDaFicha(id: string): Promise<PartesDaFicha | null> {
  const { pode } = await contextoCom();
  if (!pode("comercial.formulario.ver")) return null;
  const sb = await com();
  const [f, d] = await Promise.all([
    sb.from("fichas").select("id, tipo, origem").eq("id", id).maybeSingle(),
    sb.from("ficha_dados").select("respostas").eq("ficha_id", id).maybeSingle(),
  ]);
  falhar(f.error);
  falhar(d.error);
  if (!f.data || !d.data) return null;
  return dadosDaFichaParaContrato({ ...f.data, respostas: d.data.respostas });
}

/** Documentos exigidos, para as ações do link (recebe a ficha já conferida). */
export async function documentosDoLink(
  _ficha: FichaDoLink,
): Promise<DocumentosPorTipo> {
  return documentosPublicos();
}

/**
 * Endereço assinado (5 minutos) de um documento da ficha. A linha é lida
 * pelo RLS (só quem vê fichas); o download fica registrado.
 */
export async function enderecoDoDocumento(
  fichaId: string,
  documentoId: string,
  usuarioId: string,
): Promise<string | "nao_existe" | "sem_arquivo"> {
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(fichaId) || !uuid.test(documentoId)) return "nao_existe";
  const { data, error } = await (await com())
    .from("ficha_documentos")
    .select("arquivo_path")
    .eq("id", documentoId)
    .eq("ficha_id", fichaId)
    .maybeSingle();
  falhar(error);
  if (!data) return "nao_existe";
  registrarAcessoDepois(fichaId, usuarioId, "documento");
  const { data: url, error: e } = await createAdminClient()
    .storage.from(BUCKET_COMERCIAL)
    .createSignedUrl(data.arquivo_path, 300);
  return e || !url ? "sem_arquivo" : url.signedUrl;
}
