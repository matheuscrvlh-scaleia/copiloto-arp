"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { INICIO } from "@/config/navigation";
import { destinoSeguro } from "@/lib/destino-seguro";
import {
  assinarSessao,
  COOKIE_SESSAO,
  OPCOES_COOKIE_SESSAO,
} from "@/lib/sessao";
import { createClient } from "@/lib/supabase/server";
import { registrarDepois } from "@/server/logs";

// Entrar e sair. O registro do acesso vai depois da resposta (after). Entrar
// abre o prazo da sessão (src/lib/sessao.ts), que o proxy confere.

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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: dados.data.email,
    password: dados.data.senha,
  });
  if (error) {
    registrarDepois({
      modulo: "acesso",
      evento: "login_falhou",
      descricao: `Tentativa de entrar com ${dados.data.email}`,
      usuarioId: null,
      detalhes: {
        email: dados.data.email,
        motivo: error.code ?? error.message,
      },
    });
    // Mesma mensagem para e-mail inexistente e senha errada.
    return { erro: "E-mail ou senha incorretos.", email };
  }
  const agora = Date.now();
  (await cookies()).set(
    COOKIE_SESSAO,
    await assinarSessao({ sub: data.user.id, inicio: agora, ultima: agora }),
    OPCOES_COOKIE_SESSAO,
  );
  registrarDepois({
    modulo: "acesso",
    evento: "login",
    descricao: "Entrou no sistema",
    usuarioId: data.user.id,
  });
  redirect(destinoSeguro(form.get("next"), INICIO));
}

export async function sair() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  await supabase.auth.signOut();
  (await cookies()).delete(COOKIE_SESSAO);
  if (data?.claims?.sub)
    registrarDepois({
      modulo: "acesso",
      evento: "logout",
      descricao: "Saiu do sistema",
      usuarioId: data.claims.sub,
    });
  redirect("/login");
}
