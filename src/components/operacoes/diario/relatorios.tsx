import { Camera } from "lucide-react";
import Link from "next/link";
import { type Coluna, Tabela } from "@/components/dashboard/tabela";
import { formatarData, formatarHoras, formatarNumero } from "@/lib/formato";
import { STATUS_RELATORIO, statusDe } from "@/lib/operacoes/diario";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import type { LinhaRelatorio } from "@/server/operacoes/diario";
import { BASE, Condicao, dataHoraDoApp, SeloRelatorio } from "./comum";

// Tela 3 — lista de relatórios (também a aba Relatórios da obra). Do
// detalhe já guardado: efetivo, clima da manhã e da tarde, ocorrências e fotos.

const ORIGEM: Record<string, string> = {
  "app-web": "Web",
  "app-android": "Android",
  "app-ios": "iPhone",
};
const origem = (app: string | null) => (app ? (ORIGEM[app] ?? app) : "—");

const SEM_DETALHE = "Detalhe ainda não lido";

function colunas(comObra: boolean): Coluna<LinhaRelatorio>[] {
  return [
    {
      titulo: "Nº",
      numero: true,
      valor: (r) => (
        <Link
          href={`${BASE}/relatorios/${encodeURIComponent(r.id)}`}
          className="font-semibold underline-offset-4 hover:underline"
        >
          {r.numero}
          <span className="sr-only"> — abrir o relatório</span>
        </Link>
      ),
    },
    {
      titulo: "Data",
      valor: (r) => (
        <span className="flex flex-col whitespace-nowrap tabular-nums">
          {formatarData(r.data)}
          {r.dataFim ? ` a ${formatarData(r.dataFim)}` : ""}
          <span className="text-xs text-neutral-500">
            {diaDaSemana(r.data)}
          </span>
        </span>
      ),
    },
    ...(comObra
      ? [
          {
            titulo: "Obra",
            valor: (r: LinhaRelatorio) => (
              <Link
                href={`${BASE}/${encodeURIComponent(r.obraId)}`}
                className="underline-offset-4 hover:underline"
              >
                {r.obra}
              </Link>
            ),
          },
        ]
      : []),
    {
      titulo: "Modelo",
      classe: "hidden 2xl:table-cell",
      valor: (r) => (
        <span className="text-xs text-neutral-600">{r.modelo ?? "—"}</span>
      ),
    },
    { titulo: "Status", valor: (r) => <SeloRelatorio id={r.statusId} /> },
    {
      titulo: "Criado por",
      valor: (r) => (
        <span className="flex flex-col">
          {[r.autor, r.autorCargo].filter(Boolean).join(" · ") || "—"}
          <span className="text-xs text-neutral-500">
            {origem(r.app)} · {dataHoraDoApp(r.criadoNoApp)}
          </span>
        </span>
      ),
    },
    {
      titulo: "Efetivo",
      numero: true,
      valor: (r) =>
        r.resumo?.efetivo === null || r.resumo?.efetivo === undefined
          ? "—"
          : formatarNumero(r.resumo.efetivo),
    },
    {
      titulo: "Clima (manhã / tarde)",
      valor: (r) =>
        r.resumo ? (
          <span className="flex flex-col gap-0.5 text-xs">
            <span>
              Manhã: {r.resumo.manha?.clima ?? "—"} ·{" "}
              <Condicao texto={r.resumo.manha?.condicao} />
            </span>
            <span>
              Tarde: {r.resumo.tarde?.clima ?? "—"} ·{" "}
              <Condicao texto={r.resumo.tarde?.condicao} />
            </span>
          </span>
        ) : (
          <span className="text-xs text-neutral-400">{SEM_DETALHE}</span>
        ),
    },
    {
      titulo: "Ocorrências",
      valor: (r) =>
        !r.resumo ? (
          "—"
        ) : r.resumo.tipos.length > 0 ? (
          <span className="text-xs font-medium text-amber-900">
            {r.resumo.tipos.join(", ")}
          </span>
        ) : r.resumo.ocorrencias > 0 ? (
          <span className="text-xs">
            {formatarNumero(r.resumo.ocorrencias)} sem tipo
          </span>
        ) : (
          <span className="text-xs text-neutral-400">Nenhuma</span>
        ),
    },
    {
      titulo: "Fotos",
      numero: true,
      valor: (r) =>
        r.resumo ? (
          <span className="inline-flex items-center gap-1">
            <Camera className="size-3.5 text-neutral-400" aria-hidden />
            {formatarNumero(r.resumo.fotos)}
          </span>
        ) : (
          "—"
        ),
    },
  ];
}

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
function diaDaSemana(data: string): string {
  return DIAS_SEMANA[new Date(`${data}T12:00:00Z`).getUTCDay()] ?? "";
}

export function ListaDeRelatorios({
  linhas,
  comObra = true,
}: {
  linhas: LinhaRelatorio[];
  /** Na aba da obra, a coluna da obra sai. */
  comObra?: boolean;
}) {
  const efetivo = linhas.reduce((s, r) => s + (r.resumo?.efetivo ?? 0), 0);
  const fotos = linhas.reduce((s, r) => s + (r.resumo?.fotos ?? 0), 0);
  const cols = colunas(comObra);
  const rodape: React.ReactNode[] = cols.map(() => "");
  rodape[0] = formatarNumero(linhas.length);
  rodape[cols.findIndex((c) => c.titulo === "Efetivo")] =
    formatarNumero(efetivo);
  rodape[cols.findIndex((c) => c.titulo === "Fotos")] = formatarNumero(fotos);
  return (
    <div data-guia="op-diario-relatorios">
      <Tabela
        colunas={cols}
        linhas={linhas}
        chave={(r) => r.id}
        vazio="Nenhum relatório no período com estes filtros."
        rodape={rodape}
      />
    </div>
  );
}

export const COLUNAS_EXPORTAR_RELATORIOS: ColunaExportar[] = [
  { titulo: "Nº", numero: true },
  { titulo: "Data" },
  { titulo: "Data final" },
  { titulo: "Dia da semana" },
  { titulo: "Obra" },
  { titulo: "Modelo" },
  { titulo: "Status" },
  { titulo: "Criado por" },
  { titulo: "Cargo" },
  { titulo: "Origem" },
  { titulo: "Criado em" },
  { titulo: "Efetivo", numero: true },
  { titulo: "Homem-hora" },
  { titulo: "Clima manhã" },
  { titulo: "Condição manhã" },
  { titulo: "Clima tarde" },
  { titulo: "Condição tarde" },
  { titulo: "Ocorrências (tipos)" },
  { titulo: "Fotos", numero: true },
  { titulo: "Vídeos", numero: true },
];

export function linhasExportarRelatorios(
  linhas: LinhaRelatorio[],
): CelulaExportar[][] {
  return linhas.map((r) => [
    r.numero,
    formatarData(r.data),
    r.dataFim ? formatarData(r.dataFim) : "",
    diaDaSemana(r.data),
    r.obra,
    r.modelo ?? "",
    statusDe(STATUS_RELATORIO, r.statusId).rotulo,
    r.autor ?? "",
    r.autorCargo ?? "",
    origem(r.app),
    dataHoraDoApp(r.criadoNoApp),
    r.resumo?.efetivo ?? null,
    r.resumo?.homemHora ? formatarHoras(r.resumo.homemHora) : "",
    r.resumo?.manha?.clima ?? "",
    r.resumo?.manha?.condicao ?? "",
    r.resumo?.tarde?.clima ?? "",
    r.resumo?.tarde?.condicao ?? "",
    r.resumo?.tipos.join(", ") ?? "",
    r.resumo?.fotos ?? null,
    r.resumo?.videos ?? null,
  ]);
}
