import { Suspense } from "react";
import { rotaChamado } from "@/lib/os/rotas";
import { DetalheCarregando, DetalheChamado } from "./detalhe";
import { PainelDeslizante } from "./painel-deslizante";

// Janela lateral do detalhe, aberta pelas listas com ?c=<id> (PARAM_PAINEL).
// O quadro aparece na hora; o chamado entra quando chega do banco.
//   <PainelLateralChamado id="<uuid>" fecharHref="/os?…" />
// `fecharHref` é a mesma tela sem o ?c= (fecha a janela).
export function PainelLateralChamado({
  id,
  fecharHref,
}: {
  id: string;
  fecharHref: string;
}) {
  return (
    <PainelDeslizante fecharHref={fecharHref} paginaHref={rotaChamado(id)}>
      <Suspense key={id} fallback={<DetalheCarregando compacto />}>
        <DetalheChamado id={id} compacto />
      </Suspense>
    </PainelDeslizante>
  );
}
