import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { FormLoja } from "@/components/os/portal/form-loja";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { loja } from "@/server/os/lojas";

export const metadata: Metadata = { title: "Loja · Portal lojista" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Page({ params }: PageProps<"/os/portal/lojas/[id]">) {
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
          <Edicao params={params} />
        </Protegido>
      </Suspense>
    </div>
  );
}

async function Edicao({
  params,
}: Pick<PageProps<"/os/portal/lojas/[id]">, "params">) {
  const { id } = await params;
  const l = UUID.test(id) ? await loja(id) : null;
  if (!l)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">Loja não encontrada.</p>
      </Cartao>
    );
  return (
    <Cartao>
      <h2 className="text-lg font-semibold">
        {l.luc} · {l.nome}
      </h2>
      {l.enet_id ? (
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          Esta loja vem do ENET: os dados ficam só para consulta.
        </p>
      ) : (
        <p className="mt-1 mb-6 text-sm text-neutral-500">
          Cadastro manual. Quando o ENET estiver ligado, estes dados virão de
          lá.
        </p>
      )}
      <FormLoja loja={l} somenteLeitura={!!l.enet_id} />
    </Cartao>
  );
}
