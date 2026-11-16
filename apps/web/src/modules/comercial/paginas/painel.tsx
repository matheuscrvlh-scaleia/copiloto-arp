import { linhaDeFiltros } from "@arp/shared/comercial/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, Target } from "lucide-react";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { consultaDoPainel } from "../api/painel";
import { type FiltrosCom, useFiltrosCom } from "../base";
import {
  COLUNAS_EXPORTAR_PAINEL,
  GradePainel,
  linhasExportarPainel,
} from "../components/painel/grade";
import { VisaoPainel } from "../components/painel/visao";
import {
  EXEMPLO,
  FiltrosComercial,
  Fonte,
  TopoComercial,
} from "../components/tela";

// /comercial: Painel de indicadores (app/(app)/comercial/page.tsx).

export default function Page() {
  return (
    <>
      <PageHeader
        title="Painel de indicadores comerciais"
        description="Planejado × realizado × % atingido, mês a mês, com o acumulado do ano: a aba “Painel de Indicadores Anual” do Planejamento Comercial. O realizado vem do ENET e do RD; o planejado, das metas cadastradas."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.painel.ver">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

const botao =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

function Tela() {
  const f = useFiltrosCom("painel");
  return f ? <Painel f={f} /> : <Esqueleto />;
}

function Painel({ f }: { f: FiltrosCom }) {
  const { ctx } = f;
  const pedido = /^\d{4}$/.test(f.um("ano")) ? Number(f.um("ano")) : null;
  const { data: d } = useSuspenseQuery(consultaDoPainel(pedido));
  const anoAtual = Number(d.hoje.slice(0, 4));
  const ano = d.ano;
  const linhaFiltros = linhaDeFiltros([{ rotulo: "Ano", valor: String(ano) }]);
  const exportar = ctx.pode("comercial.exportar");
  const metas = ctx.pode("comercial.painel.metas");
  const exemplo = d.exemplo ? EXEMPLO.enet : undefined;

  return (
    <div className="flex flex-col gap-6">
      <FiltrosComercial
        tela="painel"
        hoje={d.hoje}
        lembrado={f.lembrado}
        selecoes={[
          {
            chave: "ano",
            rotulo: "Ano",
            todos: String(anoAtual),
            valor: ano === anoAtual ? "" : String(ano),
            icone: <CalendarDays className="size-4" />,
            largura: "w-32",
            opcoes: d.anos
              .filter((a) => a !== anoAtual)
              .map((a) => ({ valor: String(a), rotulo: String(a) })),
          },
        ]}
      />

      <TopoComercial
        dadosDe={d.dadosDe}
        filtros={linhaFiltros}
        exemplo={exemplo}
        acoes={
          metas || exportar ? (
            <>
              {metas && (
                <Link
                  href={`/comercial/configuracoes/metas?ano=${ano}`}
                  className={botao}
                >
                  <Target className="size-4" aria-hidden />
                  Editar metas
                </Link>
              )}
              {exportar && (
                <BotaoExportar
                  titulo={`Painel de indicadores comerciais ${ano}`}
                  filtros={`${linhaFiltros} · ${d.dadosDe}${d.comValores ? "" : " · Valores em reais só com a permissão de valores"}`}
                  nomeArquivo={`painel-comercial-${ano}`}
                  colunas={COLUNAS_EXPORTAR_PAINEL}
                  linhas={linhasExportarPainel(d.linhas)}
                />
              )}
            </>
          ) : undefined
        }
      />

      <VisaoPainel ano={ano} linhas={d.linhas} exemplo={exemplo} />

      <Secao
        titulo={`Mês a mês em ${ano}`}
        exemplo={
          exemplo && "ENET de exemplo; o RD Station e as metas são reais"
        }
        descricao="Real vem das APIs; Plan vem das metas cadastradas. % atingido abaixo de 100% em vermelho; em rescindidos e churn, menor é melhor e a cor inverte. Passe o mouse no nome do indicador para ver o cálculo."
      >
        <GradePainel linhas={d.linhas} />
        <Fonte>
          ENET (contas a receber, contratos e LUCs), RD Station CRM
          (oportunidades do funil padrão dos parâmetros) e metas em
          Configurações › Metas. Acumulado do Plan nos mesmos meses do Real.
        </Fonte>
      </Secao>

      <div className="flex flex-col gap-2">
        {d.avisoRd && <Nota>{d.avisoRd} Os leads ficam vazios até lá.</Nota>}
        {!d.comValores && (
          <Nota>Valores em reais só com a permissão de valores.</Nota>
        )}
        <Nota>
          % Ocupação{d.comValores ? " e valor por m² usam" : " usa"} a foto do
          último dia de cada mês.
          {d.semFoto &&
            (d.exemplo
              ? " Meses sem foto guardada (*) são calculados pelos contratos do ENET de exemplo ativos no fim do mês."
              : " Meses antes das fotos ficam vazios, com o rótulo “sem histórico”.")}{" "}
          No mês corrente (h), a ocupação de hoje no ENET.
        </Nota>
        {d.comValores && (
          <Nota>
            Faturamento em carência: número parcial, só contratos feitos no
            sistema
            {d.contratosComCarencia
              ? ` (${d.contratosComCarencia} com carência).`
              : " (ainda nenhum contrato com carência)."}
          </Nota>
        )}
        <Nota>
          Ficam fora do painel: estoque disponível e estoque em obra em reais
          (dependem do preço de tabela, que não vem do ENET) e faturamento em
          obra (o status de obra vem só da planilha). Voltam se o ENET tiver os
          campos.
        </Nota>
      </div>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: esqueleto fixo
          <CartaoCarregando key={i} altura="h-44" />
        ))}
      </div>
      <CartaoCarregando altura="h-[40rem]" />
    </TelaCarregando>
  );
}
