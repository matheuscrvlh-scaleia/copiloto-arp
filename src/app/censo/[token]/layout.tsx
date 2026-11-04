import type { Metadata } from "next";

// Questionário do Censo para a empresa: página pública (o proxy libera
// /censo/), sem o menu do sistema. Mesma moldura do link da vistoria.

export const metadata: Metadata = {
  title: "Censo ARP",
  // O token está no endereço: nada de enviá-lo como origem para outros sites.
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh px-4 py-5 sm:py-8">
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="mx-auto flex max-w-xl flex-col gap-4">{children}</div>
      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-neutral-500">
        Censo · Espaço ARP, Nova Friburgo
      </p>
    </div>
  );
}
