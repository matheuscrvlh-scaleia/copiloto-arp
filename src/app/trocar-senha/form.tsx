"use client";

import { useActionState, useState } from "react";
import {
  definirSenha,
  type EstadoTroca,
} from "@/server/acesso/acoes/trocar-senha";

const campo =
  "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5";

export function FormTrocarSenha() {
  const [estado, acao, enviando] = useActionState<EstadoTroca, FormData>(
    definirSenha,
    {},
  );
  const [mostrar, setMostrar] = useState(false);
  const tipo = mostrar ? "text" : "password";

  return (
    <form action={acao} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Nova senha</span>
        <span className="relative">
          <input
            name="senha"
            type={tipo}
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={72}
            className={`${campo} pr-20`}
          />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {mostrar ? "Ocultar" : "Mostrar"}
          </button>
        </span>
        <span className="text-xs text-neutral-400">
          Mínimo de 10 caracteres. Misture letras, números e símbolos.
        </span>
      </label>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Repita a nova senha</span>
        <input
          name="confirmacao"
          type={tipo}
          autoComplete="new-password"
          required
          className={campo}
        />
      </label>

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
        {enviando ? "Salvando…" : "Definir senha e entrar"}
      </button>
    </form>
  );
}
