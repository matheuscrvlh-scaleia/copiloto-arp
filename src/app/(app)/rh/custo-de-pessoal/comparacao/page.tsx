import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { FiltroCompetencia } from "@/components/dashboard/filtro-competencia";
import { CartaoIndicador } from "@/components/dashboard/indicador";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { EmConstrucao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { AbasDoCusto } from "@/components/rh/abas-custo";
import {
  competenciaDaUrl,
  formatarMes,
  formatarMoeda,
  formatarNumero,
} from "@/lib/formato";
import {
  ativosPorGrupo,
  type CustoAgregado,
  custoMedio,
  somarCustos,
} from "@/lib/rh/custo";
import { COMPONENTES } from "@/lib/rh/modais";
import {
  colaboradoresDoQuadro,
  custoAgregado,
  folhasDoCusto,
} from "@/server/rh/dados";
import { type Busca, fimConsiderado, lerFiltros } from "@/server/rh/filtros";

export const metadata: Metadata = { title: "Custo de pessoal: comparação" };

export default function Page({
  searchParams,
}: PageProps<"/rh/custo-de-pessoal/comparacao">) {
  return (
    <>
      <PageHeader
        title="Custo de pessoal"
        description="Duas competências lado a lado: o que mudou em cada parte do custo e em cada departamento, em R$ e em %."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="rh.custo_pessoal">
          <Comparacao busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const moeda = (v: number) => formatarMoeda(v, 0);
const sinal = (v: number) => (v > 0 ? "+" : v < 0 ? "-" : "");
const difMoeda = (d: number) => `${sinal(d)}${moeda(Math.abs(d))}`;
const difPct = (d: number, base: number) =>
  base ? `${d > 0 ? "+" : ""}${formatarNumero((d / base) * 100, 1)}%` : "—";

async function Comparacao({ busca }: { busca: Promise<Busca> }) {
  const [folhas, pedido, quadro] = await Promise.all([
    folhasDoCusto(),
    busca,
    colaboradoresDoQuadro(),
  ]);
  if (folhas.length < 2)
    return (
      <EmConstrucao motivo="A comparação precisa de pelo menos duas folhas importadas (Configurações › Importações)." />
    );
  const meses = folhas.map((f) => f.competencia).sort();
  const desc = [...meses].reverse();
  const { mes, departamento, departamentos } = await lerFiltros(pedido, desc);
  // Sem ?comparar= (ou inválido): a folha anterior à escolhida.
  const pedidoB = competenciaDaUrl(pedido.comparar);
  const comparar =
    pedidoB && pedidoB !== mes && meses.includes(pedidoB)
      ? pedidoB
      : (meses.filter((c) => c < mes).at(-1) ??
        (desc.find((c) => c !== mes) as string));

  const [de, ate] = mes < comparar ? [mes, comparar] : [comparar, mes];
  const todas = await custoAgregado(de, ate);
  const doDep = <T extends { departamento_id: string | null }>(ls: T[]) =>
    departamento ? ls.filter((l) => l.departamento_id === departamento) : ls;
  const linhasDe = (c: string) =>
    doDep(todas.filter((l) => l.competencia === c));
  const a = somarCustos(linhasDe(mes));
  const b = somarCustos(linhasDe(comparar));
  // Custo médio como no Dashboard: ÷ ativos no Copiloto RH no fim do mês.
  const ativos = (c: string) =>
    [
      ...ativosPorGrupo(
        doDep(quadro),
        [fimConsiderado(c)],
        () => "todos",
      ).values(),
    ].reduce((s, n) => s + n, 0);
  const medioA = custoMedio(a.custo_total, ativos(mes), a.sem_valor);
  const medioB = custoMedio(b.custo_total, ativos(comparar), b.sem_valor);
  const rA = formatarMes(mes);
  const rB = formatarMes(comparar);

  const componentes: { rotulo: string; a: number | null; b: number | null }[] =
    [
      { rotulo: "Custo total", a: a.custo_total, b: b.custo_total },
      ...(
        [
          "remuneracao",
          "encargos",
          "provisoes",
          "beneficios",
          "rescisao",
        ] as const
      ).map((c) => ({ rotulo: COMPONENTES[c].rotulo, a: a[c], b: b[c] })),
      { rotulo: "Custo médio por pessoa", a: medioA, b: medioB },
      { rotulo: "Pessoas no custo", a: a.colaboradores, b: b.colaboradores },
    ];

  // Por departamento: o custo total de cada um nas duas competências.
  const nomeDep = new Map(departamentos.map((d) => [d.id, d.nome]));
  const porDep = new Map<string, { a: number; b: number }>();
  const somar = (ls: CustoAgregado[], lado: "a" | "b") => {
    for (const l of ls) {
      const k = l.departamento_id ?? "";
      const v = porDep.get(k) ?? { a: 0, b: 0 };
      v[lado] += Number(l.custo_total);
      porDep.set(k, v);
    }
  };
  somar(linhasDe(mes), "a");
  somar(linhasDe(comparar), "b");
  const departamentosLinhas = [...porDep]
    .map(([id, v]) => ({
      rotulo: (id && nomeDep.get(id)) || "Sem departamento",
      ...v,
      d: v.a - v.b,
    }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));

  const dTotal = a.custo_total - b.custo_total;

  return (
    <div className="flex flex-col gap-6">
      <FiltroCompetencia
        meses={desc}
        mes={mes}
        comparar={comparar}
        departamentos={departamentos}
        departamento={departamento}
      />
      <AbasDoCusto />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CartaoIndicador
          titulo={`Custo total de ${rA}`}
          tom="escuro"
          valor={moeda(a.custo_total)}
          detalhe={`${a.colaboradores} pessoas no custo`}
        />
        <CartaoIndicador
          titulo={`Custo total de ${rB}`}
          valor={moeda(b.custo_total)}
          detalhe={`${b.colaboradores} pessoas no custo`}
        />
        <CartaoIndicador
          titulo="Diferença"
          tom="verde"
          valor={difMoeda(dTotal)}
          detalhe={`${difPct(dTotal, b.custo_total)} de ${rB} para ${rA}`}
        />
      </div>

      <Secao
        titulo="Por componente"
        descricao={`Diferença = ${rA} − ${rB}; % sobre ${rB}`}
      >
        <TabelaComparada
          colunas={[rA, rB]}
          linhas={componentes.map((l) => ({
            rotulo: l.rotulo,
            a: l.a,
            b: l.b,
            pessoas: l.rotulo === "Pessoas no custo",
          }))}
        />
      </Secao>

      <Secao
        titulo="Por departamento"
        descricao={`Custo total de cada departamento, do que mais mudou para o que menos mudou`}
      >
        <TabelaComparada
          colunas={[rA, rB]}
          linhas={departamentosLinhas.map((l) => ({
            rotulo: l.rotulo,
            a: l.a,
            b: l.b,
          }))}
        />
      </Secao>

      <Nota>
        Fonte: custo calculado de cada folha (mesmas contas do Dashboard). Custo
        médio = custo total ÷ colaboradores ativos no Copiloto RH no fim do mês,
        sem os PJ sem valor informado.
      </Nota>
    </div>
  );
}

function TabelaComparada({
  colunas,
  linhas,
}: {
  colunas: [string, string];
  linhas: {
    rotulo: string;
    a: number | null;
    b: number | null;
    pessoas?: boolean;
  }[];
}) {
  const valor = (v: number | null, pessoas?: boolean) =>
    v === null ? "—" : pessoas ? formatarNumero(v) : moeda(v);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead>
          <tr className="text-left text-xs text-neutral-500">
            <th className="py-2 pr-3 font-medium" />
            <th className="py-2 pr-3 text-right font-medium">{colunas[0]}</th>
            <th className="py-2 pr-3 text-right font-medium">{colunas[1]}</th>
            <th className="py-2 pr-3 text-right font-medium">Diferença R$</th>
            <th className="py-2 text-right font-medium">Diferença %</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const d = l.a !== null && l.b !== null ? l.a - l.b : null;
            return (
              <tr
                key={l.rotulo}
                className="border-t border-neutral-900/[0.06] tabular-nums"
              >
                <td className="py-2 pr-3">{l.rotulo}</td>
                <td className="py-2 pr-3 text-right">
                  {valor(l.a, l.pessoas)}
                </td>
                <td className="py-2 pr-3 text-right">
                  {valor(l.b, l.pessoas)}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-medium ${d ? (d > 0 ? "text-amber-800" : "text-emerald-700") : ""}`}
                >
                  {d === null
                    ? "—"
                    : l.pessoas
                      ? `${d > 0 ? "+" : ""}${formatarNumero(d)}`
                      : difMoeda(d)}
                </td>
                <td className="py-2 text-right">
                  {d === null || l.b === null ? "—" : difPct(d, l.b)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <CartaoCarregando altura="h-11" />
      <CartaoCarregando altura="h-32" />
      <CartaoCarregando altura="h-80" />
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}
