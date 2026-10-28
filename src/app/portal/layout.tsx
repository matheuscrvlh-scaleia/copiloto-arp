import type { Metadata } from "next";
import { Moldura } from "@/components/os/portal/publico/visual";

// Portal do lojista: página pública (o proxy libera /portal), sem o menu
// do sistema. Moldura leve, feita para o celular.

export const metadata: Metadata = {
  title: "Portal do lojista",
  // Nada de enviar o endereço do pedido como origem para sites de fora.
  referrer: "no-referrer",
};

export default function Layout({ children }: LayoutProps<"/portal">) {
  return <Moldura>{children}</Moldura>;
}
