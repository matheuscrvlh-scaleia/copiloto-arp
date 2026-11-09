import "server-only";
import { cache } from "react";
import {
  type ArquivoImportado,
  type AvisoImportacao,
  contarAvisos,
  type FiltroImportacoes,
  lerArquivos,
  lerAvisos,
  linhasDoResumo,
  POR_PAGINA,
  type StatusImportacao,
  TIPOS_IMPORTACAO,
  type TipoImportacao,
} from "@/lib/operacoes/importacoes";
import type { Permissao } from "@/lib/permissions";
import { linkDeLeitura } from "@/server/arquivos";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { falhar, op } from "./base";

// Histórico de importações de Operações (spec 4.11), com a sessão: o RLS
// (operacoes.ve_importacao) mostra a cada pessoa só os tipos que ela vê ou
// importa. Os arquivos enviados ficam no bucket "operacoes"; o link só sai
// para a importação que o RLS já deixou ler.

/** Quem vê o histórico (mesma regra de operacoes.ve_importacao). */
const VEEM_IMPORTACOES: Permissao[] = [
  ...Object.values(TIPOS_IMPORTACAO).map((t) => t.permissao),
  "operacoes.agua.ver",
  "operacoes.obras.ver",
  "operacoes.limpeza.ver",
];

const COLUNAS =
  "id, tipo, status, referencia, arquivos, avisos, bate, incompleta, motivo, exemplo, substitui, criado_por, criado_em, confirmado_por, confirmado_em, desfeito_por, desfeito_em" as const;

export interface ImportacaoNaLista {
  id: string;
  tipo: TipoImportacao;
  status: StatusImportacao;
  referencia: string;
  arquivos: ArquivoImportado[];
  avisos: { erro: number; aviso: number; info: number };
  bate: boolean | null;
  incompleta: boolean;
  motivo: string | null;
  exemplo: boolean;
  substitui: string | null;
  criadoPor: string | null;
  criadoEm: string;
  confirmadoPor: string | null;
  confirmadoEm: string | null;
  desfeitoPor: string | null;
  desfeitoEm: string | null;
}

type Linha = {
  id: string;
  tipo: string;
  status: string;
  referencia: string;
  arquivos: unknown;
  avisos: unknown;
  bate: boolean | null;
  incompleta: boolean;
  motivo: string | null;
  exemplo: boolean;
  substitui: string | null;
  criado_por: string | null;
  criado_em: string;
  confirmado_por: string | null;
  confirmado_em: string | null;
  desfeito_por: string | null;
  desfeito_em: string | null;
};

async function paraTela(linhas: Linha[]): Promise<ImportacaoNaLista[]> {
  const nomes = await nomesDeUsuarios(
    linhas.flatMap((l) => [l.criado_por, l.confirmado_por, l.desfeito_por]),
    VEEM_IMPORTACOES,
  );
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? null) : null);
  return linhas.map((l) => ({
    id: l.id,
    tipo: l.tipo as TipoImportacao,
    status: l.status as StatusImportacao,
    referencia: l.referencia,
    arquivos: lerArquivos(l.arquivos),
    avisos: contarAvisos(lerAvisos(l.avisos)),
    bate: l.bate,
    incompleta: l.incompleta,
    motivo: l.motivo,
    exemplo: l.exemplo,
    substitui: l.substitui,
    criadoPor: nome(l.criado_por),
    criadoEm: l.criado_em,
    confirmadoPor: nome(l.confirmado_por),
    confirmadoEm: l.confirmado_em,
    desfeitoPor: nome(l.desfeito_por),
    desfeitoEm: l.desfeito_em,
  }));
}

/** Uma página do histórico, da mais nova para a mais antiga. */
export async function paginaDeImportacoes(f: FiltroImportacoes): Promise<{
  linhas: ImportacaoNaLista[];
  total: number;
}> {
  let q = (await op())
    .from("importacoes")
    .select(COLUNAS, { count: "exact" })
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .range((f.pagina - 1) * POR_PAGINA, f.pagina * POR_PAGINA - 1);
  if (f.tipo) q = q.eq("tipo", f.tipo);
  if (f.status) q = q.eq("status", f.status);
  if (f.de) q = q.gte("criado_em", `${f.de}T00:00:00-03:00`);
  if (f.ate) q = q.lte("criado_em", `${f.ate}T23:59:59.999-03:00`);
  const { data, error, count } = await q;
  falhar(error);
  return { linhas: await paraTela(data ?? []), total: count ?? 0 };
}

export interface ArquivoComLink extends ArquivoImportado {
  url: string | null;
}

export interface ImportacaoDetalhe extends ImportacaoNaLista {
  listaDeAvisos: AvisoImportacao[];
  resumo: { rotulo: string; valor: string }[];
  arquivosComLink: ArquivoComLink[];
  /** Conciliação em reais da água (só com operacoes.agua.valores). */
  valores: {
    arquivo: number | null;
    lido: number | null;
    porBloco: { bloco: string; arquivo: number | null; lido: number | null }[];
  } | null;
  /** Importação que veio depois e substituiu esta (água). */
  substituidaPor: string | null;
}

const numero = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Uma importação com avisos, resumo e links dos arquivos (null: não existe ou o RLS esconde). */
export const importacao = cache(
  async (
    id: string,
    comValores: boolean,
  ): Promise<ImportacaoDetalhe | null> => {
    const db = await op();
    const [{ data, error }, valores, depois] = await Promise.all([
      db
        .from("importacoes")
        .select(`${COLUNAS}, resumo`)
        .eq("id", id)
        .maybeSingle(),
      comValores
        ? db
            .from("importacao_valores")
            .select("valor_arquivo, valor_lido, por_bloco")
            .eq("importacao_id", id)
            .maybeSingle()
        : null,
      db
        .from("importacoes")
        .select("id")
        .eq("substitui", id)
        .order("criado_em", { ascending: false })
        .limit(1),
    ]);
    falhar(error);
    if (!data) return null;
    if (valores) falhar(valores.error);
    falhar(depois.error);
    const [base] = await paraTela([data]);
    if (!base) return null;
    const arquivos = await Promise.all(
      base.arquivos.map(async (a) => ({
        ...a,
        url: a.caminho
          ? await linkDeLeitura("operacoes", a.caminho, {
              segundos: 600,
              baixarComo: a.nome,
            })
          : null,
      })),
    );
    const v = valores?.data;
    const porBloco =
      v?.por_bloco &&
      typeof v.por_bloco === "object" &&
      !Array.isArray(v.por_bloco)
        ? Object.entries(v.por_bloco as Record<string, unknown>).map(
            ([bloco, x]) => {
              const o = (x ?? {}) as Record<string, unknown>;
              return {
                bloco,
                arquivo: numero(o.arquivo),
                lido: numero(o.lido),
              };
            },
          )
        : [];
    return {
      ...base,
      listaDeAvisos: lerAvisos(data.avisos),
      resumo: linhasDoResumo(data.resumo),
      arquivosComLink: arquivos,
      valores: v
        ? {
            arquivo: v.valor_arquivo === null ? null : Number(v.valor_arquivo),
            lido: v.valor_lido === null ? null : Number(v.valor_lido),
            porBloco: porBloco.sort((a, b) => a.bloco.localeCompare(b.bloco)),
          }
        : null,
      substituidaPor: depois.data?.[0]?.id ?? null,
    };
  },
);
