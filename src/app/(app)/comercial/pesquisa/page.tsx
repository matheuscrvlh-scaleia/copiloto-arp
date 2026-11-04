import { CalendarDays, Ruler, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import {
  EXEMPLO,
  FiltrosComercial,
  TabelaLista,
  TopoComercial,
  Valor,
} from "@/components/comercial/tela";
import { Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import {
  dentroDoPeriodo,
  faixaDeTamanho,
  faixasDeTamanho,
  type LinhaResumo,
  PERIODO_12_MESES,
  resumoPorBairro,
  rotuloDoPeriodo,
} from "@/lib/comercial/pesquisa";
import { formatarData, formatarMes, formatarNumero } from "@/lib/formato";
import { parametros, valoresDaLista } from "@/server/comercial/base";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";
import { imoveisPesquisados, valorM2Arp } from "@/server/comercial/pesquisa";

export const metadata: Metadata = { title: "Pesquisa de mercado" };

const BASE = "/comercial/pesquisa";

export default function Page({
  searchParams,
}: PageProps<"/comercial/pesquisa">) {
  return (
    <>
      <PageHeader
        title="Pesquisa de mercado"
        description="Preços de imóveis da concorrência em Nova Friburgo (Viva Real, Zap Imóveis, Chaves na Mão e imobiliárias), alimentados na rotina mensal. Só locação."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.pesquisa.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const COLUNAS_RESUMO = [
  { titulo: "Bairro" },
  { titulo: "Imóveis", numero: true },
  { titulo: "m² médio", numero: true },
  { titulo: "Aluguel médio", numero: true },
  { titulo: "Condomínio médio", numero: true },
  { titulo: "IPTU médio", numero: true },
  { titulo: "Valor por m² médio", numero: true },
  { titulo: "Custo total médio", numero: true },
  { titulo: "Custo total por m²", numero: true },
];

const celulasResumo = (r: LinhaResumo) => [
  r.quantidade,
  r.areaMedia,
  r.aluguelMedio,
  r.condominioMedio,
  r.iptuMedio,
  r.valorM2Medio,
  r.custoTotalMedio,
  r.custoM2Medio,
];

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("pesquisa", await busca);
  const { ctx } = f;
  const [imoveis, p, tipos, arp] = await Promise.all([
    imoveisPesquisados(),
    parametros(),
    valoresDaLista("pesquisa_tipo"),
    valorM2Arp(),
  ]);
  const limites = p.pesquisa_faixas_m2.map(Number);
  const faixas = faixasDeTamanho(limites);
  const tiposNaBase = [...new Set([...tipos, ...imoveis.map((i) => i.tipo)])];
  const anos = [
    ...new Set(imoveis.map((i) => i.data_pesquisa.slice(0, 4))),
  ].sort((a, b) => b.localeCompare(a));
  const tipo = tiposNaBase.includes(f.um("tipo")) ? f.um("tipo") : "";
  const faixa = faixas.includes(f.um("faixa")) ? f.um("faixa") : "";
  const periodo =
    f.um("periodo") === PERIODO_12_MESES || anos.includes(f.um("periodo"))
      ? f.um("periodo")
      : "";

  const lista = imoveis
    .map((i) => ({ ...i, faixa: faixaDeTamanho(i.area_m2, limites) }))
    .filter(
      (i) =>
        (!tipo || i.tipo === tipo) &&
        (!faixa || i.faixa === faixa) &&
        dentroDoPeriodo(i.data_pesquisa, periodo, ctx.hoje),
    );
  const resumo = resumoPorBairro(lista);
  const exemplo = lista.some((i) => i.exemplo);
  const datas = lista.map((i) => i.data_pesquisa).sort();

  const linhaFiltros = linhaDeFiltros([
    { rotulo: "Tipo", valor: tipo || "Todos" },
    { rotulo: "Faixa de tamanho", valor: faixa || "Todas" },
    { rotulo: "Período", valor: rotuloDoPeriodo(periodo) },
  ]);
  const podeExportar = ctx.pode("comercial.exportar");
  const arpTexto = `ARP (Painel, ${formatarMes(arp.mes)})`;

  return (
    <div className="flex flex-col gap-6">
      <FiltrosComercial
        tela="pesquisa"
        hoje={ctx.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "tipo",
            rotulo: "Tipo",
            todos: "Todos os tipos",
            valor: tipo,
            icone: <Store className="size-4" />,
            opcoes: tiposNaBase.map((t) => ({ valor: t, rotulo: t })),
          },
          {
            chave: "faixa",
            rotulo: "Faixa de tamanho",
            todos: "Todas as faixas",
            valor: faixa,
            icone: <Ruler className="size-4" />,
            opcoes: faixas.map((x) => ({ valor: x, rotulo: x })),
          },
          {
            chave: "periodo",
            rotulo: "Período",
            todos: "Todo o período",
            valor: periodo,
            icone: <CalendarDays className="size-4" />,
            opcoes: [
              { valor: PERIODO_12_MESES, rotulo: "Últimos 12 meses" },
              ...anos.map((a) => ({ valor: a, rotulo: a })),
            ],
          },
        ]}
      />

      <TopoComercial
        dadosDe={ctx.dadosDe}
        filtros={linhaFiltros}
        exemplo={
          exemplo
            ? "imóveis pesquisados de exemplo (endereços inventados) e o valor por m² da ARP, até a importação e a API do ENET"
            : arp.exemplo
              ? "valor por m² da ARP (ENET), até a API ser ligada"
              : undefined
        }
        acoes={
          <div className="flex flex-wrap items-center gap-2">
            {ctx.pode("comercial.pesquisa.editar") && (
              <Link
                href={`${BASE}/novo`}
                className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
              >
                Cadastrar imóvel
              </Link>
            )}
            {podeExportar && (
              <BotaoExportar
                titulo="Pesquisa de mercado — imóveis"
                filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                nomeArquivo="pesquisa-de-mercado"
                colunas={[
                  { titulo: "Data" },
                  { titulo: "Endereço ou referência" },
                  { titulo: "Bairro" },
                  { titulo: "Tipo" },
                  { titulo: "Área (m²)", numero: true, formato: "#,##0.00" },
                  { titulo: "Aluguel", numero: true, formato: "#,##0.00" },
                  { titulo: "Condomínio", numero: true, formato: "#,##0.00" },
                  { titulo: "IPTU", numero: true, formato: "#,##0.00" },
                  { titulo: "Valor por m²", numero: true, formato: "#,##0.00" },
                  { titulo: "Custo total", numero: true, formato: "#,##0.00" },
                  {
                    titulo: "Custo total por m²",
                    numero: true,
                    formato: "#,##0.00",
                  },
                  { titulo: "Faixa" },
                  { titulo: "Vagas", numero: true },
                  { titulo: "Fonte" },
                ]}
                linhas={lista.map((i) => [
                  formatarData(i.data_pesquisa),
                  i.endereco,
                  i.bairro,
                  i.tipo,
                  i.area_m2,
                  i.aluguel,
                  i.condominio,
                  i.iptu,
                  i.valor_m2,
                  i.custo_total,
                  i.custo_m2,
                  i.faixa,
                  i.vagas,
                  i.fonte ?? "",
                ])}
              />
            )}
          </div>
        }
      />

      <Secao
        titulo="Resumo por bairro"
        descricao={`Como a aba Resumo, nos filtros: médias simples dos imóveis (condomínio e IPTU em branco ficam fora da média deles). A linha ARP usa o valor por m² do Painel: faturamento de ${formatarMes(arp.mes)} ÷ ABL locada no fim do mês.`}
        exemplo={arp.exemplo ? EXEMPLO.enet : false}
      >
        <div className="flex items-center justify-end pb-2">
          {podeExportar && (
            <BotaoExportar
              titulo="Pesquisa de mercado — resumo por bairro"
              filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
              nomeArquivo="pesquisa-de-mercado-resumo"
              colunas={COLUNAS_RESUMO.map((c) =>
                c.numero ? { ...c, formato: "#,##0.00" } : c,
              )}
              linhas={[
                ...resumo.map((r) => [r.bairro, ...celulasResumo(r)]),
                [arpTexto, null, null, null, null, null, arp.valor, null, null],
              ]}
            />
          )}
        </div>
        <TabelaLista
          semBusca
          caber
          colunas={COLUNAS_RESUMO}
          vazio="Nenhum imóvel nos filtros."
          rodape={[
            arpTexto,
            "—",
            "—",
            "—",
            "—",
            "—",
            <Valor key="arp" valor={arp.valor} />,
            "—",
            "—",
          ]}
          linhas={resumo.map((r) => ({
            chave: r.bairro,
            busca: r.bairro,
            ordem: [r.bairro, ...celulasResumo(r)],
            celulas: [
              <span key="b" className="font-medium">
                {r.bairro}
              </span>,
              formatarNumero(r.quantidade),
              <Valor key="a" valor={r.areaMedia} />,
              <Valor key="al" valor={r.aluguelMedio} />,
              <Valor key="c" valor={r.condominioMedio} />,
              <Valor key="i" valor={r.iptuMedio} />,
              <Valor key="v" valor={r.valorM2Medio} />,
              <Valor key="ct" valor={r.custoTotalMedio} />,
              <Valor key="cm" valor={r.custoM2Medio} />,
            ],
          }))}
        />
      </Secao>

      <Secao
        titulo="Imóveis pesquisados"
        descricao={
          datas.length
            ? `${formatarNumero(lista.length)} imóveis de ${formatarData(datas[0] ?? null)} a ${formatarData(datas.at(-1) ?? null)}. Só locação.`
            : "Só locação."
        }
      >
        <TabelaLista
          colunas={[
            { titulo: "Data" },
            { titulo: "Referência", classe: "min-w-56" },
            { titulo: "Bairro" },
            { titulo: "Tipo" },
            { titulo: "Área (m²)", numero: true },
            { titulo: "Aluguel", numero: true },
            { titulo: "Condomínio", numero: true },
            { titulo: "IPTU", numero: true },
            { titulo: "Valor por m²", numero: true },
            { titulo: "Custo total", numero: true },
            { titulo: "Custo por m²", numero: true },
            { titulo: "Faixa" },
            { titulo: "Fonte" },
          ]}
          vazio="Nenhum imóvel nos filtros."
          placeholder="Buscar endereço, bairro ou fonte…"
          rodape={[
            "Total",
            `${formatarNumero(lista.length)} imóveis`,
            "",
            "",
            <Valor key="a" valor={lista.reduce((s, i) => s + i.area_m2, 0)} />,
            <Valor key="al" valor={lista.reduce((s, i) => s + i.aluguel, 0)} />,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ]}
          linhas={lista.map((i) => ({
            chave: i.id,
            href: `${BASE}/${i.id}`,
            busca: `${i.endereco} ${i.bairro} ${i.tipo} ${i.fonte ?? ""} ${i.observacao ?? ""}`,
            ordem: [
              i.data_pesquisa,
              i.endereco,
              i.bairro,
              i.tipo,
              i.area_m2,
              i.aluguel,
              i.condominio,
              i.iptu,
              i.valor_m2,
              i.custo_total,
              i.custo_m2,
              i.area_m2,
              i.fonte,
            ],
            celulas: [
              formatarData(i.data_pesquisa),
              i.endereco,
              i.bairro,
              i.tipo,
              <Valor key="a" valor={i.area_m2} />,
              <Valor key="al" valor={i.aluguel} />,
              <Valor key="c" valor={i.condominio} />,
              <Valor key="i" valor={i.iptu} />,
              <Valor key="v" valor={i.valor_m2} />,
              <Valor key="ct" valor={i.custo_total} />,
              <Valor key="cm" valor={i.custo_m2} />,
              i.faixa,
              i.fonte ? fonteCurta(i.fonte) : "—",
            ],
          }))}
        />
      </Secao>
    </div>
  );
}

/** "https://www.vivareal.com.br/…" → "vivareal.com.br". */
function fonteCurta(fonte: string): string {
  try {
    return new URL(fonte).hostname.replace(/^www\./, "");
  } catch {
    return fonte.slice(0, 40);
  }
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <CartaoCarregando altura="h-72" />
      <CartaoCarregando altura="h-[32rem]" />
    </TelaCarregando>
  );
}
