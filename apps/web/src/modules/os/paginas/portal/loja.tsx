import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { CartaoCarregando } from "@/components/carregando";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useParametro } from "@/lib/navegacao";
import { consultaDaLoja } from "@/modules/os/api-portal";
import { FormLoja } from "@/modules/os/components/portal/form-loja";

export default function Pagina() {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/os/portal/lojas"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Lojas
      </Link>
      <Protegido permissao="os.portal">
        <Suspense fallback={<CartaoCarregando altura="h-[36rem]" />}>
          <Edicao />
        </Suspense>
      </Protegido>
    </div>
  );
}

function Edicao() {
  const { data: l } = useSuspenseQuery(consultaDaLoja(useParametro("id")));
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
