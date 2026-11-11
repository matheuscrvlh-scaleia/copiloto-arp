"use client";

import { Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { CampoTexto, Painel } from "@/components/operacoes/painel-lateral";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import {
  excluirHidrometro,
  salvarHidrometro,
} from "@/server/operacoes/acoes/cadastros";
import type { HidrometroCadastrado } from "@/server/operacoes/cadastros";
import { BOTAO_PRIMARIO } from "../agua/estilos";

// Cadastro de hidrômetros: a lista com busca e filtros e o painel para
// cadastrar ou corrigir. Cadastrado aqui, o hidrômetro aparece na escolha
// da foto do visor em Importações.

export interface SalaParaEscolher {
  id: string;
  codigo: string;
}

const sem = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

type Situacao = "" | "ativos" | "inativos" | "sem_leitura" | "sem_sala";

export function CadastroDeHidrometros({
  hidrometros,
  salas,
  podeEditar,
}: {
  hidrometros: HidrometroCadastrado[];
  salas: SalaParaEscolher[];
  podeEditar: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [bloco, setBloco] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("");
  const [aberto, setAberto] = useState<string | "novo" | null>(null);
  const blocos = useMemo(
    () => [...new Set(hidrometros.map((h) => h.bloco))].sort(),
    [hidrometros],
  );
  const termo = sem(busca.trim());
  const visiveis = hidrometros.filter(
    (h) =>
      (!bloco || h.bloco === bloco) &&
      (situacao !== "ativos" || h.ativo) &&
      (situacao !== "inativos" || !h.ativo) &&
      (situacao !== "sem_leitura" || !h.meses) &&
      (situacao !== "sem_sala" || !h.sala_id) &&
      (!termo ||
        sem(
          `${h.numero} ${h.sala} ${h.descricao ?? ""} ${h.salaCodigo ?? ""}`,
        ).includes(termo)),
  );
  const atual =
    aberto === "novo" ? null : hidrometros.find((h) => h.id === aberto);

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
              placeholder="Número, sala ou cliente"
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
        <label className="flex flex-col gap-1 text-xs font-medium text-neutral-600">
          Situação
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as Situacao)}
            className={classeCampo}
          >
            <option value="">Todos</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="sem_leitura">Sem leitura importada</option>
            <option value="sem_sala">Sem sala da energia</option>
          </select>
        </label>
        {podeEditar && (
          <button
            type="button"
            onClick={() => setAberto("novo")}
            data-guia="op-cadastros-novo"
            className={`${BOTAO_PRIMARIO} ml-auto`}
          >
            <Plus className="size-4" aria-hidden />
            Novo hidrômetro
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-500" aria-live="polite">
        {visiveis.length === hidrometros.length
          ? `${hidrometros.length} hidrômetros`
          : `${visiveis.length} de ${hidrometros.length} hidrômetros`}
      </p>

      <div
        data-guia="op-cadastros-lista"
        className="overflow-x-auto rounded-2xl border border-neutral-900/[0.06]"
      >
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="bg-neutral-900/[0.03] text-left text-xs text-neutral-600">
            <tr>
              <th className="px-3 py-2 font-medium">Hidrômetro</th>
              <th className="px-3 py-2 font-medium">Bloco · sala</th>
              <th className="px-3 py-2 font-medium">Sala da energia</th>
              <th className="px-3 py-2 font-medium">Cliente ou uso</th>
              <th className="px-3 py-2 font-medium">Leituras</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              {podeEditar && (
                <th className="px-3 py-2">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((h) => (
              <tr key={h.id} className="border-t border-neutral-900/[0.06]">
                <td className="px-3 py-2 font-medium">
                  {h.meses ? (
                    <Link
                      href={`/operacoes/agua/${encodeURIComponent(h.numero)}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {h.numero}
                    </Link>
                  ) : (
                    h.numero
                  )}
                </td>
                <td className="px-3 py-2">
                  {h.bloco} · {h.sala || "—"}
                </td>
                <td className="px-3 py-2">
                  {h.salaCodigo ?? (
                    <span className="text-neutral-400">sem vínculo</span>
                  )}
                </td>
                <td className="px-3 py-2">{h.descricao ?? "—"}</td>
                <td className="px-3 py-2 text-neutral-600">
                  {h.ultimaLeitura
                    ? `${h.meses} ${h.meses === 1 ? "mês" : "meses"} · última ${rotuloMes(h.ultimaLeitura)}`
                    : "nenhuma"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${h.ativo ? "bg-emerald-50 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}
                  >
                    {h.ativo ? "Ativo" : "Inativo"}
                  </span>
                </td>
                {podeEditar && (
                  <td className="px-3 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => setAberto(h.id)}
                      aria-label={`Editar o hidrômetro ${h.numero}`}
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
                  colSpan={7}
                  className="px-3 py-8 text-center text-neutral-500"
                >
                  {hidrometros.length
                    ? "Nenhum hidrômetro com estes filtros."
                    : "Nenhum hidrômetro cadastrado ainda."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aberto && (
        <Painel
          titulo={atual ? `Hidrômetro ${atual.numero}` : "Novo hidrômetro"}
          aoFechar={() => setAberto(null)}
        >
          <FormularioHidrometro
            key={atual?.id ?? "novo"}
            h={atual ?? null}
            salas={salas}
            aoConcluir={() => setAberto(null)}
          />
        </Painel>
      )}
    </div>
  );
}

function FormularioHidrometro({
  h,
  salas,
  aoConcluir,
}: {
  h: HidrometroCadastrado | null;
  salas: SalaParaEscolher[];
  aoConcluir: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <FormAcao
        acao={salvarHidrometro}
        rotulo={h ? "Salvar" : "Cadastrar hidrômetro"}
        aoConcluir={aoConcluir}
      >
        {h && <input type="hidden" name="id" value={h.id} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoTexto
            rotulo="Número do hidrômetro"
            nome="numero"
            valor={h?.numero ?? ""}
            obrigatorio
          />
          <CampoTexto
            rotulo="Bloco (ex.: 05)"
            nome="bloco"
            valor={h?.bloco ?? ""}
            numerico
            obrigatorio
          />
          <CampoTexto rotulo="Sala" nome="sala" valor={h?.sala ?? ""} />
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700">
            Sala da energia
            <select
              name="sala_id"
              defaultValue={h?.sala_id ?? ""}
              className={classeCampo}
            >
              <option value="">
                Sem vínculo (liga pela sala, se o código existir)
              </option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <CampoTexto
              rotulo="Cliente ou uso (ex.: Estoque ARP)"
              nome="descricao"
              valor={h?.descricao ?? ""}
            />
          </div>
          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-700 sm:col-span-2">
            Observações
            <textarea
              name="observacoes"
              defaultValue={h?.observacoes ?? ""}
              rows={3}
              maxLength={500}
              className={classeCampo}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              name="ativo"
              defaultChecked={h?.ativo ?? true}
              className="size-4"
            />
            Ativo (aparece na escolha da foto)
          </label>
        </div>
      </FormAcao>
      {h && (
        <section className="flex flex-col gap-2 border-t border-neutral-900/[0.06] pt-4">
          <p className="text-xs text-neutral-500">
            Excluir tira o hidrômetro só do cadastro: as leituras importadas
            continuam. Para parar de usar, prefira desmarcar “Ativo”.
          </p>
          <FormAcao
            acao={excluirHidrometro}
            rotulo="Excluir do cadastro"
            rotuloEnviando="Excluindo…"
            variante="perigo"
            confirmar={`Excluir o hidrômetro ${h.numero} do cadastro? As leituras importadas continuam.`}
            aoConcluir={aoConcluir}
          >
            <input type="hidden" name="id" value={h.id} />
          </FormAcao>
        </section>
      )}
    </div>
  );
}
