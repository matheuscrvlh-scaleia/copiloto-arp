"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { rotuloMes } from "@/lib/operacoes/agua";
import type {
  ArquivoParaEnviar,
  EnvioPreparado,
  PedidoDePrevia,
  PreviaAgua,
  RespostaPrevia,
} from "@/lib/operacoes/agua-importacao";
import { podeAgora, usuarioAtual } from "@/server/auth";
import {
  descartarPrevia,
  gerarPrevia,
  limparEnvio,
  prepararEnvioAgua as preparar,
  previaAberta,
} from "@/server/operacoes/agua-importacao";
import { op } from "@/server/operacoes/base";
import { logImportacaoOp } from "@/server/operacoes/historico";

// Ações da água: o envio e a prévia da importação (a leitura fica em
// server/operacoes/agua-importacao.ts), confirmar e descartar, e a correção
// do vínculo do hidrômetro. Gravação com a sessão: o RLS e as funções do
// banco conferem a permissão de novo. As telas leem com a sessão, sem
// cache: refresh() basta depois de gravar.

export async function prepararEnvioAgua(
  arquivos: ArquivoParaEnviar[],
): Promise<EnvioPreparado> {
  return preparar(arquivos);
}

export async function previaAgua(
  pedido: PedidoDePrevia,
): Promise<RespostaPrevia> {
  return gerarPrevia(pedido);
}

export async function limparEnvioAgua(envio: string): Promise<void> {
  try {
    await limparEnvio(envio);
  } catch (erro) {
    console.error("limpar envio da água", erro);
  }
}

export async function previaAbertaAgua(): Promise<PreviaAgua | null> {
  try {
    return await previaAberta();
  } catch (erro) {
    console.error("prévia aberta da água", erro);
    return null;
  }
}

const confirmar = z.object({
  id: z.uuid(),
  motivo: z.string().trim().max(500).optional(),
});

export async function confirmarAgua(entrada: {
  id: string;
  motivo?: string;
}): Promise<{ ok: string; referencia: string } | { erro: string }> {
  const e = confirmar.safeParse(entrada);
  if (!e.success) return { erro: "Motivo longo demais (até 500 letras)." };
  const db = await op();
  const { data: imp } = await db
    .from("importacoes")
    .select("id, referencia, status, bate")
    .eq("id", e.data.id)
    .eq("tipo", "agua")
    .maybeSingle();
  if (!imp) return { erro: "Importação não encontrada." };
  if (imp.status !== "previa")
    return { erro: "Esta prévia já foi confirmada ou descartada." };
  const motivo = e.data.motivo || undefined;
  if (imp.bate === false && (!motivo || motivo.length < 3))
    return {
      erro: "Linhas e totais não batem com o resumo do arquivo: escreva o motivo para confirmar assim mesmo (o mês fica marcado incompleto).",
    };
  const { error } = await db.rpc("confirmar_importacao", {
    p_id: e.data.id,
    p_motivo: imp.bate === false ? motivo : undefined,
  });
  if (error) {
    if (error.code === "42501")
      return { erro: "Você não tem permissão para importar a água." };
    if (error.code === "22023" || error.code === "P0001")
      return { erro: error.message };
    if (error.code === "23505")
      return {
        erro: "Há hidrômetro repetido na mesma sala do mês. Confira o arquivo e envie de novo.",
      };
    console.error("confirmar importação da água", error);
    return { erro: "Não foi possível confirmar. Nada foi alterado." };
  }
  await cadastrarNovos(db, imp.id);
  refresh();
  await logImportacaoOp(
    "confirmou",
    { id: imp.id, tipo: "agua", referencia: imp.referencia },
    imp.bate === false ? "marcada incompleta" : undefined,
    imp.bate === false ? { incompleta: true, motivo } : {},
  );
  return {
    ok: `${rotuloMes(imp.referencia)} importado${imp.bate === false ? " (marcado incompleto)" : ""}.`,
    referencia: imp.referencia,
  };
}

/**
 * Hidrômetro do mês que ainda não está no cadastro entra nele (com o bloco,
 * a sala e o cliente da planilha). Falha aqui não desfaz a importação: o
 * cadastro pode ser completado à mão em Cadastros.
 */
async function cadastrarNovos(db: Awaited<ReturnType<typeof op>>, id: string) {
  const { data, error } = await db
    .from("agua_leituras")
    .select("hidrometro, bloco, sala, cliente")
    .eq("importacao_id", id);
  if (error || !data?.length) return;
  const unicos = [...new Map(data.map((l) => [l.hidrometro, l])).values()];
  const r = await db.from("hidrometros").upsert(
    unicos.map((l) => ({
      numero: l.hidrometro,
      bloco: l.bloco,
      sala: l.sala.slice(0, 40),
      descricao: l.cliente.trim().slice(0, 120) || null,
    })),
    { onConflict: "numero", ignoreDuplicates: true },
  );
  if (r.error) console.error("cadastrar hidrômetros novos", r.error);
}

export async function descartarAgua(id: string): Promise<EstadoAcao> {
  if (!z.uuid().safeParse(id).success) return { erro: "Prévia inválida." };
  if (!(await podeAgora("operacoes.agua.importar")))
    return { erro: "Você não tem permissão para importar a água." };
  try {
    const erro = await descartarPrevia(id);
    if (erro) return { erro };
  } catch (erro) {
    console.error("descartar prévia da água", erro);
    return { erro: "Não foi possível descartar. Tente de novo." };
  }
  refresh();
  await logImportacaoOp("descartou", { id, tipo: "agua" });
  return { ok: "Prévia descartada." };
}

// ---------------------------------------------------------------------------
// Vínculo do hidrômetro (sala e bloco a partir de um mês)
// ---------------------------------------------------------------------------

const vinculo = z.object({
  hidrometro: z.string().trim().min(1).max(40),
  desde: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Escolha o mês."),
  bloco: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "Bloco com 2 dígitos (ex.: 05).")
    .transform((b) => b.padStart(2, "0")),
  sala: z.string().trim().min(1, "Informe a sala.").max(120),
  motivo: z
    .string()
    .trim()
    .min(3, "Escreva o motivo da correção.")
    .max(500, "Motivo com até 500 letras."),
});

export async function corrigirVinculo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = vinculo.safeParse(Object.fromEntries(form));
  if (!e.success)
    return { erro: e.error.issues[0]?.message ?? "Dados inválidos." };
  const usuario = await usuarioAtual();
  const { error } = await (await op()).from("agua_vinculos").insert({
    hidrometro: e.data.hidrometro.toUpperCase(),
    desde: `${e.data.desde}-01`,
    bloco: e.data.bloco,
    sala: e.data.sala,
    motivo: e.data.motivo,
    criado_por: usuario.id,
  });
  if (error) {
    if (error.code === "42501")
      return { erro: "Você não tem permissão para corrigir o vínculo." };
    if (error.code === "23505")
      return {
        erro: "Já há uma correção deste hidrômetro a partir desse mês. Remova a outra antes.",
      };
    console.error("correção de vínculo da água", error);
    return { erro: "Não foi possível salvar a correção." };
  }
  refresh();
  return {
    ok: `Vínculo corrigido a partir de ${rotuloMes(`${e.data.desde}-01`)}.`,
  };
}

export async function removerVinculo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Correção inválida." };
  const { data, error } = await (await op())
    .from("agua_vinculos")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("remover correção de vínculo", error);
    return {
      erro: "Não foi possível remover (sem permissão ou já removida).",
    };
  }
  refresh();
  return { ok: "Correção removida: vale de novo o que veio no arquivo." };
}
