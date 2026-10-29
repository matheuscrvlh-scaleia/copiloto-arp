"use client";

import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Selecao } from "@/components/selecao";
import { PERMISSOES, type Permissao } from "@/lib/permissions";

const MODULOS = [
  { prefixo: "admin.", titulo: "Administração" },
  { prefixo: "rh.", titulo: "RH" },
  { prefixo: "financeiro.", titulo: "Financeiro" },
  { prefixo: "os.", titulo: "Tickets" },
  { prefixo: "marketing.", titulo: "Marketing" },
] as const;

const TODAS = Object.keys(PERMISSOES) as Permissao[];

/**
 * Caixas de permissão por módulo. As que vêm de `herdadas` (o cargo)
 * aparecem marcadas e travadas; só as individuais vão no formulário, no
 * campo "permissoes".
 */
export function CaixasDePermissao({
  marcadas,
  herdadas = [],
  rotuloHerdada = "pelo cargo",
}: {
  marcadas: Permissao[];
  herdadas?: Permissao[];
  rotuloHerdada?: string;
}) {
  const [sel, setSel] = useState(() => new Set(marcadas));
  const herdou = new Set(herdadas);

  return (
    <div className="flex flex-col gap-4">
      {MODULOS.map((m) => {
        const doModulo = TODAS.filter((p) => p.startsWith(m.prefixo));
        const livres = doModulo.filter((p) => !herdou.has(p));
        const todasMarcadas =
          livres.length > 0 && livres.every((p) => sel.has(p));
        const nMarcadas = doModulo.filter(
          (p) => herdou.has(p) || sel.has(p),
        ).length;
        return (
          <fieldset
            key={m.prefixo}
            className="min-w-0 rounded-3xl border border-neutral-200 bg-white/60 p-4"
          >
            <legend className="sr-only">{m.titulo}</legend>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-2">
              <span className="text-sm font-semibold">{m.titulo}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${nMarcadas > 0 ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500"}`}
              >
                {nMarcadas} de {doModulo.length}
              </span>
              {livres.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSel((s) => {
                      const n = new Set(s);
                      for (const p of livres)
                        todasMarcadas ? n.delete(p) : n.add(p);
                      return n;
                    })
                  }
                  className="ml-auto rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900"
                >
                  {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
                </button>
              )}
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
              {doModulo.map((p) => {
                const travada = herdou.has(p);
                const marcada = travada || sel.has(p);
                return (
                  <li key={p} className="min-w-0">
                    <label
                      className={`flex h-full items-start gap-3 rounded-2xl px-2 py-2 text-sm transition ${travada ? "cursor-default" : "cursor-pointer hover:bg-neutral-100"} ${marcada ? "bg-neutral-100/60" : ""}`}
                    >
                      <input
                        type="checkbox"
                        name={travada ? undefined : "permissoes"}
                        value={p}
                        checked={marcada}
                        disabled={travada}
                        onChange={(e) =>
                          setSel((s) => {
                            const n = new Set(s);
                            e.target.checked ? n.add(p) : n.delete(p);
                            return n;
                          })
                        }
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition peer-focus-visible:ring-4 peer-focus-visible:ring-neutral-900/10 ${marcada ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"} ${travada ? "opacity-50" : ""}`}
                      >
                        {travada ? (
                          <Lock className="size-3" />
                        ) : marcada ? (
                          <Check className="size-3" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-neutral-800">
                          {PERMISSOES[p]}
                        </span>
                        <span className="block break-all text-[11px] text-neutral-400">
                          {p}
                          {travada && ` · ${rotuloHerdada}`}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        );
      })}
    </div>
  );
}

interface CargoNaEscolha {
  id: string;
  nome: string;
  ativo: boolean;
  permissoes: Permissao[];
}

/**
 * Escolha do cargo, com o resumo do que ele dá. As permissões em si são
 * editadas só no cargo. Inativos só aparecem se já são o cargo da pessoa.
 */
export function EscolhaDeCargo({
  cargos,
  cargoInicial,
}: {
  cargos: CargoNaEscolha[];
  cargoInicial: string | null;
}) {
  const [cargo, setCargo] = useState(cargoInicial ?? "");
  const escolhido = cargos.find((c) => c.id === cargo);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-full max-w-sm flex-col gap-1 text-xs font-medium text-neutral-600">
        Cargo
        <Selecao
          name="cargo_id"
          valor={cargo}
          aoMudar={setCargo}
          opcoes={[
            {
              valor: "",
              rotulo: "Sem cargo",
              descricao: "Entra, mas não vê nenhuma tela",
            },
            ...cargos
              .filter((c) => c.ativo || c.id === cargoInicial)
              .map((c) => ({
                valor: c.id,
                rotulo: c.ativo ? c.nome : `${c.nome} (inativo)`,
                descricao: `${c.permissoes.length} permissões`,
              })),
          ]}
        />
      </label>
      <ResumoDoCargo cargo={escolhido} />
    </div>
  );
}

function ResumoDoCargo({ cargo }: { cargo?: CargoNaEscolha }) {
  if (!cargo)
    return (
      <p className="text-xs text-neutral-500">
        Sem cargo, a pessoa não vê nenhuma tela.
      </p>
    );
  if (!cargo.ativo)
    return (
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Este cargo está inativo e não dá nenhuma permissão. Escolha outro ou
        reative o cargo.
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      <span>Dá acesso a</span>
      {MODULOS.map((m) => {
        const n = cargo.permissoes.filter((p) =>
          p.startsWith(m.prefixo),
        ).length;
        if (n === 0) return null;
        return (
          <span
            key={m.prefixo}
            className="rounded-full border border-neutral-200 bg-white/70 px-2.5 py-1 text-neutral-700"
          >
            {m.titulo} · {n}
          </span>
        );
      })}
      {cargo.permissoes.length === 0 && <span>nada ainda</span>}
      <Link
        href={`/admin/usuarios/cargos/${cargo.id}`}
        className="ml-1 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        Ver o cargo →
      </Link>
    </div>
  );
}
