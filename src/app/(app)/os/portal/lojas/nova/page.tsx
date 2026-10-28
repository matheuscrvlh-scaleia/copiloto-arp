import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { FormLoja } from "@/components/os/portal/form-loja";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";

export const metadata: Metadata = { title: "Nova loja · Portal lojista" };

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/os/portal/lojas"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Lojas
      </Link>
      <Suspense fallback={<CartaoCarregando altura="h-[36rem]" />}>
        <Protegido permissao="os.portal">
          <Cartao>
            <h2 className="mb-6 text-lg font-semibold">Nova loja</h2>
            <FormLoja />
          </Cartao>
        </Protegido>
      </Suspense>
    </div>
  );
}
