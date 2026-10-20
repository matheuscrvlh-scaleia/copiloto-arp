import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Marca } from "@/components/marca";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-white md:grid-cols-[516px_1fr] xl:grid-cols-[580px_1fr]">
      <section className="flex flex-col justify-between gap-12 p-8 md:p-12">
        <Marca />

        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Bem-vindo de volta
          </h1>
          <p className="mt-2 mb-8 text-sm text-neutral-500">
            Entre com seu e-mail e senha para continuar.
          </p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-xs text-neutral-400">
          Acesso restrito à equipe da ARP. Problemas para entrar? Fale com o
          administrador.
        </p>
      </section>

      <section className="relative hidden md:block">
        <Image
          src="/brand/espaco-arp-evento.webp"
          alt="Apresentação de dança no Espaço ARP, em Nova Friburgo"
          fill
          sizes="(min-width: 768px) 75vw, 0px"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(0_0_0/0.7)] via-[rgb(0_0_0/0.1)] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-[#fff]">
          <p className="text-4xl font-semibold tracking-tight">
            Onde tudo acontece.
          </p>
          <p className="mt-2 text-sm text-[rgb(255_255_255/0.8)]">
            Espaço ARP · Nova Friburgo, RJ
          </p>
        </div>
      </section>
    </main>
  );
}
