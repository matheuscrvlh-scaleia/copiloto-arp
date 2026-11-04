"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  COM_META,
  campoMeta,
  chaveMeta,
  competencia,
  INDICADORES_PAINEL,
  MESES_CURTOS,
  type MetaNova,
  metaValida,
  mudancasDeMetas,
} from "@/lib/comercial/painel";
import { lerValorBr } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";

// Metas do Painel comercial (spec 4.10): a grade indicador × mês do ano,
// gravada em core.metas (comercial.<indicador>, uma linha por mês). Zod →
// comercial.painel.metas no banco → grava com a sessão (o RLS confere de
// novo e core.auditoria guarda quem, quando, antes e depois) → updateTag.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar as metas do painel.",
};

const entrada = z.object({
  ano: z.coerce.number().int().min(2000).max(2100),
});

export async function salvarMetas(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = entrada.safeParse({ ano: form.get("ano") });
  if (!e.success) return { erro: "Ano inválido." };
  const { ano } = e.data;

  const novas: MetaNova[] = [];
  for (const i of COM_META)
    for (let m = 1; m <= 12; m++) {
      const bruto = form.get(campoMeta(i, m));
      if (bruto === null) continue;
      const v = lerValorBr(String(bruto));
      if (v !== null) {
        const erro = metaValida(i, v);
        if (erro)
          return {
            erro: `${INDICADORES_PAINEL[i].nome}, ${MESES_CURTOS[m - 1]}: ${erro}.`,
          };
      }
      novas.push({
        indicador: chaveMeta(i),
        vigente_desde: competencia(ano, m),
        meta: v,
      });
    }

  if (!(await podeAgora("comercial.painel.metas"))) return SEM_PERMISSAO;
  const core = (await createClient()).schema("core");
  const { data: atuais, error: erroLer } = await core
    .from("metas")
    .select("id, indicador, vigente_desde, meta")
    .like("indicador", "comercial.%")
    .gte("vigente_desde", competencia(ano, 1))
    .lte("vigente_desde", competencia(ano, 12));
  if (erroLer) return erroDoBanco(erroLer);

  const { gravar, apagar } = mudancasDeMetas(atuais ?? [], novas);
  if (!gravar.length && !apagar.length) return { ok: "Nada mudou." };

  const direcao = new Map(
    COM_META.map((i) => [chaveMeta(i), INDICADORES_PAINEL[i].direcao]),
  );
  if (gravar.length) {
    const { error } = await core.from("metas").upsert(
      gravar.map((g) => ({
        ...g,
        direcao: direcao.get(g.indicador) ?? "maior_melhor",
      })),
      { onConflict: "indicador,vigente_desde" },
    );
    if (error) return erroDoBanco(error);
  }
  if (apagar.length) {
    const { error } = await core
      .from("metas")
      .delete()
      .in("id", apagar)
      .like("indicador", "comercial.%");
    if (error) return erroDoBanco(error);
  }
  updateTag(TAG.comercial.metas);
  refresh();
  const n = gravar.length + apagar.length;
  return {
    ok: `Salvo: ${n} ${n === 1 ? "meta alterada" : "metas alteradas"}.`,
  };
}

function erroDoBanco(error: { message: string; code?: string }): EstadoAcao {
  if (error.code === "42501") return SEM_PERMISSAO;
  if (error.code === "23514") return { erro: "Valor fora do permitido." };
  console.error("metas do comercial", error);
  return { erro: "Não foi possível salvar. Tente de novo." };
}
