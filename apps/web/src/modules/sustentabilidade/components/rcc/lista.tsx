import { formatarNumero } from "@arp/shared/formato";
import {
  formatarMesNumerico,
  formatarPercentual,
  formatarReais,
  formatarToneladas,
} from "@arp/shared/sustentabilidade/formatos";
import { totaisDoPeriodo } from "@arp/shared/sustentabilidade/rcc";
import type { NotaCalculada } from "@arp/shared/sustentabilidade/rcc-lista";
import { FileText } from "lucide-react";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import type { CelulaExportar, ColunaExportar } from "@/components/exportar";

// Lista do RCC (spec 4.7): uma linha por nota, com toneladas, % reciclado e
// valor economizado calculados com o fator e o preço vigentes na competência.
// O total do rodapé calcula o % sobre as somas, não a média dos meses. Sem a
// permissão de valores, a coluna do valor nem existe.

function colunas(comValores: boolean) {
  return [
    { titulo: "Competência" },
    { titulo: "Empresa e nota", classe: "min-w-56" },
    { titulo: "Caçambas A", numero: true },
    { titulo: "Caçambas B", numero: true },
    { titulo: "Toneladas A", numero: true },
    { titulo: "Toneladas B", numero: true },
    { titulo: "Total (t)", numero: true },
    { titulo: "% reciclado", numero: true },
    ...(comValores
      ? [
          {
            titulo: "Valor economizado",
            numero: true,
            dica: "Caçambas A × (preço da caçamba B − preço da caçamba A), com o preço vigente na competência",
          },
        ]
      : []),
  ];
}

const Valor = ({ valor }: { valor: number | null }) =>
  valor === null ? (
    <span
      className="text-neutral-400"
      title="Sem preço vigente nesta competência: cadastre nos Parâmetros."
    >
      —
    </span>
  ) : (
    <span
      className={`whitespace-nowrap tabular-nums ${valor < 0 ? "text-red-700" : ""}`}
    >
      {formatarReais(valor)}
    </span>
  );

export function ListaRcc({
  notas,
  links,
  comValores,
}: {
  notas: NotaCalculada[];
  /** Link temporário do PDF de cada nota, pelo caminho. */
  links: Record<string, string>;
  comValores: boolean;
}) {
  const t = totaisDoPeriodo(notas);
  return (
    <div data-guia="su-rcc-lista">
      <TabelaLista
        colunas={colunas(comValores)}
        placeholder="Buscar empresa ou número da nota…"
        vazio="Nenhuma nota neste filtro. Escolha outro ano ou toque em Limpar; para lançar, use “Lançar nota”."
        alturaMax="max-h-[40rem]"
        ordemInicial={{ coluna: 0, desc: true }}
        linhas={notas.map((n) => {
          const url = links[n.pdf];
          return {
            chave: n.id,
            busca: `${n.empresa} ${n.numero} ${formatarMesNumerico(n.competencia)}`,
            celulas: [
              <span key="c" className="whitespace-nowrap tabular-nums">
                {formatarMesNumerico(n.competencia)}
              </span>,
              <span key="e" className="flex flex-wrap items-center gap-x-2">
                <span className="font-medium">{n.empresa}</span>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-neutral-700 underline-offset-4 hover:underline"
                  >
                    <FileText className="size-3.5" aria-hidden />
                    Nota {n.numero} (PDF)
                  </a>
                ) : (
                  <span
                    className="text-neutral-500"
                    title="O arquivo da nota não foi encontrado."
                  >
                    Nota {n.numero} (PDF indisponível)
                  </span>
                )}
              </span>,
              formatarNumero(n.cacambasA),
              formatarNumero(n.cacambasB),
              formatarToneladas(n.toneladasA),
              formatarToneladas(n.toneladasB),
              formatarToneladas(n.toneladasTotal),
              formatarPercentual(n.pctReciclado),
              ...(comValores
                ? [<Valor key="v" valor={n.valorEconomizado} />]
                : []),
            ],
            ordem: [
              n.competencia,
              n.empresa,
              n.cacambasA,
              n.cacambasB,
              n.toneladasA,
              n.toneladasB,
              n.toneladasTotal,
              n.pctReciclado,
              ...(comValores ? [n.valorEconomizado] : []),
            ],
          };
        })}
        rodape={[
          "Total",
          `${formatarNumero(notas.length)} ${notas.length === 1 ? "nota" : "notas"}`,
          formatarNumero(t.cacambasA),
          formatarNumero(t.cacambasB),
          formatarToneladas(t.toneladasA),
          formatarToneladas(t.toneladasB),
          formatarToneladas(t.toneladasTotal),
          formatarPercentual(t.pctReciclado),
          ...(comValores ? [formatarReais(t.valorEconomizado)] : []),
        ]}
      />
    </div>
  );
}

export function colunasExportarRcc(comValores: boolean): ColunaExportar[] {
  return [
    { titulo: "Competência" },
    { titulo: "Empresa" },
    { titulo: "Nota" },
    { titulo: "Caçambas A", numero: true, formato: "#,##0" },
    { titulo: "Caçambas B", numero: true, formato: "#,##0" },
    { titulo: "Toneladas A", numero: true, formato: "#,##0.00" },
    { titulo: "Toneladas B", numero: true, formato: "#,##0.00" },
    { titulo: "Total (t)", numero: true, formato: "#,##0.00" },
    { titulo: "% reciclado", numero: true, formato: "0.0" },
    ...(comValores
      ? [
          {
            titulo: "Valor economizado",
            numero: true,
            formato: "#,##0.00",
          },
        ]
      : []),
  ];
}

const arredonda = (v: number | null, casas: number) =>
  v === null ? null : Math.round(v * 10 ** casas) / 10 ** casas;

/** Relatório "RCC mensal": as notas e a linha de total (% sobre as somas). */
export function linhasExportarRcc(
  notas: NotaCalculada[],
  comValores: boolean,
): CelulaExportar[][] {
  const t = totaisDoPeriodo(notas);
  return [
    ...notas.map((n): CelulaExportar[] => [
      formatarMesNumerico(n.competencia),
      n.empresa,
      n.numero,
      n.cacambasA,
      n.cacambasB,
      arredonda(n.toneladasA, 2),
      arredonda(n.toneladasB, 2),
      arredonda(n.toneladasTotal, 2),
      arredonda(n.pctReciclado, 1),
      ...(comValores ? [arredonda(n.valorEconomizado, 2)] : []),
    ]),
    [
      "Total",
      "",
      "",
      t.cacambasA,
      t.cacambasB,
      arredonda(t.toneladasA, 2),
      arredonda(t.toneladasB, 2),
      arredonda(t.toneladasTotal, 2),
      arredonda(t.pctReciclado, 1),
      ...(comValores ? [arredonda(t.valorEconomizado, 2)] : []),
    ],
  ];
}
