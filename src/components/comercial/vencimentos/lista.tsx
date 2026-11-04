import { Fonte, Valor } from "@/components/comercial/tela";
import { TabelaLista } from "@/components/dashboard/tabela-lista";
import {
  type Faixas,
  type LinhaVencimento,
  nomeDoMes,
  rotulosDasFaixas,
} from "@/lib/comercial/vencimentos";
import {
  formatarData,
  formatarMes,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import type { CelulaExportar, ColunaExportar } from "@/lib/os/exportar";

// Lista de Vencimentos de contrato (spec 4.6): uma linha por contrato,
// dias para vencer negativo em vermelho, reajuste previsto e agrupamento
// opcional por mês de vencimento. Sem a permissão de valores, as colunas de
// aluguel nem existem (as linhas já chegam sem o valor).

export const ESTIMATIVA = "estimativa; o valor oficial é o do ENET";

export function colunasVencimentos(comValores: boolean) {
  return [
    { titulo: "LUC" },
    { titulo: "Locatário", classe: "min-w-48" },
    { titulo: "Bloco" },
    { titulo: "ABL (m²)", numero: true },
    { titulo: "Início" },
    { titulo: "Término" },
    { titulo: "Dias para vencer", numero: true },
    { titulo: "Tipo de prazo" },
    { titulo: "Índice e mês de reajuste" },
    ...(comValores ? [{ titulo: "Aluguel", numero: true }] : []),
    {
      titulo: "Índice 12 meses",
      numero: true,
      dica: `Acumulado do Banco Central, só para reajuste próximo (${ESTIMATIVA})`,
    },
    ...(comValores
      ? [{ titulo: "Aluguel previsto", numero: true, dica: ESTIMATIVA }]
      : []),
  ];
}

const grupoDe = (l: LinhaVencimento) =>
  l.termino ? l.termino.slice(0, 7) : "indeterminado";
const rotuloGrupo = (g: string) =>
  g === "indeterminado" ? "prazo indeterminado" : formatarMes(g);
const reajuste = (l: LinhaVencimento) =>
  `${l.indice === "IGPM" ? "IGP-M" : "IPCA"} · ${nomeDoMes(l.mesReajuste)}`;

export function ListaVencimentos({
  linhas,
  comValores,
  hrefDe,
  faixas,
}: {
  linhas: LinhaVencimento[];
  comValores: boolean;
  hrefDe: (contrato: string) => string;
  faixas: Faixas;
}) {
  const soma = (ls: LinhaVencimento[]) => ({
    abl: ls.reduce((t, l) => t + l.abl, 0),
    aluguel: ls.reduce((t, l) => t + (l.aluguel ?? 0), 0),
  });
  const rodape = (rotulo: string, ls: LinhaVencimento[]) => {
    const s = soma(ls);
    return [
      rotulo,
      `${formatarNumero(ls.length)} contratos`,
      "",
      formatarNumero(s.abl, 2),
      "",
      "",
      "",
      "",
      "",
      ...(comValores ? [formatarNumero(s.aluguel, 2)] : []),
      "",
      ...(comValores ? [""] : []),
    ];
  };
  const grupos = new Map<string, LinhaVencimento[]>();
  for (const l of linhas)
    grupos.set(grupoDe(l), [...(grupos.get(grupoDe(l)) ?? []), l]);
  const rotulos = rotulosDasFaixas(faixas);
  return (
    <>
      <TabelaLista
        colunas={colunasVencimentos(comValores)}
        placeholder="Buscar LUC, locatário, bloco…"
        vazio="Nenhum contrato nesse filtro."
        alturaMax="max-h-[40rem]"
        ordemInicial={{ coluna: 6, desc: false }}
        rotuloGrupo="Agrupar por mês de vencimento"
        subtotais={Object.fromEntries(
          [...grupos].map(([g, ls]) => [
            g,
            { rotulo: rotuloGrupo(g), celulas: rodape("", ls) },
          ]),
        )}
        linhas={linhas.map((l) => ({
          chave: l.contrato,
          busca: `${l.luc} ${l.locatario} ${l.bloco} ${l.prazo} ${reajuste(l)} ${rotulos[l.faixa]}`,
          grupo: grupoDe(l),
          href: hrefDe(l.contrato),
          tom:
            l.faixa === "vencido"
              ? "alerta"
              : l.faixa === "faixa1"
                ? "atencao"
                : undefined,
          celulas: [
            <span key="l" className="font-mono text-xs font-medium">
              {l.luc}
            </span>,
            <span key="n" className="font-medium">
              {l.locatario}
            </span>,
            l.bloco,
            <Valor key="a" valor={l.abl} />,
            formatarData(l.inicio),
            formatarData(l.termino),
            <Valor key="d" valor={l.dias} casas={0} />,
            l.prazo,
            reajuste(l),
            ...(comValores ? [<Valor key="v" valor={l.aluguel} />] : []),
            l.previsto ? (
              <span
                key="i"
                title={ESTIMATIVA}
                className={l.previsto.acumulado < 0 ? "text-red-700" : ""}
              >
                {formatarPct(l.previsto.acumulado, 2)}
              </span>
            ) : (
              <span key="i" className="text-neutral-400">
                —
              </span>
            ),
            ...(comValores
              ? [<Valor key="p" valor={l.previsto?.aluguel ?? null} />]
              : []),
          ],
          ordem: [
            l.luc,
            l.locatario,
            l.bloco,
            l.abl,
            l.inicio,
            l.termino,
            l.dias,
            l.prazo,
            `${l.indice}${String(l.mesReajuste).padStart(2, "0")}`,
            ...(comValores ? [l.aluguel] : []),
            l.previsto?.acumulado ?? null,
            ...(comValores ? [l.previsto?.aluguel ?? null] : []),
          ],
        }))}
        rodape={rodape("Total", linhas)}
      />
      <Fonte>
        ENET — Contratos (LUC, início, término, prazo, índice e mês de reajuste,
        aluguel), Clientes (locatário) e LUCs (bloco, ABL). Dias para vencer =
        término − hoje. Reajuste previsto: acumulado de 12 meses do índice do
        contrato no Banco Central ({ESTIMATIVA}); índice negativo mantém o
        aluguel.
      </Fonte>
    </>
  );
}

export function colunasExportarVencimentos(
  comValores: boolean,
): ColunaExportar[] {
  return colunasVencimentos(comValores).map((c) => ({
    titulo:
      c.titulo === "Aluguel previsto"
        ? `Aluguel previsto (${ESTIMATIVA})`
        : c.titulo,
    numero: c.numero,
    formato:
      c.titulo === "Dias para vencer"
        ? "#,##0"
        : c.numero
          ? "#,##0.00"
          : undefined,
  }));
}

export function exportarVencimentos(
  ls: LinhaVencimento[],
  comValores: boolean,
): CelulaExportar[][] {
  return ls.map((l) => [
    l.luc,
    l.locatario,
    l.bloco,
    l.abl,
    formatarData(l.inicio),
    l.termino ? formatarData(l.termino) : "",
    l.dias,
    l.prazo,
    reajuste(l),
    ...(comValores ? [l.aluguel] : []),
    l.previsto?.acumulado ?? null,
    ...(comValores ? [l.previsto?.aluguel ?? null] : []),
  ]);
}
