import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Questionario } from "@/components/comercial/censo/questionario";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { opcoesDoQuestionario } from "@/server/comercial/censo";

export const metadata: Metadata = {
  title: "Questionário do Censo (demonstração)",
};

// "Ver questionário (link)": o questionário como a empresa vê pelo link,
// com as opções das listas. O envio só confere as respostas; nada é gravado.

export default function Page() {
  return (
    <>
      <Link
        href="/comercial/censo"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden /> Censo
      </Link>
      <PageHeader
        title="Questionário do Censo"
        description="É assim que a empresa vê o link (sem login, no celular ou no computador). Demonstração: nada do que for digitado aqui é gravado."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-[40rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="comercial.censo.ver">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Tela() {
  const { opcoes, diasPadrao } = await opcoesDoQuestionario();
  return (
    <div className="vidro mx-auto w-full max-w-xl rounded-[1.75rem] p-5">
      <Questionario
        modo="demonstracao"
        opcoes={opcoes}
        diasPadrao={diasPadrao}
        inicial={{
          email: "",
          bloco: "",
          segmento: "",
          empresa_nome: "",
          colaboradores: "",
          visitantes_dia: "",
          ticket: "",
          mensalidade: false,
          dias_uso: "",
          conversoes_dia: "",
          expectativas: [],
          sugestao: "",
        }}
        corrigindo={false}
      />
    </div>
  );
}
