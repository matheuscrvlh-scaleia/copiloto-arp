import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { AbasDaTela, hrefCom } from "@/components/dashboard/tela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { ultimasCompetencias } from "@/lib/formato";
import { type Busca, filtrosLembrados } from "@/server/preferencias/filtros";
import { contextoSu } from "@/server/sustentabilidade/base";
import { programaVisivel } from "@/server/sustentabilidade/programas";
import { AbaFormulario } from "./formulario";
import { AbaIndicadores } from "./indicadores";
import { AbaLancamentos } from "./lancamentos";
import { AbaLink } from "./link";
import { AbaResumo } from "./resumo";

export const metadata: Metadata = { title: "Programa" };

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

export default function Page({
  params,
  searchParams,
}: PageProps<"/sustentabilidade/programas/[id]">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Tela params={params} busca={searchParams} />
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

async function Tela({
  params,
  busca: buscaUrl,
}: {
  params: Promise<{ id: string }>;
  busca: Promise<Busca>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const ctx = await contextoSu();
  if (!ctx.podeLancar(id)) return <SemAcesso />;
  const [programa, f] = await Promise.all([
    programaVisivel(id),
    buscaUrl.then((b) => filtrosLembrados("sustentabilidade", "programa", b)),
  ]);
  if (!programa) notFound();
  const um = (k: string) => {
    const v = f.busca[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  const gerencia = ctx.pode("sustentabilidade.programas.gerenciar");
  const abas = (Object.keys(ABAS) as Aba[]).filter(
    (a) => gerencia || !DE_QUEM_GERENCIA.includes(a),
  );
  const aba: Aba = abas.includes(um("aba") as Aba)
    ? (um("aba") as Aba)
    : "resumo";
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
          {aba === "resumo" && <AbaResumo c={c} programa={programa} />}
          {aba === "lancamentos" && (
            <AbaLancamentos c={c} programa={programa} />
          )}
          {aba === "formulario" && <AbaFormulario c={c} />}
          {aba === "indicadores" && <AbaIndicadores c={c} />}
          {aba === "link" && <AbaLink c={c} programa={programa} />}
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
