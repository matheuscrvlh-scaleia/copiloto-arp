"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { CampoTexto, Painel } from "@/components/operacoes/painel-lateral";
import { formatarNumero } from "@/lib/formato";
import {
  excluirColetor,
  salvarColetor,
} from "@/server/sustentabilidade/acoes/coletores";

// Cadastro dos coletores (spec 4.6 e 4.11): lista e painel para cadastrar ou
// corrigir. A ronda usa os ativos, nesta ordem. Capacidade em litros fica "a
// confirmar" enquanto vazia. O limite de alerta e quem recebe o recolhimento
// são dos Parâmetros.

export interface ColetorCadastrado {
  id: string;
  local: string;
  cor: "preto" | "azul";
  conteineres: number;
  capacidadeL: number | null;
  ativo: boolean;
  ordem: number;
  exemplo: boolean;
}

const BOTAO =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";
const NOME_COR = { preto: "Preto (não reciclável)", azul: "Azul (reciclável)" };

const litros = (v: number | null) =>
  v === null ? null : `${formatarNumero(v, Number.isInteger(v) ? 0 : 2)} L`;

export function CadastroDeColetores({
  coletores,
  podeEditar,
}: {
  coletores: ColetorCadastrado[];
  podeEditar: boolean;
}) {
  const [aberto, setAberto] = useState<string | "novo" | null>(null);
  const atual =
    aberto === "novo" ? null : coletores.find((c) => c.id === aberto);
  const proximaOrdem = Math.max(0, ...coletores.map((c) => c.ordem)) + 1;
  const ativos = coletores.filter((c) => c.ativo).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500" aria-live="polite">
          {coletores.length} {coletores.length === 1 ? "coletor" : "coletores"}{" "}
          · {ativos} {ativos === 1 ? "ativo" : "ativos"} (os ativos entram na
          ronda)
        </p>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setAberto("novo")}
            data-guia="su-coletores-novo"
            className={BOTAO}
          >
            <Plus className="size-4" aria-hidden />
            Novo coletor
          </button>
        )}
      </div>

      <div
        data-guia="su-coletores-lista"
        className="overflow-x-auto rounded-2xl border border-neutral-900/[0.06]"
      >
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-neutral-900/[0.03] text-left text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Ordem</th>
              <th className="px-3 py-2 font-medium">Local</th>
              <th className="px-3 py-2 font-medium">Cor</th>
              <th className="px-3 py-2 text-right font-medium">Contêineres</th>
              <th className="px-3 py-2 text-right font-medium">
                Capacidade de cada contêiner
              </th>
              <th className="px-3 py-2 font-medium">Situação</th>
              {podeEditar && (
                <th className="px-3 py-2">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {coletores.map((c) => (
              <tr key={c.id} className="border-t border-neutral-900/[0.06]">
                <td className="px-3 py-2 tabular-nums text-neutral-600">
                  {c.ordem}
                </td>
                <td className="px-3 py-2 font-medium">
                  {c.local}
                  {c.exemplo && (
                    <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                      exemplo
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      aria-hidden
                      className={`size-2.5 rounded-full ${c.cor === "preto" ? "bg-neutral-800" : "bg-[var(--serie-1)]"}`}
                    />
                    {NOME_COR[c.cor]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatarNumero(c.conteineres)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {litros(c.capacidadeL) ?? (
                    <span className="text-neutral-500">a confirmar</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.ativo ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}
                  >
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {podeEditar && (
                  <td className="px-3 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => setAberto(c.id)}
                      aria-label={`Editar o coletor ${c.local} (${c.cor})`}
                      className="grid size-9 place-items-center rounded-full hover:bg-neutral-900/[0.06]"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!coletores.length && (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  Nenhum coletor cadastrado. A ronda depende dele: use “Novo
                  coletor” para cadastrar o primeiro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aberto && (
        <Painel
          titulo={atual ? `Coletor ${atual.local}` : "Novo coletor"}
          aoFechar={() => setAberto(null)}
        >
          <Formulario
            key={atual?.id ?? "novo"}
            c={atual ?? null}
            ordemSugerida={proximaOrdem}
            aoConcluir={() => setAberto(null)}
          />
        </Painel>
      )}
    </div>
  );
}

function Formulario({
  c,
  ordemSugerida,
  aoConcluir,
}: {
  c: ColetorCadastrado | null;
  ordemSugerida: number;
  aoConcluir: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <FormAcao
        acao={salvarColetor}
        rotulo={c ? "Salvar" : "Cadastrar coletor"}
        aoConcluir={aoConcluir}
      >
        {c && <input type="hidden" name="id" value={c.id} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CampoTexto
              rotulo="Local (ex.: PEV Caçula)"
              nome="local"
              valor={c?.local ?? ""}
              obrigatorio
            />
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            <span>
              Cor<span className="text-red-700"> *</span>
            </span>
            <select
              name="cor"
              required
              defaultValue={c?.cor ?? ""}
              className={classeCampo}
            >
              <option value="" disabled>
                Escolha a cor
              </option>
              <option value="preto">
                Preto (não reciclável, recolhido todo dia)
              </option>
              <option value="azul">
                Azul (reciclável, recolhido uma vez por semana)
              </option>
            </select>
          </label>
          <CampoTexto
            rotulo="Contêineres (padrão da ronda)"
            nome="conteineres"
            valor={String(c?.conteineres ?? 1)}
            numerico
            obrigatorio
          />
          <CampoTexto
            rotulo="Capacidade de cada contêiner, em litros (vazio = a confirmar)"
            nome="capacidade"
            valor={
              c?.capacidadeL === null || !c
                ? ""
                : String(c.capacidadeL).replace(".", ",")
            }
            numerico
          />
          <CampoTexto
            rotulo="Ordem na ronda"
            nome="ordem"
            valor={String(c?.ordem ?? ordemSugerida)}
            numerico
            obrigatorio
          />
          <label className="flex items-center gap-2 text-sm text-neutral-700 sm:col-span-2">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={c?.ativo ?? true}
              className="size-4"
            />
            Ativo (aparece na lista da ronda)
          </label>
        </div>
      </FormAcao>
      {c && (
        <section className="flex flex-col gap-2 border-t border-neutral-900/[0.06] pt-4">
          <p className="text-xs text-neutral-500">
            Excluir só funciona para coletor sem ronda lançada. Para parar de
            usar, prefira desmarcar “Ativo”: as rondas antigas continuam.
          </p>
          <FormAcao
            acao={excluirColetor}
            rotulo="Excluir coletor"
            rotuloEnviando="Excluindo…"
            variante="perigo"
            confirmar={`Excluir o coletor ${c.local} (${c.cor})? Só é possível se ele não tem ronda lançada.`}
            aoConcluir={aoConcluir}
          >
            <input type="hidden" name="id" value={c.id} />
          </FormAcao>
        </section>
      )}
    </div>
  );
}
