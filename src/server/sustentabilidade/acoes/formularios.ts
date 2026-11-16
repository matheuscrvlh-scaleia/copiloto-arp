"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";
import {
  aplicarOperacao,
  errosParaPublicar,
  explicarErroDoBanco,
  MARCO_DESCARTADO,
  operacaoSchema,
  SEM_EXCLUIR,
  tiposDoFormulario,
  tiradosDaPublicada,
} from "@/lib/sustentabilidade/editor-operacoes";
import {
  type Alteracao,
  restaurarVersao,
} from "@/lib/sustentabilidade/formulario/editor";
import {
  type DefinicaoFormulario,
  definicaoSchema,
} from "@/lib/sustentabilidade/formulario/tipos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { registrarDepois } from "@/server/logs";
import { MODULO, su } from "../base";
import {
  definicaoPublicada,
  type Formulario,
  formulario,
  indicadoresDoFormulario,
  lerDefinicao,
  permissaoDoFormulario,
  usoDoFormulario,
} from "../formularios";

// Gravações do editor dos formulários específicos (spec 4.13) e da lista de
// formulários de um programa (4.8). Tudo pela sessão (o RLS confere de
// novo). Cada mudança do rascunho reaplica a regra pura sobre o rascunho
// que está no banco (nunca o que a tela mandou), grava com a versão
// otimista (`atualizado_em`: se outra pessoa gravou antes, nada muda e a
// tela recarrega) e deixa uma linha em formulario_alteracoes.

export interface RespostaEditor {
  ok?: true;
  erro?: string;
  /** Não pode excluir, mas pode inativar: a tela oferece "Inativar". */
  podeInativar?: boolean;
  /** O que mostrar depois (indicadores afetados, dependentes). */
  avisos?: string[];
  /** Conferência antes de publicar: a lista do que corrigir. */
  erros?: string[];
  versao?: number;
}

export interface RespostaFormulario {
  ok?: true;
  erro?: string;
  id?: string;
}

const EXCLUIR = "sustentabilidade.formularios.excluir";
const CONFLITO =
  "Outra pessoa alterou este formulário enquanto você editava. A tela foi atualizada com o rascunho mais recente: confira e faça a alteração de novo.";
const ERRO_BANCO = "Não foi possível gravar. Tente de novo.";
const uuid = z.uuid();
const nomeSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do formulário.")
  .max(120, "Use até 120 caracteres no nome.");

function semPermissao(tipo: Formulario["tipo"]): string {
  return tipo === "questionario"
    ? "Você não tem permissão para editar o questionário."
    : "Você não tem permissão para gerenciar os formulários dos programas.";
}

function invalidar() {
  updateTag(TAG.sustentabilidade.formularios);
  refresh();
}

/** O formulário, se existe e a pessoa pode editá-lo agora. */
async function carregar(id: unknown): Promise<Formulario | { erro: string }> {
  const ok = uuid.safeParse(id);
  if (!ok.success) return { erro: "Formulário inválido." };
  const f = await formulario(ok.data);
  if (!f) return { erro: "Formulário não encontrado." };
  if (!(await podeAgora(permissaoDoFormulario(f.tipo))))
    return { erro: semPermissao(f.tipo) };
  return f;
}

async function registrar(formularioId: string, a: Alteracao) {
  const { error } = await (await su()).from("formulario_alteracoes").insert({
    formulario_id: formularioId,
    descricao: a.descricao.slice(0, 500),
    antes: (a.antes ?? null) as Json,
    depois: (a.depois ?? null) as Json,
  });
  // O rascunho já mudou; sem o registro, fica o aviso no log do servidor.
  if (error) console.error("registro da alteração do formulário", error);
}

/** Grava o rascunho só se ninguém gravou depois de `atualizadoEm`. */
async function gravarRascunho(
  f: Formulario,
  atualizadoEm: string,
  rascunho: DefinicaoFormulario,
  alteracao: Alteracao,
  alterado = true,
): Promise<RespostaEditor> {
  const { data, error } = await (await su())
    .from("formularios")
    .update({ rascunho: rascunho as Json, rascunho_alterado: alterado })
    .eq("id", f.id)
    .eq("atualizado_em", atualizadoEm)
    .select("id");
  if (error) {
    console.error("rascunho do formulário", error);
    return { erro: ERRO_BANCO };
  }
  if (!data.length) {
    refresh();
    return { erro: CONFLITO };
  }
  await registrar(f.id, alteracao);
  invalidar();
  return { ok: true };
}

// ---------------------------------------------------------------- rascunho

const alterarSchema = z.object({
  formularioId: uuid,
  atualizadoEm: z.string().min(1),
  operacao: operacaoSchema,
});

/** Uma operação do editor (criar, editar, mover, inativar, excluir...). */
export async function alterarRascunho(
  entrada: z.input<typeof alterarSchema>,
): Promise<RespostaEditor> {
  const e = alterarSchema.safeParse(entrada);
  if (!e.success) return { erro: "Dados inválidos. Recarregue a tela." };
  const f = await carregar(e.data.formularioId);
  if ("erro" in f) return f;
  if (f.atualizado_em !== e.data.atualizadoEm) {
    refresh();
    return { erro: CONFLITO };
  }

  const [uso, indicadores] = await Promise.all([
    usoDoFormulario(f.id),
    indicadoresDoFormulario(f),
  ]);
  const r = aplicarOperacao(
    f.rascunho,
    e.data.operacao,
    {
      uso,
      indicadoresPorCampo: indicadores.todos,
      novoId: randomUUID,
      programa: f.tipo === "programa",
    },
    tiposDoFormulario(f.tipo),
  );
  if ("erro" in r) return { erro: r.erro, podeInativar: r.podeInativar };
  const nova = definicaoSchema.safeParse(r.definicao);
  if (!nova.success)
    return { erro: "A alteração deixaria o formulário inválido." };

  if (f.versao_publicada > 0) {
    const { definicao } = await definicaoPublicada(f.id);
    if (
      tiradosDaPublicada(definicao, nova.data).length &&
      !(await podeAgora(EXCLUIR))
    )
      return { erro: SEM_EXCLUIR, podeInativar: true };
  }

  const g = await gravarRascunho(
    f,
    e.data.atualizadoEm,
    nova.data,
    r.alteracao,
  );
  return g.ok ? { ok: true, avisos: r.avisos } : g;
}

const versaoOtimista = z.object({
  formularioId: uuid,
  atualizadoEm: z.string().min(1),
});

/** Volta o rascunho à versão publicada (com registro no log). */
export async function descartarRascunho(
  entrada: z.input<typeof versaoOtimista>,
): Promise<RespostaEditor> {
  const e = versaoOtimista.safeParse(entrada);
  if (!e.success) return { erro: "Dados inválidos. Recarregue a tela." };
  const f = await carregar(e.data.formularioId);
  if ("erro" in f) return f;
  if (!f.versao_publicada)
    return { erro: "Ainda não há versão publicada para onde voltar." };
  if (!f.rascunho_alterado) return { erro: "Não há alterações a descartar." };
  const { versao, definicao } = await definicaoPublicada(f.id);
  return gravarRascunho(
    f,
    e.data.atualizadoEm,
    definicao,
    {
      descricao: `Rascunho descartado: voltou à versão ${versao} publicada`,
      antes: f.rascunho,
      depois: { ...MARCO_DESCARTADO, versao },
    },
    false,
  );
}

/** Versão antiga como novo rascunho (o que não existia nela entra inativo). */
export async function restaurarComoRascunho(
  entrada: z.input<typeof versaoOtimista> & { versao: number },
): Promise<RespostaEditor> {
  const e = versaoOtimista
    .extend({ versao: z.number().int().positive() })
    .safeParse(entrada);
  if (!e.success) return { erro: "Dados inválidos. Recarregue a tela." };
  const f = await carregar(e.data.formularioId);
  if ("erro" in f) return f;
  const antiga = await lerVersaoDoBanco(f.id, e.data.versao);
  if (!antiga) return { erro: "Versão não encontrada." };
  return gravarRascunho(
    f,
    e.data.atualizadoEm,
    restaurarVersao(antiga, f.rascunho),
    {
      descricao: `Rascunho criado a partir da versão ${e.data.versao} (o que não existia nela ficou inativo)`,
      antes: null,
      depois: { versao: e.data.versao },
    },
  );
}

async function lerVersaoDoBanco(
  formularioId: string,
  versao: number,
): Promise<DefinicaoFormulario | null> {
  const { data, error } = await (await su())
    .from("formulario_versoes")
    .select("definicao")
    .eq("formulario_id", formularioId)
    .eq("versao", versao)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler o banco: ${error.message}`);
  return data ? lerDefinicao(data.definicao) : null;
}

/** Definição de uma versão, para abrir só para leitura. */
export async function lerVersao(
  formularioId: string,
  versao: number,
): Promise<{ definicao?: DefinicaoFormulario; erro?: string }> {
  const f = await carregar(formularioId);
  if ("erro" in f) return f;
  if (!Number.isInteger(versao) || versao < 1)
    return { erro: "Versão inválida." };
  const definicao = await lerVersaoDoBanco(f.id, versao);
  return definicao ? { definicao } : { erro: "Versão não encontrada." };
}

// ---------------------------------------------------------------- publicar

const publicarSchema = versaoOtimista.extend({
  resumo: z
    .string()
    .trim()
    .min(1, "Escreva um resumo do que mudou nesta versão.")
    .max(500, "Use até 500 caracteres no resumo."),
});

/**
 * Confere (4.13: sem texto, opções, regra, indicador) e, sem erro, cria a
 * versão N + 1 com `publicar_formulario`, que recusa de novo o que tiraria
 * pergunta ou opção com uso.
 */
export async function publicarFormulario(
  entrada: z.input<typeof publicarSchema>,
): Promise<RespostaEditor> {
  const e = publicarSchema.safeParse(entrada);
  if (!e.success)
    return { erro: e.error.issues[0]?.message ?? "Dados inválidos." };
  const f = await carregar(e.data.formularioId);
  if ("erro" in f) return f;
  if (f.atualizado_em !== e.data.atualizadoEm) {
    refresh();
    return { erro: CONFLITO };
  }
  if (f.versao_publicada && !f.rascunho_alterado)
    return { erro: "Não há alterações para publicar." };

  const [indicadores, publicada] = await Promise.all([
    indicadoresDoFormulario(f),
    definicaoPublicada(f.id),
  ]);
  const erros = errosParaPublicar(f.rascunho, indicadores.ativos, f.tipo);
  if (erros.length) return { erro: "Corrija antes de publicar.", erros };

  const { data, error } = await (await su()).rpc("publicar_formulario", {
    p_id: f.id,
    p_resumo: e.data.resumo,
  });
  if (error) {
    if (["23503", "42501", "22023", "P0001"].includes(error.code))
      return {
        erro: explicarErroDoBanco(error.message, [
          f.rascunho,
          publicada.definicao,
        ]),
      };
    console.error("publicar formulário", error);
    return { erro: "Não foi possível publicar. Tente de novo." };
  }
  invalidar();
  const usuario = await usuarioAtual();
  registrarDepois({
    modulo: MODULO,
    evento: "sustentabilidade_formulario_publicado",
    descricao: `${f.nome}: versão ${data} publicada`,
    usuarioId: usuario.id,
    detalhes: { formulario_id: f.id, versao: data, resumo: e.data.resumo },
  });
  return { ok: true, versao: data };
}

// ---------------------------------------------------------------- lista do programa

const GERENCIAR = "sustentabilidade.programas.gerenciar";

function secaoInicial(): DefinicaoFormulario {
  return {
    secoes: [{ id: randomUUID(), nome: "Campos", ativa: true, perguntas: [] }],
  };
}

/** Novo formulário do programa, sem versão (ganha a 1 ao publicar). */
export async function criarFormularioDePrograma(
  programaId: string,
  nome: string,
): Promise<RespostaFormulario> {
  const p = uuid.safeParse(programaId);
  const n = nomeSchema.safeParse(nome);
  if (!p.success) return { erro: "Programa inválido." };
  if (!n.success) return { erro: n.error.issues[0]?.message };
  if (!(await podeAgora(GERENCIAR))) return { erro: semPermissao("programa") };
  const { data, error } = await (await su())
    .from("formularios")
    .insert({
      tipo: "programa",
      programa_id: p.data,
      nome: n.data,
      rascunho: secaoInicial() as Json,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23503") return { erro: "Programa não encontrado." };
    console.error("criar formulário", error);
    return { erro: ERRO_BANCO };
  }
  await registrar(data.id, {
    descricao: `Formulário "${n.data}" criado`,
    antes: null,
    depois: { nome: n.data },
  });
  invalidar();
  return { ok: true, id: data.id };
}

export async function renomearFormulario(
  id: string,
  nome: string,
): Promise<RespostaFormulario> {
  const n = nomeSchema.safeParse(nome);
  if (!n.success) return { erro: n.error.issues[0]?.message };
  const f = await carregar(id);
  if ("erro" in f) return f;
  if (f.nome === n.data) return { ok: true, id: f.id };
  const { data, error } = await (await su())
    .from("formularios")
    .update({ nome: n.data })
    .eq("id", f.id)
    .select("id");
  if (error) {
    console.error("renomear formulário", error);
    return { erro: ERRO_BANCO };
  }
  if (!data.length) return { erro: semPermissao(f.tipo) };
  invalidar();
  return { ok: true, id: f.id };
}

/** Cópia como rascunho novo: sem versão e sem lançamentos. */
export async function duplicarFormulario(
  id: string,
): Promise<RespostaFormulario> {
  const f = await carregar(id);
  if ("erro" in f) return f;
  if (f.tipo !== "programa")
    return { erro: "O questionário da entrevista é um só e não é duplicado." };
  const nome = `${f.nome} (cópia)`.slice(0, 120);
  const { data, error } = await (await su())
    .from("formularios")
    .insert({
      tipo: "programa",
      programa_id: f.programa_id,
      nome,
      rascunho: f.rascunho as Json,
      rascunho_alterado: true,
    })
    .select("id")
    .single();
  if (error) {
    console.error("duplicar formulário", error);
    return { erro: ERRO_BANCO };
  }
  await registrar(data.id, {
    descricao: `Criado como cópia de "${f.nome}" (rascunho atual dele)`,
    antes: null,
    depois: { origem: f.id },
  });
  invalidar();
  return { ok: true, id: data.id };
}

/** Inativo some do link do parceiro e da tela de lançamento; nada se apaga. */
export async function alternarFormularioAtivo(
  id: string,
  ativo: boolean,
): Promise<RespostaFormulario> {
  const f = await carregar(id);
  if ("erro" in f) return f;
  if (f.tipo !== "programa")
    return { erro: "O questionário da entrevista não pode ser inativado." };
  if (f.ativo === ativo) return { ok: true, id: f.id };
  const { data, error } = await (await su())
    .from("formularios")
    .update({ ativo: Boolean(ativo) })
    .eq("id", f.id)
    .select("id");
  if (error) {
    console.error("ativar formulário", error);
    return { erro: ERRO_BANCO };
  }
  if (!data.length) return { erro: semPermissao(f.tipo) };
  invalidar();
  return { ok: true, id: f.id };
}

/** Só sem lançamentos, sem indicador e com "Formulários específicos – excluir". */
export async function excluirFormulario(
  id: string,
): Promise<RespostaFormulario> {
  const f = await carregar(id);
  if ("erro" in f) return f;
  if (f.tipo !== "programa")
    return { erro: "O questionário da entrevista não pode ser excluído." };
  if (!(await podeAgora(EXCLUIR)))
    return {
      erro: "Excluir formulário exige a permissão “Formulários específicos – excluir”. Sem ela, inative o formulário: ele some do link e da tela de lançamento, e nada se apaga.",
    };
  const db = await su();
  const [lancamentos, indicadores] = await Promise.all([
    db
      .from("lancamentos")
      .select("id", { count: "exact", head: true })
      .eq("formulario_id", f.id),
    db.from("programa_indicadores").select("nome").eq("formulario_id", f.id),
  ]);
  if (lancamentos.error || indicadores.error) {
    console.error("excluir formulário", lancamentos.error ?? indicadores.error);
    return { erro: ERRO_BANCO };
  }
  const n = lancamentos.count ?? 0;
  if (n)
    return {
      erro: `"${f.nome}" já tem ${n.toLocaleString("pt-BR")} ${n === 1 ? "lançamento" : "lançamentos"}. Para não perder o histórico, só pode ser inativado.`,
    };
  if (indicadores.data.length)
    return {
      erro: `"${f.nome}" é usado pelos indicadores ${indicadores.data.map((i) => i.nome).join(", ")}. Ajuste esses indicadores (aba Indicadores) antes de excluir, ou inative o formulário.`,
    };
  const { data, error } = await db
    .from("formularios")
    .delete()
    .eq("id", f.id)
    .select("id");
  if (error) {
    if (error.code === "23503")
      return {
        erro: `"${f.nome}" já tem lançamentos. Para não perder o histórico, só pode ser inativado.`,
      };
    console.error("excluir formulário", error);
    return { erro: ERRO_BANCO };
  }
  if (!data.length) return { erro: semPermissao(f.tipo) };
  invalidar();
  return { ok: true, id: f.id };
}
