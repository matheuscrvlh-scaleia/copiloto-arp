import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormularioFicha } from "@/components/comercial/fichas/formulario";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { respostasVazias } from "@/lib/comercial/ficha";
import { contextoCom, parametros } from "@/server/comercial/base";
import {
  documentosExigidos,
  lucsVagos,
  ROTA_FICHAS,
} from "@/server/comercial/fichas";

export const metadata: Metadata = { title: "Ficha cadastral (demonstração)" };

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

async function Tela() {
  const ctx = await contextoCom();
  if (
    !ctx.pode("comercial.formulario.ver") &&
    !ctx.pode("comercial.formulario.link")
  )
    return <SemAcesso />;
  const [p, documentos, lucs] = await Promise.all([
    parametros(),
    documentosExigidos(),
    lucsVagos(),
  ]);
  return (
    <div className="mx-auto w-full max-w-2xl">
      <FormularioFicha
        token={null}
        inicial={respostasVazias()}
        boasVindas={p.ficha_boas_vindas}
        termoLgpd={p.ficha_termo_lgpd}
        documentos={documentos}
        enviados={[]}
        lucs={lucs.opcoes}
        lucDoLink={null}
        hoje={ctx.hoje}
      />
    </div>
  );
}
