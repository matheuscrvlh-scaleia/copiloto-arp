import { Building2, CalendarClock, CalendarRange, Repeat } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import {
  CartaoDaTela,
  CartoesComercial,
  EXEMPLO,
  FiltrosComercial,
  hrefDoCartao,
  TopoComercial,
} from "@/components/comercial/tela";
import {
  colunasExportarVencimentos,
  ESTIMATIVA,
  exportarVencimentos,
  ListaVencimentos,
} from "@/components/comercial/vencimentos/lista";
import { Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import {
  contarFaixas,
  type FaixaVencimento,
  linhasDeVencimento,
  NOMES_DOS_MESES,
  nomeDoMes,
  noPeriodo,
  PERIODOS_TERMINO,
  type PeriodoTermino,
  rotulosDasFaixas,
} from "@/lib/comercial/vencimentos";
import { formatarMes, formatarNumero, formatarPct } from "@/lib/formato";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";
import { dadosDosVencimentos } from "@/server/comercial/vencimentos";

export const metadata: Metadata = { title: "Vencimentos de contrato" };

const BASE = "/comercial/vencimentos";
const ENET = "ENET — Contratos";
const PRAZOS = {
  determinado: "Determinado",
  indeterminado: "Indeterminado",
} as const;
const CARTOES: FaixaVencimento[] = [
  "vencido",
  "faixa1",
  "faixa2",
  "indeterminado",
];

export default function Page({
  searchParams,
}: PageProps<"/comercial/vencimentos">) {
  return (
    <>
      <PageHeader
        title="Vencimentos de contrato"
        description="Quais contratos vencem ou já venceram, para negociar a renovação com antecedência."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.vencimentos.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("vencimentos", await busca);
  const { ctx } = f;
  const comValores = ctx.pode("comercial.valores.ver");
  const exportar = ctx.pode("comercial.exportar");
  const d = await dadosDosVencimentos();

  const periodo: PeriodoTermino =
    f.um("periodo") in PERIODOS_TERMINO
      ? (f.um("periodo") as PeriodoTermino)
      : "";
  const blocos = [...new Set(d.enet.lucs.map((l) => l.local))];
  const bloco = blocos.includes(f.um("bloco")) ? f.um("bloco") : "";
  const prazo =
    f.um("prazo") in PRAZOS ? (f.um("prazo") as keyof typeof PRAZOS) : "";
  const mes = Number(f.um("mes"));
  const mesReajuste = mes >= 1 && mes <= 12 ? mes : 0;
  const cartao = (CARTOES as string[]).includes(f.um("cartao"))
    ? (f.um("cartao") as FaixaVencimento)
    : "";

  const todas = linhasDeVencimento({
    contratos: d.enet.contratos,
    lucs: d.lucs,
    hoje: ctx.hoje,
    faixas: d.faixas,
    diasReajuste: d.diasReajuste,
    acumulados: d.acumulados,
    comValores,
  });
  const base = todas.filter(
    (l) =>
      noPeriodo(
        { prazo: l.prazo, data_termino: l.termino },
        ctx.hoje,
        periodo,
      ) &&
      (!bloco || l.bloco === bloco) &&
      (!prazo || l.prazo === PRAZOS[prazo]) &&
      (!mesReajuste || l.mesReajuste === mesReajuste),
  );
  const lista = cartao ? base.filter((l) => l.faixa === cartao) : base;
  const n = contarFaixas(base);
  const rotulos = rotulosDasFaixas(d.faixas);

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Período de término", valor: PERIODOS_TERMINO[periodo] },
    { rotulo: "Bloco", valor: bloco || "Todos" },
    { rotulo: "Tipo de prazo", valor: prazo ? PRAZOS[prazo] : "Todos" },
    {
      rotulo: "Mês de reajuste",
      valor: mesReajuste ? nomeDoMes(mesReajuste) : "Todos",
    },
    ...(cartao ? [{ rotulo: "Cartão", valor: rotulos[cartao] }] : []),
  ]);
  const indice = (i: "IGPM" | "IPCA", nome: string) =>
    d.acumulados[i] === null
      ? `${nome} indisponível`
      : `${nome} ${formatarPct(d.acumulados[i], 2)} (12 meses até ${formatarMes(d.ate[i] ?? "")})`;
  const semIndice = d.acumulados.IGPM === null || d.acumulados.IPCA === null;

  return (
    <div className="flex flex-col gap-6">
      <FiltrosComercial
        tela="vencimentos"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "periodo",
            rotulo: "Período de término",
            todos: PERIODOS_TERMINO[""],
            valor: periodo,
            icone: <CalendarRange className="size-4" />,
            largura: "w-52",
            opcoes: (Object.keys(PERIODOS_TERMINO) as PeriodoTermino[])
              .filter((p) => p)
              .map((p) => ({ valor: p, rotulo: PERIODOS_TERMINO[p] })),
          },
          {
            chave: "bloco",
            rotulo: "Bloco",
            todos: "Todos os blocos",
            valor: bloco,
            icone: <Building2 className="size-4" />,
            opcoes: blocos.map((b) => ({ valor: b, rotulo: b })),
          },
          {
            chave: "prazo",
            rotulo: "Tipo de prazo",
            todos: "Todos os prazos",
            valor: prazo,
            icone: <CalendarClock className="size-4" />,
            opcoes: Object.entries(PRAZOS).map(([valor, rotulo]) => ({
              valor,
              rotulo,
            })),
          },
          {
            chave: "mes",
            rotulo: "Mês de reajuste",
            todos: "Todos os meses de reajuste",
            valor: mesReajuste ? String(mesReajuste) : "",
            icone: <Repeat className="size-4" />,
            largura: "w-56",
            opcoes: NOMES_DOS_MESES.map((m, i) => ({
              valor: String(i + 1),
              rotulo: m,
            })),
          },
        ]}
      />

      <TopoComercial
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={EXEMPLO.enet}
        acoes={
          exportar ? (
            <BotaoExportar
              titulo="Vencimentos de contrato"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="vencimentos-de-contrato"
              colunas={colunasExportarVencimentos(comValores)}
              linhas={exportarVencimentos(lista, comValores)}
            />
          ) : undefined
        }
      />

      <CartoesComercial>
        {CARTOES.map((k) => (
          <CartaoDaTela
            key={k}
            titulo={rotulos[k]}
            valor={formatarNumero(n[k])}
            detalhe={
              k === "vencido"
                ? "Prazo determinado, sem renovação"
                : k === "indeterminado"
                  ? "Seguem sem data de término"
                  : k === "faixa1"
                    ? "Faixa 1 (parâmetro)"
                    : "Faixa 2 (parâmetro)"
            }
            fonte={ENET}
            exemplo={EXEMPLO.enet}
            href={hrefDoCartao(BASE, f.busca, k)}
            ativo={cartao === k}
          />
        ))}
      </CartoesComercial>

      <Secao
        titulo="Contratos"
        descricao={`Uma linha por contrato ativo · reajuste previsto para reajuste nos próximos ${d.diasReajuste} dias (parâmetro): ${indice("IGPM", "IGP-M")}, ${indice("IPCA", "IPCA")} · ${ESTIMATIVA}.${semIndice ? " Sem o índice, a estimativa fica de fora até o Banco Central voltar." : ""}${comValores ? "" : " Aluguel só para quem tem a permissão de valores."}`}
      >
        <ListaVencimentos
          linhas={lista}
          comValores={comValores}
          faixas={d.faixas}
          hrefDe={(c) => `${BASE}/${encodeURIComponent(c)}`}
        />
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
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
