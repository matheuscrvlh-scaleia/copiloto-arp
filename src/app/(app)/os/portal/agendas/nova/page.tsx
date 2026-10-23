import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { FormAgenda } from "@/components/os/portal/form-agenda";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Nova agenda · Portal e agenda" };

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/os/portal/agendas"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Agendas
      </Link>
      <Suspense fallback={<CartaoCarregando altura="h-[32rem]" />}>
        <Protegido permissao="os.portal_agenda">
          <Cartao>
            <h2 className="mb-6 text-lg font-semibold">Nova agenda</h2>
            <FormAgenda />
          </Cartao>
        </Protegido>
      </Suspense>
    </div>
  );
}
