import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { FormCargo } from "../form-cargo";

export const metadata: Metadata = { title: "Novo cargo" };

export default function Page() {
  return (
    <>
      <Link
        href="/admin/usuarios/cargos"
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Cargos
      </Link>
      <PageHeader
        title="Novo cargo"
        description="Dê um nome e marque o que quem tiver este cargo pode ver e fazer."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.usuarios">
          <FormCargo />
        </Protegido>
      </Suspense>
    </>
  );
}
