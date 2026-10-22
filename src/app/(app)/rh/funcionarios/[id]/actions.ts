"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { pode } from "@/server/auth";

// Fora do ponto: quem segue no Secullum mas não conta no ponto. Passa pelo
// RLS (rh.parametros) e cai em core.auditoria.

const marcacao = z.object({
  id: z.uuid(),
  fora: z.enum(["sim", "nao"]),
});

export async function marcarForaDoPonto(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.parametros")))
    return { erro: "Você não tem permissão para alterar este cadastro." };
  const m = marcacao.safeParse(Object.fromEntries(form));
  if (!m.success) return primeiroErro(m.error);
  const fora = m.data.fora === "sim";
  const { error } = await (await createClient())
    .schema("rh")
    .from("colaboradores")
    .update({ fora_do_ponto: fora })
    .eq("id", m.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: fora ? "Fora do ponto." : "De volta ao ponto." };
}
