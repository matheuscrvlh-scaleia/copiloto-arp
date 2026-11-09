import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { type Coluna, Tabela } from "@/components/dashboard/tabela";
import type { CelulaExportar, ColunaExportar } from "@/components/os/exportar";
import {
  formatarData,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import {
  type AlertaConsumo,
  type FaturaConta,
  nomeDaUnidade,
  somarReais,
  type TotaisDoMes,
  type UnidadeEnergia,
} from "@/lib/operacoes/energisa-contas";
import { kwh, LinkPdf } from "./comum";

// Lista das faturas do mês (uma linha por unidade), com os totais no rodapé
// e a mesma lista para exportar.

export const ROTA_CONTAS = "/operacoes/energia/contas";

const tributos = (f: FaturaConta) => somarReais([f.icms, f.pis_cofins]);

export function ListaContas({
  faturas,
  unidades,
  totais,
  alertas,
  pdfs,
}: {
  faturas: FaturaConta[];
  unidades: Map<string, UnidadeEnergia>;
  totais: TotaisDoMes;
  alertas: AlertaConsumo[];
  /** Link do PDF original pelo caminho do arquivo. */
  pdfs: Map<string, string>;
}) {
  const acima = new Map(alertas.map((a) => [a.matricula, a]));
  const colunas: Coluna<FaturaConta>[] = [
    {
      titulo: "Unidade",
      inteiro: true,
      valor: (f) => {
        const u = unidades.get(f.matricula);
        return (
          <Link href={`${ROTA_CONTAS}/${f.id}`} className="group flex flex-col">
            <span className="font-medium group-hover:underline">
              {nomeDaUnidade(f.matricula, u)}
            </span>
            <span className="text-xs text-neutral-500">
              Matrícula {f.matricula}
              {f.medidor ? ` · medidor ${f.medidor}` : ""}
            </span>
          </Link>
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
    { titulo: "Ref.", valor: (f) => formatarMes(f.referencia) },
    {
      titulo: "Consumo (kWh)",
      numero: true,
      valor: (f) => {
        const a = acima.get(f.matricula);
        return (
          <span
            className={`inline-flex items-center gap-1 ${a ? "font-semibold text-amber-700" : ""}`}
            title={
              a
                ? `${formatarNumero(a.acima, 0)}% acima da média de 12 meses (${formatarNumero(a.media, 0)} kWh)`
                : undefined
            }
          >
            {a && <TrendingUp className="size-3.5" aria-hidden />}
            {formatarNumero(f.consumo_kwh)}
            {a && (
              <span className="sr-only">
                , {formatarNumero(a.acima, 0)}% acima da média
              </span>
            )}
          </span>
        );
      },
    },
    {
      titulo: "Compensado (kWh)",
      numero: true,
      valor: (f) => (
        <span className="text-green-700">
          {formatarNumero(f.compensado_kwh)}
        </span>
      ),
    },
    {
      titulo: "Saldo de créditos",
      numero: true,
      valor: (f) => kwh(f.saldo_kwh),
    },
    {
      titulo: "Bandeira",
      numero: true,
      valor: (f) => (
        <span className="flex flex-col items-end">
          <span>{formatarMoeda(f.valor_bandeira)}</span>
          <span className="text-xs text-neutral-500">{f.bandeira ?? "—"}</span>
        </span>
      ),
    },
    {
      titulo: "Ilum. pública",
      numero: true,
      valor: (f) => formatarMoeda(f.iluminacao_publica),
    },
    {
      titulo: "Tributos",
      numero: true,
      valor: (f) => (
        <span
          title={`ICMS ${formatarMoeda(f.icms)} · PIS/COFINS ${formatarMoeda(f.pis_cofins)}`}
        >
          {formatarMoeda(tributos(f))}
        </span>
      ),
    },
    {
      titulo: "Total (R$)",
      numero: true,
      valor: (f) => (
        <span className="font-semibold">{formatarMoeda(f.total)}</span>
      ),
    },
    { titulo: "Vencimento", valor: (f) => formatarData(f.vencimento) },
    {
      titulo: "Fatura",
      valor: (f) => {
        const href = f.arquivo ? pdfs.get(f.arquivo) : undefined;
        return href ? (
          <LinkPdf
            href={href}
            rotulo={`Abrir o PDF da fatura de ${f.matricula}`}
          />
        ) : (
          <span
            className="text-xs text-neutral-400"
            title={
              f.exemplo ? "Fatura de exemplo, sem PDF" : "PDF não encontrado"
            }
          >
            {f.exemplo ? "exemplo" : "sem PDF"}
          </span>
        );
      },
    },
  ];
  const n = totais.faturas;
  return (
    <Tabela
      colunas={colunas}
      linhas={faturas}
      chave={(f) => f.id}
      vazio="Nenhuma fatura neste mês com esses filtros."
      rodape={[
        `${n} ${n === 1 ? "unidade" : "unidades"}`,
        "",
        "",
        formatarNumero(totais.consumoKwh),
        formatarNumero(totais.compensadoKwh),
        kwh(totais.saldoKwh),
        formatarMoeda(totais.bandeira),
        formatarMoeda(totais.iluminacao),
        formatarMoeda(totais.tributos),
        formatarMoeda(totais.total),
        "",
        "",
      ]}
    />
  );
}

const REAIS = "#,##0.00";
const KWH = "#,##0";

export const COLUNAS_EXPORTAR: ColunaExportar[] = [
  { titulo: "Matrícula" },
  { titulo: "Unidade" },
  { titulo: "Endereço" },
  { titulo: "Referência" },
  { titulo: "Consumo (kWh)", numero: true, formato: KWH },
  { titulo: "Compensado (kWh)", numero: true, formato: KWH },
  { titulo: "Valor compensado (R$)", numero: true, formato: REAIS },
  { titulo: "Saldo de créditos (kWh)", numero: true, formato: KWH },
  { titulo: "Bandeira" },
  { titulo: "Adicional de bandeira (R$)", numero: true, formato: REAIS },
  { titulo: "Iluminação pública (R$)", numero: true, formato: REAIS },
  { titulo: "ICMS (R$)", numero: true, formato: REAIS },
  { titulo: "PIS/COFINS (R$)", numero: true, formato: REAIS },
  { titulo: "Total (R$)", numero: true, formato: REAIS },
  { titulo: "Vencimento" },
];

export function linhasParaExportar(
  faturas: FaturaConta[],
  unidades: Map<string, UnidadeEnergia>,
): CelulaExportar[][] {
  return faturas.map((f) => {
    const u = unidades.get(f.matricula);
    return [
      f.matricula,
      u?.apelido ?? "",
      u?.endereco ?? "",
      formatarMes(f.referencia),
      f.consumo_kwh,
      f.compensado_kwh,
      f.valor_compensado,
      f.saldo_kwh,
      f.bandeira ?? "",
      f.valor_bandeira,
      f.iluminacao_publica,
      f.icms,
      f.pis_cofins,
      f.total,
      formatarData(f.vencimento),
    ];
  });
}
