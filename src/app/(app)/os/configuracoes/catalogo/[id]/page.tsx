import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotificarAoAbrir } from "@/components/notificacoes";
import { Protegido } from "@/components/protegido";
import { categorias } from "@/server/os/base";
import { EdicaoDeCategoria, EsqueletoCategoria } from "../editar";

export const metadata: Metadata = { title: "Categoria" };

export default function Page({
  params,
  searchParams,
}: PageProps<"/os/configuracoes/catalogo/[id]">) {
  return (
    <Suspense fallback={<EsqueletoCategoria />}>
      <Protegido permissao="os.catalogo">
        <Edicao params={params} busca={searchParams} />
      </Protegido>
    </Suspense>
  );
}

async function Edicao({
  params,
  busca,
}: {
  params: Promise<{ id: string }>;
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, b, lista] = await Promise.all([params, busca, categorias()]);
  const categoria = lista.find((c) => c.id === id);
  if (!categoria) notFound();
  return (
    <div className="flex flex-col gap-4">
      {b.copia === "1" && (
        <NotificarAoAbrir
          texto="Cópia criada. Ajuste o nome e o que mudar e salve."
          parametro="copia"
        />
      )}
      <EdicaoDeCategoria categoria={categoria} />
    </div>
  );
}
