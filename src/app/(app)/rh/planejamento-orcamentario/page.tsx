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
import { FormAcao } from "@/components/form-acao";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  FiltrosDoOrcamento,
  GastosDoOrcamento,
} from "@/components/rh/orcamento";
import { CONFIGURACOES_RH } from "@/config/navigation";
import {
  formatarData,
  formatarDataHora,
  formatarMes,
  formatarMoeda,
  formatarPct,
  isoLocal,
} from "@/lib/formato";
import {
  anoEmUso,
  filtrarGastos,
  mesesDoAno,
  porCategoria,
  soma,
} from "@/lib/rh/orcamento";
import { pode } from "@/server/auth";
import { finalizarOrcamento } from "@/server/rh/acoes/orcamento";
import {
  categoriasDeGasto,
  gastosDoAno,
  orcamentosAnuais,
  primeiroAnoComGasto,
} from "@/server/rh/orcamento";

export const metadata: Metadata = { title: "Planejamento orçamentário" };

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/rh/planejamento-orcamentario">) {
  return (
    <>
      <PageHeader
        title="Planejamento orçamentário"
        description="Orçamento do ano do RH, que vem do ERP, e os gastos lançados que abatem dele: quanto já foi usado e quanto sobra."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const params = await busca;
  const [ve, lanca] = await Promise.all([
    pode("rh.orcamento"),
    pode("rh.orcamento.lancar"),
  ]);
  if (!ve && !lanca) return <SemAcesso />;

  const hoje = isoLocal(new Date());
  const anoAtual = Number(hoje.slice(0, 4));
  const [orcamentos, categorias, primeiro] = await Promise.all([
    orcamentosAnuais(),
    categoriasDeGasto(),
    primeiroAnoComGasto(),
  ]);
  const padrao = anoEmUso(
    anoAtual,
    orcamentos.filter((o) => o.finalizado_em).map((o) => o.ano),
  );
  const ultimo = Math.max(padrao, ...orcamentos.map((o) => o.ano));
  const inicio = Math.min(
    padrao,
    primeiro ?? padrao,
    ...orcamentos.map((o) => o.ano),
  );
  const anos = Array.from(
    { length: ultimo - inicio + 1 },
    (_, i) => ultimo - i,
  );
  const anoPedido = Number(um(params.ano));
  const ano = anos.includes(anoPedido) ? anoPedido : padrao;
  const mesPedido = Number(um(params.mes));
  const mes = mesPedido >= 1 && mesPedido <= 12 ? mesPedido : null;
  const catPedida = um(params.cat) ?? null;
  const categoria = categorias.some((c) => c.id === catPedida)
    ? catPedida
    : null;

  const gastos = await gastosDoAno(ano);
  const orcamento = orcamentos.find((o) => o.ano === ano) ?? null;
  const valor = orcamento?.valor ?? null;
  const finalizado = !!orcamento?.finalizado_em;
  const nomeCategoria = categorias.find((c) => c.id === categoria)?.nome;

  // Gastos do filtro (mês e categoria) e do ano na categoria (gráficos).
  const doFiltro = filtrarGastos(gastos, { mes, categoria });
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
  const rotuloFiltro = `${mes ? formatarMes(`${ano}-${String(mes).padStart(2, "0")}-01`) : ano}${nomeCategoria ? ` · ${nomeCategoria}` : ""}`;
  const editavel = lanca && !finalizado;
  const dataPadrao = hoje.slice(0, 4) === String(ano) ? hoje : `${ano}-01-01`;

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

      <Secao
        id="gastos"
        titulo="Gastos lançados"
        descricao={`${rotuloFiltro}. ${
          finalizado
            ? "Ano finalizado: só leitura."
            : lanca
              ? "Cada gasto abate do orçamento do ano da sua data. A categoria é escolhida da lista de Configurações › Cadastros."
              : "Quem lança é a Gestão de RH."
        }`}
      >
        <GastosDoOrcamento
          gastos={doFiltro}
          categorias={categorias}
          editavel={editavel}
          dataPadrao={dataPadrao}
          ano={ano}
        />
        {lanca && !finalizado && categorias.every((c) => !c.ativa) && (
          <p className="mt-3 text-xs text-amber-700">
            Nenhuma categoria ativa: cadastre uma em{" "}
            <a
              href={`${CONFIGURACOES_RH.cadastros}#categorias-gasto`}
              className="underline"
            >
              Configurações › Cadastros
            </a>
            .
          </p>
        )}
      </Secao>

      {lanca && !finalizado && orcamento && (
        <Secao
          titulo="Finalizar o orçamento do ano"
          descricao={`Fecha o ano de ${ano}: guarda o total orçado, o total gasto, o saldo, a data e quem fechou. Depois disso o ano fica só leitura e o sistema passa a puxar do ERP o orçamento do ano seguinte.`}
        >
          <FormAcao
            acao={finalizarOrcamento}
            rotulo={`Finalizar orçamento de ${ano}`}
            rotuloEnviando="Finalizando…"
            variante="perigo"
            confirmar={`Finalizar o orçamento de ${ano}? Gasto até agora: ${formatarMoeda(soma(gastos))} de ${formatarMoeda(orcamento.valor)}. Depois disso nenhum gasto de ${ano} pode ser lançado, corrigido ou excluído, e não há como desfazer.`}
          >
            <input type="hidden" name="ano" value={ano} />
          </FormAcao>
        </Secao>
      )}
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
