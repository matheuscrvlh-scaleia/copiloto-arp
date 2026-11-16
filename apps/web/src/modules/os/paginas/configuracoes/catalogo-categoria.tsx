import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { NotificarAoAbrir } from "@/components/notificacoes";
import { Protegido } from "@/components/protegido";
import { naoEncontrado, useBusca, useParametros } from "@/lib/navegacao";
import { consultaDasCategorias } from "@/modules/os/api-configuracoes";
import { EdicaoDeCategoria, EsqueletoCategoria } from "./editar-categoria";

// app/(app)/os/configuracoes/catalogo/[id]/page.tsx

export default function Page() {
  return (
    <Suspense fallback={<EsqueletoCategoria />}>
      <Protegido permissao="os.catalogo">
        <Edicao />
      </Protegido>
    </Suspense>
  );
}

function Edicao() {
  const { id } = useParametros();
  const b = useBusca();
  const {
    data: { categorias: lista },
  } = useSuspenseQuery(consultaDasCategorias);
  const categoria = lista.find((c) => c.id === id);
  if (!categoria) naoEncontrado();
  return (
    <div className="flex flex-col gap-4">
      {b.copia === "1" && (
        <NotificarAoAbrir
          texto="Cópia criada. Ajuste o nome e o que mudar e salve."
          parametro="copia"
        />
      )}
      <EdicaoDeCategoria key={categoria.id} categoria={categoria} />
    </div>
  );
}
