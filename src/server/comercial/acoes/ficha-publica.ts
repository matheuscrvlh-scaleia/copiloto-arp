"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import {
  avisosDoEnvio,
  documentoDaFicha,
  documentosFaltando,
  limparPorTipo,
  lucDaFicha,
  nomeDaFicha,
  type Problema,
  problemasDoEnvio,
  ROTULO_TIPO_CURTO,
  respostasSchema,
  TIPOS_FICHA,
} from "@/lib/comercial/ficha";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { BYTES_DO_TIPO, tipoPeloConteudo } from "@/lib/os/tipo-arquivo";
import { createAdminClient } from "@/lib/supabase/admin";
import { comAdmin } from "@/server/comercial/base";
import {
  BUCKET_COMERCIAL,
  documentosDoLink,
  type FichaDoLink,
  fichaPeloToken,
  type MotivoInativo,
  rotaDaFicha,
} from "@/server/comercial/fichas";
import { notificar } from "@/server/os/base";

// Ficha cadastral pelo link (sem login): "Salvar e continuar depois",
// "Enviar ficha" e os documentos comprobatórios. Cada ação confere o token
// de novo (link vencido, cancelado ou já enviado para na hora) e grava pela
// service role só a ficha desse token. Sem o aceite da LGPD nada é gravado.

export interface EstadoDaFicha {
  ok?: string;
  erro?: string;
  /** O que falta para enviar, pergunta a pergunta. */
  problemas?: Problema[];
  /** Avisos que pedem confirmação (ex.: nome do envio diferente da 15). */
  avisos?: string[];
  /** Ficha enviada: a página mostra o agradecimento. */
  enviada?: boolean;
  /** Link parou de valer no meio do preenchimento. */
  inativo?: MotivoInativo;
}

const MENSAGEM_INATIVO: Record<MotivoInativo, string> = {
  inexistente: "Este link não existe. Confira o endereço que a ARP enviou.",
  expirada: "Este link venceu. Peça um novo link à equipe da ARP.",
  cancelada: "Este link foi cancelado pela ARP. Fale com a equipe.",
  enviada: "Esta ficha já foi enviada. Obrigado!",
};

const inativo = (motivo: MotivoInativo): EstadoDaFicha => ({
  erro: MENSAGEM_INATIVO[motivo],
  inativo: motivo,
});

const token = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/);

async function conferir(
  form: FormData,
): Promise<{ ficha: FichaDoLink } | { estado: EstadoDaFicha }> {
  const t = token.safeParse(form.get("token"));
  if (!t.success) return { estado: inativo("inexistente") };
  const acesso = await fichaPeloToken(t.data);
  return acesso.ok
    ? { ficha: acesso.ficha }
    : { estado: inativo(acesso.motivo) };
}

const FALHOU: EstadoDaFicha = {
  erro: "Não foi possível salvar. Tente de novo.",
};
const SEM_ACEITE: EstadoDaFicha = {
  erro: "Sem o aceite do termo da LGPD (pergunta 2) não é possível seguir.",
  problemas: [
    {
      campo: "aceite",
      pergunta: 2,
      mensagem: "Marque o aceite do termo da LGPD para seguir.",
    },
  ],
};

/** "Salvar e continuar depois" (acao=salvar) ou "Enviar ficha" (acao=enviar). */
export async function salvarFichaPeloLink(
  _: EstadoDaFicha,
  form: FormData,
): Promise<EstadoDaFicha> {
  const c = await conferir(form);
  if ("estado" in c) return c.estado;
  const { ficha } = c;
  const enviar = form.get("acao") === "enviar";

  const bruto = String(form.get("respostas") ?? "");
  if (bruto.length > 200_000) return { erro: "Respostas grandes demais." };
  let json: unknown;
  try {
    json = JSON.parse(bruto);
  } catch {
    return { erro: "Não foi possível ler as respostas. Recarregue a página." };
  }
  const lidas = respostasSchema.safeParse(json);
  if (!lidas.success)
    return { erro: "Algum campo veio num formato que não dá para guardar." };
  if (!lidas.data.aceite) return SEM_ACEITE;
  const r = enviar ? limparPorTipo(lidas.data) : lidas.data;

  if (enviar) {
    const problemas = problemasDoEnvio(r, hojeEmBrasilia(new Date()));
    if (r.tipo) {
      const exigidos = (await documentosDoLink(ficha))[r.tipo];
      for (const d of documentosFaltando(
        exigidos,
        ficha.documentos.map((x) => x.documento),
      ))
        problemas.push({
          campo: `documentos.${d}`,
          pergunta: 0,
          mensagem: `Envie o arquivo: ${d}.`,
        });
    }
    if (problemas.length)
      return {
        erro:
          problemas.length === 1
            ? "Falta 1 resposta para enviar. Veja o campo marcado."
            : `Faltam ${problemas.length} respostas para enviar. Veja os campos marcados.`,
        problemas,
      };
    const avisos = avisosDoEnvio(r);
    if (avisos.length && form.get("confirmar") !== "1") return { avisos };
  }

  const agora = new Date().toISOString();
  const doc = documentoDaFicha(r);
  const { error: e1 } = await comAdmin()
    .from("ficha_dados")
    .upsert({
      ficha_id: ficha.id,
      documento: doc.length === 11 || doc.length === 14 ? doc : null,
      respostas: r,
      assinatura_nome: r.assinatura || null,
    });
  if (e1) {
    console.error("ficha pelo link (dados)", ficha.id, e1);
    return FALHOU;
  }
  const nome = nomeDaFicha(r) || ficha.nome;
  const { data, error } = await comAdmin()
    .from("fichas")
    .update({
      tipo: r.tipo || null,
      luc: lucDaFicha(r),
      nome,
      iniciada_em: ficha.iniciada ? undefined : agora,
      consentimento_em: ficha.consentimentoEm ?? agora,
      ultimo_acesso_em: agora,
      ...(enviar ? { situacao: "recebida", recebida_em: agora } : {}),
    })
    .eq("id", ficha.id)
    .eq("token", ficha.token)
    .eq("situacao", "em_preenchimento")
    .is("cancelada_em", null)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("ficha pelo link", ficha.id, error);
    return error ? FALHOU : inativo("enviada");
  }

  if (!enviar)
    return {
      ok: "Rascunho salvo. Use o mesmo link para continuar quando quiser.",
    };
  // O aviso à equipe não muda a resposta ao interessado: sai depois.
  after(() =>
    notificar([ficha.geradaPor], {
      tipo: "ficha_recebida",
      titulo: `Ficha cadastral recebida: ${nome ?? "sem nome"}`,
      texto: r.tipo ? ROTULO_TIPO_CURTO[r.tipo] : undefined,
      href: rotaDaFicha(ficha.id),
      chave: `ficha_recebida:${ficha.id}`,
    }),
  );
  return { ok: "Ficha enviada. Obrigado!", enviada: true };
}

// ---------------------------------------------------------------------------
// Documentos comprobatórios
// ---------------------------------------------------------------------------

const LIMITE_MB = 8;
const ACEITOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export interface EstadoDoDocumento {
  ok?: string;
  erro?: string;
  inativo?: MotivoInativo;
  documento?: { id: string; documento: string; arquivo_nome: string };
}

const envio = z.object({
  tipo: z.enum(TIPOS_FICHA),
  documento: z.string().trim().min(1).max(200),
  aceite: z.literal("1"),
});

/** Sobe um documento (troca o anterior do mesmo item da lista). */
export async function enviarDocumentoPeloLink(
  form: FormData,
): Promise<EstadoDoDocumento> {
  const c = await conferir(form);
  if ("estado" in c) return { erro: c.estado.erro, inativo: c.estado.inativo };
  const { ficha } = c;
  const d = envio.safeParse({
    tipo: form.get("tipo"),
    documento: form.get("documento"),
    aceite: form.get("aceite"),
  });
  if (!d.success)
    return d.error.issues[0]?.path[0] === "aceite"
      ? { erro: SEM_ACEITE.erro }
      : { erro: "Escolha o tipo de formulário antes de enviar os documentos." };
  const exigidos = (await documentosDoLink(ficha))[d.data.tipo];
  const item = exigidos.find((x) => x.documento === d.data.documento);
  if (!item) return { erro: "Documento fora da lista. Recarregue a página." };

  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha o arquivo." };
  if (arquivo.size > LIMITE_MB * 1024 * 1024)
    return {
      erro: `Arquivo maior que ${LIMITE_MB} MB. Envie uma foto ou PDF menor.`,
    };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const mime = tipoPeloConteudo(bytes.slice(0, BYTES_DO_TIPO));
  const ext = mime ? ACEITOS[mime] : undefined;
  if (!mime || !ext)
    return { erro: "Envie um PDF ou uma foto (JPG, PNG, WEBP ou HEIC)." };

  const path = `fichas/${ficha.id}/${randomUUID()}.${ext}`;
  const storage = createAdminClient().storage.from(BUCKET_COMERCIAL);
  const { error: eUp } = await storage.upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (eUp) {
    console.error("documento da ficha", ficha.id, eUp);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  const nome =
    arquivo.name.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 120) ||
    `documento.${ext}`;
  const antigos = await comAdmin()
    .from("ficha_documentos")
    .select("id, arquivo_path")
    .eq("ficha_id", ficha.id)
    .eq("documento", item.documento);
  const { data, error } = await comAdmin()
    .from("ficha_documentos")
    .insert({
      ficha_id: ficha.id,
      documento: item.documento,
      arquivo_path: path,
      arquivo_nome: nome,
      tamanho: arquivo.size,
      tipo_mime: mime,
    })
    .select("id, documento, arquivo_nome")
    .single();
  if (error) {
    console.error("documento da ficha", ficha.id, error);
    await storage.remove([path]);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  const velhos = antigos.data ?? [];
  if (velhos.length) {
    await comAdmin()
      .from("ficha_documentos")
      .delete()
      .in(
        "id",
        velhos.map((v) => v.id),
      );
    await storage.remove(velhos.map((v) => v.arquivo_path));
  }
  if (!ficha.consentimentoEm)
    await comAdmin()
      .from("fichas")
      .update({ consentimento_em: new Date().toISOString() })
      .eq("id", ficha.id)
      .is("consentimento_em", null);
  return { ok: "Arquivo enviado.", documento: data };
}

/** Tira um documento enviado pelo link. */
export async function removerDocumentoPeloLink(
  form: FormData,
): Promise<EstadoDoDocumento> {
  const c = await conferir(form);
  if ("estado" in c) return { erro: c.estado.erro, inativo: c.estado.inativo };
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Documento não encontrado." };
  const { data, error } = await comAdmin()
    .from("ficha_documentos")
    .delete()
    .eq("id", id.data)
    .eq("ficha_id", c.ficha.id)
    .select("arquivo_path");
  if (error)
    return { erro: "Não foi possível tirar o arquivo. Tente de novo." };
  if (data?.length)
    await createAdminClient()
      .storage.from(BUCKET_COMERCIAL)
      .remove(data.map((x) => x.arquivo_path));
  return { ok: "Arquivo retirado." };
}
