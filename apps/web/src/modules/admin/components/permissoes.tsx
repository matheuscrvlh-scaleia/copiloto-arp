import {
  type CodigoPermissao,
  codigosDoGrupo,
  gruposDePermissao,
  type ProgramaPermissao,
  rotuloDaPermissao,
} from "@arp/shared/admin/grupos-permissao";
import { MODULOS_DE_PERMISSAO as MODULOS } from "@arp/shared/permissions";
import { Check, Lock } from "lucide-react";
import { useState } from "react";
import { Selecao } from "@/components/selecao";
import { Link } from "@/lib/navegacao";

/**
 * Caixas de permissÃ£o por mÃ³dulo. As que vÃªm de `herdadas` (o cargo)
 * aparecem marcadas e travadas; sÃ³ as individuais vÃ£o no formulÃ¡rio, no
 * campo "permissoes". `programas` sÃ£o as "Programa â€“ lanÃ§ar" (uma por
 * programa): ficam num subgrupo de Sustentabilidade e vÃ£o tambÃ©m em
 * "programas_vistas", para o servidor sÃ³ revogar o que a tela mostrou.
 */
export function CaixasDePermissao({
  marcadas,
  herdadas = [],
  programas = [],
  rotuloHerdada = "pelo cargo",
}: {
  marcadas: CodigoPermissao[];
  herdadas?: CodigoPermissao[];
  programas?: ProgramaPermissao[];
  rotuloHerdada?: string;
}) {
  const [sel, setSel] = useState(() => new Set(marcadas));
  const herdou = new Set(herdadas);
  const grupos = gruposDePermissao(programas);

  return (
    <div className="flex flex-col gap-4">
      {programas.map((p) => (
        <input
          key={p.codigo}
          type="hidden"
          name="programas_vistas"
          value={p.codigo}
        />
      ))}
      {grupos.map((m) => {
        const doModulo = codigosDoGrupo(m);
        const livres = doModulo.filter((p) => !herdou.has(p));
        const todasMarcadas =
          livres.length > 0 && livres.every((p) => sel.has(p));
        const nMarcadas = doModulo.filter(
          (p) => herdou.has(p) || sel.has(p),
        ).length;
        const caixa = (p: CodigoPermissao, rotulo: string) => {
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
                  <span className="block text-neutral-800">{rotulo}</span>
                  <span className="block break-all text-[11px] text-neutral-400">
                    {p}
                    {travada && ` Â· ${rotuloHerdada}`}
                  </span>
                </span>
              </label>
            </li>
          );
        };
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
              {m.fixas.map((p) => caixa(p, rotuloDaPermissao(p, programas)))}
            </ul>
            {m.programas.length > 0 && (
              <>
                <h3 className="mb-1 mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Programas (lanÃ§ar)
                </h3>
                <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
                  {m.programas.map((p) => caixa(p.codigo, p.descricao))}
                </ul>
              </>
            )}
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
  permissoes: CodigoPermissao[];
}

/**
 * Escolha do cargo, com o resumo do que ele dÃ¡. As permissÃµes em si sÃ£o
 * editadas sÃ³ no cargo. Inativos sÃ³ aparecem se jÃ¡ sÃ£o o cargo da pessoa.
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
              descricao: "Entra, mas nÃ£o vÃª nenhuma tela",
            },
            ...cargos
              .filter((c) => c.ativo || c.id === cargoInicial)
              .map((c) => ({
                valor: c.id,
                rotulo: c.ativo ? c.nome : `${c.nome} (inativo)`,
                descricao: `${c.permissoes.length} permissÃµes`,
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
        Sem cargo, a pessoa nÃ£o vÃª nenhuma tela.
      </p>
    );
  if (!cargo.ativo)
    return (
      <p className="rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Este cargo estÃ¡ inativo e nÃ£o dÃ¡ nenhuma permissÃ£o. Escolha outro ou
        reative o cargo.
      </p>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      <span>DÃ¡ acesso a</span>
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
            {m.titulo} Â· {n}
          </span>
        );
      })}
      {cargo.permissoes.length === 0 && <span>nada ainda</span>}
      <Link
        href={`/admin/usuarios/cargos/${cargo.id}`}
        className="ml-1 underline-offset-2 hover:text-neutral-900 hover:underline"
      >
        Ver o cargo â†’
      </Link>
    </div>
  );
}
