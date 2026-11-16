import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useParametro } from "@/lib/navegacao";
import { consultaDaAgenda } from "@/modules/os/api-portal";
import { FormAgenda } from "@/modules/os/components/portal/form-agenda";

export default function Pagina() {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/os/portal/agendas"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Agendas
      </Link>
      <Protegido permissao="os.portal_agenda">
        <Suspense fallback={<CartaoCarregando altura="h-[32rem]" />}>
          <Edicao />
        </Suspense>
      </Protegido>
    </div>
  );
}

function Edicao() {
  const { data: a } = useSuspenseQuery(consultaDaAgenda(useParametro("id")));
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
