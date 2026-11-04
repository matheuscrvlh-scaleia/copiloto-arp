import { TabelaLista } from "@/components/dashboard/tabela-lista";
import type { CelulaExportar, ColunaExportar } from "@/components/os/exportar";
import type {
  LinhaContagem,
  LinhaMensal,
  QuadroMensal,
} from "@/lib/comercial/funil";
import { MESES_CURTOS } from "@/lib/comercial/painel";
import { formatarNumero, formatarPct } from "@/lib/formato";

// Quadros da aba DASHBOARD da planilha, abaixo da lista do Funil: mês × campo
// (com total do ano, % e média) e contagens simples (quantidade e %).

const pct2 = (v: number | null) => formatarPct(v, 2);
const media = (v: number | null) => (v === null ? "—" : formatarNumero(v, 1));

function colunasMensal(rotulo: string, meses: number[]) {
  return [
    { titulo: rotulo, classe: "min-w-40" },
    ...meses.map((m) => ({
      titulo: MESES_CURTOS[m - 1] as string,
      numero: true,
    })),
    { titulo: "Total", numero: true },
    { titulo: "%", numero: true },
    { titulo: "Média", numero: true, dica: "Total ÷ meses do período" },
  ];
}

const celulasMensal = (l: LinhaMensal) => [
  ...l.porMes.map((v) => formatarNumero(v)),
  <span key="t" className="font-semibold">
    {formatarNumero(l.total)}
  </span>,
  pct2(l.pct),
  media(l.media),
];

export function TabelaMensal({
  quadro,
  rotulo,
}: {
  quadro: QuadroMensal;
  rotulo: string;
}) {
  return (
    <TabelaLista
      colunas={colunasMensal(rotulo, quadro.meses)}
      semBusca
      ordemInicial={{ coluna: quadro.meses.length + 1, desc: true }}
      vazio="Nenhuma oportunidade nesse filtro."
      linhas={quadro.linhas.map((l) => ({
        chave: l.rotulo,
        busca: l.rotulo,
        celulas: [
          <span key="r" className="font-medium">
            {l.rotulo}
          </span>,
          ...celulasMensal(l),
        ],
        ordem: [l.rotulo, ...l.porMes, l.total, l.pct, l.media],
      }))}
      rodape={["Total", ...celulasMensal(quadro.total)]}
    />
  );
}

export function TabelaContagem({
  linhas,
  rotulo,
  total,
}: {
  linhas: LinhaContagem[];
  rotulo: string;
  total: number;
}) {
  return (
    <TabelaLista
      colunas={[
        { titulo: rotulo },
        { titulo: "Quantidade", numero: true },
        { titulo: "%", numero: true },
      ]}
      semBusca
      caber
      ordemInicial={{ coluna: 1, desc: true }}
      vazio="Nenhuma oportunidade nesse filtro."
      linhas={linhas.map((l) => ({
        chave: l.rotulo,
        busca: l.rotulo,
        celulas: [l.rotulo, formatarNumero(l.quantidade), pct2(l.pct)],
        ordem: [l.rotulo, l.quantidade, l.pct],
      }))}
      rodape={["Total", formatarNumero(total), total ? pct2(100) : "—"]}
    />
  );
}

/** Quadro mês × fonte ajustada para o Excel e o PDF. */
export function exportarMensal(
  quadro: QuadroMensal,
  rotulo: string,
): { colunas: ColunaExportar[]; linhas: CelulaExportar[][] } {
  const r2 = (v: number | null) =>
    v === null ? null : Math.round(v * 100) / 100;
  const linha = (l: LinhaMensal): CelulaExportar[] => [
    l.rotulo,
    ...l.porMes,
    l.total,
    r2(l.pct),
    r2(l.media),
  ];
  return {
    colunas: colunasMensal(rotulo, quadro.meses).map((c, i) => ({
      titulo: i === quadro.meses.length + 2 ? "% do total" : c.titulo,
      numero: "numero" in c ? c.numero : undefined,
      formato: i >= quadro.meses.length + 2 ? "#,##0.00" : undefined,
    })),
    linhas: [...quadro.linhas.map(linha), linha(quadro.total)],
  };
}
