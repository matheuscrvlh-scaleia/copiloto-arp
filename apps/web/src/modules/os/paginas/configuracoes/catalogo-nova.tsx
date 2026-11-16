import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Cartao } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
import { consultaDasCategorias } from "@/modules/os/api-configuracoes";
import {
  categoriaNova,
  EdicaoDeCategoria,
  EsqueletoCategoria,
} from "./editar-categoria";

// app/(app)/os/configuracoes/catalogo/nova/page.tsx

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoCategoria />}>
      <Protegido permissao="os.catalogo">
        <Nova />
      </Protegido>
    </Suspense>
  );
}

function Nova() {
  const { setor: pedido } = useBusca();
  const {
    data: { setores: lista },
  } = useSuspenseQuery(consultaDasCategorias);
  const setor =
    lista.find((s) => s.id === pedido && s.ativo) ?? lista.find((s) => s.ativo);
  if (!setor)
    return (
      <Cartao>
        <p className="text-sm text-neutral-600">
          Cadastre um setor ativo antes de criar categorias.
        </p>
      </Cartao>
    );
  return <EdicaoDeCategoria categoria={categoriaNova(setor.id)} />;
}
