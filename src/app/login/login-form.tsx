"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { type EstadoLogin, entrar } from "@/server/acesso/acoes/login";

const campo =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5";

export function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "";
  const expirou = params.get("motivo") === "expirou";
  const [estado, acao, enviando] = useActionState<EstadoLogin, FormData>(
    entrar,
    {},
  );
  const [mostrarSenha, setMostrarSenha] = useState(false);

  return (
    <form action={acao} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">E-mail</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={estado.email}
          placeholder="nome@arp.com.br"
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Senha</span>
        <span className="relative">
          <input
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${campo} pr-20`}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {mostrarSenha ? "Ocultar" : "Mostrar"}
          </button>
        </span>
      </label>

      {expirou && !estado.erro && (
        <p
          role="status"
          className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          Sua sessão expirou. Entre de novo para continuar.
        </p>
      )}

      {estado.erro && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {estado.erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="mt-1 rounded-xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:opacity-70"
      >
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
