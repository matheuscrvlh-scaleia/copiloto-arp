"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { lerValorBr } from "@/lib/formato";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { su } from "../base";

// Cadastro dos coletores (spec 4.6 e 4.11): aba Coletores das Configurações.
// Grava com a sessão (o RLS exige "Parâmetros") e a auditoria do banco guarda
// o antes e o depois. Coletores NÃO são ativos do Chamados (decidido: faltam
// cor, contêineres e capacidade). Capacidade vazia = "a confirmar".

const SEM_PERMISSAO = "Você não tem permissão para alterar os coletores.";

const esquema = z.object({
  id: z.uuid().optional(),
  local: z
    .string()
    .trim()
    .min(1, "Informe o local do coletor.")
    .max(120, "O local pode ter até 120 letras."),
  cor: z.enum(["preto", "azul"], "Escolha a cor: preto ou azul."),
  conteineres: z.coerce
    .number("Informe quantos contêineres.")
    .int("Contêineres: use um número inteiro.")
    .min(1, "O coletor tem pelo menos 1 contêiner.")
    .max(999, "Contêineres: número alto demais."),
  capacidade: z
    .string()
    .trim()
    .max(20)
    .transform((v, ctx) => {
      const n = lerValorBr(v);
      if (n === null) return null;
      if (!Number.isFinite(n) || n <= 0 || n > 99_999_999) {
        ctx.addIssue({
          code: "custom",
          message:
            "Capacidade: digite os litros de cada contêiner (ou deixe vazio, a confirmar).",
        });
        return z.NEVER;
      }
      return Math.round(n * 100) / 100;
    }),
  ordem: z.coerce
    .number("Informe a ordem.")
    .int("Ordem: use um número inteiro.")
    .min(0)
    .max(9999),
});

function concluir(ok: string): EstadoAcao {
  updateTag(TAG.sustentabilidade.coletores);
  refresh();
  return { ok };
}

export async function salvarColetor(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquema.safeParse({
    id: form.get("id") || undefined,
    local: form.get("local"),
    cor: form.get("cor"),
    conteineres: form.get("conteineres"),
    capacidade: form.get("capacidade") ?? "",
    ordem: form.get("ordem") || 0,
  });
  if (!e.success)
    return { erro: e.error.issues[0]?.message ?? "Confira os dados." };
  if (!(await podeAgora("sustentabilidade.parametros")))
    return { erro: SEM_PERMISSAO };
  const { id, capacidade, ...resto } = e.data;
  const campos = {
    ...resto,
    capacidade_l: capacidade,
    ativo: form.get("ativo") === "on",
  };
  const db = await su();
  const { data, error } = id
    ? await db.from("coletores").update(campos).eq("id", id).select("id")
    : await db.from("coletores").insert(campos).select("id");
  if (error || !data?.length) {
    if (error) console.error("salvar coletor", error);
    return { erro: "Não foi possível salvar o coletor. Tente de novo." };
  }
  return concluir(
    id ? "Coletor salvo." : `Coletor ${campos.local} cadastrado.`,
  );
}

export async function excluirColetor(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Coletor inválido." };
  if (!(await podeAgora("sustentabilidade.parametros")))
    return { erro: SEM_PERMISSAO };
  const { data, error } = await (await su())
    .from("coletores")
    .delete()
    .eq("id", id.data)
    .select("local");
  if (error?.code === "23503")
    return {
      erro: "Este coletor tem rondas lançadas e não pode ser excluído. Desmarque “Ativo” para tirá-lo da ronda.",
    };
  if (error || !data?.length) {
    if (error) console.error("excluir coletor", error);
    return { erro: "Não foi possível excluir o coletor. Tente de novo." };
  }
  return concluir(`Coletor ${data[0]?.local} excluído.`);
}
