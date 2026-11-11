import { HardHat, OctagonAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { formatarData } from "@/lib/formato";
import {
  type AlertaDoPainel,
  type LinhaDoPainel,
  STATUS_OBRA,
  STATUS_RELATORIO,
  statusDe,
} from "@/lib/operacoes/diario";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import { BASE, Negativo, pct, pontos } from "./comum";

// Peças da execução na tela de Obras: foto, exportação, o gráfico de avanço
// físico × prazo consumido e os alertas.

export const hrefDaObra = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

/** Foto da obra direto do aplicativo (só endereço http(s), validado na entrada). */
export function FotoDaObra({
  url,
  nome,
}: {
  url: string | null;
  nome: string;
}) {
  if (!url)
    return (
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-900/[0.06] text-neutral-400"
      >
        <HardHat className="size-4" />
      </span>
    );
  return (
    // biome-ignore lint/performance/noImgElement: foto servida pelo aplicativo Diário de Obra (endereço externo)
    <img
      src={url}
      alt={`Foto da obra ${nome}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-neutral-900/10"
    />
  );
}

export const COLUNAS_EXPORTAR: ColunaExportar[] = [
  { titulo: "Obra" },
  { titulo: "Grupo" },
  { titulo: "Status" },
  { titulo: "Responsável" },
  { titulo: "Cliente" },
  { titulo: "Contrato" },
  { titulo: "Início" },
  { titulo: "Fim" },
  { titulo: "Prazo (d)", numero: true },
  { titulo: "Decorrido (d)", numero: true },
  { titulo: "A vencer (d)", numero: true },
  { titulo: "Avanço físico (%)", numero: true },
  { titulo: "Prazo consumido (%)", numero: true },
  { titulo: "Desvio (p.p.)", numero: true },
  { titulo: "Relatórios", numero: true },
  { titulo: "Fotos", numero: true },
  { titulo: "Último relatório" },
  { titulo: "Status do último" },
  { titulo: "Dias sem relatório", numero: true },
];

const arred = (v: number | null) =>
  v === null ? null : Math.round(v * 10) / 10;

export function linhasExportar(linhas: LinhaDoPainel[]): CelulaExportar[][] {
  return linhas.map((l) => [
    l.obra.nome,
    l.obra.grupo ?? "",
    statusDe(STATUS_OBRA, l.obra.statusId).rotulo,
    l.obra.responsavel ?? "",
    l.obra.ficha?.cliente ?? "",
    l.obra.ficha?.numeroContrato ?? "",
    formatarData(l.obra.dataInicio),
    formatarData(l.obra.dataFim),
    l.obra.prazo.contratual,
    l.obra.prazo.decorrido,
    l.obra.prazo.aVencer,
    arred(l.obra.realizado),
    arred(l.consumido),
    arred(l.desvio),
    l.relatorios,
    l.obra.ficha?.visaoGeral?.total?.fotos ?? null,
    l.ultimo ? formatarData(l.ultimo.data) : "",
    l.ultimo ? statusDe(STATUS_RELATORIO, l.ultimo.statusId).rotulo : "",
    l.semRelatorio.length,
  ]);
}

/**
 * Avanço físico × prazo consumido por obra: duas barras na mesma escala
 * (0–100%), com os números escritos. Avanço abaixo do prazo é atraso.
 */
export function AvancoPorPrazo({ linhas }: { linhas: LinhaDoPainel[] }) {
  const comDados = linhas.filter(
    (l) => l.obra.realizado !== null || l.consumido !== null,
  );
  if (comDados.length === 0)
    return (
      <p className="py-6 text-sm text-neutral-500">
        Sem avanço físico nem prazo contratual nas obras filtradas (dependem da
        lista de tarefas e do prazo cadastrados no aplicativo).
      </p>
    );
  const largura = (v: number | null) =>
    `${Math.min(Math.max(v ?? 0, 0), 100)}%`;
  return (
    <ul className="flex flex-col gap-4" data-guia="op-diario-avanco-prazo">
      {comDados.map((l) => (
        <li key={l.obra.id}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <Link
              href={hrefDaObra(l.obra.id)}
              className="font-medium underline-offset-4 hover:underline"
            >
              {l.obra.nome}
            </Link>
            <span className="text-xs text-neutral-500">
              físico {pct(l.obra.realizado)} · prazo {pct(l.consumido)} ·{" "}
              <Negativo valor={l.desvio} texto={pontos(l.desvio)} />
            </span>
          </div>
          <div
            aria-hidden
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-900/[0.07]"
          >
            <div
              className="h-full rounded-full bg-[var(--serie-1)]"
              style={{ width: largura(l.obra.realizado) }}
            />
          </div>
          <div
            aria-hidden
            className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-900/[0.07]"
          >
            <div
              className="h-full rounded-full bg-[var(--serie-neutro)]"
              style={{ width: largura(l.consumido) }}
            />
          </div>
        </li>
      ))}
      <li className="flex gap-4 text-xs text-neutral-500" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-[var(--serie-1)]" />
          Avanço físico
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-2.5 rounded-full bg-[var(--serie-neutro)]" />
          Prazo consumido
        </span>
      </li>
    </ul>
  );
}

/** Alerta da tela de Obras (do Diário ou do orçamento), já com o link. */
export interface AlertaDaTela {
  chave: string;
  grave: boolean;
  texto: string;
  href: string;
}

/** Alertas do Diário com o link para a obra no Diário. */
export const alertasDoDiario = (alertas: AlertaDoPainel[]): AlertaDaTela[] =>
  alertas.map((a) => ({
    chave: `diario-${a.obraId}-${a.tipo}`,
    grave: a.grave,
    texto: a.texto,
    href: hrefDaObra(a.obraId),
  }));

export function Alertas({
  alertas,
  vazio,
}: {
  alertas: AlertaDaTela[];
  vazio: string;
}) {
  if (alertas.length === 0)
    return <p className="py-2 text-sm text-neutral-500">{vazio}</p>;
  return (
    <ul className="flex flex-col gap-2" data-guia="op-diario-alertas">
      {alertas.map((a) => (
        <li
          key={a.chave}
          className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm ${a.grave ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-900"}`}
        >
          {a.grave ? (
            <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          )}
          <span>
            <span className="sr-only">{a.grave ? "Grave: " : "Atenção: "}</span>
            <Link href={a.href} className="underline-offset-4 hover:underline">
              {a.texto}
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
