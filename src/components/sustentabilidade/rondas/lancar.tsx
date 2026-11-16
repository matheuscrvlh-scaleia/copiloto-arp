"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { notificar } from "@/components/notificacoes";
import {
  PASSOS_OCUPACAO,
  ROTULO_COR,
} from "@/lib/sustentabilidade/rondas-lancamento";
import { lancarRonda } from "@/server/sustentabilidade/acoes/rondas";
import { CampoFoto } from "./foto";

// Lançar ronda (spec 4.6), pensada para o celular: um cartão por coletor
// ativo, contêineres encontrados (já com o número do cadastro) e botões
// grandes de 0 a 100, de 10 em 10. Coletor em branco não é lançado (não vira
// zero): tocar de novo no percentual escolhido volta para em branco.

export interface ColetorParaLancar {
  id: string;
  local: string;
  cor: "preto" | "azul";
  conteineres: number;
}

interface Estado {
  conteineres: string;
  pct: number | null;
  observacao: string;
  foto: string | null;
}

const VOLTAR = "/sustentabilidade/rondas";

export function LancarRonda({
  coletores,
  limite,
  dia,
  chamado,
}: {
  coletores: ColetorParaLancar[];
  /** Limite de alerta dos Parâmetros (%). */
  limite: number;
  /** Dia de hoje já escrito (dd/mm/aaaa). */
  dia: string;
  /** Chamado da ronda em aberto, que fecha ao salvar (ex.: "#412"); null se não há. */
  chamado: string | null;
}) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [itens, setItens] = useState<Record<string, Estado>>(() =>
    Object.fromEntries(
      coletores.map((c) => [
        c.id,
        {
          conteineres: String(c.conteineres),
          pct: null,
          observacao: "",
          foto: null,
        },
      ]),
    ),
  );
  const [observacao, setObservacao] = useState("");
  const [foto, setFoto] = useState<string | null>(null);

  const muda = (id: string, parte: Partial<Estado>) =>
    setItens((s) => ({ ...s, [id]: { ...(s[id] as Estado), ...parte } }));
  const lancados = coletores.filter((c) => itens[c.id]?.pct != null);
  const cheios = lancados.filter(
    (c) => (itens[c.id]?.pct ?? 0) >= limite,
  ).length;

  function salvar() {
    for (const c of lancados) {
      const n = Number(itens[c.id]?.conteineres);
      if (!Number.isInteger(n) || n < 0) {
        notificar(
          "erro",
          `${c.local} (${c.cor}): informe quantos contêineres você encontrou (um número inteiro).`,
        );
        return;
      }
    }
    iniciar(async () => {
      try {
        const r = await lancarRonda({
          observacao: observacao.trim() || null,
          foto,
          itens: coletores.map((c) => {
            const e = itens[c.id] as Estado;
            return {
              coletorId: c.id,
              conteineres: Number(e.conteineres) || 0,
              ocupacaoPct: e.pct,
              observacao: e.pct === null ? null : e.observacao.trim() || null,
              foto: e.pct === null ? null : e.foto,
            };
          }),
        });
        if (r.erro) notificar("erro", r.erro);
        else if (r.ok) {
          notificar("ok", r.ok);
          router.push(VOLTAR);
        }
      } catch {
        notificar(
          "erro",
          "Não foi possível salvar a ronda. Confira a conexão e tente de novo: o que você preencheu continua na tela.",
        );
      }
    });
  }

  if (!coletores.length)
    return (
      <p className="text-sm text-neutral-600">
        Não há coletor ativo no cadastro. Cadastre em Configurações › Coletores
        e volte aqui.
      </p>
    );

  return (
    <div data-guia="su-ronda-lancar" className="flex flex-col gap-4 pb-24">
      <p className="text-sm text-neutral-600">
        <span className="font-medium text-neutral-900">{dia}</span>, a hora é a
        de quando você salvar.{" "}
        {chamado
          ? `Ao salvar, o chamado ${chamado} (ronda da semana) fecha.`
          : "Não há chamado da ronda em aberto."}{" "}
        Toque na ocupação de cada coletor. Quem você não visitou fica em branco,
        não vira zero.
      </p>

      <ul className="flex flex-col gap-3">
        {coletores.map((c) => {
          const e = itens[c.id] as Estado;
          return (
            <li
              key={c.id}
              data-guia="su-ronda-coletor"
              className="vidro flex flex-col gap-3 rounded-[1.5rem] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-neutral-900">
                    <span
                      aria-hidden
                      className={`size-3 shrink-0 rounded-full ${c.cor === "preto" ? "bg-neutral-800" : "bg-[var(--serie-1)]"}`}
                    />
                    <span className="truncate">{c.local}</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    {ROTULO_COR[c.cor]}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  Contêineres
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={e.conteineres}
                    onChange={(ev) =>
                      muda(c.id, { conteineres: ev.target.value.trim() })
                    }
                    aria-label={`Contêineres encontrados em ${c.local}`}
                    className="min-h-11 w-20 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-center text-base outline-none transition focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5"
                  />
                </label>
              </div>

              <fieldset className="m-0 grid min-w-0 grid-cols-4 gap-2 border-0 p-0 sm:grid-cols-6 lg:grid-cols-11">
                <legend className="sr-only">
                  Ocupação de {c.local} ({c.cor})
                </legend>
                {PASSOS_OCUPACAO.map((p) => {
                  const marcado = e.pct === p;
                  const cheio = p >= limite;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={marcado}
                      onClick={() => muda(c.id, { pct: marcado ? null : p })}
                      className={`min-h-14 rounded-2xl border text-lg font-semibold tabular-nums transition ${
                        marcado
                          ? cheio
                            ? "border-red-700 bg-red-700 text-white"
                            : "border-neutral-900 bg-neutral-900 text-white"
                          : cheio
                            ? "border-red-300 bg-red-50 text-red-800 hover:border-red-500"
                            : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </fieldset>

              <p className="text-sm" aria-live="polite">
                {e.pct === null ? (
                  <span className="text-neutral-500">
                    Em branco: este coletor não entra na ronda.
                  </span>
                ) : e.pct >= limite ? (
                  <span className="font-medium text-red-700">
                    {e.pct}%: acima do limite de {limite}%, vai abrir chamado de
                    recolhimento.
                  </span>
                ) : (
                  <span className="text-neutral-700">Ocupação: {e.pct}%</span>
                )}
              </p>

              {e.pct !== null && (
                <details className="text-sm">
                  <summary className="min-h-11 cursor-pointer py-2 font-medium text-neutral-700">
                    Foto e observação (opcionais)
                  </summary>
                  <div className="flex flex-col gap-3 pt-2">
                    <CampoFoto
                      rotulo="Tirar foto"
                      caminho={e.foto}
                      aoMudar={(f) => muda(c.id, { foto: f })}
                    />
                    <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
                      Observação
                      <textarea
                        value={e.observacao}
                        onChange={(ev) =>
                          muda(c.id, { observacao: ev.target.value })
                        }
                        rows={2}
                        maxLength={1000}
                        className={classeCampo}
                      />
                    </label>
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <details className="vidro rounded-[1.5rem] p-4 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium text-neutral-700">
          Foto e observação da ronda (opcionais)
        </summary>
        <div className="flex flex-col gap-3 pt-2">
          <CampoFoto
            rotulo="Tirar foto da ronda"
            caminho={foto}
            aoMudar={setFoto}
          />
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            Observação
            <textarea
              value={observacao}
              onChange={(ev) => setObservacao(ev.target.value)}
              rows={3}
              maxLength={1000}
              className={classeCampo}
            />
          </label>
        </div>
      </details>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-neutral-900/10 bg-white/90 px-4 py-3 backdrop-blur sm:sticky sm:rounded-2xl sm:border">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-neutral-700" aria-live="polite">
            {lancados.length} de {coletores.length} coletores lançados
            {cheios > 0 && (
              <span className="font-medium text-red-700">
                {" "}
                · {cheios} acima do limite
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || lancados.length === 0}
            data-guia="su-ronda-salvar"
            className="min-h-12 rounded-full bg-neutral-900 px-8 text-base font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar ronda"}
          </button>
        </div>
      </div>
    </div>
  );
}
