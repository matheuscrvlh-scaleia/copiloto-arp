import type { Metadata } from "next";
import { Marca } from "@/components/marca";
import { sair } from "../login/actions";
import { FormTrocarSenha } from "./form";

export const metadata: Metadata = { title: "Definir senha" };

/** Primeiro acesso (ou senha trocada pelo administrador): o proxy traz para cá. */
export default function TrocarSenhaPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-between gap-12 bg-white p-8 md:p-12">
      <Marca />

      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Defina a sua senha
        </h1>
        <p className="mt-2 mb-8 text-sm text-neutral-500">
          Você entrou com uma senha provisória. Escolha uma senha só sua para
          continuar.
        </p>
        <FormTrocarSenha />
        <form action={sair} className="mt-4 text-center">
          <button
            type="submit"
            className="text-xs text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
          >
            Sair
          </button>
        </form>
      </div>

      <p className="text-xs text-neutral-400">
        Acesso restrito à equipe da ARP. Problemas para entrar? Fale com o
        administrador.
      </p>
    </main>
  );
}
