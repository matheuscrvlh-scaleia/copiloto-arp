import type { Metadata } from "next";

// Formulário para quem recebeu o link: página pública (o proxy libera
// /responder), sem o menu do sistema. Mesma moldura da ficha cadastral.

export const metadata: Metadata = {
  title: "Formulário",
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
      <div className="relative mx-auto flex max-w-2xl flex-col gap-4">
        {children}
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-neutral-500">
        Espaço ARP, Nova Friburgo
      </p>
    </div>
  );
}
