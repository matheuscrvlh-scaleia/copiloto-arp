"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { permissaoDoPrograma } from "@/lib/permissions";
import type { Json } from "@/lib/supabase/database.types";
import type { DefinicaoFormulario } from "@/lib/sustentabilidade/formulario/tipos";
import {
  type CustoPorPessoa,
  definicaoSemReais,
  prepararLancamento,
} from "@/lib/sustentabilidade/lancamento-valores";
import { podeAgora } from "@/server/auth";
import { contextoSu, su } from "../base";
import {
  cadastrarNomes,
  custosDoTour,
  definicaoDaVersao,
  formulariosParaLancar,
  inserirLancamento,
  lancamentoParaCorrigir,
  listasDoPrograma,
} from "../lancamentos";
import { concluirCobranca } from "../programas";

// Lançamentos dos programas pela equipe (spec 4.8): "Lançar pela equipe"
// com o mesmo formulário do parceiro, corrigir e excluir. Com a sessão (o
// RLS confere de novo); os campos em reais vão para lancamento_valores e
// só entram com "Ver valores" (sem ela, só os custos padrão do tour). A
// correção e a exclusão ficam na auditoria (gatilho).

export interface RespostaLancamento {
  ok?: string;
  erro?: string;
  /** Erro por campo ({ campo_id: mensagem }). */
  erros?: Record<string, string>;
}

const uuid = z.uuid();
const entrada = z.object({
  programaId: uuid,
  formularioId: uuid,
  versao: z.number().int().positive(),
  respostas: z.record(z.string().max(100), z.unknown()),
  data: z.string().max(10).nullish(),
});
const correcao = z.object({
  id: uuid,
  respostas: z.record(z.string().max(100), z.unknown()),
  data: z.string().max(10).nullish(),
});

const ERRO_BANCO =
  "Não foi possível gravar o lançamento. Tente de novo; se continuar, avise o administrador.";
const SEM_PERMISSAO = "Você não tem permissão para lançar neste programa.";

async function podeLancarAgora(programaId: string): Promise<boolean> {
  return (
    (await podeAgora("sustentabilidade.programas.gerenciar")) ||
    (await podeAgora(permissaoDoPrograma(programaId)))
  );
}

const tamanhoOk = (r: Record<string, unknown>) =>
  JSON.stringify(r).length <= 50_000;

/** "Lançar pela equipe": grava com origem Equipe. */
export async function lancarPelaEquipe(
  pedido: unknown,
): Promise<RespostaLancamento> {
  const e = entrada.safeParse(pedido);
  if (!e.success || !tamanhoOk(e.data.respostas))
    return {
      erro: "Lançamento inválido. Recarregue a página e tente de novo.",
    };
  const { programaId, formularioId, versao } = e.data;
  if (!(await podeLancarAgora(programaId))) return { erro: SEM_PERMISSAO };
  const db = await su();
  const { data: prog, error } = await db
    .from("programas")
    .select("ativo")
    .eq("id", programaId)
    .maybeSingle();
  if (error || !prog) return { erro: "Programa não encontrado." };
  if (!prog.ativo)
    return {
      erro: "Este programa está inativo: reative-o no cadastro para voltar a lançar.",
    };
  const form = (await formulariosParaLancar(programaId)).find(
    (f) => f.id === formularioId,
  );
  if (!form)
    return {
      erro: "Este formulário está inativo ou ainda não foi publicado. Escolha outro ou publique-o na aba Formulário.",
    };
  if (form.versao !== versao)
    return {
      erro: `O formulário foi atualizado (versão ${form.versao}). Recarregue a página e confira o lançamento.`,
    };
  const comValores = await podeAgora("sustentabilidade.valores");
  const p = prepararLancamento({
    definicao: form.definicao,
    respostas: e.data.respostas,
    comValores,
    custos: await custosDoTour(),
    data: e.data.data,
  });
  if ("erros" in p)
    return { erro: "Confira os campos marcados.", erros: p.erros };
  const { usuario } = await contextoSu();
  const id = await inserirLancamento(
    db,
    {
      programa_id: programaId,
      formulario_id: form.id,
      formulario_versao: form.versao,
      data: p.data,
      valores: p.valores,
      origem: "equipe",
      lancado_por: usuario.id,
    },
    p.reais,
  );
  if (!id) return { erro: ERRO_BANCO };
  await cadastrarNomes(db, programaId, form.definicao, p.valores);
  after(() => concluirCobranca(programaId, p.data));
  refresh();
  return { ok: "Lançamento gravado." };
}

/** Corrigir: a mesma versão do formulário do lançamento. */
export async function corrigirLancamento(
  pedido: unknown,
): Promise<RespostaLancamento> {
  const e = correcao.safeParse(pedido);
  if (!e.success || !tamanhoOk(e.data.respostas))
    return { erro: "Correção inválida. Recarregue a página e tente de novo." };
  const atual = await lancamentoParaCorrigir(e.data.id);
  if (!atual) return { erro: "Lançamento não encontrado." };
  if (!(await podeLancarAgora(atual.programaId)))
    return { erro: SEM_PERMISSAO };
  if (atual.exemplo)
    return {
      erro: "Lançamento de exemplo (fictício) não se corrige: ele sai quando os dados de exemplo forem removidos.",
    };
  const def = await definicaoDaVersao(atual.formularioId, atual.versao);
  if (!def) return { erro: "Versão do formulário não encontrada." };
  const comValores = await podeAgora("sustentabilidade.valores");
  const p = prepararLancamento({
    definicao: def,
    respostas: e.data.respostas,
    comValores,
    data: e.data.data ?? atual.data,
  });
  if ("erros" in p)
    return { erro: "Confira os campos marcados.", erros: p.erros };
  const db = await su();
  const { data, error } = await db
    .from("lancamentos")
    .update({ data: p.data, valores: p.valores as Json })
    .eq("id", atual.id)
    .select("id");
  if (error || !data.length) {
    if (error) console.error("corrigir lançamento", error);
    return { erro: ERRO_BANCO };
  }
  // Sem "Ver valores" os campos em reais ficam como estavam.
  if (comValores) {
    const r = await db
      .from("lancamento_valores")
      .upsert({ lancamento_id: atual.id, valores: p.reais as Json });
    if (r.error) {
      console.error("corrigir valores do lançamento", r.error);
      return {
        erro: "Os campos foram corrigidos, mas os valores em reais não. Tente de novo.",
      };
    }
  }
  await cadastrarNomes(db, atual.programaId, def, p.valores);
  after(() => concluirCobranca(atual.programaId, p.data));
  refresh();
  return { ok: "Lançamento corrigido." };
}

/** Excluir: fica na auditoria (quem, quando e o que era). */
export async function excluirLancamento(
  id: string,
): Promise<RespostaLancamento> {
  const e = uuid.safeParse(id);
  if (!e.success) return { erro: "Lançamento inválido." };
  const atual = await lancamentoParaCorrigir(e.data);
  if (!atual) return { erro: "Lançamento não encontrado." };
  if (!(await podeLancarAgora(atual.programaId)))
    return { erro: SEM_PERMISSAO };
  const { data, error } = await (await su())
    .from("lancamentos")
    .delete()
    .eq("id", atual.id)
    .select("id");
  if (error || !data.length) {
    if (error) console.error("excluir lançamento", error);
    return { erro: "Não foi possível excluir o lançamento." };
  }
  refresh();
  return { ok: "Lançamento excluído." };
}

export interface DadosParaCorrigir {
  erro?: string;
  definicao?: DefinicaoFormulario;
  valores?: Record<string, unknown>;
  data?: string;
  listas?: Record<string, string[]>;
  custos?: CustoPorPessoa | null;
}

/** Abre a correção: a versão usada, as respostas e as listas de cadastro. */
export async function abrirCorrecao(id: string): Promise<DadosParaCorrigir> {
  const e = uuid.safeParse(id);
  if (!e.success) return { erro: "Lançamento inválido." };
  const atual = await lancamentoParaCorrigir(e.data);
  if (!atual) return { erro: "Lançamento não encontrado." };
  if (!(await podeLancarAgora(atual.programaId)))
    return { erro: SEM_PERMISSAO };
  const [def, listas, comValores] = await Promise.all([
    definicaoDaVersao(atual.formularioId, atual.versao),
    listasDoPrograma(atual.programaId),
    podeAgora("sustentabilidade.valores"),
  ]);
  if (!def) return { erro: "Versão do formulário não encontrada." };
  return {
    definicao: comValores ? def : definicaoSemReais(def),
    valores: atual.valores,
    data: atual.data,
    listas,
    custos: comValores ? await custosDoTour() : null,
  };
}
