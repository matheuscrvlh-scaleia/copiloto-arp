import type { Metadata } from "next";
import { Suspense } from "react";
import { TelaDeAcesso } from "@/components/tela-de-acesso";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <TelaDeAcesso
      titulo="Bem-vindo de volta"
      subtitulo="Entre com seu e-mail e senha para continuar."
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </TelaDeAcesso>
  );
}
