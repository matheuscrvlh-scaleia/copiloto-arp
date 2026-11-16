import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { useParametro } from "@/lib/navegacao";
import {
  EsqueletoDoPainel,
  TelaDoPainel,
} from "@/modules/os/components/paineis/tela";

// app/(app)/os/paineis/[setor]/page.tsx: painel geral vê qualquer setor;
// painel do setor, só os seus (setor que não existe: página não encontrada).

export default function Pagina() {
  const setor = useParametro("setor");
  return (
    <>
      <PageHeader
        title="Painéis"
        description="A base de todo setor (em aberto, atrasados, fechados no prazo) e os indicadores próprios dele. Todo número abre a lista que o forma."
      />
      <Suspense fallback={<EsqueletoDoPainel />}>
        <Protegido permissao={["os.painel_geral", "os.painel_setor"]}>
          <TelaDoPainel setor={setor} />
        </Protegido>
      </Suspense>
    </>
  );
}
