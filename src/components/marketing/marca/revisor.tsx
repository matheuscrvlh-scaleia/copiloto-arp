"use client";

import { CircleAlert, CircleCheck, Sparkles } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { revisar } from "@/lib/marketing/revisor";

// Revisor de texto (spec 4.4): roda no navegador, com as listas da base da
// marca. Grifa as proibidas em vermelho e as proprietárias já usadas em
// verde; ao lado, a contagem e as proprietárias que podem entrar. Não
// reescreve o texto.

const EXEMPLO = "O Super Espaço tem de tudo";

export function Revisor({
  proibidas,
  proprietarias,
}: {
  proibidas: string[];
  proprietarias: string[];
}) {
  const [texto, setTexto] = useState("");
  const adiado = useDeferredValue(texto);
  const r = useMemo(
    () => revisar(adiado, { proibidas, proprietarias }),
    [adiado, proibidas, proprietarias],
  );
  const campo = useId();
  const vazio = !adiado.trim();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <section className="vidro flex flex-col gap-3 rounded-[1.75rem] p-5 md:p-6 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor={campo} className="text-base font-semibold">
            Cole o texto
          </label>
          <button
            type="button"
            onClick={() => setTexto(EXEMPLO)}
            className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
          >
            Testar com um exemplo
          </button>
        </div>
        <textarea
          id={campo}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={7}
          placeholder="Legenda de post, texto de anúncio, e-mail…"
          className={`${classeCampo} leading-relaxed`}
        />
        <div aria-live="polite">
          <p className="mb-2 text-xs font-medium text-neutral-500">
            Texto revisado
          </p>
          <div className="min-h-24 whitespace-pre-wrap rounded-2xl border border-neutral-900/10 bg-white/60 p-4 text-sm leading-7 text-neutral-800">
            {vazio ? (
              <span className="text-neutral-400">
                O texto aparece aqui com as palavras proibidas em vermelho e as
                proprietárias em verde.
              </span>
            ) : (
              r.trechos.map((t, i) =>
                t.tipo === "normal" ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: trechos não mudam de ordem
                  <span key={i}>{t.texto}</span>
                ) : (
                  <mark
                    // biome-ignore lint/suspicious/noArrayIndexKey: trechos não mudam de ordem
                    key={i}
                    title={
                      t.tipo === "proibida"
                        ? `Proibida: ${t.termo}`
                        : `Proprietária: ${t.termo}`
                    }
                    className={
                      t.tipo === "proibida"
                        ? "rounded-md bg-red-500/15 px-0.5 font-medium text-red-700 underline decoration-red-500 decoration-wavy underline-offset-4"
                        : "rounded-md bg-green-500/15 px-0.5 font-medium text-green-800"
                    }
                  >
                    {t.texto}
                  </mark>
                ),
              )
            )}
          </div>
        </div>
        <p className="text-[11px] leading-snug text-neutral-400">
          Comparação de palavras com as listas da aba Tom de voz e palavras, sem
          diferença de maiúscula e acento. Sem IA: o texto não é reescrito.
        </p>
      </section>

      <aside className="flex flex-col gap-4 lg:col-span-2">
        <section
          className={`rounded-[1.75rem] p-5 md:p-6 ${!vazio && r.totalProibidas > 0 ? "tom-escuro" : "vidro"}`}
        >
          {vazio ? (
            <p className="text-sm text-neutral-500">
              Cole um texto para revisar.
            </p>
          ) : r.totalProibidas > 0 ? (
            <>
              <p className="flex items-center gap-2 text-sm text-neutral-300">
                <CircleAlert className="size-4 text-red-400" aria-hidden />
                Palavras proibidas encontradas
              </p>
              <p className="mt-1 text-4xl font-semibold tabular-nums">
                {r.totalProibidas}
              </p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {r.proibidas.map((p) => (
                  <li
                    key={p.termo}
                    className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-medium text-red-200"
                  >
                    {p.termo}
                    {p.vezes > 1 && ` × ${p.vezes}`}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-green-800">
              <CircleCheck className="size-4" aria-hidden />
              Nenhuma palavra proibida.
            </p>
          )}
        </section>

        <section className="vidro rounded-[1.75rem] p-5 md:p-6">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-marca-escuro" aria-hidden />
            Use no lugar
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Palavras proprietárias da ARP que ainda não estão no texto.
          </p>
          {r.sugestoes.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {r.sugestoes.map((s) => (
                <li
                  key={s}
                  className="rounded-full border border-green-700/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-800"
                >
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">
              {proprietarias.length
                ? "O texto já usa todas."
                : "Cadastre as palavras proprietárias na aba Tom de voz e palavras."}
            </p>
          )}
          {r.proprietariasUsadas.length > 0 && (
            <>
              <p className="mt-4 text-xs font-medium text-neutral-500">
                Já no texto
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {r.proprietariasUsadas.map((p) => (
                  <li
                    key={p.termo}
                    className="inline-flex items-center gap-1 rounded-full bg-green-600 px-3 py-1 text-xs font-medium text-white"
                  >
                    <CircleCheck className="size-3" aria-hidden />
                    {p.termo}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </aside>
    </div>
  );
}
