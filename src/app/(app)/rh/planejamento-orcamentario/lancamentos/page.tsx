import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { SemAcesso } from "@/components/protegido";
import {
  AbasDoOrcamento,
  FiltrosDoOrcamento,
  GastosDoOrcamento,
} from "@/components/rh/orcamento";
import { CONFIGURACOES_RH } from "@/config/navigation";
import { formatarDataHora, formatarMoeda } from "@/lib/formato";
import { soma } from "@/lib/rh/orcamento";
import { finalizarOrcamento } from "@/server/rh/acoes/orcamento";
import { telaDoOrcamento } from "@/server/rh/orcamento";

export const metadata: Metadata = {
  title: "Lançamentos · Planejamento orçamentário",
};

type Busca = Record<string, string | string[] | undefined>;

export default function Page({
  searchParams,
}: PageProps<"/rh/planejamento-orcamentario/lancamentos">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-12" />
          <CartaoCarregando />
        </TelaCarregando>
      }
    >
      <Tela busca={searchParams} />
    </Suspense>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const t = await telaDoOrcamento(await busca);
  if (!t) return <SemAcesso />;
  const { lanca, hoje, ano, orcamento, finalizado, gastos, categorias } = t;
  const dataPadrao = hoje.slice(0, 4) === String(ano) ? hoje : `${ano}-01-01`;

  return (
    <div className="flex flex-col gap-6">
      <FiltrosDoOrcamento
        anos={t.anos}
        ano={ano}
        mes={t.mes}
        categorias={categorias}
        categoria={t.categoria}
      />
      <AbasDoOrcamento />

      <Secao
        id="gastos"
        titulo="Gastos lançados"
        descricao={`${t.rotuloFiltro}. ${
          finalizado && orcamento?.finalizado_em
            ? `Orçamento de ${ano} finalizado em ${formatarDataHora(orcamento.finalizado_em)} por ${orcamento.finalizado_por ?? "—"}: só leitura.`
            : lanca
              ? "Cada gasto abate do orçamento do ano da sua data. A categoria é escolhida da lista de Configurações › Cadastros."
              : "Quem lança é a Gestão de RH."
        }`}
      >
        <GastosDoOrcamento
          gastos={t.doFiltro}
          categorias={categorias}
          editavel={lanca && !finalizado}
          dataPadrao={dataPadrao}
          ano={ano}
        />
        {lanca && !finalizado && categorias.every((c) => !c.ativa) && (
          <p className="mt-3 text-xs text-amber-700">
            Nenhuma categoria ativa: cadastre uma em{" "}
            <Link
              href={`${CONFIGURACOES_RH.cadastros}#categorias-gasto`}
              className="underline"
            >
              Configurações › Cadastros
            </Link>
            .
          </p>
        )}
      </Secao>

      {lanca && !finalizado && orcamento && (
        <Secao
          titulo="Finalizar o orçamento do ano"
          descricao={`Fecha o ano de ${ano}: guarda o total orçado, o total gasto, o saldo, a data e quem fechou. Depois disso o ano fica só leitura e o sistema passa a puxar do ERP o orçamento do ano seguinte.`}
        >
          <FormAcao
            acao={finalizarOrcamento}
            rotulo={`Finalizar orçamento de ${ano}`}
            rotuloEnviando="Finalizando…"
            variante="perigo"
            confirmar={`Finalizar o orçamento de ${ano}? Gasto até agora: ${formatarMoeda(soma(gastos))} de ${formatarMoeda(orcamento.valor)}. Depois disso nenhum gasto de ${ano} pode ser lançado, corrigido ou excluído, e não há como desfazer.`}
          >
            <input type="hidden" name="ano" value={ano} />
          </FormAcao>
        </Secao>
      )}
    </div>
  );
}
