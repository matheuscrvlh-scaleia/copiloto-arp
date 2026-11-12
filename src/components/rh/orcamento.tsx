"use client";

import { CalendarDays, Loader, Pencil, Plus, Tag } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { classeCampo } from "@/components/estilos";
import { FormAcao } from "@/components/form-acao";
import { Painel } from "@/components/operacoes/painel-lateral";
import { Abas } from "@/components/os/abas";
import { Selecao } from "@/components/selecao";
import { formatarData, formatarMoeda } from "@/lib/formato";
import type { GastoDoAno } from "@/lib/rh/orcamento";
import { excluirGasto, salvarGasto } from "@/server/rh/acoes/orcamento";

// Planejamento orçamentário: filtros (ano, mês, categoria) na URL, as abas
// (Dashboard, Lançamentos, Cadastros), a lista de gastos e o painel de lançar
// ou corrigir um gasto.

const RAIZ = "/rh/planejamento-orcamentario";

/** Abas do módulo; Dashboard e Lançamentos levam o filtro junto. */
export function AbasDoOrcamento({ cadastros }: { cadastros: boolean }) {
  const filtro = useSearchParams().toString();
  const com = (href: string) => (filtro ? `${href}?${filtro}` : href);
  return (
    <Abas
      rotulo="Telas do planejamento orçamentário"
      abas={[
        { href: com(RAIZ), rotulo: "Dashboard" },
        { href: com(`${RAIZ}/lancamentos`), rotulo: "Lançamentos" },
        ...(cadastros
          ? [{ href: `${RAIZ}/cadastros`, rotulo: "Cadastros" }]
          : []),
      ]}
    />
  );
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

interface Categoria {
  id: string;
  nome: string;
  ativa: boolean;
}

export function FiltrosDoOrcamento({
  anos,
  ano,
  mes,
  categorias,
  categoria,
}: {
  anos: number[];
  ano: number;
  mes: number | null;
  categorias: Categoria[];
  categoria: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [carregando, iniciar] = useTransition();

  function trocar(nome: "ano" | "mes" | "cat", valor: string) {
    const novos = new URLSearchParams(params);
    if (valor) novos.set(nome, valor);
    else novos.delete(nome);
    iniciar(() =>
      router.replace(`${pathname}?${novos.toString()}`, { scroll: false }),
    );
  }

  return (
    <div
      data-guia="filtros"
      className="flex flex-wrap items-center gap-2"
      aria-busy={carregando}
    >
      <Selecao
        variante="pilula"
        rotulo="Ano"
        icone={<CalendarDays className="size-4" />}
        className="w-32"
        valor={String(ano)}
        aoMudar={(v) => trocar("ano", v)}
        opcoes={anos.map((a) => ({ valor: String(a), rotulo: String(a) }))}
      />
      <Selecao
        variante="pilula"
        rotulo="Mês"
        className="w-44"
        valor={mes ? String(mes) : ""}
        aoMudar={(v) => trocar("mes", v)}
        opcoes={[
          { valor: "", rotulo: "Ano inteiro" },
          ...MESES.map((m, i) => ({ valor: String(i + 1), rotulo: m })),
        ]}
      />
      <Selecao
        variante="pilula"
        rotulo="Categoria"
        icone={<Tag className="size-4" />}
        className="w-56"
        valor={categoria ?? ""}
        aoMudar={(v) => trocar("cat", v)}
        opcoes={[
          { valor: "", rotulo: "Todas as categorias" },
          ...categorias.map((c) => ({
            valor: c.id,
            rotulo: c.ativa ? c.nome : `${c.nome} (desativada)`,
          })),
        ]}
      />
      {carregando && (
        <Loader
          className="size-4 animate-spin text-neutral-400"
          aria-label="Carregando"
        />
      )}
    </div>
  );
}

const BOTAO =
  "inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800";
const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";

/**
 * Lista de gastos do filtro. Com `editavel` (pode lançar e o ano está
 * aberto), lança, corrige e exclui.
 */
export function GastosDoOrcamento({
  gastos,
  categorias,
  editavel,
  dataPadrao,
  ano,
}: {
  gastos: GastoDoAno[];
  categorias: Categoria[];
  editavel: boolean;
  /** Data sugerida para um gasto novo (aaaa-mm-dd). */
  dataPadrao: string;
  ano: number;
}) {
  const [aberto, setAberto] = useState<string | "novo" | null>(null);
  const atual =
    aberto === "novo" ? null : (gastos.find((g) => g.id === aberto) ?? null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-500" aria-live="polite">
          {gastos.length === 1
            ? "1 gasto lançado"
            : `${gastos.length} gastos lançados`}
        </p>
        {editavel && (
          <button
            type="button"
            data-guia="novo"
            onClick={() => setAberto("novo")}
            className={BOTAO}
          >
            <Plus className="size-4" aria-hidden />
            Lançar gasto
          </button>
        )}
      </div>

      {gastos.length > 0 && (
        <div
          data-guia="tabela"
          className="overflow-x-auto rounded-2xl border border-neutral-900/[0.06]"
        >
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-neutral-900/[0.03] text-left text-xs text-neutral-600">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Categoria</th>
                <th className="px-3 py-2 font-medium">O que foi gasto</th>
                <th className="px-3 py-2 font-medium">Finalidade</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
                {editavel && (
                  <th className="px-3 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/[0.05]">
              {gastos.map((g) => (
                <tr key={g.id} className="align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {formatarData(g.data)}
                  </td>
                  <td className="px-3 py-2">{g.categoria}</td>
                  <td className="px-3 py-2">
                    {g.descricao}
                    {g.observacao && (
                      <span className="block text-xs text-neutral-500">
                        {g.observacao}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{g.finalidade}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    {formatarMoeda(g.valor)}
                  </td>
                  {editavel && (
                    <td className="whitespace-nowrap px-3 py-1 text-right">
                      <button
                        type="button"
                        onClick={() => setAberto(g.id)}
                        aria-label={`Corrigir o gasto de ${formatarData(g.data)}`}
                        className="grid size-9 place-items-center rounded-full text-neutral-500 hover:bg-neutral-900/[0.06] hover:text-neutral-900"
                      >
                        <Pencil className="size-4" aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aberto !== null && (
        <Painel
          titulo={atual ? "Corrigir gasto" : "Lançar gasto"}
          aoFechar={() => setAberto(null)}
        >
          <FormularioDoGasto
            gasto={atual}
            categorias={categorias}
            dataPadrao={dataPadrao}
            ano={ano}
            aoConcluir={() => setAberto(null)}
          />
        </Painel>
      )}
    </div>
  );
}

function FormularioDoGasto({
  gasto,
  categorias,
  dataPadrao,
  ano,
  aoConcluir,
}: {
  gasto: GastoDoAno | null;
  categorias: Categoria[];
  dataPadrao: string;
  ano: number;
  aoConcluir: () => void;
}) {
  // Só as ativas; ao corrigir, a do gasto continua na lista mesmo
  // desativada (o gasto antigo não perde a categoria).
  const opcoes = categorias
    .filter((c) => c.ativa || c.id === gasto?.categoria_id)
    .map((c) => ({
      valor: c.id,
      rotulo: c.ativa ? c.nome : `${c.nome} (desativada)`,
    }));
  return (
    <div className="flex flex-col gap-6">
      <FormAcao
        acao={salvarGasto}
        rotulo={gasto ? "Salvar correção" : "Lançar gasto"}
        aoConcluir={aoConcluir}
        className="flex flex-col gap-4"
      >
        {gasto && <input type="hidden" name="id" value={gasto.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={rotulo}>
            Data
            <input
              type="date"
              name="data"
              required
              defaultValue={gasto?.data ?? dataPadrao}
              min={`${ano}-01-01`}
              max={`${ano}-12-31`}
              className={classeCampo}
            />
          </label>
          <label className={rotulo}>
            Valor (R$)
            <input
              name="valor"
              required
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                gasto ? gasto.valor.toFixed(2).replace(".", ",") : ""
              }
              className={classeCampo}
            />
          </label>
        </div>
        <label className={rotulo}>
          Categoria
          <Selecao
            name="categoria_id"
            obrigatorio
            rotulo="Categoria"
            placeholder="Escolha da lista…"
            valorInicial={gasto?.categoria_id ?? ""}
            opcoes={opcoes}
          />
        </label>
        <label className={rotulo}>
          O que foi gasto
          <input
            name="descricao"
            required
            maxLength={200}
            placeholder="Ex.: bolo e salgados"
            defaultValue={gasto?.descricao ?? ""}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Finalidade
          <input
            name="finalidade"
            required
            maxLength={200}
            placeholder="Ex.: aniversariantes de outubro"
            defaultValue={gasto?.finalidade ?? ""}
            className={classeCampo}
          />
        </label>
        <label className={rotulo}>
          Observação
          <textarea
            name="observacao"
            rows={3}
            maxLength={1000}
            placeholder="Opcional"
            defaultValue={gasto?.observacao ?? ""}
            className={classeCampo}
          />
        </label>
      </FormAcao>
      {gasto && (
        <FormAcao
          acao={excluirGasto}
          rotulo="Excluir gasto"
          rotuloEnviando="Excluindo…"
          variante="perigo"
          confirmar={`Excluir este gasto? O gasto de ${formatarMoeda(gasto.valor)} em ${formatarData(gasto.data)} sai do orçamento.`}
          aoConcluir={aoConcluir}
          className="border-t border-neutral-900/[0.06] pt-4"
        >
          <input type="hidden" name="id" value={gasto.id} />
        </FormAcao>
      )}
    </div>
  );
}
