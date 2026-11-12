import type { Metadata } from "next";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import {
  CartaoIndicador,
  CartaoPendente,
} from "@/components/dashboard/indicador";
import { Secao } from "@/components/dashboard/tabela";
import { SemAcesso } from "@/components/protegido";
import { AbasDoOrcamento, FiltrosDoOrcamento } from "@/components/rh/orcamento";
import {
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarMoeda,
  formatarPct,
} from "@/lib/formato";
import {
  filtrarGastos,
  mesesDoAno,
  porCategoria,
  soma,
} from "@/lib/rh/orcamento";
import { telaDoOrcamento } from "@/server/rh/orcamento";

export const metadata: Metadata = { title: "Planejamento orçamentário" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/rh/planejamento-orcamentario">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Tela busca={searchParams} />
    </Suspense>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const t = await telaDoOrcamento(await busca);
  if (!t) return <SemAcesso />;
  const {
    lanca,
    hoje,
    anoAtual,
    anos,
    ano,
    mes,
    categoria,
    categorias,
    nomeCategoria,
    gastos,
    doFiltro,
    orcamento,
    finalizado,
    rotuloFiltro,
  } = t;
  const valor = orcamento?.valor ?? null;
  const daCategoria = filtrarGastos(gastos, { mes: null, categoria });
  const meses = mesesDoAno(ano, daCategoria, valor);
  // Saldo do orçamento: sempre com todas as categorias (o orçamento é um
  // só), até o fim do mês escolhido ou até hoje no ano corrente.
  const todos = mesesDoAno(ano, gastos, valor);
  const ate =
    mes ??
    (ano === anoAtual ? Number(hoje.slice(5, 7)) : ano < anoAtual ? 12 : 1);
  const doSaldo = todos[ate - 1];
  const gastoNoFiltro = soma(doFiltro);

  const itensMes = meses.map((m, i) => ({
    chave: m.competencia,
    rotulo: formatarMes(m.competencia).slice(0, 3),
    titulo: formatarMes(m.competencia),
    valor: m.gasto,
    texto: formatarMoeda(m.gasto, 0),
    detalhe:
      m.consumidoPct === null
        ? undefined
        : `${formatarPct(m.consumidoPct)} do orçamento consumido até o mês`,
    destaque: mes === i + 1,
  }));
  const eixo = meses.map((m) => ({
    chave: m.competencia,
    rotulo: formatarMes(m.competencia).slice(0, 3),
    titulo: formatarMes(m.competencia),
  }));
  const categoriasDoFiltro = porCategoria(
    filtrarGastos(gastos, { mes, categoria: null }),
  );

  return (
    <div className="flex flex-col gap-6">
      <FiltrosDoOrcamento
        anos={anos}
        ano={ano}
        mes={mes}
        categorias={categorias}
        categoria={categoria}
      />
      <AbasDoOrcamento cadastros={lanca} />

      {finalizado && orcamento && (
        <Secao
          titulo={`Orçamento de ${ano} finalizado`}
          descricao={`Fechado em ${formatarDataHora(orcamento.finalizado_em as string)} por ${orcamento.finalizado_por ?? "—"}. O ano é só leitura: orçamento e gastos não mudam.`}
          tom="escuro"
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              ["Total orçado", formatarMoeda(orcamento.valor)],
              ["Total gasto", formatarMoeda(orcamento.total_gasto)],
              [
                "Saldo",
                formatarMoeda(orcamento.valor - (orcamento.total_gasto ?? 0)),
              ],
            ].map(([rotulo, v]) => (
              <div key={rotulo}>
                <dt className="text-xs opacity-70">{rotulo}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </Secao>
      )}

      <div
        data-guia="cartoes"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {orcamento ? (
          <CartaoIndicador
            titulo="Orçamento do ano"
            tom="escuro"
            valor={formatarMoeda(orcamento.valor, 0)}
            detalhe={`${ano} · valor único do RH, vindo do ERP em ${formatarData(orcamento.recebido_em)}`}
            calculo="O orçamento vem do ERP (ENET) e não se edita aqui: se estiver errado, a correção é feita no ERP."
          />
        ) : (
          <CartaoPendente
            titulo="Orçamento do ano"
            motivo={`${ano}: ainda não chegou do ERP (ENET): a API da EASE ainda não foi liberada. Os gastos já lançados abatem dele assim que chegar.`}
          />
        )}
        <CartaoIndicador
          titulo={`Gasto · ${rotuloFiltro}`}
          valor={formatarMoeda(gastoNoFiltro, 0)}
          detalhe={
            valor
              ? `${formatarPct((gastoNoFiltro / valor) * 100)} do orçamento do ano`
              : `${doFiltro.length} ${doFiltro.length === 1 ? "lançamento" : "lançamentos"}`
          }
        />
        {doSaldo?.saldo != null ? (
          <CartaoIndicador
            titulo="Saldo do ano"
            tom={doSaldo.saldo < 0 ? "claro" : "verde"}
            valor={`${doSaldo.saldo < 0 ? "−" : ""}${formatarMoeda(Math.abs(doSaldo.saldo), 0)}`}
            status={doSaldo.saldo < 0 ? "fora" : "ok"}
            detalhe={`${doSaldo.saldo < 0 ? "Passou" : "Sobra"} do orçamento até ${formatarMes(doSaldo.competencia)}${categoria ? " · todas as categorias" : ""}`}
            calculo="Orçamento do ano − gastos do ano (todas as categorias) até o fim do mês."
          />
        ) : (
          <CartaoPendente
            titulo="Saldo do ano"
            motivo="Depende do orçamento do ano, que vem do ERP."
          />
        )}
        {doSaldo?.consumidoPct != null ? (
          <CartaoIndicador
            titulo="Orçamento consumido"
            valor={formatarPct(doSaldo.consumidoPct)}
            detalhe={`Até ${formatarMes(doSaldo.competencia)}${categoria ? " · todas as categorias" : ""}`}
          />
        ) : (
          <CartaoPendente
            titulo="Orçamento consumido"
            motivo="Depende do orçamento do ano, que vem do ERP."
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Secao
          titulo="Gasto por mês"
          descricao={`${ano}${nomeCategoria ? ` · ${nomeCategoria}` : ""}. Passe o mouse para ver quanto do orçamento já foi consumido até o mês.`}
        >
          <Colunas
            itens={itensMes}
            descricao={`Gasto do RH em cada mês de ${ano}`}
          />
          {valor !== null && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium text-neutral-600">
                Orçamento do ano consumido (%)
              </p>
              <Linhas
                pontos={eixo}
                series={[
                  {
                    chave: "consumido",
                    rotulo: "Consumido",
                    cor: 1,
                    valores: meses.map((m) => m.consumidoPct),
                  },
                ]}
                unidade="pct"
                meta={{ valor: 100, texto: "Orçamento" }}
                descricao={`Percentual do orçamento de ${ano} consumido até cada mês`}
                altura={160}
              />
            </div>
          )}
        </Secao>
        <Secao
          titulo="Saldo acumulado do ano"
          descricao={
            valor === null
              ? "Aparece quando o orçamento do ano chegar do ERP."
              : "Orçamento − gastos acumulados até o fim de cada mês (todas as categorias). Abaixo de zero: passou do orçamento."
          }
        >
          {valor === null ? (
            <p className="text-sm text-neutral-500">
              Sem o orçamento de {ano}.
            </p>
          ) : (
            <Linhas
              pontos={eixo}
              series={[
                {
                  chave: "saldo",
                  rotulo: "Saldo",
                  cor: 2,
                  valores: todos.map((m) => m.saldo),
                },
              ]}
              unidade="moeda0"
              zero={todos.every((m) => (m.saldo ?? 0) >= 0)}
              descricao={`Saldo do orçamento de ${ano} no fim de cada mês`}
            />
          )}
        </Secao>
      </div>

      <Secao
        titulo="Gasto por categoria"
        descricao={`${mes ? formatarMes(`${ano}-${String(mes).padStart(2, "0")}-01`) : ano}. As categorias só classificam os gastos: o orçamento é um só, do RH.`}
      >
        <BarrasHorizontais
          itens={categoriasDoFiltro.map((c) => ({
            chave: c.categoria_id,
            rotulo: c.categoria,
            valor: c.total,
            texto: formatarMoeda(c.total, 0),
            detalhe: `${c.lancamentos} ${c.lancamentos === 1 ? "lançamento" : "lançamentos"}${valor ? ` · ${formatarPct((c.total / valor) * 100)} do orçamento` : ""}`,
            destaque: c.categoria_id === categoria,
          }))}
          vazio="Nenhum gasto lançado no período."
          descricao="Gasto por categoria"
        />
      </Secao>

      <Secao
        titulo="Saldo mês a mês"
        descricao="Gasto do mês e quanto sobra (ou quanto passou) do orçamento do ano no fim de cada mês."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="text-left text-xs text-neutral-600">
              <tr>
                <th className="py-2 pr-3 font-medium">Mês</th>
                <th className="px-3 py-2 text-right font-medium">
                  Gasto do mês
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Acumulado no ano
                </th>
                <th className="py-2 pl-3 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900/[0.05]">
              {todos.map((m, i) => (
                <tr
                  key={m.competencia}
                  className={mes === i + 1 ? "font-semibold" : undefined}
                >
                  <td className="py-2 pr-3">{formatarMes(m.competencia)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatarMoeda(m.gasto)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatarMoeda(m.acumulado)}
                  </td>
                  <td
                    className={`py-2 pl-3 text-right tabular-nums ${m.saldo !== null && m.saldo < 0 ? "text-red-700" : ""}`}
                  >
                    {m.saldo === null
                      ? "—"
                      : m.saldo < 0
                        ? `passou ${formatarMoeda(-m.saldo)}`
                        : formatarMoeda(m.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-32" />
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando />
    </TelaCarregando>
  );
}
