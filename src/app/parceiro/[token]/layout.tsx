import type { Metadata } from "next";

// Lançamento do parceiro de um programa de Sustentabilidade: página pública
// (o proxy libera /parceiro), sem menu, sem login e sem nenhum módulo. A
// página confere o token a cada acesso. Feita para o celular.

export const metadata: Metadata = {
  title: "Lançamento do programa",
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
