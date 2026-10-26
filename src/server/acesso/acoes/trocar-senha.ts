"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { INICIO } from "@/config/navigation";
import { SENHA_PROVISORIA } from "@/lib/senha-provisoria";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { registrarDepois } from "@/server/logs";

// Primeiro acesso: a pessoa troca a senha provisória pela própria. A marca
// de provisória fica no app_metadata do Auth (vem no token e o proxy a lê);
// não faz parte do cache de perfil e permissões, então não há tag a invalidar.

export interface EstadoTroca {
  erro?: string;
}

const nova = z
  .object({
    senha: z
      .string()
      .min(10, "A senha precisa ter pelo menos 10 caracteres.")
      .max(72, "A senha pode ter no máximo 72 caracteres."),
    confirmacao: z.string(),
  })
  .refine((v) => v.senha === v.confirmacao, {
    message: "As senhas não conferem.",
  });

/** Troca a senha provisória pela da pessoa e libera o acesso. */
export async function definirSenha(
  _anterior: EstadoTroca,
  form: FormData,
): Promise<EstadoTroca> {
  const d = nova.safeParse({
    senha: form.get("senha"),
    confirmacao: form.get("confirmacao"),
  });
  if (!d.success) return { erro: d.error.issues[0]?.message };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");

  // Com a sessão da própria pessoa: o Auth recusa repetir a provisória.
  const { error } = await supabase.auth.updateUser({ password: d.data.senha });
  if (error) {
    if (error.code === "same_password")
      return { erro: "Use uma senha diferente da provisória." };
    if (error.code === "weak_password")
      return { erro: "Senha fraca: use letras, números e símbolos." };
    return { erro: "Não foi possível trocar a senha. Tente de novo." };
  }

  // Só a service role mexe no app_metadata. Depois renova o token, que é
  // onde o proxy enxerga a marca.
  const r = await createAdminClient().auth.admin.updateUserById(id, {
    app_metadata: { [SENHA_PROVISORIA]: false },
  });
  if (r.error)
    return {
      erro: "A senha foi trocada, mas o acesso não liberou. Tente de novo.",
    };
  await supabase.auth.refreshSession();
  registrarDepois({
    modulo: "acesso",
    evento: "senha_definida",
    descricao: "Trocou a senha provisória pela própria",
    usuarioId: id,
  });
  redirect(INICIO);
}
