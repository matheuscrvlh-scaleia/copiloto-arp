import {
  type ColunaLista,
  type LinhaLista,
  TabelaLista,
} from "@/components/dashboard/tabela-lista";
import { formatarData, formatarNumero } from "@/lib/formato";
import { ALERTAS } from "@/lib/operacoes/agua-alertas";
import {
  formatarM3,
  ROTULO_TIPO,
  rotuloMes,
} from "@/lib/operacoes/agua-formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";
import type { LeituraComAlertas } from "@/server/operacoes/agua";
import { FotoDoVisor } from "./foto";
import { Alertas, BASE_AGUA, TipoFaturamento, VisorDeExemplo } from "./tela";

// Lista "Leituras do mês" (spec 4.4, Tela 1): uma linha por leitura, com o
// cliente do faturamento ao lado do locatário vigente no ENET, a foto e os
// alertas; subtotal por bloco e o total no rodapé (soma das linhas). Clicar
// abre o hidrômetro. Sem a permissão de valores, a coluna de reais não existe.

const n2 = (v: number | null) => (v === null ? "—" : formatarNumero(v, 2));

function Leitura({
  valor,
  data,
}: {
  valor: number | null;
  data: string | null;
}) {
  return (
    <span className="flex flex-col items-end">
      <span>{n2(valor)}</span>
      {data && (
        <span className="text-[11px] text-neutral-500">
          {formatarData(data)}
        </span>
      )}
    </span>
  );
}

function Enet({ l }: { l: LeituraComAlertas }) {
  if (l.locatarios === null)
    return (
      <span
        className="text-xs text-neutral-400"
        title="ENET sem contratos lidos"
      >
        —
      </span>
    );
  if (!l.locatarios.length)
    return (
      <span className="text-xs font-medium text-amber-800">
        Sem contrato vigente
      </span>
    );
  const difere = l.alertas.some((a) => a.codigo === "cliente_difere");
  return (
    <span className={difere ? "font-medium text-red-800" : "text-neutral-600"}>
      {l.locatarios.join(" · ")}
    </span>
  );
}

type Legenda = Pick<
  LeituraComAlertas,
  "referencia" | "bloco" | "sala" | "leituraAtual" | "consumo"
>;

export function legendaDaFoto(l: Legenda) {
  return `${rotuloMes(l.referencia)} · Bloco ${l.bloco} · sala ${l.sala || "—"} · leitura ${n2(l.leituraAtual)} m³ · consumo ${formatarM3(l.consumo)}`;
}

/** Miniatura da foto (ou o visor desenhado nos dados de exemplo). */
export function Foto({
  l,
  links,
  className,
}: {
  l: Pick<
    LeituraComAlertas,
    | "foto"
    | "exemplo"
    | "hidrometro"
    | "leituraAtual"
    | "referencia"
    | "bloco"
    | "sala"
    | "consumo"
  >;
  links: Map<string, string>;
  className?: string;
}) {
  const link = l.foto && !l.exemplo ? (links.get(l.foto) ?? null) : null;
  return (
    <FotoDoVisor
      link={link}
      desenho={
        l.foto && l.exemplo ? (
          <VisorDeExemplo leitura={l.leituraAtual} className="size-full" />
        ) : undefined
      }
      titulo={`Hidrômetro ${l.hidrometro}`}
      legenda={legendaDaFoto(l)}
      className={className}
    />
  );
}

export function ListaDeLeituras({
  leituras,
  comValores,
  links,
  limite,
}: {
  leituras: LeituraComAlertas[];
  comValores: boolean;
  links: Map<string, string>;
  limite: number;
}) {
  const colunas: ColunaLista[] = [
    { titulo: "Bloco" },
    { titulo: "Sala" },
    { titulo: "Cliente no faturamento", classe: "min-w-40" },
    { titulo: "Locatário no ENET", classe: "min-w-40" },
    { titulo: "Hidrômetro" },
    { titulo: "Leit. anterior", numero: true },
    { titulo: "Leit. atual", numero: true },
    { titulo: "Dias", numero: true },
    { titulo: "Consumo (m³)", numero: true },
    { titulo: "Fat. (m³)", numero: true },
    ...(comValores ? [{ titulo: "Valor (R$)", numero: true }] : []),
    { titulo: "Tipo" },
    { titulo: "Foto" },
    { titulo: "Alertas", classe: "min-w-40" },
  ];
  const linhas: LinhaLista[] = leituras.map((l) => ({
    chave: l.id,
    grupo: l.bloco,
    href: `${BASE_AGUA}/${encodeURIComponent(l.hidrometro)}`,
    tom: l.alertas.length ? "alerta" : undefined,
    busca: `${l.bloco} ${l.sala} ${l.cliente} ${l.hidrometro} ${(l.locatarios ?? []).join(" ")}`,
    celulas: [
      l.bloco,
      <span key="s">
        {l.sala || "—"}
        {l.noArquivo && (
          <span
            className="block text-[11px] text-neutral-500"
            title="Vínculo corrigido"
          >
            No arquivo: {l.noArquivo.bloco} · {l.noArquivo.sala || "—"}
          </span>
        )}
      </span>,
      l.cliente || "—",
      <Enet key="e" l={l} />,
      <span key="h" className="text-neutral-600">
        {l.hidrometro}
      </span>,
      <Leitura key="a" valor={l.leituraAnterior} data={l.dataAnterior} />,
      <span
        key="t"
        className={l.leituraAtual === 0 ? "font-medium text-red-700" : ""}
      >
        <Leitura valor={l.leituraAtual} data={l.dataAtual} />
      </span>,
      l.dias ?? "—",
      <span
        key="c"
        className={`font-semibold ${l.consumo > limite ? "text-amber-700" : ""}`}
      >
        {n2(l.consumo)}
      </span>,
      n2(l.volume),
      ...(comValores ? [n2(l.valor)] : []),
      <TipoFaturamento key="tp" tipo={l.tipo} />,
      <Foto key="f" l={l} links={links} />,
      <Alertas key="al" alertas={l.alertas} />,
    ],
    ordem: [
      l.bloco,
      l.sala,
      l.cliente,
      (l.locatarios ?? []).join(" "),
      l.hidrometro,
      l.leituraAnterior,
      l.leituraAtual,
      l.dias,
      l.consumo,
      l.volume,
      ...(comValores ? [l.valor] : []),
      l.tipo,
      l.foto ? 1 : 0,
      l.alertas.length,
    ],
  }));

  const soma = (xs: LeituraComAlertas[], f: (l: LeituraComAlertas) => number) =>
    xs.reduce((s, l) => s + Math.round(f(l) * 1000), 0) / 1000;
  const totais = (xs: LeituraComAlertas[]) => [
    soma(xs, (l) => l.consumo),
    soma(xs, (l) => l.volume),
    ...(comValores
      ? [xs.reduce((s, l) => s + Math.round((l.valor ?? 0) * 100), 0) / 100]
      : []),
  ];
  const celulasTotal = (rotulo: string, xs: LeituraComAlertas[]) => [
    rotulo,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ...totais(xs).map((t) => n2(t)),
    "",
    "",
    "",
  ];
  const blocos = [...new Set(leituras.map((l) => l.bloco))];
  const subtotais = Object.fromEntries(
    blocos.map((b) => {
      const xs = leituras.filter((l) => l.bloco === b);
      return [
        b,
        {
          rotulo: `Bloco ${b} · ${xs.length} hidrômetros`,
          celulas: celulasTotal(`Bloco ${b}`, xs),
        },
      ];
    }),
  );

  return (
    <div data-guia="op-agua-leituras">
      <TabelaLista
        colunas={colunas}
        linhas={linhas}
        rodape={celulasTotal(
          `${formatarNumero(leituras.length)} leituras`,
          leituras,
        )}
        subtotais={subtotais}
        rotuloGrupo="Subtotal por bloco"
        placeholder="Buscar sala, cliente, locatário ou hidrômetro…"
        vazio="Nenhuma leitura com estes filtros."
        alturaMax="max-h-[40rem]"
      />
    </div>
  );
}

/** Excel e PDF: as colunas da tela, uma linha por leitura. */
export function exportarLeituras(
  leituras: LeituraComAlertas[],
  comValores: boolean,
): { colunas: ColunaExportar[]; linhas: CelulaExportar[][] } {
  const m3 = { numero: true, formato: "#,##0.00" };
  const colunas: ColunaExportar[] = [
    { titulo: "Referência" },
    { titulo: "Bloco" },
    { titulo: "Sala" },
    { titulo: "Cliente no faturamento" },
    { titulo: "Locatário no ENET" },
    { titulo: "Hidrômetro" },
    { titulo: "Data anterior" },
    { titulo: "Leitura anterior", ...m3 },
    { titulo: "Data atual" },
    { titulo: "Leitura atual", ...m3 },
    { titulo: "Dias", numero: true },
    { titulo: "Consumo (m³)", ...m3 },
    { titulo: "Faturado (m³)", ...m3 },
    ...(comValores ? [{ titulo: "Valor (R$)", ...m3 }] : []),
    { titulo: "Tipo" },
    { titulo: "Foto" },
    { titulo: "Alertas" },
  ];
  const linhas = leituras.map((l) => [
    rotuloMes(l.referencia),
    l.bloco,
    l.sala,
    l.cliente,
    l.locatarios === null
      ? ""
      : l.locatarios.join(" · ") || "Sem contrato vigente",
    l.hidrometro,
    l.dataAnterior ? formatarData(l.dataAnterior) : "",
    l.leituraAnterior,
    l.dataAtual ? formatarData(l.dataAtual) : "",
    l.leituraAtual,
    l.dias,
    l.consumo,
    l.volume,
    ...(comValores ? [l.valor] : []),
    ROTULO_TIPO[l.tipo],
    l.foto ? "Sim" : "Sem foto",
    l.alertas.map((a) => `${ALERTAS[a.codigo].rotulo}: ${a.texto}`).join(" | "),
  ]);
  return { colunas, linhas };
}
