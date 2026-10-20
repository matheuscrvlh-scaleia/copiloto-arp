"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { INICIO } from "@/config/navigation";
import { destinoSeguro } from "@/lib/destino-seguro";
import { createClient } from "@/lib/supabase/server";

export interface EstadoLogin {
  erro?: string;
  email?: string;
}

const credenciais = z.object({
  email: z.email(),
  senha: z.string().min(1),
});

export async function entrar(
  _anterior: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const email = String(form.get("email") ?? "").trim();
  const dados = credenciais.safeParse({ email, senha: form.get("senha") });
  if (!dados.success) {
    return { erro: "Informe um e-mail válido e a senha.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  if (error) {
    // Mesma mensagem para e-mail inexistente e senha errada.
    return { erro: "E-mail ou senha incorretos.", email };
  }
  redirect(destinoSeguro(form.get("next"), INICIO));
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
