"use server";

import { refresh, updateTag } from "next/cache";
import type { EstadoAcao } from "@/components/form-acao";
import {
  camposDoForm,
  ESQUEMAS,
  ehGrupo,
  esquemaUnidade,
  GRUPOS,
  ROTULOS_PARAMETROS,
  ROTULOS_UNIDADE,
} from "@/lib/operacoes/parametros";
import type { Database } from "@/lib/supabase/database.types";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { contextoOp, op, opAdmin } from "@/server/operacoes/base";

// Operações › Parâmetros (spec 4.12): cada grupo salva só as colunas dele,
// pelo RLS (operacoes.parametros edita). O gatilho de auditoria guarda quem
// mudou, quando, o antes e o depois; o cache dos parâmetros é invalidado.

type Atualizar = Database["operacoes"]["Tables"]["parametros"]["Update"];

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar os parâmetros de Operações.",
};

export async function salvarParametros(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await contextoOp();
  if (!ctx.pode("operacoes.parametros")) return SEM_PERMISSAO;
  const grupo = form.get("grupo");
  if (!ehGrupo(grupo)) return { erro: "Grupo de parâmetros inválido." };
  const d = ESQUEMAS[grupo].safeParse(camposDoForm(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_PARAMETROS);
  const linha = {
    ...(d.data as Record<string, unknown>),
    atualizado_por: ctx.usuario.id,
  } as Atualizar; // o esquema do grupo validou cada coluna
  const { data, error } = await (await op())
    .from("parametros")
    .update(linha)
    .eq("id", true)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return SEM_PERMISSAO;
  updateTag(TAG.operacoes.parametros);
  refresh();
  return { ok: `${GRUPOS[grupo]}: salvo.` };
}

/** Apaga tudo o que foi marcado "exemplo" (operacoes.remover_exemplos). */
export async function removerExemplos(
  _: EstadoAcao,
  _form: FormData,
): Promise<EstadoAcao> {
  const ctx = await contextoOp();
  if (!ctx.pode("operacoes.parametros")) return SEM_PERMISSAO;
  const { error } = await (await op()).rpc("remover_exemplos");
  if (error) return erroDoBanco(error);
  refresh();
  return {
    ok: "Dados de exemplo removidos. As telas passam a mostrar só os dados reais.",
  };
}

/**
 * Unidade consumidora: cria (matrícula nova) ou altera endereço, apelido,
 * papel e se está ativa. Grava pela service role depois de conferir no banco
 * a mesma permissão das políticas de gravação (operacoes.parametros).
 */
export async function salvarUnidade(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("operacoes.parametros"))) return SEM_PERMISSAO;
  const d = esquemaUnidade.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_UNIDADE);
  const nova = form.get("nova") === "1";
  const db = opAdmin().from("energia_unidades");
  const { matricula, ...dados } = d.data;
  const { data, error } = nova
    ? await db.insert({ matricula, ...dados }).select("matricula")
    : await db.update(dados).eq("matricula", matricula).select("matricula");
  if (error) {
    if (error.code === "23505")
      return { erro: `A matrícula ${matricula} já está cadastrada.` };
    return erroDoBanco(error);
  }
  if (!data?.length) return { erro: "Unidade não encontrada." };
  refresh();
  return { ok: nova ? `Unidade ${matricula} cadastrada.` : "Unidade salva." };
}
