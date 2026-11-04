"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { createAdminClient } from "@/lib/supabase/admin";
import { podeAgora } from "@/server/auth";
import { com, valoresDaLista } from "@/server/comercial/base";
import { BUCKET_COMERCIAL } from "@/server/comercial/kit";

// Gravações do Kit de entrega (spec 4.14). Cadastro e metadados vão com a
// sessão: o RLS confere comercial.kit.editar e o gatilho do banco tira a
// versão anterior do kit (nada se apaga; fica no histórico). O PDF vai do
// navegador direto para o bucket privado por um link de envio assinado,
// que o servidor só gera depois de conferir a permissão com podeAgora.

const ARQUIVO_MAX_BYTES = 25 * 1024 * 1024;
const SEM_PERMISSAO = "Você não tem permissão para alterar o kit de entrega.";

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
  todoContrato: z.boolean(),
});

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

const primeiroErro = (e: z.ZodError) =>
  e.issues[0]?.message && !e.issues[0].message.startsWith("Invalid")
    ? e.issues[0].message
    : "Confira os campos do documento.";

async function categoriaValida(categoria: string): Promise<boolean> {
  return (await valoresDaLista("kit_categoria")).includes(categoria);
}

function erroDoBanco(error: { code?: string; message: string }, oQue: string) {
  if (error.code === "42501") return SEM_PERMISSAO;
  if (error.code === "23505") return "Já existe um documento com este nome.";
  console.error(`kit: ${oQue}`, error);
  return `Não foi possível ${oQue}. Tente de novo.`;
}

// ---------------------------------------------------------------------------
// Documento novo (com a primeira versão, ainda sem arquivo)
// ---------------------------------------------------------------------------

export type DocumentoCriado =
  | { ok: true; documentoId: string; versaoId: string }
  | { ok: false; erro: string };

export async function novoDocumentoKit(entrada: {
  documento: z.input<typeof metaDocumento>;
  versao: z.input<typeof metaVersao>;
}): Promise<DocumentoCriado> {
  const e = z
    .object({ documento: metaDocumento, versao: metaVersao })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: primeiroErro(e.error) };
  const { documento: d, versao: v } = e.data;
  if (!(await categoriaValida(d.categoria)))
    return { ok: false, erro: "Categoria fora da lista." };
  const db = await com();
  const ultimo = await db
    .from("kit_documentos")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const doc = await db
    .from("kit_documentos")
    .insert({
      nome: d.nome,
      categoria: d.categoria,
      blocos: d.blocos,
      todo_contrato: d.todoContrato,
      ordem: (ultimo.data?.ordem ?? 0) + 1,
    })
    .select("id")
    .single();
  if (doc.error)
    return { ok: false, erro: erroDoBanco(doc.error, "criar o documento") };
  const versao = await db
    .from("kit_versoes")
    .insert({ documento_id: doc.data.id, ...v })
    .select("id")
    .single();
  if (versao.error)
    return { ok: false, erro: erroDoBanco(versao.error, "criar a versão") };
  refresh();
  return { ok: true, documentoId: doc.data.id, versaoId: versao.data.id };
}

// ---------------------------------------------------------------------------
// Envio do PDF (documento novo, nova versão ou versão ainda sem arquivo)
// ---------------------------------------------------------------------------

export type EnvioPreparado =
  | { ok: true; url: string; path: string }
  | { ok: false; erro: string };

export async function prepararEnvioKit(entrada: {
  documentoId: string;
  nome: string;
  tamanho: number;
}): Promise<EnvioPreparado> {
  const e = z
    .object({
      documentoId: z.uuid(),
      nome: z.string().min(1).max(255),
      tamanho: z.number().int().positive(),
    })
    .safeParse(entrada);
  if (!e.success) return { ok: false, erro: "Arquivo inválido." };
  if (!(await podeAgora("comercial.kit.editar")))
    return { ok: false, erro: SEM_PERMISSAO };
  const { documentoId, nome, tamanho } = e.data;
  if (!/\.pdf$/i.test(nome))
    return { ok: false, erro: "Envie o arquivo em PDF." };
  if (tamanho > ARQUIVO_MAX_BYTES)
    return { ok: false, erro: "Arquivo maior que 25 MB." };
  const existe = await (await com())
    .from("kit_documentos")
    .select("id")
    .eq("id", documentoId)
    .maybeSingle();
  if (!existe.data) return { ok: false, erro: "Documento não encontrado." };
  const path = `kit/${documentoId}/${randomBytes(6).toString("hex")}-${nomeSeguro(nome)}`;
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET_COMERCIAL)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("link de envio do kit", error);
    return {
      ok: false,
      erro: "Não foi possível preparar o envio. Tente de novo.",
    };
  }
  return { ok: true, url: data.signedUrl, path: data.path };
}

/**
 * Depois do envio: confere o arquivo no bucket e grava. Com `versaoId`, o
 * arquivo entra na versão que ainda não tinha arquivo; com `versao`, vira
 * a versão nova e a anterior fica no histórico.
 */
export async function registrarArquivoKit(entrada: {
  documentoId: string;
  path: string;
  nome: string;
  versaoId?: string;
  versao?: z.input<typeof metaVersao>;
}): Promise<EstadoAcao> {
  const e = z
    .object({
      documentoId: z.uuid(),
      path: z.string().max(400),
      nome: z.string().min(1).max(255),
      versaoId: z.uuid().optional(),
      versao: metaVersao.optional(),
    })
    .safeParse(entrada);
  if (!e.success) return { erro: primeiroErro(e.error) };
  if (!(await podeAgora("comercial.kit.editar")))
    return { erro: SEM_PERMISSAO };
  const { documentoId, path, nome, versaoId, versao } = e.data;
  if (
    !path.startsWith(`kit/${documentoId}/`) ||
    !/^[a-z0-9._-]+$/.test(path.slice(`kit/${documentoId}/`.length)) ||
    (!versaoId && !versao)
  )
    return { erro: "Arquivo inválido." };

  const storage = createAdminClient().storage.from(BUCKET_COMERCIAL);
  const descartar = async (erro: string): Promise<EstadoAcao> => {
    await storage.remove([path]);
    return { erro };
  };
  const info = await storage.info(path);
  if (info.error || !info.data)
    return { erro: "O arquivo não chegou. Tente enviar de novo." };
  const tamanho = info.data.size ?? 0;
  if (tamanho > ARQUIVO_MAX_BYTES) return descartar("Arquivo maior que 25 MB.");
  const arquivo = { arquivo_path: path, arquivo_nome: nome, tamanho };
  const db = await com();

  if (versaoId) {
    const { data, error } = await db
      .from("kit_versoes")
      .update(arquivo)
      .eq("id", versaoId)
      .eq("documento_id", documentoId)
      .is("arquivo_path", null)
      .select("id");
    if (error) return descartar(erroDoBanco(error, "registrar o arquivo"));
    if (!data?.length)
      return descartar(
        "Esta versão já tem arquivo. Use “Subir nova versão” para trocar.",
      );
    refresh();
    return { ok: "Arquivo enviado." };
  }

  const { error } = await db.from("kit_versoes").insert({
    documento_id: documentoId,
    ...(versao as z.output<typeof metaVersao>),
    ...arquivo,
  });
  if (error) return descartar(erroDoBanco(error, "registrar a versão"));
  refresh();
  return {
    ok: "Versão nova no kit. A anterior ficou guardada no histórico.",
  };
}

// ---------------------------------------------------------------------------
// Dados do documento e validade da versão atual
// ---------------------------------------------------------------------------

const lista = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(/[,;\n]/)
    .map((b) => b.trim())
    .filter(Boolean);

export async function editarDocumentoKit(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = z
    .object({
      id: z.uuid(),
      documento: metaDocumento,
      ativo: z.boolean(),
      versaoId: z.uuid().nullable(),
      validade: dia,
    })
    .safeParse({
      id: form.get("id"),
      documento: {
        nome: form.get("nome"),
        categoria: form.get("categoria"),
        blocos: lista(form.get("blocos")),
        todoContrato: form.get("todo_contrato") === "sim",
      },
      ativo: form.get("ativo") !== "nao",
      versaoId: form.get("versao_id") || null,
      validade: form.get("validade") || null,
    });
  if (!e.success) return { erro: primeiroErro(e.error) };
  const { id, documento: d, ativo, versaoId, validade } = e.data;
  if (!(await categoriaValida(d.categoria)))
    return { erro: "Categoria fora da lista." };
  const db = await com();
  const doc = await db
    .from("kit_documentos")
    .update({
      nome: d.nome,
      categoria: d.categoria,
      blocos: d.blocos,
      todo_contrato: d.todoContrato,
      ativo,
    })
    .eq("id", id)
    .select("id");
  if (doc.error) return { erro: erroDoBanco(doc.error, "salvar o documento") };
  if (!doc.data?.length) return { erro: SEM_PERMISSAO };
  if (versaoId) {
    const v = await db
      .from("kit_versoes")
      .update({ validade })
      .eq("id", versaoId)
      .eq("documento_id", id)
      .eq("atual", true);
    if (v.error) return { erro: erroDoBanco(v.error, "salvar a validade") };
  }
  refresh();
  return { ok: "Documento salvo." };
}
