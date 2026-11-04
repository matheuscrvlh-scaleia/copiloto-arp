import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { AbasDaTela, hrefCom } from "@/components/comercial/tela";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { rodadasCenso } from "@/server/comercial/censo";
import { type Busca, lerFiltros } from "@/server/comercial/filtros";
import { Feedbacks } from "./feedbacks";
import { Indicadores, TELA_FILTROS } from "./indicadores";
import { Rodadas } from "./rodadas";

export const metadata: Metadata = { title: "Censo" };

const BASE = "/comercial/censo";
const ABAS = {
  indicadores: "Indicadores",
  feedbacks: "Feedbacks",
  rodadas: "Rodadas",
} as const;
type Aba = keyof typeof ABAS;

export default function Page({ searchParams }: PageProps<"/comercial/censo">) {
  return (
    <>
      <PageHeader
        title="Censo"
        description="O panorama das empresas do Espaço ARP a cada rodada do questionário (colaboradores, público, movimentação e planos) e as sugestões delas, agrupadas por tema."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.censo.ver">
          <Tela busca={searchParams} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela({ busca }: { busca: Promise<Busca> }) {
  // Cada aba lembra os próprios filtros: a aba da URL escolhe a chave e não
  // conta como filtro (só "?aba=feedbacks" ainda traz os lembrados dela).
  const { aba: abaUrl, ...semAba } = await busca;
  const pedida = (Array.isArray(abaUrl) ? abaUrl[0] : abaUrl) as Aba;
  const chave = pedida in ABAS ? pedida : "indicadores";
  const [lidos, rodadas] = await Promise.all([
    lerFiltros(TELA_FILTROS[chave], semAba),
    rodadasCenso(),
  ]);
  const lembrado = new URLSearchParams(lidos.lembrado ?? "");
  lembrado.delete("aba");
  if (lembrado.size && chave !== "indicadores") {
    lembrado.set("aba", chave);
    redirect(`${BASE}?${lembrado}`);
  }
  const f = {
    ...lidos,
    busca:
      chave === "indicadores" ? lidos.busca : { ...lidos.busca, aba: chave },
  };
  const aplicar = f.ctx.pode("comercial.censo.aplicar");
  const aba: Aba =
    pedida in ABAS && (pedida !== "rodadas" || aplicar)
      ? pedida
      : "indicadores";
  const rodada =
    rodadas.find((r) => r.id === f.um("rodada")) ?? rodadas[0] ?? null;

  const abas = (Object.keys(ABAS) as Aba[])
    .filter((a) => a !== "rodadas" || aplicar)
    .map((chave) => ({
      chave,
      rotulo: ABAS[chave],
      href: hrefCom(
        BASE,
        {},
        {
          aba: chave === "indicadores" ? null : chave,
          tema: null,
          cartao: null,
        },
      ),
    }));

  return (
    <div className="flex flex-col gap-6">
      <AbasDaTela abas={abas} ativa={aba} rotulo="Partes do Censo" />
      {aba === "rodadas" ? (
        <Rodadas f={f} rodadas={rodadas} rodada={rodada} />
      ) : !rodada ? (
        <Cartao>
          <p className="text-sm text-neutral-600">
            Nenhuma rodada do Censo ainda.
            {aplicar
              ? " Abra a primeira na aba Rodadas ou importe a planilha de 2026 em Configurações › Importações."
              : " Quem aplica o Censo abre a rodada."}
          </p>
        </Cartao>
      ) : aba === "feedbacks" ? (
        <Feedbacks f={f} rodadas={rodadas} rodada={rodada} />
      ) : (
        <Indicadores f={f} rodadas={rodadas} rodada={rodada} />
      )}
    </div>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-12" />
      <FiltrosCarregando />
      <IndicadoresCarregando quantidade={4} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CartaoCarregando altura="h-72" />
        <CartaoCarregando altura="h-72" />
      </div>
    </TelaCarregando>
  );
}
