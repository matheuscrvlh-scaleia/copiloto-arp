import { TriangleAlert } from "lucide-react";
import { type Coluna, Tabela } from "@/components/dashboard/tabela";
import type { CelulaExportar, ColunaExportar } from "@/components/os/exportar";
import { formatarMes, formatarMoeda, formatarNumero } from "@/lib/formato";
import {
  type FaturaConta,
  nomeDaUnidade,
  PAPEIS,
  type UnidadeEnergia,
} from "@/lib/operacoes/energisa-contas";
import type { CreditoPorOrigem } from "@/lib/operacoes/solar";
import { kwh } from "../contas/comum";

// Listas da consulta da energia solar: créditos usados no mês por origem e
// mês de geração, e o saldo de créditos de cada unidade.

const ORIGEM = {
  oUC: "De outra unidade (oUC)",
  mUC: "Da própria unidade (mUC)",
} as const;
const origem = (o: CreditoPorOrigem["origem"]) =>
  o ? ORIGEM[o] : "Origem não lida";

export function ListaCreditos({
  creditos,
  unidades,
}: {
  creditos: CreditoPorOrigem[];
  unidades: Map<string, UnidadeEnergia>;
}) {
  const colunas: Coluna<CreditoPorOrigem>[] = [
    {
      titulo: "Unidade",
      inteiro: true,
      valor: (c) => (
        <span className="flex flex-col">
          <span className="font-medium">
            {nomeDaUnidade(c.matricula, unidades.get(c.matricula))}
          </span>
          <span className="text-xs text-neutral-500">{c.matricula}</span>
        </span>
      ),
    },
    { titulo: "Origem do crédito", valor: (c) => origem(c.origem) },
    {
      titulo: "Gerado em",
      valor: (c) => (c.mesGeracao ? formatarMes(c.mesGeracao) : "—"),
    },
    { titulo: "kWh", numero: true, valor: (c) => formatarNumero(c.kwh) },
    {
      titulo: "Valor (R$)",
      numero: true,
      valor: (c) => (
        <span className="text-green-700">{formatarMoeda(c.valor)}</span>
      ),
    },
  ];
  const totalKwh = creditos.reduce((s, c) => s + c.kwh, 0);
  const totalValor =
    creditos.reduce((s, c) => s + Math.round(c.valor * 100), 0) / 100;
  return (
    <Tabela
      colunas={colunas}
      linhas={creditos}
      chave={(c) => `${c.matricula}|${c.origem}|${c.mesGeracao}`}
      vazio="Nenhum crédito compensado nas faturas deste mês."
      rodape={[
        "Total",
        "",
        "",
        formatarNumero(totalKwh),
        formatarMoeda(totalValor),
      ]}
    />
  );
}

export function ListaSaldos({
  faturas,
  unidades,
}: {
  faturas: FaturaConta[];
  unidades: Map<string, UnidadeEnergia>;
}) {
  const colunas: Coluna<FaturaConta>[] = [
    {
      titulo: "Unidade",
      inteiro: true,
      valor: (f) => {
        const u = unidades.get(f.matricula);
        return (
          <span className="flex flex-col">
            <span className="font-medium">{nomeDaUnidade(f.matricula, u)}</span>
            <span className="text-xs text-neutral-500">
              {f.matricula}
              {u ? ` · ${PAPEIS[u.papel]}` : ""}
            </span>
          </span>
        );
      },
    },
    {
      titulo: "Endereço",
      classe: "hidden xl:table-cell",
      valor: (f) => (
        <span className="text-xs text-neutral-600">
          {unidades.get(f.matricula)?.endereco ?? "—"}
        </span>
      ),
    },
    {
      titulo: "Classificação",
      valor: (f) =>
        f.classificacao_gd
          ? `${f.classificacao_gd.replace("_", " ")} · Lei 14.300/22`
          : "—",
    },
    {
      titulo: "Compensado",
      numero: true,
      valor: (f) => (
        <span className="text-green-700">{kwh(f.compensado_kwh)}</span>
      ),
    },
    { titulo: "Saldo acumulado", numero: true, valor: (f) => kwh(f.saldo_kwh) },
    {
      titulo: "A expirar no próximo ciclo",
      numero: true,
      valor: (f) =>
        (f.expirar_kwh ?? 0) > 0 ? (
          <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
            <TriangleAlert className="size-3.5" aria-hidden />
            {kwh(f.expirar_kwh)}
          </span>
        ) : (
          kwh(f.expirar_kwh)
        ),
    },
  ];
  const soma = (k: "compensado_kwh" | "saldo_kwh" | "expirar_kwh") =>
    faturas.reduce((s, f) => s + (f[k] ?? 0), 0);
  return (
    <Tabela
      colunas={colunas}
      linhas={faturas}
      chave={(f) => f.id}
      vazio="Nenhuma fatura neste mês com esses filtros."
      rodape={[
        `${faturas.length} ${faturas.length === 1 ? "unidade" : "unidades"}`,
        "",
        "",
        kwh(soma("compensado_kwh")),
        kwh(soma("saldo_kwh")),
        kwh(soma("expirar_kwh")),
      ]}
    />
  );
}

export const COLUNAS_EXPORTAR_SOLAR: ColunaExportar[] = [
  { titulo: "Matrícula" },
  { titulo: "Unidade" },
  { titulo: "Origem do crédito" },
  { titulo: "Gerado em" },
  { titulo: "Compensado (kWh)", numero: true, formato: "#,##0" },
  { titulo: "Valor compensado (R$)", numero: true, formato: "#,##0.00" },
  { titulo: "Saldo da unidade (kWh)", numero: true, formato: "#,##0" },
  { titulo: "A expirar (kWh)", numero: true, formato: "#,##0" },
];

/** Uma linha por crédito (unidade, origem, mês de geração), com o saldo da unidade. */
export function linhasParaExportarSolar(
  creditos: CreditoPorOrigem[],
  faturas: FaturaConta[],
  unidades: Map<string, UnidadeEnergia>,
): CelulaExportar[][] {
  const daUnidade = new Map(faturas.map((f) => [f.matricula, f]));
  const comCredito = new Set(creditos.map((c) => c.matricula));
  const linhas: CelulaExportar[][] = creditos.map((c) => [
    c.matricula,
    unidades.get(c.matricula)?.apelido ?? "",
    origem(c.origem),
    c.mesGeracao ? formatarMes(c.mesGeracao) : "",
    c.kwh,
    c.valor,
    daUnidade.get(c.matricula)?.saldo_kwh ?? null,
    daUnidade.get(c.matricula)?.expirar_kwh ?? null,
  ]);
  // Unidade com saldo e sem crédito usado no mês também sai.
  for (const f of faturas) {
    if (comCredito.has(f.matricula)) continue;
    linhas.push([
      f.matricula,
      unidades.get(f.matricula)?.apelido ?? "",
      "Sem crédito usado no mês",
      "",
      0,
      0,
      f.saldo_kwh,
      f.expirar_kwh,
    ]);
  }
  return linhas;
}
