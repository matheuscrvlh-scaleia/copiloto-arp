"use server";

import {
  titulosDasPerguntas,
  validarRespostas,
} from "@/lib/formularios/campos";
import type { MotivoFechado } from "@/lib/formularios/formulario";
import type { Json } from "@/lib/supabase/database.types";
import { formularioPeloToken, frmAdmin, tokenValido } from "../base";

// Quem responde pelo link (sem login): o token e as respostas são
// conferidos aqui, contra as perguntas atuais, e a gravação passa por
// formularios.responder() (service role), que confere de novo a situação,
// a data e o limite com a linha travada.

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
  const { campos } = acesso.formulario;
  const { respostas, erros } = validarRespostas(
    campos,
    entrada as Record<string, unknown>,
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
