import { ROTAS_OS } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { consultaDasEtiquetas } from "@/modules/os/api-ativos";
import { SelecaoEtiquetas } from "@/modules/os/components/ativos/selecao-etiquetas";

// /os/ativos/etiquetas: escolha dos ativos e o PDF para papel adesivo.

export default function Pagina() {
  return (
    <>
      <Link
        href={ROTAS_OS.ativos}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Ativos
      </Link>
      <PageHeader
        title="Etiquetas"
        description="Marque os ativos e gere o PDF para imprimir em papel adesivo. O QR abre a ficha no celular de quem já está logado, com o botão para abrir chamado."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-24" />
            <CartaoCarregando altura="h-[32rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="os.ativos_gerenciar">
          <Conteudo />
        </Protegido>
      </Suspense>
    </>
  );
}

function Conteudo() {
  const { data } = useSuspenseQuery(consultaDasEtiquetas);
  const { ativos, grade: GRADE, porFolha: POR_FOLHA } = data;
  return (
    <div className="flex flex-col gap-4">
      <SelecaoEtiquetas porFolha={POR_FOLHA} ativos={ativos} />
      <Nota>
        Folha A4 com {POR_FOLHA} etiquetas ({GRADE.colunas} × {GRADE.linhas},{" "}
        {GRADE.largura} × {GRADE.altura} mm). Imprima em tamanho real (100%, sem
        ajustar à página). Para aproveitar uma folha já usada, diga em que
        etiqueta começar.
      </Nota>
    </div>
  );
}
