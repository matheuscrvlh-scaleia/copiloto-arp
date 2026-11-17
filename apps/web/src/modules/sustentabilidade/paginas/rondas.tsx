import { formatarData, formatarMes, formatarNumero } from "@arp/shared/formato";
import {
  type AtalhoMkt,
  descreverPeriodoMkt,
  lerPeriodoMkt,
  linhaDeFiltros,
} from "@arp/shared/marketing/periodo";
import {
  ehCartaoRondas,
  filtrarLinhas,
  linhasDasRondas,
  mediaPorLocalECor,
  resumoDaUltimaRonda,
  rondasDoLocal,
  rondasDoMes,
  semanasDoGrafico,
} from "@arp/shared/sustentabilidade/rondas-lista";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, Plus, Trash2 } from "lucide-react";
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
import { Link } from "@/lib/navegacao";
import { consultaDasRondas } from "../api-residuos";
import { GraficoSemanal } from "../components/rondas/grafico";
import {
  COLUNAS_EXPORTAR_RONDAS,
  ListaDeRondas,
  linhasExportarRondas,
  MediaPorLocal,
} from "../components/rondas/lista";
import { type FiltrosSu, useContextoSu, useFiltrosSu } from "../contexto-su";

// /sustentabilidade/rondas (app/(app)/sustentabilidade/rondas/page.tsx).

const BASE = "/sustentabilidade/rondas";
const FONTE = "Sustentabilidade — rondas dos coletores";
const ATALHOS: AtalhoMkt[] = [
  "mes",
  "mes_passado",
  "ultimos_30",
  "ultimas_12_semanas",
];
const NOMES_COR = { preto: "Preto", azul: "Azul" } as const;
type Cor = keyof typeof NOMES_COR;
const ehCor = (v: string): v is Cor => v === "preto" || v === "azul";

export default function Page() {
  return (
    <>
      <PageHeader
        title="Rondas dos coletores"
        description="A ronda semanal da gestora ambiental: quanto cada coletor está cheio e quais precisam ser recolhidos."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="sustentabilidade.ronda">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const f = useFiltrosSu("rondas");
  if (!f) return <Esqueleto />;
  return <Rondas f={f} />;
}

function Rondas({ f }: { f: FiltrosSu }) {
  const { busca, lembrado, um } = f;
  const hoje = useContextoSu().hoje;
  const periodo = lerPeriodoMkt(busca, "mes", hoje);
  const { data: dados, dataUpdatedAt } = useSuspenseQuery(
    consultaDasRondas(periodo.de, periodo.ate),
  );
  const ctx = useContextoSu(dataUpdatedAt);
  const local = dados.locais.includes(um("local")) ? um("local") : "";
  const corUrl = um("cor");
  const cor: Cor | "" = ehCor(corUrl) ? corUrl : "";
  const cartaoUrl = um("cartao");
  const cartao = ehCartaoRondas(cartaoUrl) ? cartaoUrl : "";
  const exportar = ctx.pode("sustentabilidade.exportar");

  // Cartões e gráfico respeitam o período (até o fim dele) e o local; a cor
  // não, para os dois cartões de cor continuarem mostrando as duas.
  const doLocal = rondasDoLocal(dados.rondas, local);
  const resumo = resumoDaUltimaRonda(doLocal, periodo.ate, dados.limite);
  const noMes = rondasDoMes(doLocal, periodo.ate);
  const semanas = semanasDoGrafico(doLocal, periodo.ate);

  const todas = linhasDasRondas(dados.rondas, dados.limite);
  const linhas = filtrarLinhas(todas, {
    de: periodo.de,
    ate: periodo.ate,
    local,
    cor,
    cartao,
  });
  const medias = mediaPorLocalECor(linhas);

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período", valor: descreverPeriodoMkt(periodo) },
    { rotulo: "Local", valor: local || "Todos" },
    { rotulo: "Cor", valor: cor ? NOMES_COR[cor] : "Todas" },
    ...(cartao
      ? [
          {
            rotulo: "Cartão",
            valor:
              cartao === "cheios"
                ? "Coletores cheios"
                : `Ocupação dos ${cartao === "preto" ? "pretos" : "azuis"}`,
          },
        ]
      : []),
  ]);
  const quando = resumo.ultima ? `Ronda de ${formatarData(resumo.ultima)}` : "";
  const semDado = "sem ronda até esta data";
  const pct = (v: number | null) =>
    v === null ? "—" : `${formatarNumero(v, 1)}%`;
  const href = (k: string) =>
    hrefCom(BASE, busca, { cartao: cartao === k ? null : k });

  return (
    <div className="flex flex-col gap-6">
      <BarraDeFiltros
        modulo="sustentabilidade"
        tela="rondas"
        hoje={ctx.hoje}
        periodo={periodo}
        atalhos={ATALHOS}
        lembrado={lembrado}
        selecoes={[
          {
            chave: "local",
            rotulo: "Local",
            todos: "Todos os locais",
            valor: local,
            icone: <MapPin className="size-4" />,
            largura: "w-52",
            opcoes: dados.locais.map((l) => ({ valor: l, rotulo: l })),
          },
          {
            chave: "cor",
            rotulo: "Cor",
            todos: "Todas as cores",
            valor: cor,
            icone: <Trash2 className="size-4" />,
            opcoes: [
              { valor: "preto", rotulo: "Preto (não reciclável)" },
              { valor: "azul", rotulo: "Azul (reciclável)" },
            ],
          },
        ]}
      />

      <TopoDaTela
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={dados.temExemplo ? "rondas dos coletores" : undefined}
        acoes={
          <>
            <Link
              href={`${BASE}/lancar`}
              data-guia="su-rondas-lancar"
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
            >
              <Plus className="size-4" aria-hidden />
              Lançar ronda
            </Link>
            {exportar && (
              <BotaoExportar
                titulo="Rondas dos coletores"
                filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                nomeArquivo="rondas-dos-coletores"
                colunas={COLUNAS_EXPORTAR_RONDAS}
                linhas={linhasExportarRondas(linhas, medias, dados.limite)}
              />
            )}
          </>
        }
      />

      <Cartoes modulo="sustentabilidade">
        <CartaoDaTela
          titulo="Ocupação média dos pretos"
          valor={pct(resumo.pretos)}
          detalhe={quando || semDado}
          fonte={`${FONTE} (última ronda)`}
          exemplo={dados.temExemplo && "rondas de exemplo"}
          href={href("preto")}
          ativo={cartao === "preto"}
        />
        <CartaoDaTela
          titulo="Ocupação média dos azuis"
          valor={pct(resumo.azuis)}
          detalhe={quando || semDado}
          fonte={`${FONTE} (última ronda)`}
          exemplo={dados.temExemplo && "rondas de exemplo"}
          href={href("azul")}
          ativo={cartao === "azul"}
        />
        <CartaoDaTela
          titulo="Coletores cheios"
          valor={resumo.ultima ? formatarNumero(resumo.cheios) : "—"}
          detalhe={
            resumo.ultima
              ? `Ocupação ≥ ${formatarNumero(dados.limite)}% (parâmetro) · ${quando.toLowerCase()}`
              : semDado
          }
          fonte={`${FONTE} (última ronda)`}
          exemplo={dados.temExemplo && "rondas de exemplo"}
          href={href("cheios")}
          ativo={cartao === "cheios"}
        />
        <CartaoDaTela
          titulo="Rondas no mês"
          valor={formatarNumero(noMes)}
          detalhe={formatarMes(periodo.ate)}
          fonte={FONTE}
          exemplo={dados.temExemplo && "rondas de exemplo"}
        />
      </Cartoes>

      <Secao
        titulo="Ocupação média por semana"
        descricao="Pretos e azuis nas últimas 12 semanas (segunda a domingo), ponderada pelos contêineres. Semana sem ronda fica sem ponto. Só percentuais: o volume em litros ou kg só entra depois que a fórmula for confirmada."
      >
        <GraficoSemanal semanas={semanas} />
      </Secao>

      <Secao
        titulo="Rondas"
        descricao={`Uma linha por coletor visitado. Coletor não visitado não aparece (não é zero). Alerta a partir de ${formatarNumero(dados.limite)}% (limite dos Parâmetros).`}
      >
        <ListaDeRondas linhas={linhas} limite={dados.limite} />
      </Secao>

      <Secao
        titulo="Média por local e cor"
        descricao="Do período filtrado, ponderada pela quantidade de contêineres de cada visita."
      >
        <MediaPorLocal medias={medias} linhas={linhas} />
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
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando altura="h-96" />
    </TelaCarregando>
  );
}
