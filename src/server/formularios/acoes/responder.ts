"use server";

import { randomUUID } from "node:crypto";
import {
  type ArquivoEnviado,
  LIMITES,
  titulosDasPerguntas,
  validarRespostas,
} from "@/lib/formularios/campos";
import type { MotivoFechado } from "@/lib/formularios/formulario";
import { BYTES_DO_TIPO } from "@/lib/os/tipo-arquivo";
import type { Json } from "@/lib/supabase/database.types";
import { gravarArquivo } from "@/server/arquivos";
import {
  assinar,
  BUCKET_FORMULARIOS,
  conferirAssinatura,
  tipoDoArquivo,
} from "../arquivos";
import { formularioPeloToken, frmAdmin, tokenValido } from "../base";

// Quem responde pelo link (sem login): o token e as respostas são
// conferidos aqui, contra as perguntas atuais, e a gravação passa por
// formularios.responder() (service role), que confere de novo a situação,
// a data e o limite com a linha travada. Arquivo sobe antes, um por vez,
// e volta assinado; o envio final só aceita arquivo assinado.

export interface EstadoDoEnvio {
  erro?: string;
  /** Mensagem por pergunta (id → texto). */
  erros?: Record<string, string>;
  enviado?: boolean;
  fechado?: MotivoFechado;
}

const MENSAGEM_FECHADO: Record<MotivoFechado, string> = {
  inexistente: "Este link não existe. Confira o endereço que você recebeu.",
  rascunho: "Este formulário ainda não está aberto para respostas.",
  encerrado: "Este formulário não recebe mais respostas.",
};

/** "Enviar" do formulário público. */
export async function responderPeloLink(
  _: EstadoDoEnvio,
  form: FormData,
): Promise<EstadoDoEnvio> {
  const token = String(form.get("token") ?? "");
  if (!tokenValido(token))
    return { erro: MENSAGEM_FECHADO.inexistente, fechado: "inexistente" };
  // Campo escondido que pessoa não preenche; robô costuma preencher.
  // atalho: sem limite de envios por IP; se aparecer spam, pôr captcha.
  if (String(form.get("site") ?? "") !== "") return { enviado: true };

  const bruto = String(form.get("respostas") ?? "");
  if (bruto.length > 200_000) return { erro: "Respostas grandes demais." };
  let entrada: unknown;
  try {
    entrada = JSON.parse(bruto);
  } catch {
    return { erro: "Não foi possível ler as respostas. Recarregue a página." };
  }
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada))
    return { erro: "Não foi possível ler as respostas. Recarregue a página." };

  const acesso = await formularioPeloToken(token);
  if ("motivo" in acesso)
    return { erro: MENSAGEM_FECHADO[acesso.motivo], fechado: acesso.motivo };
  const { campos, id } = acesso.formulario;
  const { respostas, erros } = validarRespostas(
    campos,
    entrada as Record<string, unknown>,
    conferirAssinatura(id),
  );
  if (Object.keys(erros).length)
    return { erro: "Confira as perguntas marcadas.", erros };

  const { error } = await frmAdmin().rpc("responder", {
    p_token: token,
    p_respostas: respostas as Json,
    p_perguntas: titulosDasPerguntas(campos) as Json,
  });
  if (error) {
    if (error.code === "P0001")
      return { erro: MENSAGEM_FECHADO.encerrado, fechado: "encerrado" };
    if (error.code === "P0002")
      return { erro: MENSAGEM_FECHADO.inexistente, fechado: "inexistente" };
    console.error("resposta do formulário", error);
    return { erro: "Não foi possível enviar. Tente de novo." };
  }
  return { enviado: true };
}

export interface EstadoDoArquivo {
  erro?: string;
  arquivo?: ArquivoEnviado;
}

/**
 * Sobe um arquivo de uma pergunta "Envio de arquivo" com o formulário
 * aberto. Volta caminho, nome, tamanho, tipo e a assinatura que o envio
 * final confere.
 */
export async function enviarArquivoPeloLink(
  form: FormData,
): Promise<EstadoDoArquivo> {
  const token = String(form.get("token") ?? "");
  if (!tokenValido(token)) return { erro: MENSAGEM_FECHADO.inexistente };
  const acesso = await formularioPeloToken(token);
  if ("motivo" in acesso) return { erro: MENSAGEM_FECHADO[acesso.motivo] };
  const { id, campos } = acesso.formulario;
  const campo = campos.find(
    (c) => c.id === String(form.get("campo") ?? "") && c.tipo === "arquivo",
  );
  if (!campo) return { erro: "Pergunta não encontrada. Recarregue a página." };

  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha o arquivo." };
  if (arquivo.size > LIMITES.arquivoMb * 1024 * 1024)
    return { erro: `Arquivo maior que ${LIMITES.arquivoMb} MB.` };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoDoArquivo(arquivo.name, bytes.slice(0, BYTES_DO_TIPO));
  if (!tipo)
    return {
      erro: "Envie PDF, foto (JPG, PNG, WEBP ou HEIC), Word ou Excel.",
    };

  const caminho = `${id}/${randomUUID()}.${tipo.ext}`;
  // atalho: arquivo que sobe e não é enviado no formulário fica no bucket.
  try {
    await gravarArquivo(BUCKET_FORMULARIOS, caminho, bytes, tipo.tipo);
  } catch (error) {
    console.error("arquivo do formulário", id, error);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  const base = arquivo.name.replace(/\.[^.]*$/, "");
  const nome = `${
    base.replace(/[^\p{L}\p{N} ._()-]/gu, "").slice(0, 100) || "arquivo"
  }.${tipo.ext}`;
  const dados = { caminho, nome, tamanho: arquivo.size, tipo: tipo.tipo };
  return { arquivo: { ...dados, assinatura: assinar(dados) } };
}
