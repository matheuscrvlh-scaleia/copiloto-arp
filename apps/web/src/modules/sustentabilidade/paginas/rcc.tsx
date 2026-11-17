import { formatarMoeda, formatarNumero } from "@arp/shared/formato";
import { linhaDeFiltros } from "@arp/shared/marketing/periodo";
import {
  formatarMesNumerico,
  formatarPercentual,
  formatarToneladas,
} from "@arp/shared/sustentabilidade/formatos";
import { totaisDoPeriodo } from "@arp/shared/sustentabilidade/rcc";
import {
  cacambasDoMes,
  calcularNotas,
  filtrarNotas,
  resumoPorMes,
  semPreco,
} from "@arp/shared/sustentabilidade/rcc-lista";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Building2, CalendarDays } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Secao } from "@/components/dashboard/tabela";
import {
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { consultaDoRcc } from "../api-residuos";
import { GraficoRcc } from "../components/rcc/grafico";
import { LancarNotaRcc } from "../components/rcc/lancar";
import {
  colunasExportarRcc,
  ListaRcc,
  linhasExportarRcc,
} from "../components/rcc/lista";
import { type FiltrosSu, useContextoSu, useFiltrosSu } from "../contexto-su";

// /sustentabilidade/rcc (app/(app)/sustentabilidade/rcc/page.tsx).

const BASE = "/sustentabilidade/rcc";
const FONTE = "Sustentabilidade — notas do RCC";

export default function Page() {
  return (
    <>
      <PageHeader
        title="RCC"
        description="Resíduo de construção civil: a nota mensal da empresa coletora, com toneladas, percentual reciclado e valor economizado."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="sustentabilidade.rcc">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const f = useFiltrosSu("rcc");
  if (!f) return <Esqueleto />;
  return <Rcc f={f} />;
}

function Rcc({ f }: { f: FiltrosSu }) {
  const { busca, lembrado, um } = f;
  const { data: dados, dataUpdatedAt } = useSuspenseQuery(consultaDoRcc);
  const ctx = useContextoSu(dataUpdatedAt);
  const anoAtual = Number(ctx.hoje.slice(0, 4));
  const anos = [
    ...new Set([
      anoAtual,
      ...dados.notas.map((n) => Number(n.competencia.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);
  const pedido = Number(um("ano"));
  const ano = anos.includes(pedido) ? pedido : anoAtual;
  // Empresas dos Parâmetros e as que já aparecem nas notas (nota antiga de
  // empresa que saiu da lista continua filtrável).
  const empresas = [
    ...new Set([...dados.empresas, ...dados.notas.map((n) => n.empresa)]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const empresa = empresas.includes(um("empresa")) ? um("empresa") : "";
  const comValores = ctx.pode("sustentabilidade.valores");
  const exportar = ctx.pode("sustentabilidade.exportar");

  // Cada nota usa o fator e o preço vigentes na competência dela.
  const calculadas = calcularNotas(
    filtrarNotas(dados.notas, { ano, empresa }),
    dados.fatores,
    dados.precos,
  );
  const mesDosCartoes =
    ano === anoAtual
      ? `${ctx.hoje.slice(0, 7)}-01`
      : (calculadas
          .map((n) => n.competencia)
          .sort()
          .at(-1) ?? `${ano}-12-01`);
  const cartao = um("cartao") === "mes" ? "mes" : "";
  const lista = cartao
    ? calculadas.filter((n) => n.competencia === mesDosCartoes)
    : calculadas;

  const total = totaisDoPeriodo(calculadas);
  const noMes = cacambasDoMes(calculadas, mesDosCartoes);
  const temNotaNoMes = calculadas.some((n) => n.competencia === mesDosCartoes);
  const semValor = semPreco(calculadas);
  const meses = resumoPorMes(calculadas);
  const temExemplo = dados.notas.some((n) => n.exemplo);
  const exemplo = temExemplo ? "notas do RCC" : undefined;

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Ano", valor: String(ano) },
    { rotulo: "Empresa coletora", valor: empresa || "Todas" },
    ...(cartao
      ? [
          {
            rotulo: "Cartão",
            valor: `Caçambas em ${formatarMesNumerico(mesDosCartoes)}`,
          },
        ]
      : []),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="sustentabilidade"
        tela="rcc"
        hoje={ctx.hoje}
        lembrado={lembrado}
        selecoes={[
          {
            chave: "ano",
            rotulo: "Ano",
            todos: `${anoAtual} (atual)`,
            valor: ano === anoAtual ? "" : String(ano),
            icone: <CalendarDays className="size-4" />,
            largura: "w-40",
            opcoes: anos
              .filter((a) => a !== anoAtual)
              .map((a) => ({ valor: String(a), rotulo: String(a) })),
          },
          {
            chave: "empresa",
            rotulo: "Empresa coletora",
            todos: "Todas as empresas",
            valor: empresa,
            icone: <Building2 className="size-4" />,
            largura: "w-56",
            opcoes: empresas.map((e) => ({ valor: e, rotulo: e })),
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={exemplo}
        acoes={
          <>
            <LancarNotaRcc
              fatores={dados.fatores}
              precos={dados.precos}
              empresas={dados.empresas}
              competenciaPadrao={ctx.hoje.slice(0, 7)}
            />
            {exportar && (
              <BotaoExportar
                titulo="RCC mensal"
                filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                nomeArquivo="rcc-mensal"
                colunas={colunasExportarRcc(comValores)}
                linhas={linhasExportarRcc(lista, comValores)}
              />
            )}
          </>
        }
      />

      <Cartoes modulo="sustentabilidade">
        <CartaoDaTela
          titulo="Toneladas no ano"
          valor={
            calculadas.length
              ? `${formatarToneladas(total.toneladasTotal)} t`
              : "—"
          }
          detalhe={
            calculadas.length
              ? `Classe A ${formatarToneladas(total.toneladasA)} t · classe B ${formatarToneladas(total.toneladasB)} t`
              : `Sem nota em ${ano}`
          }
          fonte={FONTE}
          exemplo={temExemplo && "notas de exemplo"}
        />
        <CartaoDaTela
          titulo="% reciclado no ano"
          valor={formatarPercentual(total.pctReciclado)}
          detalhe="Toneladas A ÷ total (sobre as somas, não a média dos meses)"
          fonte={FONTE}
          exemplo={temExemplo && "notas de exemplo"}
        />
        {comValores && (
          <CartaoDaTela
            titulo="Valor economizado no ano"
            valor={
              total.valorEconomizado === null
                ? "—"
                : formatarMoeda(total.valorEconomizado)
            }
            detalhe={
              semValor
                ? `${semValor} ${semValor === 1 ? "nota" : "notas"} sem preço vigente: cadastre nos Parâmetros`
                : "Caçambas A × (preço B − preço A)"
            }
            fonte={`${FONTE} e preços dos Parâmetros`}
            exemplo={temExemplo && "notas de exemplo"}
          />
        )}
        <CartaoDaTela
          titulo={`Caçambas em ${formatarMesNumerico(mesDosCartoes)}`}
          valor={temNotaNoMes ? formatarNumero(noMes.a + noMes.b) : "—"}
          detalhe={
            temNotaNoMes
              ? `${formatarNumero(noMes.a)} classe A · ${formatarNumero(noMes.b)} classe B`
              : "Sem nota lançada neste mês"
          }
          fonte={FONTE}
          exemplo={temExemplo && "notas de exemplo"}
          href={hrefCom(BASE, busca, { cartao: cartao ? null : "mes" })}
          ativo={cartao === "mes"}
        />
      </Cartoes>

      <Secao
        titulo="Toneladas por mês e % reciclado"
        descricao={`Classe A e classe B lado a lado em ${ano}; o % reciclado (toneladas A ÷ total) vem no quadro de baixo, na mesma linha do tempo. Mês sem nota fica vazio.`}
      >
        <GraficoRcc ano={ano} meses={meses} />
      </Secao>

      <Secao
        titulo="Notas"
        descricao="Cada nota usa o fator de toneladas por caçamba e o preço vigentes na sua competência (Parâmetros). Trocar o fator só muda as notas lançadas a partir da nova vigência."
      >
        <ListaRcc notas={lista} links={dados.links} comValores={comValores} />
      </Secao>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <CartaoCarregando altura="h-80" />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
