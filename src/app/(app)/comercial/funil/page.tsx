import {
  CalendarDays,
  CircleDot,
  Megaphone,
  Route,
  Share2,
  UserRound,
  Workflow,
} from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import {
  colunasExportarFunil,
  colunasFunil,
  linhasExportarFunil,
  linhasFunil,
} from "@/components/comercial/funil/lista";
import {
  exportarMensal,
  TabelaContagem,
  TabelaMensal,
} from "@/components/comercial/funil/quadros";
import {
  CartaoDaTela,
  CartoesComercial,
  EXEMPLO,
  FiltrosComercial,
  Fonte,
  hrefCom,
  TabelaLista,
  TopoComercial,
} from "@/components/comercial/tela";
import { BarrasHorizontais } from "@/components/dashboard/graficos/barras-horizontais";
import { ColunasEmpilhadas } from "@/components/dashboard/graficos/colunas-empilhadas";
import type { CorSerie } from "@/components/dashboard/graficos/series";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { ProvedorDetalhe } from "@/components/modal-detalhe";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { ESTADOS, type Estado } from "@/lib/comercial/fontes";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import {
  contarFunil,
  contarPor,
  doEstado,
  filtrarFunil,
  mesesDoPeriodo,
  opcoesDe,
  porMesEEstado,
  quadroMensal,
} from "@/lib/comercial/funil";
import { MESES_CURTOS } from "@/lib/comercial/painel";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";
import { dadosDoFunil } from "@/server/comercial/funil";

export const metadata: Metadata = { title: "Funil comercial" };

const BASE = "/comercial/funil";
const RD = "RD Station CRM";
const TODOS_FUNIS = "todos";

const ESTADO_DA_URL: Record<string, Estado> = {
  andamento: "Em andamento",
  vendida: "Vendida",
  perdida: "Perdida",
};
const URL_DO_ESTADO: Record<Estado, string> = {
  "Em andamento": "andamento",
  Vendida: "vendida",
  Perdida: "perdida",
};
const COR_ESTADO: Record<Estado, CorSerie> = {
  "Em andamento": 1,
  Vendida: 2,
  Perdida: 3,
};

export default function Page({ searchParams }: PageProps<"/comercial/funil">) {
  return (
    <>
      <PageHeader
        title="Funil comercial"
        description="As oportunidades do RD Station CRM no formato da aba DASHBOARD da planilha Gestão Comercial, sem exportação manual. Período sempre pela data de criação."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.funil.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const opcoes = (vs: string[]) => vs.map((v) => ({ valor: v, rotulo: v }));

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const [f, d] = await Promise.all([
    busca.then((b) => lerFiltros("funil", b)),
    dadosDoFunil(),
  ]);
  const { ctx } = f;
  const anoAtual = Number(ctx.hoje.slice(0, 4));
  const ano = /^\d{4}$/.test(f.um("ano")) ? Number(f.um("ano")) : anoAtual;
  const mesUrl = Number(f.um("mes"));
  const mes =
    Number.isInteger(mesUrl) && mesUrl >= 1 && mesUrl <= 12 ? mesUrl : null;
  const funilUrl = f.um("funil");
  const funil = funilUrl === TODOS_FUNIS ? null : funilUrl || d.funilPadrao;
  const campanha = f.um("campanha") || null;
  const fonte = f.um("fonte") || null;
  const responsavel = f.um("resp") || null;
  const lp = f.um("lp") || null;
  const estado = ESTADO_DA_URL[f.um("estado")] ?? null;

  const todas = d.oportunidades;
  const base = filtrarFunil(todas, {
    ano,
    mes,
    funil,
    campanha,
    fonteAjustada: fonte,
    responsavel,
    landingPage: lp,
  });
  const lista = doEstado(base, estado);
  const c = contarFunil(base);
  const meses = mesesDoPeriodo(ano, mes, ctx.hoje);
  const porFonte = quadroMensal(lista, (o) => o.fonteAjustada, meses);
  const porSegmento = quadroMensal(lista, (o) => o.segmento, meses);
  const perdidas = doEstado(lista, "Perdida");
  const motivos = contarPor(perdidas, (o) => o.motivoPerda);
  const perfis = contarPor(lista, (o) => o.perfil);
  const tamanhos = contarPor(lista, (o) => o.tamanho);
  const estados = porMesEEstado(lista, meses);
  const nomesLp = new Map(
    d.landingPages.map((l) => [l.conversion_identifier, l.nome]),
  );

  // Opções dos filtros (todo o histórico do RD; fontes pelo de-para).
  const anos = [...new Set(todas.map((o) => o.ano))]
    .filter((a) => a !== anoAtual)
    .sort((a, b) => b - a);
  const funis = opcoesDe(todas, (o) => o.funil).filter(
    (n) => n !== d.funilPadrao,
  );
  const fontes = [
    ...new Set([
      ...d.fontesAjustadas,
      ...opcoesDe(todas, (o) => o.fonteAjustada),
    ]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Ano", valor: String(ano) },
    { rotulo: "Mês", valor: mes ? (MESES_CURTOS[mes - 1] as string) : "Todos" },
    { rotulo: "Funil de vendas", valor: funil ?? "Todos" },
    { rotulo: "Campanha", valor: campanha ?? "Todas" },
    { rotulo: "Fonte ajustada", valor: fonte ?? "Todas" },
    { rotulo: "Responsável", valor: responsavel ?? "Todos" },
    { rotulo: "Estado", valor: estado ?? "Todos" },
    {
      rotulo: "Landing page",
      valor: lp ? (nomesLp.get(lp) ?? lp) : "Todas",
    },
  ]);
  const filtrosExportar = `${linhaFiltros} · ${ctx.dadosDe}`;
  const exportar = ctx.pode("comercial.exportar");
  const exemplo = d.exemplo ? EXEMPLO.rd : false;
  const hrefEstado = (e: Estado | null) =>
    hrefCom(BASE, f.busca, {
      estado: e === null || e === estado ? null : URL_DO_ESTADO[e],
    });
  const quadroFonte = exportarMensal(porFonte, "Fonte ajustada");

  return (
    <ProvedorDetalhe exportar={exportar}>
      <div className="flex flex-col gap-6">
        <FiltrosComercial
          tela="funil"
          hoje={ctx.hoje}
          lembrado={f.lembrado}
          selecoes={[
            {
              chave: "ano",
              rotulo: "Ano",
              todos: String(anoAtual),
              valor: ano === anoAtual ? "" : String(ano),
              icone: <CalendarDays className="size-4" />,
              largura: "w-32",
              opcoes: anos.map((a) => ({
                valor: String(a),
                rotulo: String(a),
              })),
            },
            {
              chave: "mes",
              rotulo: "Mês",
              todos: "Todos os meses",
              valor: mes ? String(mes) : "",
              icone: <CalendarDays className="size-4" />,
              largura: "w-40",
              opcoes: MESES_CURTOS.map((m, i) => ({
                valor: String(i + 1),
                rotulo: m,
              })),
            },
            {
              chave: "funil",
              rotulo: "Funil de vendas",
              todos: d.funilPadrao,
              valor: funilUrl === TODOS_FUNIS ? TODOS_FUNIS : funilUrl,
              icone: <Workflow className="size-4" />,
              largura: "w-56",
              opcoes: [
                ...opcoes(funis),
                { valor: TODOS_FUNIS, rotulo: "Todos os funis" },
              ],
            },
            {
              chave: "campanha",
              rotulo: "Campanha",
              todos: "Todas as campanhas",
              valor: campanha ?? "",
              icone: <Megaphone className="size-4" />,
              largura: "w-52",
              opcoes: opcoes(opcoesDe(todas, (o) => o.campanha)),
            },
            {
              chave: "fonte",
              rotulo: "Fonte ajustada",
              todos: "Todas as fontes",
              valor: fonte ?? "",
              icone: <Share2 className="size-4" />,
              largura: "w-48",
              opcoes: opcoes(fontes),
            },
            {
              chave: "resp",
              rotulo: "Responsável",
              todos: "Todos os responsáveis",
              valor: responsavel ?? "",
              icone: <UserRound className="size-4" />,
              largura: "w-48",
              opcoes: opcoes(opcoesDe(todas, (o) => o.responsavel)),
            },
            {
              chave: "estado",
              rotulo: "Estado",
              todos: "Todos os estados",
              valor: estado ? URL_DO_ESTADO[estado] : "",
              icone: <CircleDot className="size-4" />,
              largura: "w-44",
              opcoes: ESTADOS.map((e) => ({
                valor: URL_DO_ESTADO[e],
                rotulo: e,
              })),
            },
            {
              chave: "lp",
              rotulo: "Landing page",
              todos: "Todas as landing pages",
              valor: lp ?? "",
              icone: <Route className="size-4" />,
              largura: "w-52",
              opcoes: d.landingPages.map((l) => ({
                valor: l.conversion_identifier,
                rotulo: l.nome,
              })),
            },
          ]}
        />

        <TopoComercial
          dadosDe={ctx.dadosDe}
          filtros={linhaFiltros}
          exemplo={exemplo || undefined}
          acoes={
            exportar ? (
              <>
                <BotaoExportar
                  titulo="Oportunidades do funil"
                  filtros={filtrosExportar}
                  nomeArquivo="funil-oportunidades"
                  colunas={colunasExportarFunil(d.podeValores)}
                  linhas={linhasExportarFunil(lista, d.podeValores)}
                />
                <BotaoExportar
                  titulo="Oportunidades por mês e fonte ajustada"
                  filtros={filtrosExportar}
                  nomeArquivo="funil-mes-por-fonte"
                  colunas={quadroFonte.colunas}
                  linhas={quadroFonte.linhas}
                />
              </>
            ) : undefined
          }
        />

        <CartoesComercial>
          <CartaoDaTela
            titulo="Oportunidades criadas"
            valor={formatarNumero(c.criadas)}
            detalhe="no período, pela data de criação"
            fonte={RD}
            exemplo={exemplo}
            href={estado ? hrefEstado(null) : undefined}
          />
          <CartaoDaTela
            titulo="Em andamento"
            valor={formatarNumero(c.andamento)}
            detalhe={`${formatarPct(c.andamentoPct, 2)} das criadas`}
            fonte={RD}
            exemplo={exemplo}
            href={hrefEstado("Em andamento")}
            ativo={estado === "Em andamento"}
          />
          <CartaoDaTela
            titulo="Vendidas"
            valor={formatarNumero(c.vendidas)}
            detalhe={`Conversão ${formatarPct(c.conversao, 2)}${
              c.recorrentes !== null
                ? ` · recorrentes ${formatarNumero(c.recorrentes, 2)} · pontuais ${formatarNumero(c.pontuais ?? 0, 2)}`
                : ""
            }`}
            calculo="Conversão = vendidas ÷ oportunidades criadas no período. Vendas recorrentes = soma do valor recorrente das vendidas; pontuais = soma do valor único (só com a permissão de valores)."
            fonte={RD}
            exemplo={exemplo}
            href={hrefEstado("Vendida")}
            ativo={estado === "Vendida"}
          />
          <CartaoDaTela
            titulo="Perdidas"
            valor={formatarNumero(c.perdidas)}
            detalhe={`${formatarPct(c.perdidasPct, 2)} das criadas`}
            calculo="Perdidas ÷ oportunidades criadas no período."
            fonte={RD}
            exemplo={exemplo}
            href={hrefEstado("Perdida")}
            ativo={estado === "Perdida"}
          />
        </CartoesComercial>

        <Secao
          titulo="Oportunidades"
          exemplo={exemplo}
          descricao={`Uma linha por oportunidade, período pela data de criação. Clique na linha para ver o detalhe.${d.podeValores ? "" : " Valores só para quem tem a permissão de valores."}`}
        >
          <TabelaLista
            colunas={colunasFunil(d.podeValores)}
            ordemInicial={{ coluna: 0, desc: true }}
            placeholder="Buscar oportunidade, empresa, fonte…"
            vazio="Nenhuma oportunidade nesse filtro."
            alturaMax="max-h-[36rem]"
            linhas={linhasFunil(lista, nomesLp, d.podeValores)}
            rodape={[
              "Total",
              `${formatarNumero(lista.length)} ${lista.length === 1 ? "oportunidade" : "oportunidades"}`,
            ]}
          />
          <Fonte>
            {RD} (oportunidades, campos personalizados) e RD Station Marketing
            (landing page). Fonte ajustada pelo de-para dos parâmetros; fonte
            sem de-para aparece com o nome do RD.
          </Fonte>
          <Nota>
            Somente leitura: mover card, mudar etapa ou criar oportunidade é
            feito no RD Station.
          </Nota>
        </Secao>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Secao
            tom="escuro"
            titulo="Oportunidades por mês"
            descricao="Empilhadas por estado, pela data de criação"
            exemplo={exemplo}
          >
            <ColunasEmpilhadas
              descricao="Oportunidades por mês de criação, empilhadas por estado"
              pontos={meses.map((m) => ({
                chave: String(m),
                rotulo: MESES_CURTOS[m - 1] as string,
                titulo: `${MESES_CURTOS[m - 1]}/${ano}`,
              }))}
              series={ESTADOS.map((e) => ({
                chave: URL_DO_ESTADO[e],
                rotulo: e,
                cor: COR_ESTADO[e],
                valores: estados[e],
              }))}
            />
            <Fonte>{RD}</Fonte>
          </Secao>
          <Secao
            titulo="Motivos de perda"
            descricao="Quantidade de oportunidades perdidas"
            exemplo={exemplo}
          >
            <BarrasHorizontais
              descricao="Oportunidades perdidas por motivo de perda"
              vazio="Nenhuma oportunidade perdida nesse filtro."
              rotuloLargo
              itens={motivos.map((m) => ({
                chave: m.rotulo,
                rotulo: m.rotulo,
                valor: m.quantidade,
                texto: `${formatarNumero(m.quantidade)} (${formatarPct(m.pct, 2)})`,
              }))}
            />
            <Fonte>{RD} (motivo de perda)</Fonte>
          </Secao>
        </div>

        <Secao
          titulo="Mês × fonte ajustada"
          exemplo={exemplo}
          descricao="Mesmo quadro da aba DASHBOARD da planilha, com total do ano, % e média por mês."
        >
          <TabelaMensal quadro={porFonte} rotulo="Fonte ajustada" />
          <Fonte>{RD} e de-para de fontes dos parâmetros</Fonte>
        </Secao>

        <Secao
          titulo="Mês × segmento"
          exemplo={exemplo}
          descricao="Campo personalizado Segmento do RD CRM."
        >
          <TabelaMensal quadro={porSegmento} rotulo="Segmento" />
          <Fonte>{RD} (Segmento)</Fonte>
        </Secao>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Secao titulo="Motivo de perda" exemplo={exemplo}>
            <TabelaContagem
              rotulo="Motivo"
              linhas={motivos}
              total={perdidas.length}
            />
          </Secao>
          <Secao titulo="Perfil do imóvel" exemplo={exemplo}>
            <TabelaContagem
              rotulo="Perfil"
              linhas={perfis}
              total={lista.length}
            />
          </Secao>
          <Secao titulo="Tamanho pretendido" exemplo={exemplo}>
            <TabelaContagem
              rotulo="Tamanho"
              linhas={tamanhos}
              total={lista.length}
            />
          </Secao>
        </div>
      </div>
    </ProvedorDetalhe>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <CartaoCarregando altura="h-[36rem]" />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-80" />
        <CartaoCarregando altura="h-80" />
      </div>
      <CartaoCarregando altura="h-80" />
    </TelaCarregando>
  );
}
