import { Building2, CalendarRange, FileDown, Shapes } from "lucide-react";
import {
  CartaoDaTela,
  CartoesComercial,
  FiltrosComercial,
  Fonte,
  hrefCom,
  TabelaLista,
  TopoComercial,
  Valor,
} from "@/components/comercial/tela";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import type { ItemGrafico } from "@/components/dashboard/graficos/base";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import {
  filtrarRespostas,
  type IndicadoresCenso,
  indicadoresCenso,
  type LinhaGrupo,
  porGrupo,
  ROTULO_ESTIMADO,
  VAZIO,
} from "@/lib/comercial/censo";
import { dadosDe, linhaDeFiltros } from "@/lib/comercial/formato";
import {
  formatarData,
  formatarMoeda,
  formatarNumero,
  formatarPct,
} from "@/lib/formato";
import { valoresDaLista } from "@/server/comercial/base";
import {
  contagemDasRodadas,
  type RodadaCenso,
  respostasDosIndicadores,
} from "@/server/comercial/censo";
import type { FiltrosCom } from "@/server/comercial/filtros";

const BASE = "/comercial/censo";
const FONTE = "Questionário do Censo";
/** Selo das rodadas de exemplo (migration do mockup). */
export const EXEMPLO_CENSO =
  "respostas do Censo de exemplo, até a rodada de verdade";

/** Filtros da tela que valem (rodada, bloco, segmento). */
export async function filtrosDoCenso(f: FiltrosCom) {
  const [blocos, segmentos] = await Promise.all([
    valoresDaLista("censo_bloco"),
    valoresDaLista("censo_segmento"),
  ]);
  const bloco = [...blocos, VAZIO].includes(f.um("bloco")) ? f.um("bloco") : "";
  const segmento = [...segmentos, VAZIO].includes(f.um("segmento"))
    ? f.um("segmento")
    : "";
  return { blocos, segmentos, bloco, segmento };
}

export function selecoesDoCenso(
  rodadas: RodadaCenso[],
  rodada: RodadaCenso,
  d: Awaited<ReturnType<typeof filtrosDoCenso>>,
) {
  return [
    {
      chave: "rodada",
      rotulo: "Rodada",
      todos: rodadas[0]?.nome ?? "Rodada",
      valor: rodada.id === rodadas[0]?.id ? "" : rodada.id,
      icone: <CalendarRange className="size-4" />,
      opcoes: rodadas.slice(1).map((r) => ({ valor: r.id, rotulo: r.nome })),
    },
    {
      chave: "bloco",
      rotulo: "Bloco",
      todos: "Todos os blocos",
      valor: d.bloco,
      icone: <Building2 className="size-4" />,
      opcoes: [...d.blocos, VAZIO].map((b) => ({
        valor: b,
        rotulo: b === VAZIO ? VAZIO : `Bloco ${b}`,
      })),
    },
    {
      chave: "segmento",
      rotulo: "Segmento",
      todos: "Todos os segmentos",
      valor: d.segmento,
      icone: <Shapes className="size-4" />,
      largura: "w-56",
      opcoes: [...d.segmentos, VAZIO].map((s) => ({ valor: s, rotulo: s })),
    },
  ];
}

const reais = (v: number | null) => (v === null ? "—" : formatarMoeda(v));
const umaCasa = (v: number | null) => (v === null ? "—" : formatarNumero(v, 1));

/** As linhas da tabela de indicadores de 4.8 (indicador, valor, cálculo). */
export function linhasDeIndicadores(
  i: IndicadoresCenso,
): [string, string, string][] {
  return [
    [
      "Empresas respondentes",
      formatarNumero(i.empresas),
      "Quantidade de respostas, sem duplicadas",
    ],
    [
      "Colaboradores na ARP",
      formatarNumero(i.colaboradores),
      "Soma de “quantos colaboradores, incluindo os sócios”",
    ],
    [
      "Média e mediana de colaboradores",
      `${umaCasa(i.mediaColaboradores)} e ${i.medianaColaboradores === null ? "—" : formatarNumero(i.medianaColaboradores, Number.isInteger(i.medianaColaboradores) ? 0 : 1)}`,
      "Média e mediana da mesma coluna",
    ],
    [
      "Visitantes por dia",
      formatarNumero(i.visitantes),
      "Soma de “quantas pessoas visitam por dia”",
    ],
    [
      "Pessoas por dia no total",
      formatarNumero(i.pessoas),
      "Colaboradores + visitantes por dia",
    ],
    [
      "Empresas com atendimento ao público",
      formatarPct(i.pctAtendimento, 2),
      `Respostas com visitantes por dia maior que zero ÷ respostas válidas (${formatarNumero(i.visitantesValidos)})`,
    ],
    [
      "Ticket médio geral (ponderado)",
      reais(i.ticketMedio),
      "Soma de (ticket ajustado × conversões por dia) ÷ soma das conversões por dia, só respostas com ticket",
    ],
    [
      "Movimentação diária estimada",
      reais(i.movimentacao),
      "Soma de (ticket ajustado × conversões por dia)",
    ],
    [
      "Expectativas para o ano",
      i.expectativas
        .map((e) => `${e.opcao} ${formatarPct(e.pct, 0)}`)
        .join(", "),
      "Empresas que marcaram cada opção ÷ total de empresas (aceita mais de uma opção, a soma passa de 100%)",
    ],
  ];
}

const barras = (
  grupos: LinhaGrupo[],
  valor: (g: LinhaGrupo) => number,
  texto: (v: number) => string,
  rotulo: (g: string) => string = (g) => g,
): ItemGrafico[] =>
  grupos
    .map((g) => ({ g, v: valor(g) }))
    .sort((a, b) => b.v - a.v)
    .map(({ g, v }) => ({
      chave: g.grupo,
      rotulo: rotulo(g.grupo),
      valor: v,
      texto: texto(v),
      detalhe: `${formatarNumero(g.empresas)} empresas`,
    }));

const rotuloBloco = (b: string) => (b === VAZIO ? VAZIO : `Bloco ${b}`);

export async function Indicadores({
  f,
  rodadas,
  rodada,
}: {
  f: FiltrosCom;
  rodadas: RodadaCenso[];
  rodada: RodadaCenso;
}) {
  const { ctx } = f;
  const d = await filtrosDoCenso(f);
  const [respostas, opcoesExp, contagem] = await Promise.all([
    respostasDosIndicadores(rodadas.map((r) => r.id)),
    valoresDaLista("censo_expectativa"),
    contagemDasRodadas([rodada.id], ctx.pode("comercial.censo.aplicar")),
  ]);
  const filtro = { bloco: d.bloco, segmento: d.segmento };
  const daRodada = filtrarRespostas(
    respostas.filter((r) => r.rodada_id === rodada.id),
    filtro,
  );
  const i = indicadoresCenso(daRodada, opcoesExp);
  const segmentos = porGrupo(daRodada, "segmento");
  const blocos = porGrupo(daRodada, "bloco");

  // Com duas rodadas ou mais, a evolução de cada cartão (mesmos filtros).
  const emOrdem = [...rodadas].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const evolucao =
    emOrdem.length > 1
      ? emOrdem.map((r) => ({
          r,
          i: indicadoresCenso(
            filtrarRespostas(
              respostas.filter((x) => x.rodada_id === r.id),
              filtro,
            ),
            opcoesExp,
          ),
        }))
      : null;
  const serie = (
    valor: (x: IndicadoresCenso) => number,
    texto: (v: number) => string,
  ) =>
    evolucao?.map(({ r, i: x }) => ({
      chave: r.id,
      rotulo: r.nome.replace(/^Censo\s+/i, ""),
      titulo: r.nome,
      valor: valor(x),
      texto: texto(valor(x)),
      destaque: r.id === rodada.id,
    }));

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Rodada", valor: rodada.nome },
    { rotulo: "Bloco", valor: d.bloco ? rotuloBloco(d.bloco) : "Todos" },
    { rotulo: "Segmento", valor: d.segmento || "Todos" },
  ]);
  const indicadores = linhasDeIndicadores(i);
  const exportar = ctx.pode("comercial.exportar");
  const consulta = new URLSearchParams(
    Object.entries({
      rodada: rodada.id,
      bloco: d.bloco,
      segmento: d.segmento,
    }).filter(([, v]) => v),
  ).toString();
  const n = contagem.get(rodada.id);
  const importada =
    rodada.situacao === "encerrada" && (rodada.importacao_id || rodada.exemplo);

  return (
    <>
      <FiltrosComercial
        tela="censo"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={selecoesDoCenso(rodadas, rodada, d)}
      />

      <TopoComercial
        dadosDe={dadosDe(new Date())}
        exemplo={rodada.exemplo ? EXEMPLO_CENSO : undefined}
        filtros={linhaFiltros}
        acoes={
          exportar ? (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`${BASE}/panorama${consulta ? `?${consulta}` : ""}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 transition hover:border-neutral-400"
                title="Panorama do Censo em PDF de uma página, no lugar do mapa mental"
              >
                <FileDown className="size-3.5" aria-hidden />
                Panorama em PDF
              </a>
              <BotaoExportar
                titulo={`Censo — Indicadores · ${rodada.nome}`}
                filtros={`${linhaFiltros} · ${ROTULO_ESTIMADO}`}
                nomeArquivo="censo-indicadores"
                colunas={[
                  { titulo: "Quadro" },
                  { titulo: "Item" },
                  { titulo: "Empresas", numero: true },
                  { titulo: "Valor" },
                ]}
                linhas={[
                  ...indicadores.map(([k, v]) => ["Indicadores", k, null, v]),
                  ...segmentos.map((g) => [
                    "Visitantes por dia, por segmento",
                    g.grupo,
                    g.empresas,
                    formatarNumero(g.visitantes),
                  ]),
                  ...blocos.map((g) => [
                    "Visitantes por dia, por bloco",
                    rotuloBloco(g.grupo),
                    g.empresas,
                    formatarNumero(g.visitantes),
                  ]),
                  ...segmentos.map((g) => [
                    "Movimentação diária por segmento",
                    g.grupo,
                    g.empresas,
                    formatarMoeda(g.movimentacao),
                  ]),
                  ...i.expectativas.map((e) => [
                    "Expectativas para o ano",
                    e.opcao,
                    e.empresas,
                    formatarPct(e.pct, 0),
                  ]),
                ]}
              />
            </div>
          ) : undefined
        }
      />

      {rodada.situacao === "aberta" ? (
        <Nota>
          Rodada aberta de {formatarData(rodada.inicio)} a{" "}
          {formatarData(rodada.fim)}
          {n?.convites
            ? `: ${formatarNumero(n.respostas)} de ${formatarNumero(n.convites)} empresas responderam (${formatarPct((n.respostas / n.convites) * 100, 0)}). Quem falta está na aba Rodadas.`
            : `: ${formatarNumero(n?.respostas ?? 0)} respostas até agora.`}
        </Nota>
      ) : importada ? (
        <Nota>
          Rodada fechada. Veio do Google Forms por importação
          {rodada.exemplo ? " (respostas de exemplo, fictícias)" : ""}, para
          comparar com as próximas.
        </Nota>
      ) : (
        <Nota>
          Rodada fechada em{" "}
          {rodada.encerrada_em
            ? formatarData(rodada.encerrada_em.slice(0, 10))
            : formatarData(rodada.fim)}
          .
        </Nota>
      )}

      <CartoesComercial>
        <CartaoDaTela
          titulo="Empresas respondentes"
          valor={formatarNumero(i.empresas)}
          detalhe="sem duplicadas"
          calculo="Quantidade de respostas da rodada, sem as repetidas da mesma empresa."
          fonte={FONTE}
          exemplo={rodada.exemplo && EXEMPLO_CENSO}
          serie={serie((x) => x.empresas, formatarNumero)}
        />
        <CartaoDaTela
          titulo="Colaboradores na ARP"
          valor={formatarNumero(i.colaboradores)}
          detalhe={`média ${umaCasa(i.mediaColaboradores)} · mediana ${i.medianaColaboradores === null ? "—" : formatarNumero(i.medianaColaboradores, Number.isInteger(i.medianaColaboradores) ? 0 : 1)}`}
          calculo="Soma de “quantos colaboradores, incluindo os sócios”; média e mediana da mesma coluna."
          fonte={FONTE}
          exemplo={rodada.exemplo && EXEMPLO_CENSO}
          serie={serie((x) => x.colaboradores, formatarNumero)}
        />
        <CartaoDaTela
          titulo="Visitantes por dia"
          valor={formatarNumero(i.visitantes)}
          detalhe={`${formatarNumero(i.pessoas)} pessoas no total`}
          calculo="Soma de “quantas pessoas visitam por dia”. Pessoas no total = colaboradores + visitantes."
          fonte={FONTE}
          exemplo={rodada.exemplo && EXEMPLO_CENSO}
          serie={serie((x) => x.visitantes, formatarNumero)}
        />
        <CartaoDaTela
          titulo="Movimentação diária estimada"
          valor={formatarMoeda(i.movimentacao)}
          detalhe={`ticket médio ponderado ${reais(i.ticketMedio)}`}
          calculo="Soma de (ticket ajustado × conversões por dia). Ticket ajustado = ticket ÷ dias de uso quando é mensalidade."
          fonte={FONTE}
          exemplo={rodada.exemplo && EXEMPLO_CENSO}
          serie={serie(
            (x) => x.movimentacao,
            (v) => formatarMoeda(v),
          )}
        />
      </CartoesComercial>

      <p className="rounded-2xl bg-amber-400/15 px-4 py-2.5 text-sm text-amber-900">
        {ROTULO_ESTIMADO}
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Secao
          titulo="Visitantes por dia, por bloco"
          descricao="Ranking dos blocos pela soma dos visitantes informados."
        >
          <BarrasHorizontais
            itens={barras(
              blocos,
              (g) => g.visitantes,
              formatarNumero,
              rotuloBloco,
            )}
            descricao="Visitantes por dia em cada bloco"
          />
        </Secao>
        <Secao
          titulo="Visitantes por dia, por segmento"
          descricao="Ranking dos segmentos pela soma dos visitantes informados."
        >
          <BarrasHorizontais
            itens={barras(segmentos, (g) => g.visitantes, formatarNumero)}
            descricao="Visitantes por dia em cada segmento"
            rotuloLargo
          />
        </Secao>
        <Secao
          titulo="Movimentação diária por segmento"
          descricao="Ticket ajustado × conversões por dia, em reais."
        >
          <BarrasHorizontais
            itens={barras(
              segmentos,
              (g) => g.movimentacao,
              (v) => formatarMoeda(v, 0),
            )}
            descricao="Movimentação diária estimada por segmento"
            rotuloLargo
          />
        </Secao>
        <Secao
          titulo="Empresas por segmento"
          descricao="Quantidade de empresas respondentes de cada segmento."
        >
          <BarrasHorizontais
            itens={barras(segmentos, (g) => g.empresas, formatarNumero)}
            descricao="Empresas respondentes por segmento"
            rotuloLargo
          />
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Secao
          className="xl:col-span-2"
          titulo="Expectativas para o ano"
          descricao="Aceita mais de uma opção; a soma passa de 100%."
        >
          <BarrasHorizontais
            itens={i.expectativas.map((e) => ({
              chave: e.opcao,
              rotulo: e.opcao,
              valor: e.pct,
              texto: formatarPct(e.pct, 0),
              detalhe: `${formatarNumero(e.empresas)} empresas`,
            }))}
            descricao="Empresas que marcaram cada expectativa"
            rotuloLargo
          />
        </Secao>
        <Secao
          className="xl:col-span-3"
          titulo="Indicadores da rodada"
          descricao="Os números do mapa mental, calculados das respostas."
        >
          <TabelaLista
            semBusca
            caber
            colunas={[
              { titulo: "Indicador" },
              { titulo: "Valor", numero: true },
              { titulo: "Cálculo" },
            ]}
            linhas={indicadores.map(([k, v, c]) => ({
              chave: k,
              busca: k,
              celulas: [
                k,
                v,
                <span key="c" className="text-xs text-neutral-500">
                  {c}
                </span>,
              ],
              ordem: [k, null, null],
            }))}
          />
          <Fonte>
            {FONTE}. Texto em pergunta de número fica fora daquele indicador.
          </Fonte>
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Quadro
          titulo="Por segmento"
          grupos={segmentos}
          chave="segmento"
          busca={f.busca}
        />
        <Quadro
          titulo="Por bloco"
          grupos={blocos}
          chave="bloco"
          busca={f.busca}
        />
      </div>
    </>
  );
}

function Quadro({
  titulo,
  grupos,
  chave,
  busca,
}: {
  titulo: string;
  grupos: LinhaGrupo[];
  chave: "segmento" | "bloco";
  busca: FiltrosCom["busca"];
}) {
  const total = grupos.reduce(
    (t, g) => ({
      empresas: t.empresas + g.empresas,
      colaboradores: t.colaboradores + g.colaboradores,
      visitantes: t.visitantes + g.visitantes,
      movimentacao: t.movimentacao + g.movimentacao,
    }),
    { empresas: 0, colaboradores: 0, visitantes: 0, movimentacao: 0 },
  );
  return (
    <Secao
      titulo={titulo}
      descricao={`Empresas, colaboradores, visitantes e movimentação de cada ${chave}. Clique para filtrar a tela.`}
    >
      <TabelaLista
        caber
        semBusca
        ordemInicial={{ coluna: 3, desc: true }}
        colunas={[
          { titulo: chave === "bloco" ? "Bloco" : "Segmento" },
          { titulo: "Empresas", numero: true },
          { titulo: "Colaboradores", numero: true },
          { titulo: "Visitantes/dia", numero: true },
          { titulo: "Movimentação/dia", numero: true },
        ]}
        linhas={grupos.map((g) => ({
          chave: g.grupo,
          busca: g.grupo,
          href: hrefCom(BASE, busca, { [chave]: g.grupo }),
          celulas: [
            chave === "bloco" ? rotuloBloco(g.grupo) : g.grupo,
            formatarNumero(g.empresas),
            formatarNumero(g.colaboradores),
            formatarNumero(g.visitantes),
            <Valor key="m" valor={g.movimentacao} />,
          ],
          ordem: [
            g.grupo,
            g.empresas,
            g.colaboradores,
            g.visitantes,
            g.movimentacao,
          ],
        }))}
        rodape={[
          "Total",
          formatarNumero(total.empresas),
          formatarNumero(total.colaboradores),
          formatarNumero(total.visitantes),
          <Valor key="m" valor={total.movimentacao} />,
        ]}
      />
    </Secao>
  );
}
