"use client";

import { Printer, Search } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";

// Escolha das etiquetas para imprimir em lote. O PDF sai numa aba nova
// (POST com os ids: um lote grande não cabe na URL). "Começar na etiqueta"
// aproveita a folha adesiva já usada pela metade.

export interface AtivoEtiqueta {
  id: string;
  codigo: string;
  nome: string;
  local: string;
  baixado: boolean;
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function SelecaoEtiquetas({
  ativos,
  acao,
  porFolha,
  iniciais = [],
}: {
  ativos: AtivoEtiqueta[];
  /** Endereço do PDF. */
  acao: string;
  porFolha: number;
  /** Já marcados ao abrir (vindo da lista filtrada). */
  iniciais?: string[];
}) {
  const [marcados, setMarcados] = useState(() => new Set(iniciais));
  const [busca, setBusca] = useState("");
  const termo = sem(busca.trim());
  const visiveis = termo
    ? ativos.filter((a) =>
        sem(`${a.codigo} ${a.nome} ${a.local}`).includes(termo),
      )
    : ativos;
  const todosVisiveis =
    visiveis.length > 0 && visiveis.every((a) => marcados.has(a.id));

  function alternar(ids: string[], marcar: boolean) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      for (const id of ids) {
        if (marcar) novo.add(id);
        else novo.delete(id);
      }
      return novo;
    });
  }

  return (
    <form
      method="post"
      action={acao}
      target="_blank"
      className="flex flex-col gap-4"
    >
      {[...marcados].map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}

      <div className="vidro flex flex-col gap-3 rounded-[1.75rem] p-4 sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-neutral-600">
          Buscar
          <span className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, nome ou local…"
              className={`${classeCampo} pl-9`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600 sm:w-48">
          Começar na etiqueta nº
          <input
            type="number"
            name="inicio"
            min={1}
            max={porFolha}
            defaultValue={1}
            className={classeCampo}
          />
        </label>
        <button
          type="submit"
          disabled={marcados.size === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Printer className="size-4" aria-hidden />
          Gerar PDF ({marcados.size})
        </button>
      </div>

      <div className="vidro rounded-[1.75rem] p-2 md:p-3">
        <label className="flex items-center gap-3 border-b border-neutral-900/[0.06] px-3 py-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={todosVisiveis}
            onChange={(e) =>
              alternar(
                visiveis.map((a) => a.id),
                e.target.checked,
              )
            }
            className="size-4 accent-neutral-900"
          />
          {termo ? "Marcar os encontrados" : "Marcar todos"} ({visiveis.length})
        </label>
        {visiveis.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-neutral-500">
            Nenhum ativo encontrado.
          </p>
        ) : (
          <ul className="max-h-[60dvh] overflow-y-auto">
            {visiveis.map((a) => (
              <li key={a.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-white/60">
                  <input
                    type="checkbox"
                    checked={marcados.has(a.id)}
                    onChange={(e) => alternar([a.id], e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-neutral-900"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-xs text-neutral-500">
                        {a.codigo}
                      </span>
                      <span className="text-sm font-medium">{a.nome}</span>
                      {a.baixado && (
                        <span className="text-xs text-neutral-500">
                          (baixado)
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {a.local}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
