import type { Metadata } from "next";
import { TelaDeAcesso } from "@/components/tela-de-acesso";
import { sair } from "@/server/acesso/acoes/login";
import { FormTrocarSenha } from "./form";

export const metadata: Metadata = { title: "Definir senha" };

/** Primeiro acesso (ou senha trocada pelo administrador): o proxy traz para cá. */
export default function TrocarSenhaPage() {
  return (
    <TelaDeAcesso
      titulo="Defina a sua senha"
      subtitulo="Você entrou com uma senha provisória. Escolha uma senha só sua para continuar."
    >
      <FormTrocarSenha />
      <form action={sair} className="mt-4 text-center">
        <button
          type="submit"
          className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
        >
          Sair
        </button>
      </form>
    </TelaDeAcesso>
  );
}
