"use client";

import { useActionState, useId } from "react";
import { type EstadoEntrada, entrar } from "@/server/os/acoes/portal-publico";
import { BotaoEnviar, CAMPO, Rotulo } from "./campos";
import { Logo } from "./visual";

// Entrada do portal: um endereço só para todas as lojas; a loja digita o
// CNPJ e, se o CNPJ tiver mais de uma loja vigente, escolhe qual.

export function Entrada() {
  const [estado, acao, enviando] = useActionState<EstadoEntrada, FormData>(
    entrar,
    {},
  );
  const id = useId();
  const lojas = estado.lojas;
  return (
    <section className="vidro flex flex-col gap-5 rounded-[1.75rem] p-5 sm:p-6">
      <Logo />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Entrar no portal
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Informe o CNPJ da sua loja para fazer e acompanhar pedidos.
        </p>
      </div>
      <form action={acao} className="flex flex-col gap-4">
        <div>
          <Rotulo htmlFor={`${id}-cnpj`} obrigatorio>
            CNPJ
          </Rotulo>
          <input
            id={`${id}-cnpj`}
            name="cnpj"
            inputMode="numeric"
            autoComplete="off"
            placeholder="00.000.000/0000-00"
            defaultValue={estado.cnpj}
            required
            maxLength={18}
            className={CAMPO}
          />
        </div>
        {lojas && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-neutral-800">
              Este CNPJ tem mais de uma loja. Qual é a sua?
            </legend>
            {lojas.map((l, i) => (
              <label
                key={l.id}
                className="flex cursor-pointer items-center gap-3 rounded-2xl border border-neutral-200 bg-white/70 px-4 py-3 transition hover:border-neutral-400 has-checked:border-neutral-900 has-focus-visible:ring-4 has-focus-visible:ring-neutral-900/10"
              >
                <input
                  type="radio"
                  name="loja"
                  value={l.id}
                  required
                  defaultChecked={i === 0}
                  className="size-4 accent-neutral-900"
                />
                <span className="min-w-0">
                  <span className="block text-base font-medium">{l.nome}</span>
                  <span className="block text-xs text-neutral-500">
                    LUC {l.luc}
                    {l.bloco && ` · Bloco ${l.bloco}`}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <BotaoEnviar
          enviando={enviando}
          erro={estado.erro}
          rotulo="Entrar"
          rotuloEnviando="Entrando…"
        />
      </form>
    </section>
  );
}
