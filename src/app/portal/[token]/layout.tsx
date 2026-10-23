import type { Metadata } from "next";
import { Moldura } from "@/components/os/portal/publico/visual";

// Portal do lojista: página pública (o proxy libera /portal), sem o menu
// do sistema. Moldura leve, feita para o celular.

export const metadata: Metadata = {
  title: "Portal do lojista",
  // O token está no endereço: nada de enviar a página inteira como origem.
  referrer: "no-referrer",
};

export default function Layout({ children }: LayoutProps<"/portal/[token]">) {
  return <Moldura>{children}</Moldura>;
}
