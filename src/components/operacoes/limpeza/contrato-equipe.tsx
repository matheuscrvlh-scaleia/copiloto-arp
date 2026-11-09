"use client";

import { CircleAlert, CircleCheck, Plus, Trash2 } from "lucide-react";
import { formatarNumero } from "@/lib/formato";
import { reais } from "@/lib/operacoes/limpeza";
import {
  centavosDoTexto,
  GRUPOS_EQUIPE,
  type GrupoEquipe,
} from "@/lib/operacoes/limpeza-lancamento";
import { campoCelula, celula } from "./campos";
import { type LancamentoTela, type Mudar, novaChave } from "./estado";

// Composição do contrato do mês (só a parte de limpeza entra na
// conferência) e a equipe: quem trabalha onde, com os minutos por dia de
// cada um dos que limpam os blocos, para conferir com a jornada.

function BotaoRemover({
  rotulo,
  aoClicar,
}: {
  rotulo: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="grid size-8 place-items-center rounded-full text-neutral-500 hover:bg-red-500/10 hover:text-red-700"
      aria-label={rotulo}
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}

function BotaoIncluir({
  rotulo,
  aoClicar,
}: {
  rotulo: string;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium hover:border-neutral-400"
    >
      <Plus className="size-3.5" aria-hidden /> {rotulo}
    </button>
  );
}

export function ComposicaoDoContrato({
  l,
  mudar,
  editavel,
}: {
  l: LancamentoTela;
  mudar: Mudar;
  editavel: boolean;
}) {
  const total = l.contrato.reduce(
    (s, c) => s + (centavosDoTexto(c.valor) ?? 0),
    0,
  );
  const naConferencia = l.contrato
    .filter((c) => c.entraConferencia)
    .reduce((s, c) => s + (centavosDoTexto(c.valor) ?? 0), 0);
  return (
    <div data-guia="op-limpeza-contrato">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <caption className="sr-only">Composição do contrato do mês</caption>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className={celula}>Item</th>
              <th className={`${celula} text-right`}>Valor (R$)</th>
              <th className={`${celula} text-center`}>Na conferência</th>
              {editavel && (
                <th className={celula}>
                  <span className="sr-only">Remover</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/[0.06]">
            {l.contrato.map((c, i) => {
              const set = (mudanca: Partial<typeof c>) =>
                mudar((t) => ({
                  ...t,
                  contrato: t.contrato.map((y, j) =>
                    j === i ? { ...y, ...mudanca } : y,
                  ),
                }));
              return (
                <tr key={c.k}>
                  <td className={celula}>
                    <input
                      aria-label="Item do contrato"
                      value={c.descricao}
                      onChange={(e) => set({ descricao: e.target.value })}
                      disabled={!editavel}
                      maxLength={200}
                      className={`${campoCelula} w-full min-w-56 text-left`}
                    />
                  </td>
                  <td className={`${celula} text-right`}>
                    <input
                      aria-label={`Valor de ${c.descricao || "item"}`}
                      inputMode="decimal"
                      value={c.valor}
                      onChange={(e) => set({ valor: e.target.value })}
                      disabled={!editavel}
                      className={`${campoCelula} w-28`}
                    />
                  </td>
                  <td className={`${celula} text-center`}>
                    <input
                      type="checkbox"
                      aria-label={`${c.descricao || "Item"} entra na conferência`}
                      checked={c.entraConferencia}
                      onChange={(e) =>
                        set({ entraConferencia: e.target.checked })
                      }
                      disabled={!editavel}
                      className="size-4 accent-neutral-900"
                    />
                  </td>
                  {editavel && (
                    <td className={celula}>
                      <BotaoRemover
                        rotulo={`Remover ${c.descricao || "item"}`}
                        aoClicar={() =>
                          mudar((t) => ({
                            ...t,
                            contrato: t.contrato.filter((_, j) => j !== i),
                          }))
                        }
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {l.contrato.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-300 font-semibold">
                <td className={celula}>Total do contrato</td>
                <td className={`${celula} text-right tabular-nums`}>
                  {reais(total)}
                </td>
                <td
                  className={`${celula} text-center text-xs font-normal text-neutral-600`}
                >
                  {reais(naConferencia)}
                </td>
                {editavel && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!l.contrato.length && (
        <p className="py-2 text-xs text-neutral-500">
          Sem a composição do contrato, a tela não confere o total. Inclua os
          itens da medição e marque os de limpeza.
        </p>
      )}
      {editavel && (
        <BotaoIncluir
          rotulo="Item do contrato"
          aoClicar={() =>
            mudar((t) => ({
              ...t,
              contrato: [
                ...t.contrato,
                {
                  k: novaChave(),
                  descricao: "",
                  valor: "",
                  entraConferencia: true,
                },
              ],
            }))
          }
        />
      )}
    </div>
  );
}

const lerBlocos = (t: string) =>
  [
    ...new Set(
      t
        .split(/[^\d]+/)
        .filter(Boolean)
        .map((b) => b.padStart(2, "0").slice(-2)),
    ),
  ].sort();

export function EquipeDoMes({
  l,
  mudar,
  editavel,
}: {
  l: LancamentoTela;
  mudar: Mudar;
  editavel: boolean;
}) {
  const minutosDoBloco = new Map(
    l.minutos.map((m) => [
      m.bloco,
      (Number(m.limpeza) || 0) + (Number(m.manutencao) || 0),
    ]),
  );
  const totalBlocos = [...minutosDoBloco.values()].reduce((s, v) => s + v, 0);
  const nosBlocos = l.equipe.filter((m) => m.grupo === "blocos");
  const somaEquipe = nosBlocos.reduce(
    (s, m) => s + (Number(m.minutosDia) || 0),
    0,
  );
  const contagem = (Object.keys(GRUPOS_EQUIPE) as GrupoEquipe[])
    .map((g) => [g, l.equipe.filter((m) => m.grupo === g).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <div data-guia="op-limpeza-equipe">
      {contagem.length > 0 && (
        <p className="mb-2 text-xs text-neutral-500">
          {l.equipe.length} pessoas:{" "}
          {contagem
            .map(([g, n]) => `${n} ${GRUPOS_EQUIPE[g].toLowerCase()}`)
            .join(", ")}
        </p>
      )}
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="sr-only">Funcionários designados no mês</caption>
          <thead>
            <tr className="text-left text-xs text-neutral-500">
              <th className={celula}>Funcionário</th>
              <th className={celula}>Função</th>
              <th className={celula}>Onde trabalha</th>
              <th className={celula}>Blocos</th>
              <th className={celula}>Turno</th>
              <th className={`${celula} text-right`}>Min/dia</th>
              {editavel && (
                <th className={celula}>
                  <span className="sr-only">Remover</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900/[0.06]">
            {l.equipe.map((m, i) => {
              const set = (mudanca: Partial<typeof m>) =>
                mudar((t) => ({
                  ...t,
                  equipe: t.equipe.map((y, j) =>
                    j === i ? { ...y, ...mudanca } : y,
                  ),
                }));
              const esperado =
                m.grupo === "blocos"
                  ? m.blocos.reduce(
                      (s, b) => s + (minutosDoBloco.get(b) ?? 0),
                      0,
                    )
                  : null;
              const lancado = m.minutosDia.trim() ? Number(m.minutosDia) : null;
              return (
                <tr key={m.k}>
                  <td className={celula}>
                    <input
                      aria-label="Nome do funcionário"
                      value={m.nome}
                      onChange={(e) => set({ nome: e.target.value })}
                      disabled={!editavel}
                      maxLength={120}
                      className={`${campoCelula} w-40 text-left`}
                    />
                  </td>
                  <td className={celula}>
                    <input
                      aria-label={`Função de ${m.nome || "funcionário"}`}
                      value={m.funcao}
                      onChange={(e) => set({ funcao: e.target.value })}
                      disabled={!editavel}
                      maxLength={120}
                      className={`${campoCelula} w-40 text-left`}
                    />
                  </td>
                  <td className={celula}>
                    <select
                      aria-label={`Onde ${m.nome || "o funcionário"} trabalha`}
                      value={m.grupo}
                      onChange={(e) =>
                        set({ grupo: e.target.value as GrupoEquipe })
                      }
                      disabled={!editavel}
                      className={`${campoCelula} w-44 text-left`}
                    >
                      {(Object.keys(GRUPOS_EQUIPE) as GrupoEquipe[]).map(
                        (g) => (
                          <option key={g} value={g}>
                            {GRUPOS_EQUIPE[g]}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                  <td className={celula}>
                    {m.grupo === "blocos" ? (
                      <input
                        aria-label={`Blocos de ${m.nome || "funcionário"} (ex.: 01, 11)`}
                        defaultValue={m.blocos.join(", ")}
                        onBlur={(e) => {
                          const blocos = lerBlocos(e.target.value);
                          e.target.value = blocos.join(", ");
                          set({ blocos });
                        }}
                        disabled={!editavel}
                        placeholder="01, 11"
                        className={`${campoCelula} w-24 text-left`}
                      />
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className={celula}>
                    <input
                      aria-label={`Turno de ${m.nome || "funcionário"}`}
                      value={m.turno}
                      onChange={(e) => set({ turno: e.target.value })}
                      disabled={!editavel}
                      maxLength={80}
                      className={`${campoCelula} w-32 text-left`}
                    />
                  </td>
                  <td className={`${celula} text-right`}>
                    <span className="inline-flex items-center gap-1.5">
                      {esperado !== null &&
                        lancado !== null &&
                        (lancado === esperado ? (
                          <CircleCheck
                            className="size-3.5 text-green-700"
                            aria-label="Confere com os minutos dos blocos"
                          />
                        ) : (
                          <CircleAlert
                            className="size-3.5 text-amber-700"
                            aria-label={`Os blocos somam ${esperado} minutos`}
                          />
                        ))}
                      <input
                        aria-label={`Minutos por dia de ${m.nome || "funcionário"}`}
                        inputMode="numeric"
                        value={m.minutosDia}
                        onChange={(e) =>
                          set({
                            minutosDia: e.target.value
                              .replace(/\D/g, "")
                              .slice(0, 4),
                          })
                        }
                        disabled={!editavel}
                        className={`${campoCelula} w-16`}
                      />
                    </span>
                    {esperado !== null &&
                      lancado !== null &&
                      lancado !== esperado && (
                        <span className="block text-[11px] text-amber-800">
                          blocos: {formatarNumero(esperado)}
                        </span>
                      )}
                  </td>
                  {editavel && (
                    <td className={celula}>
                      <BotaoRemover
                        rotulo={`Remover ${m.nome || "funcionário"}`}
                        aoClicar={() =>
                          mudar((t) => ({
                            ...t,
                            equipe: t.equipe.filter((_, j) => j !== i),
                          }))
                        }
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {nosBlocos.length > 0 && (
            <tfoot>
              <tr className="border-t border-neutral-300 text-xs">
                <td className={celula} colSpan={5}>
                  Minutos de quem limpa os blocos × total do apontamento
                </td>
                <td
                  className={`${celula} text-right font-semibold tabular-nums`}
                >
                  {formatarNumero(somaEquipe)} / {formatarNumero(totalBlocos)}
                </td>
                {editavel && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!l.equipe.length && (
        <p className="py-2 text-xs text-neutral-500">
          Nenhum funcionário lançado. Cadastre quem trabalha onde (nome, função,
          local e turno); os nomes ficam só aqui.
        </p>
      )}
      {editavel && (
        <BotaoIncluir
          rotulo="Funcionário"
          aoClicar={() =>
            mudar((t) => ({
              ...t,
              equipe: [
                ...t.equipe,
                {
                  k: novaChave(),
                  nome: "",
                  funcao: "",
                  grupo: "blocos",
                  blocos: [],
                  turno: "",
                  minutosDia: "",
                },
              ],
            }))
          }
        />
      )}
    </div>
  );
}
