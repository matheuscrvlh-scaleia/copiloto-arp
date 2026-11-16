import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import {
  EsqueletoDoPainel,
  TelaDoPainel,
} from "@/modules/os/components/paineis/tela";

// app/(app)/os/paineis/page.tsx: painel geral para quem tem os.painel_geral;
// os outros vão ao do setor (a API diz qual).

export default function Pagina() {
  return (
    <>
      <PageHeader
        title="Painéis"
        description="Tickets em números: em aberto, atrasados, fechados no prazo e o que importa para cada setor. Todo número abre a lista que o forma."
      />
      <Suspense fallback={<EsqueletoDoPainel />}>
        <Protegido permissao={["os.painel_geral", "os.painel_setor"]}>
          <TelaDoPainel setor={null} />
        </Protegido>
      </Suspense>
    </>
  );
}
