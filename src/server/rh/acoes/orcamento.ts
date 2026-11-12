"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMoeda, lerValorBr } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { pode } from "@/server/auth";

// Planejamento orçamentário: gastos, categorias e o fechamento do ano. Tudo
// pela sessão: o RLS confere rh.orcamento.lancar e o banco barra gasto em
// ano finalizado e categoria desativada (as mensagens vêm de lá). Leituras
// sem cache: basta o refresh.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para lançar gastos do RH.",
};

const texto = (max: number, falta: string) =>
  z.string().trim().min(1, falta).max(max, `até ${max} caracteres`);

const gasto = z.object({
  id: z.preprocess((v) => (v ? v : undefined), z.uuid().optional()),
  data: z.iso.date("informe a data"),
  valor: z.preprocess(
    (v) => lerValorBr(String(v ?? "")),
    z.number("informe o valor").positive("tem que ser maior que zero"),
  ),
  categoria_id: z.uuid("escolha a categoria da lista"),
  descricao: texto(200, "diga o que foi gasto"),
  finalidade: texto(200, "informe a finalidade"),
  observacao: z
    .string()
    .trim()
    .max(1000, "até 1000 caracteres")
    .transform((v) => v || null),
});

const ROTULOS = {
  data: "Data",
  valor: "Valor",
  categoria_id: "Categoria",
  descricao: "O que foi gasto",
  finalidade: "Finalidade",
  observacao: "Observação",
};

/** Lança um gasto novo ou corrige um já lançado (com id). */
export async function salvarGasto(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.orcamento.lancar"))) return SEM_PERMISSAO;
  const g = gasto.safeParse(Object.fromEntries(form));
  if (!g.success) return primeiroErro(g.error, ROTULOS);
  const { id, ...campos } = g.data;
  const tabela = (await createClient()).schema("rh").from("gastos");
  const { error } = id
    ? await tabela.update(campos).eq("id", id)
    : await tabela.insert(campos);
  if (error) return erroDoBanco(error);
  refresh();
  return {
    ok: id
      ? "Gasto corrigido."
      : `Gasto de ${formatarMoeda(campos.valor)} lançado.`,
  };
}

export async function excluirGasto(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.orcamento.lancar"))) return SEM_PERMISSAO;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Gasto inválido." };
  const { error } = await (await createClient())
    .schema("rh")
    .from("gastos")
    .delete()
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Gasto excluído." };
}

/** Fecha o ano: guarda o total gasto, a data e quem fechou. Não tem volta. */
export async function finalizarOrcamento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.orcamento.lancar"))) return SEM_PERMISSAO;
  const ano = z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .safeParse(form.get("ano"));
  if (!ano.success) return { erro: "Ano inválido." };
  const { error } = await (await createClient())
    .schema("rh")
    .rpc("finalizar_orcamento", { p_ano: ano.data });
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: `Orçamento de ${ano.data} finalizado.` };
}

// ---------------------------------------------------------------------------
// Categorias de gasto (RH › Configurações › Cadastros)
// ---------------------------------------------------------------------------

const categoria = z.object({
  id: z.preprocess((v) => (v ? v : undefined), z.uuid().optional()),
  nome: texto(60, "informe o nome"),
});

/** Cria uma categoria ou troca o nome de uma existente. */
export async function salvarCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.orcamento.lancar"))) return SEM_PERMISSAO;
  const c = categoria.safeParse(Object.fromEntries(form));
  if (!c.success) return primeiroErro(c.error, { nome: "Nome" });
  const tabela = (await createClient()).schema("rh").from("categorias_gasto");
  const { error } = c.data.id
    ? await tabela.update({ nome: c.data.nome }).eq("id", c.data.id)
    : await tabela.insert({ nome: c.data.nome });
  if (error)
    return error.code === "23505"
      ? { erro: "Já existe uma categoria com esse nome." }
      : erroDoBanco(error);
  refresh();
  return { ok: c.data.id ? "Nome salvo." : `Categoria ${c.data.nome} criada.` };
}

/**
 * Desativa ou reativa. Desativada some da lista de lançamento, mas continua
 * nos gastos e gráficos antigos. Excluir não há.
 */
export async function trocarAtivaCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.orcamento.lancar"))) return SEM_PERMISSAO;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Categoria inválida." };
  const ativa = form.get("ativa") === "true";
  const { error } = await (await createClient())
    .schema("rh")
    .from("categorias_gasto")
    .update({ ativa })
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: ativa ? "Categoria reativada." : "Categoria desativada." };
}
