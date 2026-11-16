import { formatarDataHora } from "@arp/shared/formato";
import type { AlteracaoMkt } from "@arp/shared/marketing/contratos/base";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { TopoDaTela } from "@/components/dashboard/tela";

/** "Última alteração em dd/mm/aaaa às hh:mm, por Fulano" no topo. */
export function TopoConfiguracoes({ ultima }: { ultima?: AlteracaoMkt }) {
  const dadosDe = ultima
    ? (() => {
        const [d, h] = formatarDataHora(ultima.em).split(" ");
        return `Última alteração em ${d} às ${h}, por ${ultima.autor}`;
      })()
    : "Nenhuma alteração registrada ainda";
  return <TopoDaTela dadosDe={dadosDe} />;
}

export function EsqueletoConfiguracoes() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-12" />
      <CartaoCarregando altura="h-96" />
      <CartaoCarregando altura="h-56" />
    </TelaCarregando>
  );
}
