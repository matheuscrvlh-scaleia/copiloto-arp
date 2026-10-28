import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { FormAgenda } from "@/components/os/portal/form-agenda";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { agenda } from "@/server/os/agenda";

export const metadata: Metadata = { title: "Agenda · Portal lojista" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Page({ params }: PageProps<"/os/portal/agendas/[id]">) {
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
          <Edicao params={params} />
        </Protegido>
      </Suspense>
    </div>
  );
}

async function Edicao({
  params,
}: Pick<PageProps<"/os/portal/agendas/[id]">, "params">) {
  const { id } = await params;
  const a = UUID.test(id) ? await agenda(id) : null;
  if (!a)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">Agenda não encontrada.</p>
      </Cartao>
    );
  return (
    <Cartao>
      <h2 className="mb-6 text-lg font-semibold">{a.nome}</h2>
      <FormAgenda agenda={a} />
    </Cartao>
  );
}
