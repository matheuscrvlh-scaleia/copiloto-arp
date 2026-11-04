import {
  Building2,
  CalendarDays,
  Gauge,
  LayoutGrid,
  MapPin,
  Tag,
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
  COLUNAS_CARTEIRA,
  colunasExportarLucs,
  colunasExportarMov,
  colunasQuadro,
  exportarCarteira,
  exportarLucs,
  exportarMov,
  exportarQuadro,
  GraficoPorBloco,
  ListaDeLucs,
  Quadro,
  QuadrosMovimento,
  TabelasCarteira,
} from "@/components/comercial/ocupacao/quadros";
import {
  AbasDaTela,
  CartaoDaTela,
  CartoesComercial,
  EXEMPLO,
  FiltrosComercial,
  hrefCom,
  TopoComercial,
} from "@/components/comercial/tela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { curvaDaCarteira, totalDaCarteira } from "@/lib/comercial/carteira";
import { ativoEm } from "@/lib/comercial/fontes";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import {
  comStatus,
  type FiltroLucs,
  filtrarLucs,
  INDICADORES,
  type Indicador,
  linhasDeLucs,
  movimentos,
  quadroMovPorBloco,
  quadroPor,
  quadroPorMes,
  TODOS_OS_TIPOS,
  totais,
  totalMovimentos,
} from "@/lib/comercial/ocupacao";
import { formatarNumero, formatarPct } from "@/lib/formato";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";
import { dadosDaOcupacao } from "@/server/comercial/ocupacao";

export const metadata: Metadata = { title: "Ocupação e estoque" };

const BASE = "/comercial/ocupacao";
const ENET = "ENET — LUCs e contratos ativos";

export default function Page({
  searchParams,
}: PageProps<"/comercial/ocupacao">) {
  return (
    <>
      <PageHeader
        title="Ocupação e estoque"
        description="ABL ocupada e vaga por bloco e tipo de LUC, direto do ENET, com entradas, saídas e a curva da carteira."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.ocupacao.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

type Aba = "lucs" | "bloco" | "tipo" | "movimentos" | "carteira";
const ABAS: Record<Aba, string> = {
  lucs: "LUCs",
  bloco: "Por bloco",
  tipo: "Por tipo",
  movimentos: "Entradas e saídas",
  carteira: "Curva da carteira",
};
const STATUS = { locado: "Locados", vago: "Vagos" } as const;

const opcoes = (vs: string[]) => vs.map((v) => ({ valor: v, rotulo: v }));
const unicos = (vs: string[]) => [...new Set(vs)];
const m2 = (v: number) => `${formatarNumero(v, 2)} m²`;

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("ocupacao", await busca);
  const { ctx } = f;
  const comValores = ctx.pode("comercial.valores.ver");
  const exportar = ctx.pode("comercial.exportar");
  const { enet, contam, transferenciaDias, curva } = await dadosDaOcupacao();

  const abas = (Object.keys(ABAS) as Aba[]).filter(
    (a) => a !== "carteira" || comValores,
  );
  const aba = (abas as string[]).includes(f.um("aba"))
    ? (f.um("aba") as Aba)
    : "lucs";
  const blocos = unicos(enet.lucs.map((l) => l.local));
  const ruas = unicos(enet.lucs.map((l) => l.rua)).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const tipos = unicos(enet.lucs.map((l) => l.tipo_loja));
  const filtro: FiltroLucs = {
    bloco: blocos.includes(f.um("bloco")) ? f.um("bloco") : "",
    tipo: [TODOS_OS_TIPOS, ...tipos].includes(f.um("tipo")) ? f.um("tipo") : "",
    status:
      f.um("status") in STATUS ? (f.um("status") as FiltroLucs["status"]) : "",
    rua: ruas.includes(f.um("rua")) ? f.um("rua") : "",
  };
  const anoAtual = Number(ctx.hoje.slice(0, 4));
  const anos = Array.from({ length: anoAtual - 2023 }, (_, i) => anoAtual - i);
  const ano = anos.includes(Number(f.um("ano")))
    ? Number(f.um("ano"))
    : anoAtual;
  const indicadores = (Object.keys(INDICADORES) as Indicador[]).filter(
    (i) => i !== "valor" || comValores,
  );
  const indicador = (indicadores as string[]).includes(f.um("indicador"))
    ? (f.um("indicador") as Indicador)
    : "quantidade";

  const todas = linhasDeLucs(enet, ctx.hoje, comValores);
  const base = filtrarLucs(todas, filtro, contam);
  const lista = comStatus(base, filtro.status);
  const t = totais(base);
  const porBloco = quadroPor(lista, "bloco");
  const totalLista = { chave: "Total", ...totais(lista) };

  const rotuloTipo =
    filtro.tipo === TODOS_OS_TIPOS
      ? "Todos"
      : filtro.tipo || "Contam na ocupação";
  const itensFiltro = [
    { rotulo: "Bloco", valor: filtro.bloco || "Todos" },
    { rotulo: "Tipo de LUC", valor: rotuloTipo },
    {
      rotulo: "Status",
      valor: filtro.status ? STATUS[filtro.status] : "Todos",
    },
    { rotulo: "Rua", valor: filtro.rua || "Todas" },
    ...(aba === "movimentos"
      ? [
          { rotulo: "Ano", valor: String(ano) },
          { rotulo: "Indicador", valor: INDICADORES[indicador] },
        ]
      : []),
  ];
  const linhaFiltros = linhaDeFiltros(itensFiltro);
  const filtrosExp = `${linhaFiltros} · ${ctx.dadosDe}`;
  const hrefStatus = (s: FiltroLucs["status"]) =>
    hrefCom(BASE, f.busca, { status: filtro.status === s ? null : s || null });

  // Por tipo: todos os tipos (bloco e rua valem), as áreas que não contam à parte.
  const doTipo = filtrarLucs(
    todas,
    { ...filtro, tipo: filtro.tipo || TODOS_OS_TIPOS },
    contam,
  );
  const tiposContam = quadroPor(
    doTipo.filter((l) => contam.has(l.tipo)),
    "tipo",
  );
  const tiposFora = quadroPor(
    doTipo.filter((l) => !contam.has(l.tipo)),
    "tipo",
  );

  // Movimentos e carteira: só dos LUCs do filtro.
  const lucsDoFiltro = new Set(lista.map((l) => l.numero));
  const ms =
    aba === "movimentos"
      ? movimentos(enet, ctx.hoje, transferenciaDias).filter((m) =>
          lucsDoFiltro.has(m.luc),
        )
      : [];
  const meses = quadroPorMes(ms, ano, indicador);
  const movBlocos = quadroMovPorBloco(ms, ano, indicador, blocos).filter(
    (b) => b.colunas.entrada || b.colunas.saida || b.colunas.transferencia,
  );
  const movTotal = totalMovimentos(ms, ano, indicador);

  const atividade = new Map(enet.clientes.map((c) => [c.codigo, c.atividade]));
  const abl = new Map(enet.lucs.map((l) => [l.numero, l.abl]));
  const carteira =
    aba === "carteira" && comValores
      ? curvaDaCarteira(
          enet.contratos
            .filter((c) => ativoEm(c, ctx.hoje) && lucsDoFiltro.has(c.luc))
            .map((c) => ({
              cliente: c.cliente,
              locatario: c.locatario,
              atividade: atividade.get(c.cliente) ?? "",
              abl: abl.get(c.luc) ?? 0,
              aluguel: c.valor_aluguel,
            })),
          curva,
        )
      : [];
  const totalCarteira = totalDaCarteira(carteira);

  const exportarAba = (() => {
    if (!exportar) return undefined;
    const comum = { filtros: filtrosExp };
    switch (aba) {
      case "bloco":
        return (
          <BotaoExportar
            {...comum}
            titulo="Ocupação por bloco"
            nomeArquivo="ocupacao-por-bloco"
            colunas={colunasQuadro("Bloco")}
            linhas={exportarQuadro(porBloco, totalLista)}
          />
        );
      case "tipo": {
        const doTipoTotal = { chave: "Total", ...totais(doTipo) };
        return (
          <BotaoExportar
            {...comum}
            titulo="Ocupação por tipo de LUC"
            nomeArquivo="ocupacao-por-tipo"
            colunas={colunasQuadro("Tipo de LUC")}
            linhas={exportarQuadro([...tiposContam, ...tiposFora], doTipoTotal)}
          />
        );
      }
      case "movimentos":
        return (
          <BotaoExportar
            {...comum}
            titulo={`Entradas, saídas e transferências ${ano}`}
            nomeArquivo={`entradas-e-saidas-${ano}`}
            colunas={colunasExportarMov(indicador)}
            linhas={exportarMov(meses, movBlocos, movTotal)}
          />
        );
      case "carteira":
        return (
          <BotaoExportar
            {...comum}
            titulo="Curva da carteira"
            nomeArquivo="curva-da-carteira"
            colunas={COLUNAS_CARTEIRA}
            linhas={exportarCarteira(carteira)}
          />
        );
      default:
        return (
          <BotaoExportar
            {...comum}
            titulo="LUCs"
            nomeArquivo="lucs"
            colunas={colunasExportarLucs(comValores)}
            linhas={exportarLucs(lista, comValores)}
          />
        );
    }
  })();

  return (
    <div className="flex flex-col gap-6">
      <FiltrosComercial
        tela="ocupacao"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: filtro.bloco,
            icone: <Building2 className="size-4" />,
            opcoes: opcoes(blocos),
          },
          {
            chave: "tipo",
            rotulo: "Tipo de LUC",
            todos: "Contam na ocupação",
            valor: filtro.tipo,
            icone: <Tag className="size-4" />,
            largura: "w-52",
            opcoes: [
              { valor: TODOS_OS_TIPOS, rotulo: "Todos os tipos" },
              ...opcoes(tipos),
            ],
          },
          {
            chave: "status",
            rotulo: "Status",
            todos: "Todos os status",
            valor: filtro.status,
            icone: <LayoutGrid className="size-4" />,
            opcoes: Object.entries(STATUS).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            })),
          },
          {
            chave: "rua",
            rotulo: "Rua",
            todos: "Todas as ruas",
            valor: filtro.rua,
            icone: <MapPin className="size-4" />,
            largura: "w-48",
            opcoes: opcoes(ruas),
          },
          ...(aba === "movimentos"
            ? [
                {
                  chave: "ano",
                  rotulo: "Ano",
                  todos: String(anoAtual),
                  valor: ano === anoAtual ? "" : String(ano),
                  icone: <CalendarDays className="size-4" />,
                  largura: "w-32",
                  opcoes: anos
                    .slice(1)
                    .map((a) => ({ valor: String(a), rotulo: String(a) })),
                },
                {
                  chave: "indicador",
                  rotulo: "Indicador",
                  todos: INDICADORES.quantidade,
                  valor: indicador === "quantidade" ? "" : indicador,
                  icone: <Gauge className="size-4" />,
                  largura: "w-44",
                  opcoes: indicadores
                    .filter((i) => i !== "quantidade")
                    .map((i) => ({ valor: i, rotulo: INDICADORES[i] })),
                },
              ]
            : []),
        ]}
      />

      <TopoComercial
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={EXEMPLO.enet}
        acoes={exportarAba}
      />

      <CartoesComercial>
        <CartaoDaTela
          titulo="ABL total"
          valor={m2(t.ablTotal)}
          detalhe={`${formatarNumero(t.quantidade)} LUCs`}
          fonte={ENET}
          exemplo={EXEMPLO.enet}
          href={hrefStatus("")}
          ativo={!filtro.status}
        />
        <CartaoDaTela
          titulo="ABL locada"
          valor={m2(t.ablLocada)}
          detalhe={`${formatarNumero(t.locados)} LUCs locados`}
          fonte={ENET}
          exemplo={EXEMPLO.enet}
          href={hrefStatus("locado")}
          ativo={filtro.status === "locado"}
        />
        <CartaoDaTela
          titulo="ABL vaga"
          valor={m2(t.ablVaga)}
          detalhe={`${formatarNumero(t.vagos)} LUCs vagos`}
          fonte={ENET}
          exemplo={EXEMPLO.enet}
          href={hrefStatus("vago")}
          ativo={filtro.status === "vago"}
        />
        <CartaoDaTela
          titulo="% de ocupação"
          valor={formatarPct(t.pct, 1)}
          detalhe="ABL locada ÷ ABL total"
          calculo="ABL dos LUCs locados dividida pela ABL de todos os LUCs filtrados (o status não entra). LUC sem ABL, como área publicitária, conta na quantidade e não nos m². Tipos que contam: Configurações › Parâmetros."
          fonte={ENET}
          exemplo={EXEMPLO.enet}
        />
      </CartoesComercial>

      <AbasDaTela
        rotulo="Visões da ocupação"
        ativa={aba}
        abas={abas.map((a) => ({
          chave: a,
          rotulo: ABAS[a],
          href: hrefCom(BASE, f.busca, { aba: a === "lucs" ? null : a }),
        }))}
      />

      {aba === "lucs" && (
        <ListaDeLucs
          linhas={lista}
          todas={base}
          comValores={comValores}
          exportar={exportar}
          filtros={filtrosExp}
          hrefDe={(n) => `${BASE}/${encodeURIComponent(n)}`}
        />
      )}

      {aba === "bloco" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
          <Quadro
            titulo="Quadro por bloco"
            descricao="LUCs locados e vagos, ABL locada e vaga e % de ocupação de cada bloco."
            por="Bloco"
            linhas={porBloco}
            total={totalLista}
          />
          <GraficoPorBloco linhas={porBloco} />
        </div>
      )}

      {aba === "tipo" && (
        <>
          <Quadro
            titulo="Tipos que contam na ocupação"
            descricao="Lojas, salas e os demais tipos marcados nos parâmetros."
            por="Tipo de LUC"
            linhas={tiposContam}
            total={{
              chave: "Total",
              ...totais(doTipo.filter((l) => contam.has(l.tipo))),
            }}
          />
          <Quadro
            titulo="Fora da ocupação"
            descricao="Áreas publicitárias e os outros tipos que não contam no total (parâmetros). Área sem ABL conta na quantidade, não nos m²."
            por="Tipo de LUC"
            linhas={tiposFora}
            total={{
              chave: "Total",
              ...totais(doTipo.filter((l) => !contam.has(l.tipo))),
            }}
          />
        </>
      )}

      {aba === "movimentos" && (
        <QuadrosMovimento
          ano={ano}
          indicador={indicador}
          meses={meses}
          blocos={movBlocos}
          total={movTotal}
          dias={transferenciaDias}
        />
      )}

      {aba === "carteira" && comValores && (
        <TabelasCarteira
          linhas={carteira}
          total={totalCarteira}
          limites={curva}
        />
      )}
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
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
