import "server-only";
import { PDFDocument, rgb } from "pdf-lib";
import { cache } from "react";
import {
  blocoDoLuc,
  itensDoKit,
  situacaoDaValidade,
} from "@/lib/comercial/kit";
import { formatarData } from "@/lib/formato";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  novaPagina,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/server/os/pdf/papel-timbrado";
import { com, type KitDocumento, type KitVersao } from "./base";
import { dadosEnet } from "./fontes";
import { nomesDeUsuarios } from "./usuarios";

// Kit de entrega (spec 4.14): documentos com a versão atual, histórico de
// versões, o kit de um bloco/LUC (que a etapa Documentos do contrato usa)
// e o PDF único do kit. Lido com a sessão (RLS: kit.ver ou contratos);
// os arquivos saem do bucket privado "comercial" pela service role só
// depois de o RLS devolver a versão.

export const BUCKET_COMERCIAL = "comercial";

export type VersaoDoKit = Pick<
  KitVersao,
  | "id"
  | "documento_id"
  | "versao"
  | "data"
  | "validade"
  | "paginas"
  | "arquivo_nome"
  | "tamanho"
  | "atual"
  | "enviado_por"
  | "enviado_em"
> & { temArquivo: boolean };

export type DocumentoDoKit = Pick<
  KitDocumento,
  "id" | "nome" | "categoria" | "ordem" | "blocos" | "todo_contrato" | "ativo"
> & { atual: VersaoDoKit | null };

const COLUNAS_VERSAO =
  "id, documento_id, versao, data, validade, paginas, arquivo_nome, arquivo_path, tamanho, atual, enviado_por, enviado_em";

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler o kit: ${erro.message}`);
}

const semPath = <T extends { arquivo_path: string | null }>({
  arquivo_path,
  ...v
}: T) => ({ ...v, temArquivo: Boolean(arquivo_path) });

/** Documentos do kit (ativos e inativos) com a versão atual de cada um. */
export const documentosDoKit = cache(async (): Promise<DocumentoDoKit[]> => {
  const db = await com();
  const [docs, versoes] = await Promise.all([
    db
      .from("kit_documentos")
      .select("id, nome, categoria, ordem, blocos, todo_contrato, ativo")
      .order("ordem")
      .order("nome"),
    db.from("kit_versoes").select(COLUNAS_VERSAO).eq("atual", true),
  ]);
  falhar(docs.error);
  falhar(versoes.error);
  const atual = new Map(
    (versoes.data ?? []).map((v) => [v.documento_id, semPath(v)]),
  );
  return (docs.data ?? []).map((d) => ({
    ...d,
    atual: atual.get(d.id) ?? null,
  }));
});

/** Um documento com todas as versões, da mais nova para a mais antiga. */
export async function documentoDoKit(id: string): Promise<{
  documento: DocumentoDoKit;
  versoes: VersaoDoKit[];
} | null> {
  const db = await com();
  const [doc, versoes] = await Promise.all([
    db
      .from("kit_documentos")
      .select("id, nome, categoria, ordem, blocos, todo_contrato, ativo")
      .eq("id", id)
      .maybeSingle(),
    db
      .from("kit_versoes")
      .select(COLUNAS_VERSAO)
      .eq("documento_id", id)
      .order("enviado_em", { ascending: false }),
  ]);
  falhar(doc.error);
  falhar(versoes.error);
  if (!doc.data) return null;
  const lista = (versoes.data ?? []).map(semPath);
  return {
    documento: { ...doc.data, atual: lista.find((v) => v.atual) ?? null },
    versoes: lista,
  };
}

/** Nome de quem enviou cada versão. */
export const nomesDoKit = (ids: (string | null)[]) =>
  nomesDeUsuarios(ids, ["comercial.kit.ver"]);

// ---------------------------------------------------------------------------
// Kit de um bloco ou LUC (etapa Documentos do contrato)
// ---------------------------------------------------------------------------

export interface ItemDoKit {
  documentoId: string;
  nome: string;
  categoria: string;
  /** Versão atual: o contrato guarda este id (comercial.contrato_kit). */
  versaoId: string | null;
  versao: string | null;
  validade: string | null;
  temArquivo: boolean;
  /** Mapa de fachada do bloco (os outros vão em todo contrato). */
  mapa: boolean;
}

/** O que vai no contrato do bloco: "vai em todo contrato" + mapas do bloco. */
export async function kitDoBloco(bloco: string | null): Promise<ItemDoKit[]> {
  const docs = await documentosDoKit();
  return itensDoKit(docs, bloco).map((d) => ({
    documentoId: d.id,
    nome: d.nome,
    categoria: d.categoria,
    versaoId: d.atual?.id ?? null,
    versao: d.atual?.versao ?? null,
    validade: d.atual?.validade ?? null,
    temArquivo: d.atual?.temArquivo ?? false,
    mapa: !d.todo_contrato,
  }));
}

/**
 * Kit do LUC do ENET ("Bloco 11" → mapas do bloco 11): o número do LUC
 * (ex.: "11_204") ou o LUC já lido. LUC que não existe: só os de todo contrato.
 */
export async function kitDoLuc(
  luc: string | { local: string; tipo_loja: string },
): Promise<ItemDoKit[]> {
  const unidade =
    typeof luc === "string"
      ? (await dadosEnet()).lucs.find((l) => l.numero === luc)
      : luc;
  return kitDoBloco(unidade ? blocoDoLuc(unidade) : null);
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

/** Link assinado (60 s) de uma versão que a pessoa pode ver; null sem arquivo. */
export async function linkDaVersao(versaoId: string): Promise<string | null> {
  const { data, error } = await (await com())
    .from("kit_versoes")
    .select("arquivo_path, arquivo_nome")
    .eq("id", versaoId)
    .maybeSingle();
  falhar(error);
  if (!data?.arquivo_path) return null;
  const link = await createAdminClient()
    .storage.from(BUCKET_COMERCIAL)
    .createSignedUrl(data.arquivo_path, 60, {
      download: data.arquivo_nome ?? true,
    });
  if (link.error) {
    console.error("link do kit", link.error);
    return null;
  }
  return link.data.signedUrl;
}

/**
 * Um PDF só com o kit: capa com a lista (versão, validade, situação) e os
 * PDFs na ordem do kit. Quem não tem arquivo ou não abriu fica avisado na
 * capa. Lê as versões pela sessão: só junta o que o RLS deixa ver.
 */
export async function pdfDoKit(opcoes: {
  titulo: string;
  itens: ItemDoKit[];
  hoje: string;
}): Promise<Uint8Array> {
  const { titulo, itens, hoje } = opcoes;
  const ids = itens.map((i) => i.versaoId).filter((v): v is string => !!v);
  const caminhos = new Map<string, string>();
  if (ids.length) {
    const { data, error } = await (await com())
      .from("kit_versoes")
      .select("id, arquivo_path")
      .in("id", ids);
    falhar(error);
    for (const v of data ?? [])
      if (v.arquivo_path) caminhos.set(v.id, v.arquivo_path);
  }
  const storage = createAdminClient().storage.from(BUCKET_COMERCIAL);
  const arquivos = await Promise.all(
    itens.map(async (i) => {
      const caminho = i.versaoId ? caminhos.get(i.versaoId) : undefined;
      if (!caminho) return null;
      const { data, error } = await storage.download(caminho);
      if (error || !data) {
        console.error("arquivo do kit", caminho, error);
        return null;
      }
      try {
        return await PDFDocument.load(
          new Uint8Array(await data.arrayBuffer()),
          {
            ignoreEncryption: true,
          },
        );
      } catch (erro) {
        console.error("PDF do kit inválido", caminho, erro);
        return null;
      }
    }),
  );

  const doc = await PDFDocument.create();
  doc.setTitle(titulo);
  const papel = await prepararPapel(doc);
  const { normal, negrito } = papel.fontes;
  let capa = novaPagina(papel);
  const largura = x(210 - 2 * 14);
  let topo = 42;
  const escrever = (
    texto: string,
    tamanho: number,
    fonte = normal,
    cor = rgb(0.1, 0.1, 0.1),
  ) => {
    for (const linha of quebrarLinhas(fonte, tamanho, texto, largura)) {
      if (topo > 255) {
        capa = novaPagina(papel);
        topo = 42;
      }
      capa.drawText(seguro(fonte, linha), {
        x: x(14),
        y: y(topo),
        size: tamanho,
        font: fonte,
        color: cor,
      });
      topo += tamanho * 0.5;
    }
  };
  escrever(titulo, 16, negrito);
  topo += 2;
  escrever(`Gerado em ${formatarData(hoje)}. ${itens.length} documentos.`, 9);
  const faltam = itens.filter((_, i) => !arquivos[i]).length;
  if (faltam)
    escrever(
      `${faltam} de ${itens.length} ainda sem arquivo (marcados abaixo): falta subir o PDF no Kit de entrega.`,
      9,
      normal,
      rgb(0.73, 0.11, 0.11),
    );
  topo += 4;
  itens.forEach((item, i) => {
    const situacao = situacaoDaValidade(item.validade, hoje, 0);
    const falta = !arquivos[i];
    const detalhes = [
      item.versao ? `versão ${item.versao}` : null,
      item.validade
        ? `validade ${formatarData(item.validade)}`
        : "sem validade",
      situacao === "vencido" ? "VENCIDO" : null,
      falta
        ? "sem arquivo ainda: falta subir o PDF (não está neste kit)"
        : null,
    ].filter(Boolean);
    escrever(`${i + 1}. ${item.nome}`, 10, negrito);
    escrever(
      detalhes.join(" · "),
      9,
      normal,
      situacao === "vencido" || falta
        ? rgb(0.73, 0.11, 0.11)
        : rgb(0.35, 0.35, 0.35),
    );
    topo += 1.5;
  });

  for (const fonte of arquivos) {
    if (!fonte) continue;
    const paginas = await doc.copyPages(fonte, fonte.getPageIndices());
    for (const p of paginas) doc.addPage(p);
  }
  return doc.save();
}
