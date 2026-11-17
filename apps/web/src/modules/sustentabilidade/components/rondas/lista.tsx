import { formatarDataHora, formatarNumero } from "@arp/shared/formato";
import {
  type LinhaRonda,
  type MediaDoLocal,
  mediaGeralPorCor,
} from "@arp/shared/sustentabilidade/rondas-lista";
import { TriangleAlert } from "lucide-react";
import { Tabela } from "@/components/dashboard/tabela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import type { CelulaExportar, ColunaExportar } from "@/components/exportar";

// Lista de Rondas (spec 4.6): uma linha por coletor visitado. Só percentuais:
// volume em litros ou kg só entra depois que a fórmula for confirmada.

const COLUNAS = [
  { titulo: "Data e hora" },
  { titulo: "Local", classe: "min-w-40" },
  { titulo: "Cor" },
  { titulo: "Contêineres", numero: true },
  { titulo: "Ocupação (%)", numero: true },
  { titulo: "Alerta" },
  { titulo: "Lançado por" },
];

const NOME_COR = { preto: "Preto", azul: "Azul" } as const;

function Cor({ cor }: { cor: "preto" | "azul" }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className={`size-2.5 rounded-full ${cor === "preto" ? "bg-neutral-800" : "bg-[var(--serie-1)]"}`}
      />
      {NOME_COR[cor]}
    </span>
  );
}

export function ListaDeRondas({
  linhas,
  limite,
}: {
  linhas: LinhaRonda[];
  limite: number;
}) {
  const cheios = linhas.filter((l) => l.cheio).length;
  return (
    <div data-guia="su-rondas-lista">
      <TabelaLista
        colunas={COLUNAS}
        placeholder="Buscar local, cor, quem lançou…"
        vazio="Nenhuma ronda neste filtro. Amplie o período ou toque em Limpar; para lançar, use “Lançar ronda”."
        alturaMax="max-h-[40rem]"
        ordemInicial={{ coluna: 0, desc: true }}
        linhas={linhas.map((l) => ({
          chave: l.chave,
          busca: `${l.local} ${NOME_COR[l.cor]} ${l.lancadoPor ?? ""} ${l.cheio ? "cheio" : ""}`,
          tom: l.cheio ? "alerta" : undefined,
          celulas: [
            <span key="d" className="whitespace-nowrap tabular-nums">
              {formatarDataHora(l.dataHora)}
            </span>,
            <span key="l" className="font-medium">
              {l.local}
            </span>,
            <Cor key="c" cor={l.cor} />,
            formatarNumero(l.conteineres),
            `${formatarNumero(l.ocupacaoPct)}%`,
            l.cheio ? (
              <span
                key="a"
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700"
              >
                <TriangleAlert className="size-3" aria-hidden />
                Cheio (≥ {formatarNumero(limite)}%)
              </span>
            ) : (
              <span key="a" className="text-neutral-400">
                —
              </span>
            ),
            l.lancadoPor ?? "—",
          ],
          ordem: [
            Date.parse(l.dataHora),
            l.local,
            l.cor,
            l.conteineres,
            l.ocupacaoPct,
            l.cheio ? 1 : 0,
            l.lancadoPor,
          ],
        }))}
        rodape={[
          `${formatarNumero(linhas.length)} ${linhas.length === 1 ? "visita" : "visitas"}`,
          "",
          "",
          formatarNumero(linhas.reduce((t, l) => t + l.conteineres, 0)),
          "",
          cheios
            ? `${formatarNumero(cheios)} cheio${cheios === 1 ? "" : "s"}`
            : "",
          "",
        ]}
      />
    </div>
  );
}

const pct = (v: number | null) =>
  v === null ? "—" : `${formatarNumero(v, 1)}%`;

/** Média do período por local e cor (ponderada pelos contêineres). */
export function MediaPorLocal({
  medias,
  linhas,
}: {
  medias: MediaDoLocal[];
  linhas: LinhaRonda[];
}) {
  const geral = (cor: "preto" | "azul") => mediaGeralPorCor(linhas, cor);
  return (
    <div data-guia="su-rondas-media">
      <Tabela
        colunas={[
          { titulo: "Local", valor: (m: MediaDoLocal) => m.local },
          { titulo: "Cor", valor: (m) => <Cor cor={m.cor} /> },
          {
            titulo: "Rondas",
            numero: true,
            valor: (m) => formatarNumero(m.rondas),
          },
          {
            titulo: "Contêineres (soma das visitas)",
            numero: true,
            valor: (m) => formatarNumero(m.conteineres),
          },
          {
            titulo: "Ocupação média",
            numero: true,
            valor: (m) => pct(m.ocupacaoMedia),
          },
          {
            titulo: "Maior ocupação",
            numero: true,
            valor: (m) => `${formatarNumero(m.maxima)}%`,
          },
        ]}
        linhas={medias}
        chave={(m) => `${m.local}|${m.cor}`}
        vazio="Sem ronda no filtro: não há média para mostrar."
        rodape={
          medias.length
            ? [
                "Todos os locais",
                "Pretos · Azuis",
                "",
                "",
                `${pct(geral("preto"))} · ${pct(geral("azul"))}`,
                "",
              ]
            : undefined
        }
      />
    </div>
  );
}

export const COLUNAS_EXPORTAR_RONDAS: ColunaExportar[] = [
  { titulo: "Data e hora" },
  { titulo: "Local" },
  { titulo: "Cor" },
  { titulo: "Contêineres", numero: true, formato: "#,##0" },
  { titulo: "Ocupação (%)", numero: true, formato: "#,##0" },
  { titulo: "Alerta" },
  { titulo: "Lançado por" },
];

/**
 * Relatório "Rondas dos coletores": as visitas do filtro e, depois delas, a
 * média por local e cor (ponderada pelos contêineres) e a média de cada cor.
 */
export function linhasExportarRondas(
  linhas: LinhaRonda[],
  medias: MediaDoLocal[],
  limite: number,
): CelulaExportar[][] {
  const visitas = linhas.map((l): CelulaExportar[] => [
    formatarDataHora(l.dataHora),
    l.local,
    NOME_COR[l.cor],
    l.conteineres,
    l.ocupacaoPct,
    l.cheio ? `Cheio (≥ ${limite}%)` : "",
    l.lancadoPor ?? "",
  ]);
  if (!medias.length) return visitas;
  const nota = (
    quando: string,
    local: string,
    cor: string,
    cont: number | null,
    media: number | null,
  ): CelulaExportar[] => [
    quando,
    local,
    cor,
    cont,
    media === null ? null : Math.round(media * 10) / 10,
    "",
    "",
  ];
  return [
    ...visitas,
    nota("Média do período", "", "", null, null),
    ...medias.map((m) =>
      nota("Média", m.local, NOME_COR[m.cor], m.conteineres, m.ocupacaoMedia),
    ),
    nota(
      "Média geral",
      "Todos os locais",
      "Preto",
      null,
      mediaGeralPorCor(linhas, "preto"),
    ),
    nota(
      "Média geral",
      "Todos os locais",
      "Azul",
      null,
      mediaGeralPorCor(linhas, "azul"),
    ),
  ];
}
