import { respostaFiltros } from "@arp/shared/contratos/casca";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  IndicadoresCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { api } from "@/lib/api";
import { Redirecionar, useBusca } from "@/lib/navegacao";
import { AbasDaTela, hrefCom } from "@/modules/comercial/components/tela";
import { consultaCenso } from "../../api/censo";
import { type FiltrosCom, useContextoCom } from "../../base";
import { Feedbacks } from "./feedbacks";
import { Indicadores, TELA_FILTROS } from "./indicadores";
import { Rodadas } from "./rodadas";

// /comercial/censo (app/(app)/comercial/censo/page.tsx): abas Indicadores,
// Feedbacks e Rodadas.

const BASE = "/comercial/censo";
const ABAS = {
  indicadores: "Indicadores",
  feedbacks: "Feedbacks",
  rodadas: "Rodadas",
} as const;
type Aba = keyof typeof ABAS;
const ehAba = (a: string): a is Aba => a in ABAS;

export default function Page() {
  return (
    <>
      <PageHeader
        title="Censo"
        description="O panorama das empresas do Espaço ARP a cada rodada do questionário (colaboradores, público, movimentação e planos) e as sugestões delas, agrupadas por tema."
      />
      <Suspense fallback={<Esqueleto />}>
        <Protegido permissao="comercial.censo.ver">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Cada aba lembra os próprios filtros: a aba da URL escolhe a chave e não
 * conta como filtro (só "?aba=feedbacks" ainda traz os lembrados dela). É o
 * useFiltrosLembrados da casca com a aba fora da conta.
 */
function useFiltrosDoCenso() {
  const ctx = useContextoCom();
  const busca = useBusca();
  const semAba = useMemo(() => {
    const { aba: _, ...resto } = busca;
    return resto;
  }, [busca]);
  const pedida = um(busca.aba);
  const chave: Aba = ehAba(pedida) ? pedida : "indicadores";
  const tela = TELA_FILTROS[chave];
  const semFiltroNaUrl = Object.keys(semAba).length === 0;
  const { data, isPending } = useQuery({
    queryKey: ["casca", "filtros", "comercial", tela],
    queryFn: ({ signal }) =>
      api.get(`/preferencias/filtros/comercial/${encodeURIComponent(tela)}`, {
        esquema: respostaFiltros,
        sinal: signal,
      }),
    enabled: semFiltroNaUrl,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return useMemo(() => {
    if (semFiltroNaUrl && isPending) return null;
    const lembrado = semFiltroNaUrl ? (data?.query ?? null) : null;
    const lida = lembrado
      ? Object.fromEntries(new URLSearchParams(lembrado))
      : semAba;
    const f: FiltrosCom = {
      ctx,
      busca: lida,
      lembrado,
      um: (c: string) => um(lida[c]),
    };
    return { f, pedida, chave };
  }, [ctx, semAba, semFiltroNaUrl, isPending, data, pedida, chave]);
}

function Tela() {
  const lidos = useFiltrosDoCenso();
  return lidos ? <Censo {...lidos} /> : <Esqueleto />;
}

function Censo({
  f: lidos,
  pedida,
  chave,
}: {
  f: FiltrosCom;
  pedida: string;
  chave: Aba;
}) {
  const { data: d } = useSuspenseQuery(consultaCenso);
  const { rodadas } = d;
  const lembrado = new URLSearchParams(lidos.lembrado ?? "");
  lembrado.delete("aba");
  if (lembrado.size && chave !== "indicadores") {
    lembrado.set("aba", chave);
    return <Redirecionar para={`${BASE}?${lembrado}`} />;
  }
  const f: FiltrosCom = {
    ...lidos,
    ctx: { ...lidos.ctx, hoje: d.hoje },
    busca:
      chave === "indicadores" ? lidos.busca : { ...lidos.busca, aba: chave },
  };
  const aplicar = f.ctx.pode("comercial.censo.aplicar");
  const aba: Aba =
    ehAba(pedida) && (pedida !== "rodadas" || aplicar) ? pedida : "indicadores";
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
        <Rodadas f={f} d={d} rodada={rodada} />
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
        <Feedbacks f={f} d={d} rodada={rodada} />
      ) : (
        <Indicadores f={f} d={d} rodada={rodada} />
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
