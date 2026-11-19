import { formatarMes, formatarNumero } from "@arp/shared/formato";
import {
  descreverPeriodoMkt,
  lerPeriodoMkt,
  linhaDeFiltros,
  mesesAte,
} from "@arp/shared/marketing/periodo";
import { ROTA_ENTREVISTAS } from "@arp/shared/sustentabilidade/entrevistas-chamados";
import {
  CARTOES_CONTROLE,
  type CartaoControle,
  COLUNAS_CONTROLE,
  COLUNAS_MOVIMENTOS,
  cartoesDoControle,
  entradasESaidas,
  exportarControle,
  exportarMovimentos,
  filtrarControle,
  filtrarPorCartao,
  opcoesDoControle,
  PERIODOS_ULTIMA,
  type PeriodoUltima,
  SITUACOES_FILTRO,
  serieMensal,
} from "@arp/shared/sustentabilidade/entrevistas-controle";
import { formatarPercentual } from "@arp/shared/sustentabilidade/formatos";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CircleDot,
  Layers,
  Store,
} from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { BarraDeFiltros } from "@/components/dashboard/barra-de-filtros";
import { Colunas } from "@/components/dashboard/graficos/colunas";
import { Linhas } from "@/components/dashboard/graficos/linhas";
import { Nota, Secao } from "@/components/dashboard/tabela";
import {
  AbasDaTela,
  CartaoDaTela,
  Cartoes,
  hrefCom,
  TopoDaTela,
} from "@/components/dashboard/tela";
import { BotaoExportar } from "@/components/exportar";
import { Protegido } from "@/components/protegido";
import { Link, Redirecionar } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { consultaDoControle } from "../../api-entrevistas";
import {
  abasDeEntrevistas,
  CabecalhoDeEntrevistas,
} from "../../components/entrevistas/abas";
import {
  AGRUPAR,
  type Agrupar,
  ListaControle,
} from "../../components/entrevistas/lista-controle";
import { ListaMovimentos } from "../../components/entrevistas/lista-movimentos";
import { type FiltrosSu, useContextoSu, useFiltrosSu } from "../../contexto-su";

// /sustentabilidade/entrevistas (app/(app)/sustentabilidade/entrevistas/page.tsx).

const BASE = ROTA_ENTREVISTAS;
const FONTE = "Contratos do cadastro de lojas e entrevistas do módulo";
const ABAS = {
  controle: "Controle",
  movimentos: "Entradas e saídas",
} as const;

const ACESSA = [
  "sustentabilidade.entrevistas.ver",
  "sustentabilidade.entrevistas.aplicar",
  "sustentabilidade.entrevistas.dispensar",
] as const;

export default function Page() {
  const sessao = useSessao();
  // O menu leva para cá; quem só abre outra aba vai direto para ela.
  const outra = abasDeEntrevistas(sessao)[0];
  if (!sessao.pode(ACESSA) && outra) return <Redirecionar para={outra.href} />;
  return (
    <>
      <CabecalhoDeEntrevistas descricao="Para cada contrato ativo, se a entrevista está feita, pendente, a vencer ou vencida. A tarefa de entrevistar é um chamado do setor; aqui ficam as respostas e a cobertura." />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao={ACESSA}>
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const lidos = useFiltrosSu("entrevistas");
  if (!lidos) return <Esqueleto />;
  return <Controle lidos={lidos} />;
}

function Controle({ lidos }: { lidos: FiltrosSu }) {
  // A API copia os contratos de os.lojas, no máximo a cada 10 min, depois
  // de responder (a rotina diária também sincroniza).
  const { data: d, dataUpdatedAt } = useSuspenseQuery(consultaDoControle);
  const ctx = useContextoSu(dataUpdatedAt);
  const f = { ...lidos, ctx };
  const exportar = ctx.pode("sustentabilidade.exportar");
  const aba = f.um("aba") === "movimentos" ? "movimentos" : "controle";
  const abas = (
    <AbasDaTela
      rotulo="Telas das entrevistas"
      ativa={aba}
      abas={(Object.keys(ABAS) as (keyof typeof ABAS)[]).map((k) => ({
        chave: k,
        rotulo: ABAS[k],
        href: hrefCom(BASE, {}, { aba: k === "controle" ? null : k }),
      }))}
    />
  );
  const notaExemplo = d.exemplo && (
    <Nota>
      Dados de exemplo (fictícios): parte dos contratos e das entrevistas foi
      criada para testar a tela e sai quando os dados reais entrarem.
    </Nota>
  );

  if (d.contratos.length === 0)
    return (
      <div className="flex flex-col gap-6">
        {abas}
        <Secao titulo="Nenhum contrato ainda">
          <p className="text-sm text-neutral-600">
            Os contratos vêm do cadastro de lojas do Chamados (com LUC, tipo de
            loja e data de ativação), copiados uma vez por dia e ao abrir esta
            tela. Cadastre ou importe as lojas em Chamados › Configurações ›
            Lojas e volte aqui em alguns minutos.
          </p>
        </Secao>
      </div>
    );

  if (aba === "movimentos") {
    const periodo = lerPeriodoMkt(f.busca, "mes_passado", ctx.hoje);
    const movimentos = entradasESaidas(d.linhas, periodo.de, periodo.ate);
    const filtros = linhaDeFiltros([
      { rotulo: "Período", valor: descreverPeriodoMkt(periodo) },
    ]);
    return (
      <div className="flex flex-col gap-6">
        {abas}
        <BarraDeFiltros
          modulo="sustentabilidade"
          tela="entrevistas-movimentos"
          hoje={ctx.hoje}
          lembrado={f.lembrado}
          periodo={periodo}
        />
        <TopoDaTela
          dadosDe={ctx.dadosDe}
          filtros={filtros}
          acoes={
            exportar ? (
              <BotaoExportar
                titulo="Entradas e saídas com situação da entrevista"
                filtros={`${filtros} · ${ctx.dadosDe}`}
                nomeArquivo="entradas-e-saidas-entrevistas"
                colunas={COLUNAS_MOVIMENTOS}
                linhas={exportarMovimentos(movimentos)}
              />
            ) : undefined
          }
        />
        <Secao
          titulo="Entradas e saídas com situação da entrevista"
          descricao="Contratos que inauguraram (data de ativação, ou a corrigida) ou foram rescindidos no período, com a situação da entrevista hoje. Substitui o relatório de condições especiais filtrado por título."
        >
          <ListaMovimentos movimentos={movimentos} />
        </Secao>
        {notaExemplo}
      </div>
    );
  }

  const opcoes = opcoesDoControle(d.linhas);
  const situacao = f.um("situacao") in SITUACOES_FILTRO ? f.um("situacao") : "";
  const bloco = opcoes.blocos.includes(f.um("bloco")) ? f.um("bloco") : "";
  const tipoLoja = opcoes.tipos.includes(f.um("tipo")) ? f.um("tipo") : "";
  const setor = opcoes.setores.includes(f.um("setor")) ? f.um("setor") : "";
  const ultima = (
    f.um("ultima") in PERIODOS_ULTIMA ? f.um("ultima") : ""
  ) as PeriodoUltima;
  const texto = f.um("q").slice(0, 80);
  const cartao = (f.um("cartao") in CARTOES_CONTROLE ? f.um("cartao") : "") as
    | CartaoControle
    | "";
  const agrupar: Agrupar =
    f.um("agrupar") === "situacao" ? "situacao" : "bloco";

  const base = filtrarControle(
    d.linhas,
    { situacao, bloco, tipoLoja, setor, ultima, busca: texto },
    ctx.hoje,
  );
  const lista = filtrarPorCartao(base, cartao);
  const n = cartoesDoControle(base);
  const meses = mesesAte(ctx.hoje, 12);
  const serie = serieMensal({
    meses,
    contratos: d.contratos,
    entrevistas: d.entrevistas,
    config: d.config,
  });

  const filtros = linhaDeFiltros([
    { rotulo: "Situação", valor: SITUACOES_FILTRO[situacao] ?? "" },
    { rotulo: "Bloco", valor: bloco || "Todos" },
    { rotulo: "Tipo de loja", valor: tipoLoja || "Todos" },
    { rotulo: "Setor econômico", valor: setor || "Todos" },
    { rotulo: "Última entrevista", valor: PERIODOS_ULTIMA[ultima] },
    ...(texto ? [{ rotulo: "Busca", valor: texto }] : []),
    ...(cartao ? [{ rotulo: "Cartão", valor: CARTOES_CONTROLE[cartao] }] : []),
  ]);
  const hrefCartao = (k: CartaoControle) =>
    hrefCom(BASE, f.busca, { cartao: cartao === k ? null : k });
  const p = d.config.parametros;

  return (
    <div className="flex flex-col gap-6">
      {abas}
      <BarraDeFiltros
        modulo="sustentabilidade"
        tela="entrevistas"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        busca={{
          chave: "q",
          valor: texto,
          placeholder: "Locatário, CNPJ ou LUC",
        }}
        selecoes={[
          {
            chave: "situacao",
            rotulo: "Situação",
            todos: SITUACOES_FILTRO[""] ?? "",
            valor: situacao,
            icone: <CircleDot className="size-4" />,
            largura: "w-56",
            opcoes: Object.entries(SITUACOES_FILTRO)
              .filter(([k]) => k)
              .map(([valor, rotulo]) => ({ valor, rotulo })),
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: bloco,
            icone: <Building2 className="size-4" />,
            opcoes: opcoes.blocos.map((b) => ({ valor: b, rotulo: b })),
          },
          {
            chave: "tipo",
            rotulo: "Tipo de loja",
            todos: "Todos os tipos",
            valor: tipoLoja,
            icone: <Store className="size-4" />,
            opcoes: opcoes.tipos.map((b) => ({ valor: b, rotulo: b })),
          },
          {
            chave: "setor",
            rotulo: "Setor econômico",
            todos: "Todos os setores",
            valor: setor,
            icone: <Layers className="size-4" />,
            opcoes: opcoes.setores.map((b) => ({ valor: b, rotulo: b })),
          },
          {
            chave: "ultima",
            rotulo: "Última entrevista",
            todos: PERIODOS_ULTIMA[""],
            valor: ultima,
            icone: <CalendarClock className="size-4" />,
            largura: "w-52",
            opcoes: (Object.keys(PERIODOS_ULTIMA) as PeriodoUltima[])
              .filter((k) => k)
              .map((k) => ({ valor: k, rotulo: PERIODOS_ULTIMA[k] })),
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={filtros}
        exemplo={
          d.exemplo
            ? "contratos e entrevistas marcados como exemplo"
            : undefined
        }
        acoes={
          exportar ? (
            <BotaoExportar
              titulo="Controle das entrevistas"
              filtros={`${filtros} · ${ctx.dadosDe}`}
              nomeArquivo="controle-das-entrevistas"
              colunas={COLUNAS_CONTROLE}
              linhas={exportarControle(lista)}
            />
          ) : undefined
        }
      />

      <Cartoes modulo="sustentabilidade">
        <CartaoDaTela
          titulo={CARTOES_CONTROLE.pendente}
          valor={formatarNumero(n.pendente)}
          detalhe={`Sem entrevista e a data prevista (ativação + ${p.mesesPrimeira} meses) já passou`}
          fonte={FONTE}
          href={hrefCartao("pendente")}
          ativo={cartao === "pendente"}
        />
        <CartaoDaTela
          titulo={`${CARTOES_CONTROLE.a_vencer} (${p.avisoDias} dias)`}
          valor={formatarNumero(n.a_vencer)}
          detalhe="Validade termina nos próximos dias (parâmetro)"
          fonte={FONTE}
          href={hrefCartao("a_vencer")}
          ativo={cartao === "a_vencer"}
        />
        <CartaoDaTela
          titulo={CARTOES_CONTROLE.vencida}
          valor={formatarNumero(n.vencida)}
          detalhe="A validade da última entrevista já passou"
          fonte={FONTE}
          href={hrefCartao("vencida")}
          ativo={cartao === "vencida"}
        />
        <CartaoDaTela
          titulo={CARTOES_CONTROLE.cobertura}
          valor={formatarPercentual(n.cobertura.pct)}
          detalhe={`${formatarNumero(n.cobertura.emDia)} em dia de ${formatarNumero(n.cobertura.precisam)} que precisam de entrevista`}
          calculo="Em dia e a vencer ÷ contratos da lista, menos os aguardando e os dispensados. Clicar mostra os em dia e a vencer."
          fonte={FONTE}
          href={hrefCartao("cobertura")}
          ativo={cartao === "cobertura"}
        />
      </Cartoes>

      <div data-guia="grafico" className="grid gap-6 lg:grid-cols-2">
        <Secao
          titulo="Entrevistas por mês"
          descricao="Entrevistas salvas em cada mês, últimos 12 meses."
        >
          <Colunas
            descricao="Entrevistas salvas por mês"
            itens={serie.map((s, i) => ({
              chave: s.mes,
              rotulo: formatarMes(s.mes).slice(0, 3),
              titulo: formatarMes(s.mes),
              valor: s.entrevistas,
              texto: formatarNumero(s.entrevistas),
              destaque: i === serie.length - 1,
            }))}
          />
        </Secao>
        <Secao
          titulo="Cobertura no fim de cada mês"
          descricao="Em dia ÷ contratos que precisavam de entrevista no último dia do mês (no mês atual, hoje)."
        >
          <Linhas
            descricao="Cobertura das entrevistas no fim de cada mês"
            unidade="pct"
            pontos={serie.map((s) => ({
              chave: s.mes,
              rotulo: formatarMes(s.mes).slice(0, 3),
              titulo: formatarMes(s.mes),
            }))}
            series={[
              {
                chave: "cobertura",
                rotulo: "Cobertura",
                cor: 1,
                valores: serie.map((s) => s.cobertura),
              },
            ]}
          />
        </Secao>
      </div>

      <Secao
        titulo="Contratos"
        descricao="Uma linha por contrato (as LUCs juntas). Clique para abrir a ficha da entrevista; o número do chamado abre o chamado."
      >
        <div
          data-guia="agrupar"
          className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500"
        >
          Agrupar por:
          {(Object.keys(AGRUPAR) as Agrupar[]).map((k) => (
            <Link
              key={k}
              href={hrefCom(BASE, f.busca, {
                agrupar: k === "bloco" ? null : k,
              })}
              scroll={false}
              aria-current={agrupar === k ? "true" : undefined}
              className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1 font-medium text-neutral-700 aria-[current=true]:border-neutral-900 aria-[current=true]:bg-neutral-900 aria-[current=true]:text-white"
            >
              {AGRUPAR[k]}
            </Link>
          ))}
        </div>
        <div data-guia="lista">
          <ListaControle linhas={lista} agrupar={agrupar} />
        </div>
      </Secao>
      {notaExemplo}
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
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
