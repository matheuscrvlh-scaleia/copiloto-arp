"use client";

import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { Selecao } from "@/components/selecao";
import { PERMISSOES, type Permissao } from "@/lib/permissions";

const MODULOS = [
  { prefixo: "admin.", titulo: "Administração" },
  { prefixo: "rh.", titulo: "RH" },
  { prefixo: "financeiro.", titulo: "Financeiro" },
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {MODULOS.map((m) => {
        const doModulo = TODAS.filter((p) => p.startsWith(m.prefixo));
        const livres = doModulo.filter((p) => !herdou.has(p));
        const todasMarcadas =
          livres.length > 0 && livres.every((p) => sel.has(p));
        return (
          <fieldset
            key={m.prefixo}
            className="rounded-3xl border border-neutral-200 bg-white/60 p-4"
          >
            <legend className="sr-only">{m.titulo}</legend>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">{m.titulo}</span>
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
                  className="text-xs text-neutral-500 underline-offset-2 hover:underline"
                >
                  {todasMarcadas ? "Desmarcar todas" : "Marcar todas"}
                </button>
              )}
            </div>
            <ul className="flex flex-col gap-1">
              {doModulo.map((p) => {
                const travada = herdou.has(p);
                const marcada = travada || sel.has(p);
                return (
                  <li key={p}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl px-2 py-1.5 text-sm transition hover:bg-neutral-100 ${travada ? "cursor-default" : ""}`}
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
                        <span className="block text-[11px] text-neutral-400">
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

/** Cargo + permissões individuais: trocar o cargo atualiza as travadas. */
export function CargoEPermissoes({
  cargos,
  cargoInicial,
  marcadas,
}: {
  cargos: { id: string; nome: string; permissoes: Permissao[] }[];
  cargoInicial: string | null;
  marcadas: Permissao[];
}) {
  const [cargo, setCargo] = useState(cargoInicial ?? "");
  const herdadas = cargos.find((c) => c.id === cargo)?.permissoes ?? [];
  return (
    <div className="flex flex-col gap-4">
      <label className="flex max-w-sm flex-col gap-1 text-xs font-medium text-neutral-600">
        Cargo
        <Selecao
          name="cargo_id"
          valor={cargo}
          aoMudar={setCargo}
          opcoes={[
            {
              valor: "",
              rotulo: "Sem cargo",
              descricao: "Só as permissões individuais",
            },
            ...cargos.map((c) => ({
              valor: c.id,
              rotulo: c.nome,
              descricao: `${c.permissoes.length} permissões`,
            })),
          ]}
        />
      </label>
      <div>
        <p className="mb-3 text-xs text-neutral-500">
          Permissões travadas vêm do cargo. Marque outras para dar acesso só a
          esta pessoa.
        </p>
        <CaixasDePermissao marcadas={marcadas} herdadas={herdadas} />
      </div>
    </div>
  );
}
