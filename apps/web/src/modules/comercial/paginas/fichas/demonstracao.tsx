import { respostasVazias } from "@arp/shared/comercial/ficha";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import { FormularioFicha } from "@/modules/comercial/components/fichas/formulario";
import { consultaDemonstracaoFicha } from "../../api/fichas";

const ROTA_FICHAS = "/comercial/fichas";

// "Ver ficha (link público)": a ficha como o interessado vê, com as
// perguntas, os saltos e os textos dos parâmetros. Nada é gravado.

export default function Page() {
  return (
    <>
      <Link
        href={ROTA_FICHAS}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Fichas cadastrais
      </Link>
      <PageHeader
        title="Ficha cadastral"
        description="É assim que o interessado vê o link (sem login, no celular ou no computador). Demonstração: nada do que for digitado aqui é gravado."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-40" />
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Tela />
      </Suspense>
    </>
  );
}

function Tela() {
  const { pode } = useSessao();
  if (!pode("comercial.formulario.ver") && !pode("comercial.formulario.link"))
    return <SemAcesso />;
  return <Ficha />;
}

function Ficha() {
  const { data: d } = useSuspenseQuery(consultaDemonstracaoFicha);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <FormularioFicha
        token={null}
        inicial={respostasVazias()}
        boasVindas={d.boasVindas}
        termoLgpd={d.termoLgpd}
        documentos={d.documentos}
        enviados={[]}
        lucs={d.lucs}
        lucDoLink={null}
        hoje={d.hoje}
      />
    </div>
  );
}
