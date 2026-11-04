"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  type ContextoFeedbacks,
  chaveDoFeedback,
  type FeedbackLido,
  lerFeedbacks,
} from "@/lib/comercial/feedbacks-importacao";
import type {
  Aba,
  EstadoConfirmacao,
  EstadoPrevia,
  TipoImportacao,
} from "@/lib/comercial/importacao";
import { usuarioAtual } from "@/server/auth";
import { com, listas } from "@/server/comercial/base";
import {
  confirmarImportacao,
  ErroImportacao,
  type Gravacao,
  logImportacao,
  podeImportar,
  prepararPrevia,
} from "@/server/comercial/importacoes";

// Importações de Comercial › Configurações: os Feedbacks antigos (aba
// Feedbacks → registros de contato de um tipo marcado como feedback) e o
// "Desfazer" do histórico, que vale para os quatro tipos. Censo, Fichas e
// Pesquisa têm as ações nos próprios módulos (acoes/censo, fichas, pesquisa).

/** Listas e contatos que já existem (para conferir tipo, canal e repetidos). */
async function contextoFeedbacks(): Promise<ContextoFeedbacks> {
  const [todas, existentes] = await Promise.all([
    listas(),
    (await com())
      .from("contatos")
      .select("data, locatario_nome, descricao")
      .order("data", { ascending: false })
      // atalho: confere repetidos só nos 5.000 contatos mais recentes
      .limit(5000),
  ]);
  const ativos = (lista: string) =>
    todas.filter((l) => l.lista === lista && l.ativo);
  return {
    tiposFeedback: ativos("tipo_contato")
      .filter((l) => (l.extra as Record<string, unknown>)?.feedback === true)
      .map((l) => l.valor),
    canais: ativos("canal_contato").map((l) => l.valor),
    existentes: new Set((existentes.data ?? []).map((c) => chaveDoFeedback(c))),
  };
}

const lerFeedbacksDoArquivo = async (abas: Aba[]) =>
  lerFeedbacks(abas, await contextoFeedbacks());

const gravarFeedbacks: Gravacao<FeedbackLido> = async (linhas, ctx) => {
  if (!linhas.length)
    throw new ErroImportacao("Nenhum registro novo para importar.");
  const { data, error } = await (await com())
    .from("contatos")
    .insert(
      linhas.map(({ dados }) => ({
        ...dados,
        registrado_por: ctx.usuarioId,
        importacao_id: ctx.importacaoId,
      })),
    )
    .select("id");
  if (error) {
    if (error.code === "42501")
      throw new ErroImportacao(
        "Você não tem permissão para registrar contatos de locatários.",
      );
    throw error;
  }
  return data?.length ?? 0;
};

export async function previaImportacaoFeedbacks(
  _: EstadoPrevia,
  form: FormData,
): Promise<EstadoPrevia> {
  return prepararPrevia("contatos", form, lerFeedbacksDoArquivo);
}

export async function confirmarImportacaoFeedbacks(
  _: EstadoConfirmacao,
  form: FormData,
): Promise<EstadoConfirmacao> {
  return confirmarImportacao(
    "contatos",
    form,
    lerFeedbacksDoArquivo,
    gravarFeedbacks,
  );
}

// ---------------------------------------------------------------------------
// Desfazer (qualquer tipo): apaga as linhas que a importação trouxe
// ---------------------------------------------------------------------------

export async function desfazerImportacao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Importação inválida." };
  const banco = await com();
  const { data: imp } = await banco
    .from("importacoes")
    .select("id, tipo, status")
    .eq("id", id.data)
    .maybeSingle();
  if (!imp) return { erro: "Importação não encontrada." };
  if (!(await podeImportar(imp.tipo as TipoImportacao)))
    return { erro: "Você não tem permissão para desfazer esta importação." };
  if (imp.status !== "confirmada")
    return { erro: "Só uma importação confirmada pode ser desfeita." };
  const { data: apagadas, error } = await banco.rpc("desfazer_importacao", {
    p_id: id.data,
  });
  if (error) {
    if (error.code === "42501")
      return { erro: "Você não tem permissão para desfazer esta importação." };
    if (error.code === "22023") return { erro: error.message };
    console.error("desfazer importação", error);
    return { erro: "Não foi possível desfazer. Nada foi alterado." };
  }
  refresh();
  logImportacao(
    "desfeita",
    imp.tipo as TipoImportacao,
    id.data,
    (await usuarioAtual()).id,
    { apagadas },
  );
  return {
    ok: `Importação desfeita: ${apagadas ?? 0} registro(s) removido(s).`,
  };
}
