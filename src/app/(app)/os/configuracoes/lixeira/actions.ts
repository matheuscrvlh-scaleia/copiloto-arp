"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { os, registrar } from "@/server/os/base";
import { exigir, NADA_ALTERADO } from "@/server/os/config-acoes";

// Lixeira: nada é apagado de verdade. Restaurar devolve o chamado às listas
// (o gatilho do banco confere os.excluir) e fica na linha do tempo.

export async function restaurarChamado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.excluir");
  if (acesso.erro) return acesso.erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return primeiroErro(id.error);
  const { data, error } = await (await os())
    .from("chamados")
    .update({ lixeira_em: null, lixeira_por: null })
    .eq("id", id.data)
    .not("lixeira_em", "is", null)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  await registrar(id.data, {
    tipo: "sistema",
    texto: "Restaurou o chamado da lixeira.",
  });
  refresh();
  return { ok: "Chamado restaurado." };
}
