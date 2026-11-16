import { Suspense } from "react";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link } from "@/lib/navegacao";
import { FormCargo } from "../components/form-cargo";

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
        description="Um cargo é um conjunto de permissões. Depois é só escolher o cargo ao criar ou editar um usuário."
      />
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.usuarios">
          <FormCargo />
        </Protegido>
      </Suspense>
    </>
  );
}
