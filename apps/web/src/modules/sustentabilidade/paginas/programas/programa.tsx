import { ultimasCompetencias } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { z } from "zod";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { AbasDaTela, hrefCom } from "@/components/dashboard/tela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { Link, naoEncontrado, useParametro } from "@/lib/navegacao";
import type { Busca } from "@/modules/shell/api";
import { consultaDoPrograma } from "../../api-programas";
import { useContextoSu, useFiltrosSu } from "../../contexto-su";
import { AbaFormulario } from "./abas/formulario";
import { AbaIndicadores } from "./abas/indicadores";
import { AbaLancamentos } from "./abas/lancamentos";
import { AbaLink } from "./abas/link";
import { AbaResumo } from "./abas/resumo";

// /sustentabilidade/programas/:id (app/(app)/sustentabilidade/programas/[id]/page.tsx).

const ABAS = {
  resumo: "Resumo",
  lancamentos: "Lançamentos",
  formulario: "Formulário",
  indicadores: "Indicadores",
  link: "Link do parceiro",
} as const;
type Aba = keyof typeof ABAS;
/** Abas só de "Programas – gerenciar". */
const DE_QUEM_GERENCIA: Aba[] = ["formulario", "indicadores", "link"];
const TODAS = Object.keys(ABAS).filter((a): a is Aba => a in ABAS);

export default function Page() {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Tela />
    </Suspense>
  );
}

export interface ContextoDaAba {
  programaId: string;
  base: string;
  busca: Busca;
  lembrado: string | null;
  /** Competência escolhida ("aaaa-mm-01"). */
  mes: string;
  /** Últimos 24 meses, do mais novo ao mais antigo. */
  meses: string[];
  atual: string;
  um: (k: string) => string;
}

function Tela() {
  const id = useParametro("id");
  if (!z.uuid().safeParse(id).success) naoEncontrado();
  const ctx = useContextoSu();
  if (!ctx.podeLancar(id)) return <SemAcesso />;
  return <Programa id={id} />;
}

function Programa({ id }: { id: string }) {
  const f = useFiltrosSu("programa");
  const ctx = useContextoSu();
  const {
    data: { programa, contato, areas_impacto },
  } = useSuspenseQuery(consultaDoPrograma(id));
  if (!f) return <Esqueleto />;
  const { um } = f;
  const gerencia = ctx.pode("sustentabilidade.programas.gerenciar");
  const abas = TODAS.filter((a) => gerencia || !DE_QUEM_GERENCIA.includes(a));
  const aba: Aba = abas.find((a) => a === um("aba")) ?? "resumo";
  const base = `/sustentabilidade/programas/${id}`;
  const atual = `${ctx.hoje.slice(0, 7)}-01`;
  const meses = ultimasCompetencias(atual, 24).reverse();
  const mes = meses.find((m) => m.slice(0, 7) === um("mes")) ?? atual;
  const c: ContextoDaAba = {
    programaId: id,
    base,
    busca: f.busca,
    lembrado: f.lembrado,
    mes,
    meses,
    atual,
    um,
  };

  return (
    <>
      <Link
        href="/sustentabilidade/programas"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Programas
      </Link>
      <PageHeader
        title={programa.nome}
        description={[
          programa.area,
          programa.parceiro_nome && `Parceiro: ${programa.parceiro_nome}`,
          programa.ativo ? null : "Inativo",
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="flex flex-col gap-6">
        <AbasDaTela
          rotulo="Abas do programa"
          ativa={aba}
          abas={abas.map((a) => ({
            chave: a,
            rotulo: ABAS[a],
            href: hrefCom(base, f.busca, {
              aba: a === "resumo" ? null : a,
              formulario: null,
              cartao: null,
            }),
          }))}
        />
        <Suspense key={aba} fallback={<CartaoCarregando altura="h-[28rem]" />}>
          {aba === "resumo" && (
            <AbaResumo
              c={c}
              programa={programa}
              contato={contato}
              areas={areas_impacto}
            />
          )}
          {aba === "lancamentos" && (
            <AbaLancamentos c={c} programa={programa} />
          )}
          {aba === "formulario" && <AbaFormulario c={c} />}
          {aba === "indicadores" && <AbaIndicadores c={c} />}
          {aba === "link" && (
            <AbaLink c={c} programa={programa} contato={contato} />
          )}
        </Suspense>
      </div>
    </>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-24" />
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[28rem]" />
    </TelaCarregando>
  );
}
