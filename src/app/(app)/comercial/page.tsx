import { CalendarDays, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import {
  COLUNAS_EXPORTAR_PAINEL,
  GradePainel,
  linhasExportarPainel,
} from "@/components/comercial/painel/grade";
import {
  EXEMPLO,
  FiltrosComercial,
  Fonte,
  TopoComercial,
} from "@/components/comercial/tela";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { BotaoExportar } from "@/components/os/exportar";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { linhaDeFiltros } from "@/lib/comercial/formato";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";
import { dadosDoPainel } from "@/server/comercial/painel";

export const metadata: Metadata = { title: "Painel comercial" };

export default function Page({ searchParams }: PageProps<"/comercial">) {
  return (
    <>
      <PageHeader
        title="Painel de indicadores comerciais"
        description="Planejado × realizado × % atingido, mês a mês, com o acumulado do ano: a aba “Painel de Indicadores Anual” do Planejamento Comercial. O realizado vem do ENET e do RD; o planejado, das metas cadastradas."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.painel.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

const botao =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const f = await lerFiltros("painel", await busca);
  const { ctx } = f;
  const anoAtual = Number(ctx.hoje.slice(0, 4));
  const ano = /^\d{4}$/.test(f.um("ano")) ? Number(f.um("ano")) : anoAtual;
  const d = await dadosDoPainel(ano);
  const linhaFiltros = linhaDeFiltros([{ rotulo: "Ano", valor: String(ano) }]);
  const exportar = ctx.pode("comercial.exportar");
  const metas = ctx.pode("comercial.painel.metas");
  const exemplo = d.exemplo ? EXEMPLO.rdEnet : undefined;

  return (
    <div className="flex flex-col gap-6">
      <FiltrosComercial
        tela="painel"
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
            opcoes: d.anos
              .filter((a) => a !== anoAtual)
              .map((a) => ({ valor: String(a), rotulo: String(a) })),
          },
        ]}
      />

      <TopoComercial
        dadosDe={ctx.dadosDe}
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
                  filtros={`${linhaFiltros} · ${ctx.dadosDe}`}
                  nomeArquivo={`painel-comercial-${ano}`}
                  colunas={COLUNAS_EXPORTAR_PAINEL}
                  linhas={linhasExportarPainel(d.linhas)}
                />
              )}
            </>
          ) : undefined
        }
      />

      <Secao
        titulo={`Indicadores de ${ano}`}
        exemplo={
          exemplo && "ENET e RD Station de exemplo; as metas são as cadastradas"
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
        <Nota>
          % Ocupação e valor por m² usam a foto do último dia de cada mês.
          {d.semFoto &&
            (d.exemplo
              ? " Meses sem foto guardada (*) são calculados pelos contratos do ENET de exemplo ativos no fim do mês."
              : " Meses antes das fotos ficam vazios, com o rótulo “sem histórico”.")}{" "}
          No mês corrente (h), a ocupação de hoje no ENET.
        </Nota>
        <Nota>
          Faturamento em carência: número parcial, só contratos feitos no
          sistema
          {d.contratosComCarencia
            ? ` (${d.contratosComCarencia} com carência).`
            : " (ainda nenhum contrato com carência)."}
        </Nota>
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
      <CartaoCarregando altura="h-[60rem]" />
    </TelaCarregando>
  );
}
