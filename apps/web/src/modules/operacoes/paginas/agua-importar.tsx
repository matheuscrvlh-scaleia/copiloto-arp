import { ArrowLeft } from "lucide-react";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Cartao, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { ImportarAgua } from "../components/agua/importar";
import { BASE_AGUA } from "../components/agua/tela";

export default function Page() {
  return (
    <>
      <Link
        href={BASE_AGUA}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Água
      </Link>
      <PageHeader
        title="Importar faturamento da água"
        description="Envie as planilhas de bloco do mês (ou os PDFs, se a planilha não vier) e as fotos dos visores, como chegaram do parceiro. Nada entra antes de você conferir a prévia."
      />
      <Suspense fallback={<CartaoCarregando altura="h-80" />}>
        <Protegido permissao="operacoes.agua.importar">
          <Cartao>
            <ImportarAgua />
          </Cartao>
        </Protegido>
      </Suspense>
    </>
  );
}
