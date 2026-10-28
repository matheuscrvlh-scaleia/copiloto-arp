"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { classeCampo } from "@/components/estilos";
import { type Acao, EnvioDaAcao, FormAcao } from "@/components/form-acao";
import {
  fimDoMes,
  formatarMes,
  formatarMoeda,
  formatarNumero,
  lerValorBr,
} from "@/lib/formato";
import { type ValorLancado, valorLancadoNoMes } from "@/lib/rh/custo";
import { chaveDoNome, linhasDoModelo } from "@/lib/rh/valores-mensais";

const rotulo = "flex flex-col gap-1 text-xs font-medium text-neutral-600";
const valorBr = (v: number) => formatarNumero(v, 2);

/** "Vale Refeição" → "vale-refeicao", para o nome do arquivo. */
const paraArquivo = (t: string) =>
  chaveDoNome(t)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type ModuloExcel = typeof import("exceljs");

/**
 * Modelo .xlsx gerado no navegador (o gerador só carrega no clique), com o
 * cabeçalho que a importação procura.
 */
async function baixarModelo(
  pessoas: { nome: string; valor: number | null }[],
  nomeArquivo: string,
) {
  // O pacote é CommonJS: no Node vem em `default`, no navegador direto.
  const m = (await import("exceljs")) as ModuloExcel & {
    default?: ModuloExcel;
  };
  const ExcelJS = m.default ?? m;
  const livro = new ExcelJS.Workbook();
  livro.creator = "ARP Centralizador";
  const aba = livro.addWorksheet("Valores");
  aba.addRows(linhasDoModelo(pessoas));
  aba.getRow(1).font = { bold: true };
  aba.views = [{ state: "frozen", ySplit: 1 }];
  aba.getColumn(1).numFmt = "@"; // CPF como texto: não perde o zero à esquerda
  aba.getColumn(1).width = 18;
  aba.getColumn(2).width = Math.min(
    Math.max(12, ...pessoas.map((p) => p.nome.length + 2)),
    60,
  );
  aba.getColumn(3).numFmt = "#,##0.00";
  aba.getColumn(3).width = 14;

  const bytes = await livro.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.append(a);
  a.click();
  a.remove();
  // Dá tempo ao navegador de começar o download antes de soltar o arquivo.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface PessoaDoBeneficio {
  colaborador_id: string;
  nome: string;
  desde: string;
  ate: string | null;
}

/** Quem recebe no mês (uma linha por pessoa, mesmo com vínculos repetidos). */
function pessoasNoMes(pessoas: PessoaDoBeneficio[], competencia: string) {
  return [
    ...new Map(
      pessoas
        .filter(
          (p) =>
            p.desde <= fimDoMes(competencia) &&
            (p.ate === null || p.ate >= competencia),
        )
        .map((p) => [p.colaborador_id, p]),
    ).values(),
  ].sort((a, b) => a.nome.localeCompare(b.nome));
}

const botaoClaro =
  "rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Aba "Valores do mês" do benefício que varia por mês: competência, modelo,
 * importação e cópia em cima; a lista de quem recebe com o campo de valor; a
 * barra de salvar fica presa embaixo da tela. Cada mês é um lançamento à
 * parte; sem lançamento, o custo repete o último anterior.
 */
export function ValoresDoMes({
  beneficioId,
  beneficioNome,
  pessoas,
  lancados,
  mesInicial,
  salvar,
  importar,
}: {
  beneficioId: string;
  /** Vai no nome do arquivo modelo. */
  beneficioNome: string;
  pessoas: PessoaDoBeneficio[];
  /** Lançamentos deste benefício, de todas as competências. */
  lancados: (ValorLancado & { colaborador_id: string })[];
  /** "aaaa-mm" */
  mesInicial: string;
  salvar: Acao;
  importar: Acao;
}) {
  const [mes, setMes] = useState(mesInicial);
  const competencia = `${mes}-01`;
  const doMes = pessoasNoMes(pessoas, competencia);
  const lancadosDe = (id: string) =>
    lancados.filter((l) => l.colaborador_id === id);
  const noMes = (id: string) =>
    lancadosDe(id).find((l) => l.competencia === competencia)?.valor ?? null;
  const antes = (id: string) =>
    valorLancadoNoMes(
      lancadosDe(id).filter((l) => l.competencia < competencia),
      competencia,
    );

  // Campos controlados; voltam ao que está gravado quando muda o mês ou
  // chegam dados novos (depois de salvar ou importar).
  const gravado = Object.fromEntries(
    doMes.map((p) => {
      const v = noMes(p.colaborador_id);
      return [p.colaborador_id, v === null ? "" : valorBr(v)];
    }),
  );
  const assinatura = `${competencia}|${JSON.stringify(gravado)}`;
  const [base, setBase] = useState(assinatura);
  const [valores, setValores] = useState(gravado);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erroModelo, setErroModelo] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  if (base !== assinatura) {
    setBase(assinatura);
    setValores(gravado);
    setCopiado(false);
  }

  const comAnterior = doMes.filter(
    (p) => antes(p.colaborador_id).valor !== null,
  );
  const lancadosNoMes = doMes.filter(
    (p) => noMes(p.colaborador_id) !== null,
  ).length;
  const alterado = doMes.some(
    (p) =>
      (valores[p.colaborador_id] ?? "") !== (gravado[p.colaborador_id] ?? ""),
  );
  const total = doMes.reduce((s, p) => {
    const v = lerValorBr(valores[p.colaborador_id] ?? "");
    return v === null || Number.isNaN(v) ? s : s + v;
  }, 0);
  const termo = chaveDoNome(busca);

  function copiarAnterior() {
    setValores((atual) => {
      const novo = { ...atual };
      for (const p of comAnterior) {
        const v = antes(p.colaborador_id).valor;
        if (v !== null) novo[p.colaborador_id] = valorBr(v);
      }
      return novo;
    });
    setCopiado(true);
  }

  async function modelo() {
    setGerando(true);
    setErroModelo(null);
    try {
      await baixarModelo(
        doMes.map((p) => ({ nome: p.nome, valor: noMes(p.colaborador_id) })),
        `${paraArquivo(beneficioNome) || "beneficio"}-valores-${mes}.xlsx`,
      );
    } catch {
      setErroModelo("Não deu para gerar o modelo. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className={rotulo}>
          Competência
          <input
            type="month"
            value={mes}
            required
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className={`${classeCampo} w-44`}
          />
        </label>
        <p className="text-sm text-neutral-600">
          <span className="font-semibold text-neutral-900 tabular-nums">
            {lancadosNoMes} de {doMes.length}
          </span>{" "}
          com valor lançado em {formatarMes(competencia)}
          {doMes.length - lancadosNoMes > 0 && (
            <span className="text-amber-700">
              {" "}
              · faltam {doMes.length - lancadosNoMes}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl bg-neutral-900/[0.03] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={modelo}
            disabled={gerando || doMes.length === 0}
            className={botaoClaro}
          >
            {gerando ? "Gerando…" : "Baixar planilha modelo"}
          </button>
          <FormAcao
            acao={importar}
            rotulo="Importar planilha"
            rotuloEnviando="Importando…"
            variante="secundario"
            className="flex min-w-0 flex-1 flex-wrap items-center gap-3"
          >
            <input type="hidden" name="beneficio_id" value={beneficioId} />
            <input type="hidden" name="competencia" value={mes} />
            <input
              type="file"
              name="arquivo"
              required
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label={`Planilha com os valores de ${formatarMes(competencia)} (.xlsx)`}
              className="min-w-0 flex-1 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-neutral-100"
            />
          </FormAcao>
          <button
            type="button"
            onClick={copiarAnterior}
            disabled={comAnterior.length === 0}
            title={
              comAnterior.length === 0
                ? `Ninguém tem valor lançado antes de ${formatarMes(competencia)}`
                : undefined
            }
            className={botaoClaro}
          >
            Copiar do mês anterior
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Baixe o modelo com quem recebe em {formatarMes(competencia)}, preencha
          a coluna Valor e importe. Valor em branco não é lançado. O CPF é
          opcional e não é gravado: cada linha vale pela pessoa de mesmo nome.
        </p>
        {erroModelo && <p className="text-xs text-red-700">{erroModelo}</p>}
      </div>

      {doMes.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          Ninguém recebe este benefício em {formatarMes(competencia)}. Adicione
          pessoas ou um tipo de contrato em Quem recebe.
        </p>
      ) : (
        <FormAcao
          acao={salvar}
          rotulo="Salvar valores"
          botaoNoFim={false}
          className="flex flex-col gap-3"
        >
          <input type="hidden" name="beneficio_id" value={beneficioId} />
          <input type="hidden" name="competencia" value={mes} />
          {doMes.length > 8 && (
            <label className="flex items-center gap-2 rounded-full border border-neutral-900/10 bg-white/70 py-1.5 pr-4 pl-1.5 text-sm">
              <span className="grid size-7 place-items-center rounded-full bg-neutral-900 text-white">
                <Search className="size-3.5" aria-hidden />
              </span>
              <span className="sr-only">Buscar pessoa</span>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar pelo nome…"
                className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-400"
              />
            </label>
          )}
          <ul className="flex flex-col divide-y divide-neutral-900/[0.06] text-sm">
            {doMes.map((p) => {
              const anterior = antes(p.colaborador_id);
              const vazio = (valores[p.colaborador_id] ?? "") === "";
              // A busca só esconde: a linha continua no formulário.
              const oculta =
                termo !== "" && !chaveDoNome(p.nome).includes(termo);
              return (
                <li
                  key={p.colaborador_id}
                  className={`grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-4 py-2.5 ${oculta ? "hidden" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.nome}</p>
                    {vazio && (
                      <p className="text-xs text-amber-700">
                        {anterior.valor !== null
                          ? anterior.aviso
                          : "Sem valor: fica fora do custo do mês"}
                      </p>
                    )}
                  </div>
                  <input
                    type="hidden"
                    name="colaborador_id"
                    value={p.colaborador_id}
                  />
                  <input
                    name="valor"
                    inputMode="decimal"
                    aria-label={`Valor de ${p.nome} em ${formatarMes(competencia)} (R$)`}
                    value={valores[p.colaborador_id] ?? ""}
                    onChange={(e) =>
                      setValores((v) => ({
                        ...v,
                        [p.colaborador_id]: e.target.value,
                      }))
                    }
                    placeholder={
                      anterior.valor !== null ? valorBr(anterior.valor) : "R$"
                    }
                    className={`${classeCampo} text-right tabular-nums`}
                  />
                </li>
              );
            })}
          </ul>
          <div className="painel-modal sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
            <div className="text-xs text-neutral-500">
              <p>
                Total digitado:{" "}
                <span className="font-medium text-neutral-900 tabular-nums">
                  {formatarMoeda(total)}
                </span>
                {alterado && (
                  <span className="text-amber-700"> · não salvo</span>
                )}
              </p>
              {copiado ? (
                <p className="text-sky-800">
                  Valores copiados do último mês lançado. Confira e salve.
                </p>
              ) : (
                <p>Campo vazio apaga o lançamento do mês.</p>
              )}
            </div>
            <EnvioDaAcao />
          </div>
        </FormAcao>
      )}
    </div>
  );
}
