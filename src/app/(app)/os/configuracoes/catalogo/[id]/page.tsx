import { CircleCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
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
        <output className="flex items-center gap-2 rounded-3xl bg-green-50 px-4 py-3 text-sm text-green-800">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          Cópia criada. Ajuste o nome e o que mudar e salve.
        </output>
      )}
      <EdicaoDeCategoria categoria={categoria} />
    </div>
  );
}
