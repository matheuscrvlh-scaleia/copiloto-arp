import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useBusca, useParametro } from "@/lib/navegacao";
import { FichaDaCaixa } from "../components/energia/quadros/ficha";
import { FichaCarregada } from "../components/energia/quadros/ficha-carregada";

// Ficha da caixa em página inteira (link para mandar, uso no celular em
// campo). ?termo=1 abre o termo de autorização já preenchido.

export default function Page() {
  return (
    <>
      <Link
        href="/operacoes/energia"
        className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Quadros de medidores
      </Link>
      <PageHeader
        title="Ficha da caixa"
        description="Caixa do quadro de medidores: locatário, cadastro, termos de autorização e histórico."
      />
      <Suspense fallback={<CartaoCarregando altura="h-[40rem]" />}>
        <Protegido permissao="operacoes.energia.ver">
          <Ficha />
        </Protegido>
      </Suspense>
    </>
  );
}

function Ficha() {
  const id = useParametro("id");
  const busca = useBusca();
  return (
    <FichaCarregada
      id={id}
      naoAchou={
        <Cartao>
          <p className="text-sm text-neutral-600">
            Caixa não encontrada. Volte aos quadros e escolha a caixa no
            desenho.
          </p>
        </Cartao>
      }
    >
      {(d) => (
        <Cartao className="max-w-4xl">
          <FichaDaCaixa d={d} termoAberto={busca.termo === "1"} />
          <p className="mt-6 text-sm">
            <Link
              href={`/operacoes/energia?quadro=${encodeURIComponent(d.caixa.quadro.codigo)}&caixa=${d.caixa.id}`}
              className="text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
            >
              Ver no desenho do {d.caixa.quadro.nome}
            </Link>
          </p>
        </Cartao>
      )}
    </FichaCarregada>
  );
}
