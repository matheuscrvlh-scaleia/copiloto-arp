import { useEffect } from "react";
import { Filhas } from "@/lib/navegacao";
import { Moldura } from "@/modules/os/components/portal/publico/visual";

// Portal do lojista: página pública, sem o menu do sistema e sem a sessão
// dos usuários (a loja entra com o CPF ou CNPJ e fica numa sessão própria).
// Moldura leve, feita para o celular.

export default function Layout() {
  // Nada de enviar o endereço do pedido como origem para sites de fora.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  return (
    <Moldura>
      <Filhas />
    </Moldura>
  );
}
