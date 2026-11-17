import { randomBytes } from "node:crypto";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type {
  DocumentoDoKitLido,
  EntradaArquivoKit,
  EntradaNovoDocumentoKit,
  RespostaDocumentoKit,
  RespostaKit,
  VersaoDoKit,
} from "@arp/shared/comercial/contratos/kit";
import {
  blocoDoLuc,
  itensDoKit,
  situacaoDaValidade,
} from "@arp/shared/comercial/kit";
import { formatarData } from "@arp/shared/formato";
import { BYTES_DO_TIPO, tipoPeloConteudo } from "@arp/shared/os/tipo-arquivo";
import { PDFDocument, rgb } from "pdf-lib";
import { z } from "zod";
import { type Contexto, exigir, pode } from "@/contexto";
import {
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import {
  infoDoArquivo,
  inicioDoArquivo,
  lerArquivo,
  linkDeLeitura,
  prepararEnvio,
  removerArquivos,
} from "@/infra/arquivos";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  novaPagina,
  prepararPapel,
  quebrarLinhas,
  seguro,
  x,
  y,
} from "@/infra/pdf/papel-timbrado";
import {
  contextoCom,
  listas,
  nomesDeUsuarios,
  parametros,
  valoresDaLista,
} from "./base";
import { dadosEnet } from "./fontes";
import * as repo from "./kit.repository";
import { primeiroErro, traduzir } from "./traduzir";

// Kit de entrega (spec 4.14): documentos com a versão atual, histórico de
// versões, o kit de um LUC num PDF só, e as gravações. Lido e gravado com a
// sessão (RLS: kit.ver ou contratos para ler; kit.editar para gravar); os
// arquivos saem do bucket privado "comercial" só depois de o RLS devolver a
// versão. O PDF vai do navegador direto para o bucket por um link de envio
// assinado, que só é gerado depois de conferir kit.editar no banco.

export const BUCKET_COMERCIAL = "comercial";
const ARQUIVO_MAX_BYTES = 25 * 1024 * 1024;
const SEM_PERMISSAO = "Você não tem permissão para alterar o kit de entrega.";

type VersaoLida = Awaited<ReturnType<typeof repo.versoesAtuais>>[number];

const semPath = ({ arquivo_path, ...v }: VersaoLida): VersaoDoKit => ({
  ...v,
  temArquivo: Boolean(arquivo_path),
});

/** Documentos do kit (ativos e inativos) com a versão atual de cada um. */
async function documentosDoKit(ctx: Contexto): Promise<DocumentoDoKitLido[]> {
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const docs = await repo.documentos(tx);
    const versoes = await repo.versoesAtuais(tx);
    const atual = new Map(versoes.map((v) => [v.documento_id, semPath(v)]));
    return docs.map((d) => ({ ...d, atual: atual.get(d.id) ?? null }));
  });
}

export async function tela(ctx: Contexto): Promise<RespostaKit> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const documentos = await documentosDoKit(ctx);
  const p = await parametros(ctx);
  const todas = await listas(ctx);
  return {
    hoje,
    dadosDe,
    documentos,
    categorias: valoresDaLista(todas, "kit_categoria"),
    avisoDias: p.kit_aviso_dias,
    lucs: dadosEnet(hoje).lucs.map((l) => ({
      numero: l.numero,
      local: l.local,
      bloco: blocoDoLuc(l),
    })),
  };
}

export async function documento(
  ctx: Contexto,
  id: string,
): Promise<RespostaDocumentoKit> {
  const { hoje, dadosDe } = contextoCom(ctx);
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const d = await repo.documento(tx, id);
    return d ? { d, versoes: await repo.versoesDoDocumento(tx, id) } : null;
  });
  if (!lido) throw new ErroNaoEncontrado("Documento não encontrado.");
  const versoes = lido.versoes.map(semPath);
  const nomes = await nomesDeUsuarios(
    ctx,
    versoes.map((v) => v.enviado_por),
    ["comercial.kit.ver"],
  );
  const p = await parametros(ctx);
  return {
    hoje,
    dadosDe,
    documento: { ...lido.d, atual: versoes.find((v) => v.atual) ?? null },
    versoes,
    nomes: [...nomes].map(([i, nome]) => ({ id: i, nome })),
    categorias: valoresDaLista(await listas(ctx), "kit_categoria"),
    avisoDias: p.kit_aviso_dias,
  };
}

// ---------------------------------------------------------------------------
// Arquivos
// ---------------------------------------------------------------------------

/** Link assinado (60 s) de uma versão que a pessoa pode ver. */
export async function linkDaVersao(
  ctx: Contexto,
  versaoId: string,
): Promise<string> {
  const v = z.uuid().safeParse(versaoId).success
    ? await banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.arquivoDaVersao(tx, versaoId),
      )
    : undefined;
  const link = v?.arquivo_path
    ? await linkDeLeitura(BUCKET_COMERCIAL, v.arquivo_path, {
        segundos: 60,
        baixarComo: v.arquivo_nome ?? true,
      })
    : null;
  if (v?.arquivo_path && !link)
    log.error({ versaoId }, "link do kit: arquivo não encontrado");
  if (!link)
    throw new ErroNaoEncontrado(
      "Este documento ainda não tem arquivo (ou você não tem acesso a ele). Suba o PDF na tela do Kit de entrega.",
    );
  return link;
}

interface ItemDoKit {
  nome: string;
  versaoId: string | null;
  versao: string | null;
  validade: string | null;
}

/**
 * "Baixar kit do LUC": os "vai em todo contrato" e os mapas de fachada do
 * bloco do LUC num PDF só. Precisa de kit.ver ou contratos (o RLS do kit
 * também confere ao ler as versões).
 */
export async function pdfDoLuc(
  ctx: Contexto,
  luc: string,
): Promise<{ bytes: Uint8Array; nome: string }> {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(luc))
    throw new ErroDeValidacao("LUC inválido.");
  if (
    !pode(ctx, "comercial.kit.ver") &&
    !pode(ctx, "comercial.contratos.ver") &&
    !pode(ctx, "comercial.contratos.editar")
  )
    throw new ErroDePermissao("Você não tem acesso ao kit de entrega.");
  const { hoje } = contextoCom(ctx);
  const unidade = dadosEnet(hoje).lucs.find((l) => l.numero === luc);
  if (!unidade) throw new ErroNaoEncontrado("LUC não encontrado.");
  const docs = await documentosDoKit(ctx);
  const itens = itensDoKit(docs, blocoDoLuc(unidade), unidade.numero).map(
    (d) => ({
      nome: d.nome,
      versaoId: d.atual?.id ?? null,
      versao: d.atual?.versao ?? null,
      validade: d.atual?.validade ?? null,
    }),
  );
  return {
    bytes: await pdfDoKit(ctx, {
      titulo: `Kit de entrega — LUC ${unidade.numero} (${unidade.local})`,
      itens,
      hoje,
    }),
    nome: `kit-de-entrega-${unidade.numero}.pdf`,
  };
}

/**
 * Um PDF só com o kit: capa com a lista (versão, validade, situação) e os
 * PDFs na ordem do kit. Quem não tem arquivo ou não abriu fica avisado na
 * capa. Lê as versões pela sessão: só junta o que o RLS deixa ver.
 */
async function pdfDoKit(
  ctx: Contexto,
  opcoes: { titulo: string; itens: ItemDoKit[]; hoje: string },
): Promise<Uint8Array> {
  const { titulo, itens, hoje } = opcoes;
  const ids = itens.map((i) => i.versaoId).filter((v): v is string => !!v);
  const caminhos = new Map<string, string>();
  if (ids.length) {
    const lidas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.caminhosDasVersoes(tx, ids),
    );
    for (const v of lidas)
      if (v.arquivo_path) caminhos.set(v.id, v.arquivo_path);
  }
  const arquivos = await Promise.all(
    itens.map(async (i) => {
      const caminho = i.versaoId ? caminhos.get(i.versaoId) : undefined;
      if (!caminho) return null;
      const bytes = await lerArquivo(BUCKET_COMERCIAL, caminho);
      if (!bytes) {
        log.error({ caminho }, "arquivo do kit não encontrado");
        return null;
      }
      try {
        return await PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (err) {
        log.error({ err, caminho }, "PDF do kit inválido");
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

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const metaVersao = z.object({
  versao: z.string().trim().min(1, "Informe a versão.").max(60),
  data: dia,
  validade: dia,
  paginas: z.number().int().positive().max(5000).nullable(),
});

const metaDocumento = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(200),
  categoria: z.string().trim().min(1).max(80),
  blocos: z.array(z.string().trim().min(1).max(30)).max(40),
  lucs: z.array(z.string().trim().min(1).max(30)).max(200).default([]),
  todoContrato: z.boolean(),
});

const DOCUMENTO_INVALIDO = "Confira os campos do documento.";

function validar<T extends z.ZodType>(esquema: T, valor: unknown): z.output<T> {
  const e = esquema.safeParse(valor);
  if (!e.success)
    throw new ErroDeNegocio(primeiroErro(e.error, DOCUMENTO_INVALIDO));
  return e.data;
}

function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase();
  return (limpo || "documento.pdf").slice(-120);
}

async function conferirCategoria(ctx: Contexto, categoria: string) {
  if (!valoresDaLista(await listas(ctx), "kit_categoria").includes(categoria))
    throw new ErroDeNegocio("Categoria fora da lista.");
}

const mensagens = (oQue: string) => ({
  permissao: SEM_PERMISSAO,
  conflito: "Já existe um documento com este nome.",
  falha: `Não foi possível ${oQue}. Tente de novo.`,
});

/** Documento novo, com a primeira versão (ainda sem arquivo). */
export async function novoDocumento(
  ctx: Contexto,
  entrada: EntradaNovoDocumentoKit,
): Promise<{ documentoId: string; versaoId: string }> {
  const d = validar(metaDocumento, entrada.documento);
  const v = validar(metaVersao, entrada.versao);
  await conferirCategoria(ctx, d.categoria);
  try {
    return await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const ultimo = await repo.ultimaOrdem(tx);
      const doc = await repo.incluirDocumento(tx, {
        nome: d.nome,
        categoria: d.categoria,
        blocos: d.blocos,
        lucs: d.lucs,
        todo_contrato: d.todoContrato,
        ordem: (ultimo?.ordem ?? 0) + 1,
      });
      const versao = await repo.incluirVersao(tx, {
        documento_id: doc.id,
        ...v,
      });
      return { documentoId: doc.id, versaoId: versao.id };
    });
  } catch (e) {
    traduzir(e, mensagens("criar o documento"), "kit: criar o documento");
  }
}

/** Link de envio do PDF (documento novo, nova versão ou versão sem arquivo). */
export async function prepararEnvioKit(
  ctx: Contexto,
  documentoId: string,
  nome: string,
  tamanho: number,
): Promise<{ url: string; path: string }> {
  try {
    await exigir(ctx, "comercial.kit.editar");
  } catch {
    throw new ErroDePermissao(SEM_PERMISSAO);
  }
  if (!/\.pdf$/i.test(nome)) throw new ErroDeNegocio("Envie o arquivo em PDF.");
  if (tamanho > ARQUIVO_MAX_BYTES)
    throw new ErroDeNegocio("Arquivo maior que 25 MB.");
  const existe = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.documento(tx, documentoId),
  );
  if (!existe) throw new ErroDeNegocio("Documento não encontrado.");
  const path = `kit/${documentoId}/${randomBytes(6).toString("hex")}-${nomeSeguro(nome)}`;
  const envio = await prepararEnvio(BUCKET_COMERCIAL, path, {
    maxBytes: ARQUIVO_MAX_BYTES,
  });
  if ("erro" in envio)
    throw new ErroDeNegocio(
      "Não foi possível preparar o envio. Tente de novo.",
    );
  return { url: envio.url, path };
}

/** O arquivo no bucket começa com a assinatura de PDF? null se não deu para ler. */
async function ehPdf(path: string): Promise<boolean | null> {
  const inicio = await inicioDoArquivo(BUCKET_COMERCIAL, path, BYTES_DO_TIPO);
  if (!inicio) return null;
  return tipoPeloConteudo(inicio) === "application/pdf";
}

/**
 * Depois do envio: confere o arquivo no bucket e grava. Com `versaoId`, o
 * arquivo entra na versão que ainda não tinha arquivo; com `versao`, vira
 * a versão nova e a anterior fica no histórico. Devolve a mensagem.
 */
export async function registrarArquivo(
  ctx: Contexto,
  documentoId: string,
  entrada: EntradaArquivoKit,
): Promise<string> {
  const versao = entrada.versao ? validar(metaVersao, entrada.versao) : null;
  try {
    await exigir(ctx, "comercial.kit.editar");
  } catch {
    throw new ErroDePermissao(SEM_PERMISSAO);
  }
  const { path, nome, versaoId } = entrada;
  const prefixo = `kit/${documentoId}/`;
  if (
    !path.startsWith(prefixo) ||
    !/^[a-z0-9._-]+$/.test(path.slice(prefixo.length)) ||
    (!versaoId && !versao)
  )
    throw new ErroDeNegocio("Arquivo inválido.");

  // Caminho que já é de alguma versão não veio deste envio: nunca se apaga.
  // (kit.editar conferido no banco logo acima.)
  const emUso = await banco
    .comoServico((tx) => repo.caminhoEmUso(tx, path))
    .catch(() => ({ id: "erro" }));
  if (emUso) throw new ErroDeNegocio("Arquivo inválido.");

  const descartar = async (erro: string): Promise<never> => {
    await removerArquivos(BUCKET_COMERCIAL, [path]);
    throw new ErroDeNegocio(erro);
  };
  const info = await infoDoArquivo(BUCKET_COMERCIAL, path);
  if (!info)
    throw new ErroDeNegocio("O arquivo não chegou. Tente enviar de novo.");
  const tamanho = info.tamanho;
  if (tamanho <= 0) return descartar("O arquivo chegou vazio.");
  if (tamanho > ARQUIVO_MAX_BYTES) return descartar("Arquivo maior que 25 MB.");
  const pdf = await ehPdf(path);
  if (pdf === null)
    return descartar("Não foi possível conferir o arquivo. Envie de novo.");
  if (!pdf) return descartar("O arquivo não é um PDF. Envie o arquivo em PDF.");
  const arquivo = { arquivo_path: path, arquivo_nome: nome, tamanho };

  if (versaoId) {
    let mudou: { id: string }[];
    try {
      mudou = await banco.comoUsuario(ctx.usuario.id, (tx) =>
        repo.completarVersao(tx, versaoId, documentoId, arquivo),
      );
    } catch (e) {
      await removerArquivos(BUCKET_COMERCIAL, [path]);
      traduzir(e, mensagens("registrar o arquivo"), "kit: registrar o arquivo");
    }
    if (!mudou.length)
      return descartar(
        "Esta versão já tem arquivo. Use “Subir nova versão” para trocar.",
      );
    return "Arquivo enviado.";
  }

  if (!versao) return descartar("Arquivo inválido.");
  try {
    await banco.comoUsuario(ctx.usuario.id, (tx) =>
      repo.incluirVersao(tx, {
        documento_id: documentoId,
        ...versao,
        ...arquivo,
      }),
    );
  } catch (e) {
    await removerArquivos(BUCKET_COMERCIAL, [path]);
    traduzir(e, mensagens("registrar a versão"), "kit: registrar a versão");
  }
  return "Versão nova no kit. A anterior ficou guardada no histórico.";
}

const lista = (v: string | string[] | undefined) =>
  String([v ?? ""].flat()[0] ?? "")
    .split(/[,;\n]/)
    .map((b) => b.trim())
    .filter(Boolean);

/** Corrigir nome, categoria, blocos e a validade da versão atual. */
export async function editarDocumento(
  ctx: Contexto,
  id: string,
  form: Formulario,
): Promise<void> {
  const um = (k: string) => [form[k] ?? ""].flat()[0] ?? "";
  const e = validar(
    z.object({
      documento: metaDocumento,
      ativo: z.boolean(),
      versaoId: z.uuid().nullable(),
      validade: dia,
    }),
    {
      documento: {
        nome: um("nome"),
        categoria: um("categoria"),
        blocos: lista(form.blocos),
        lucs: lista(form.lucs),
        todoContrato: um("todo_contrato") === "sim",
      },
      ativo: um("ativo") !== "nao",
      versaoId: um("versao_id") || null,
      validade: um("validade") || null,
    },
  );
  const { documento: d, ativo, versaoId, validade } = e;
  await conferirCategoria(ctx, d.categoria);
  try {
    await banco.comoUsuario(ctx.usuario.id, async (tx) => {
      const doc = await repo.alterarDocumento(tx, id, {
        nome: d.nome,
        categoria: d.categoria,
        blocos: d.blocos,
        lucs: d.lucs,
        todo_contrato: d.todoContrato,
        ativo,
      });
      if (!doc.length) throw new ErroDePermissao(SEM_PERMISSAO);
      if (versaoId) await repo.alterarValidade(tx, versaoId, id, validade);
    });
  } catch (e) {
    traduzir(e, mensagens("salvar o documento"), "kit: salvar o documento");
  }
}
