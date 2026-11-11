"use client";

import { Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { CampoTexto, Painel } from "@/components/operacoes/painel-lateral";
import { excluirSala, salvarSala } from "@/server/operacoes/acoes/cadastros";
import type { SalaCadastrada } from "@/server/operacoes/cadastros";
import { BOTAO_PRIMARIO } from "../agua/estilos";

// Cadastro das salas da energia (código BLxx-sala): as caixas dos quadros e
// os hidrômetros se ligam a elas.

const sem = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const CAMPOS = [
  ["pavimento", "Pavimento"],
  ["armario", "Armário"],
  ["projeto", "Projeto"],
  ["disjuntor", "Disjuntor"],
  ["rota", "Rota"],
] as const;

export function CadastroDeSalas({
  salas,
  hidrometrosPorSala,
  podeEditar,
}: {
  salas: SalaCadastrada[];
  hidrometrosPorSala: Record<string, number>;
  podeEditar: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [bloco, setBloco] = useState("");
  const [aberta, setAberta] = useState<string | "nova" | null>(null);
  const blocos = useMemo(
    () => [...new Set(salas.map((s) => s.bloco))].sort(),
    [salas],
  );
  const termo = sem(busca.trim());
  const visiveis = salas.filter(
    (s) =>
      (!bloco || s.bloco === bloco) &&
      (!termo ||
        sem(`${s.codigo} ${s.pavimento ?? ""} ${s.observacoes ?? ""}`).includes(
          termo,
        )),
  );
  const atual = aberta === "nova" ? null : salas.find((s) => s.id === aberta);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium text-neutral-600">
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
              placeholder="Código (BL04-311), pavimento ou observação"
              className={`${classeCampo} pl-9`}
            />
          </span>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Bloco
          <select
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            {blocos.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setAberta("nova")}
            className={`${BOTAO_PRIMARIO} ml-auto`}
          >
            <Plus className="size-4" aria-hidden />
            Nova sala
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500" aria-live="polite">
        {visiveis.length === salas.length
          ? `${salas.length} salas`
          : `${visiveis.length} de ${salas.length} salas`}
      </p>

      <div className="overflow-x-auto rounded-2xl border border-neutral-900/[0.06]">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="bg-neutral-900/[0.03] text-left text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Sala</th>
              <th className="px-3 py-2 font-medium">Pavimento</th>
              <th className="px-3 py-2 font-medium">Disjuntor · rota</th>
              <th className="px-3 py-2 text-right font-medium">Caixas</th>
              <th className="px-3 py-2 text-right font-medium">Hidrômetros</th>
              {podeEditar && (
                <th className="px-3 py-2">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((s) => (
              <tr key={s.id} className="border-t border-neutral-900/[0.06]">
                <td className="px-3 py-2 font-medium">{s.codigo}</td>
                <td className="px-3 py-2">{s.pavimento ?? "—"}</td>
                <td className="px-3 py-2">
                  {[s.disjuntor, s.rota].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {s.caixas}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {hidrometrosPorSala[s.id] ?? 0}
                </td>
                {podeEditar && (
                  <td className="px-3 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => setAberta(s.id)}
                      aria-label={`Editar a sala ${s.codigo}`}
                      className="grid size-9 place-items-center rounded-full hover:bg-neutral-900/[0.06]"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!visiveis.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  {salas.length
                    ? "Nenhuma sala com estes filtros."
                    : "Nenhuma sala cadastrada ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aberta && (
        <Painel
          titulo={atual ? `Sala ${atual.codigo}` : "Nova sala"}
          aoFechar={() => setAberta(null)}
        >
          <div className="flex flex-col gap-6">
            <FormAcao
              key={atual?.id ?? "nova"}
              acao={salvarSala}
              rotulo={atual ? "Salvar" : "Cadastrar sala"}
              aoConcluir={() => setAberta(null)}
            >
              {atual && <input type="hidden" name="id" value={atual.id} />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CampoTexto
                  rotulo="Bloco (ex.: 04)"
                  nome="bloco"
                  valor={atual?.bloco ?? ""}
                  numerico
                  obrigatorio
                />
                <CampoTexto
                  rotulo="Sala (ex.: 311 ou 101-102)"
                  nome="sala"
                  valor={atual?.sala ?? ""}
                  obrigatorio
                />
                {CAMPOS.map(([nome, rotulo]) => (
                  <CampoTexto
                    key={nome}
                    rotulo={rotulo}
                    nome={nome}
                    valor={atual?.[nome] ?? ""}
                  />
                ))}
                <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 sm:col-span-2">
                  Observações
                  <textarea
                    name="observacoes"
                    defaultValue={atual?.observacoes ?? ""}
                    rows={3}
                    maxLength={500}
                    className={classeCampo}
                  />
                </label>
              </div>
              <p className="text-xs text-neutral-500">
                O código da sala é montado do bloco e da sala (ex.: BL04-311).
              </p>
            </FormAcao>
            {atual && (
              <section className="flex flex-col gap-2 border-t border-neutral-900/[0.06] pt-4">
                <p className="text-xs text-neutral-500">
                  {atual.caixas || hidrometrosPorSala[atual.id]
                    ? `Esta sala tem ${atual.caixas} caixa(s) e ${hidrometrosPorSala[atual.id] ?? 0} hidrômetro(s) ligados: ao excluir, eles ficam sem sala.`
                    : "Nenhuma caixa ou hidrômetro ligado a esta sala."}
                </p>
                <FormAcao
                  acao={excluirSala}
                  rotulo="Excluir sala"
                  rotuloEnviando="Excluindo…"
                  variante="perigo"
                  confirmar={`Excluir a sala ${atual.codigo}? Caixas e hidrômetros ligados a ela ficam sem sala.`}
                  aoConcluir={() => setAberta(null)}
                >
                  <input type="hidden" name="id" value={atual.id} />
                </FormAcao>
              </section>
            )}
          </div>
        </Painel>
      )}
    </div>
  );
}
