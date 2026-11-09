import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CartaoCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota } from "@/components/dashboard/tabela";
import { TopoDaTela } from "@/components/dashboard/tela";
import {
  CartoesDoPainel,
  exemplosDoPainel,
  QuadroAgua,
  QuadroContas,
  QuadroDiario,
  QuadroEnergia,
  QuadroLimpeza,
  QuadroObras,
} from "@/components/operacoes/painel/painel";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { contextoOp, parametros } from "@/server/operacoes/base";
import { dadosDoPainel } from "@/server/operacoes/painel";

export const metadata: Metadata = { title: "Painel de Operações" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Painel de Operações"
        description="Água, energia, rateio da limpeza e obras num lugar só. Clique num número para abrir a tela de origem."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="operacoes.painel">
          <Painel />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Painel() {
  const [ctx, p] = await Promise.all([contextoOp(), parametros()]);
  const d = await dadosDoPainel(ctx, p);
  const nenhuma = Object.values(d).every((v) => v === null);
  const chamados = ctx.pode("os.painel_setor") || ctx.pode("os.painel_geral");

  return (
    <div className="flex flex-col gap-6">
      <TopoDaTela
        dadosDe={ctx.dadosDe}
        exemplo={exemplosDoPainel(d)}
        acoes={
          chamados ? (
            <Link
              href="/os/paineis"
              data-guia="op-painel-chamados"
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400"
            >
              <ExternalLink className="size-4" aria-hidden />
              Painel de Chamados
            </Link>
          ) : undefined
        }
      />

      {nenhuma ? (
        <Cartao>
          <p className="text-sm text-neutral-600">
            O painel mostra as áreas que você pode ver (água, energia, rateio da
            limpeza, obras). Peça ao administrador a permissão de ver alguma
            delas.
          </p>
        </Cartao>
      ) : (
        <>
          <CartoesDoPainel d={d} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {d.agua && <QuadroAgua a={d.agua} />}
            {d.diario && <QuadroDiario d={d.diario} />}
            {d.energia && <QuadroEnergia e={d.energia} />}
            {d.contas && (
              <QuadroContas
                c={d.contas}
                comTotal={ctx.pode("operacoes.energia.contas")}
                comSolar={ctx.pode("operacoes.solar.ver")}
              />
            )}
            {d.limpeza && <QuadroLimpeza l={d.limpeza} />}
            {d.obras && <QuadroObras o={d.obras} />}
          </div>
        </>
      )}

      <Nota>
        Os indicadores de chamados, OS, minuto-homem e ativos ficam no painel do
        Módulo de Chamados. Limites e prazos (alerta de consumo, dia útil do
        envio do rateio, desvios das obras) vêm de Operações › Parâmetros.
      </Nota>
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <IndicadoresCarregando
        className="sm:grid-cols-2 xl:grid-cols-4"
        quantidade={4}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CartaoCarregando altura="h-96" />
        <CartaoCarregando altura="h-96" />
      </div>
    </TelaCarregando>
  );
}
