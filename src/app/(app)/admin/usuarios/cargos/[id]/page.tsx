import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FormAcao } from "@/components/form-acao";
import { Carregando, PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import { cargos } from "@/server/admin/dados";
import { apagarCargo } from "../../actions";
import { FormCargo } from "../form-cargo";

export const metadata: Metadata = { title: "Cargo" };

export default function Page({
  params,
}: PageProps<"/admin/usuarios/cargos/[id]">) {
  return (
    <>
      <Link
        href="/admin/usuarios/cargos"
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Cargos
      </Link>
      <Suspense fallback={<Carregando />}>
        <Protegido permissao="admin.usuarios">
          <Edicao params={params} />
        </Protegido>
      </Suspense>
    </>
  );
}

async function Edicao({
  params,
}: Pick<PageProps<"/admin/usuarios/cargos/[id]">, "params">) {
  const { id } = await params;
  const cargo = (await cargos()).find((c) => c.id === id);
  if (!cargo) notFound();
  const quem =
    cargo.usuarios === 0
      ? "Nenhum usuário tem este cargo."
      : `${formatarNumero(cargo.usuarios)} ${cargo.usuarios === 1 ? "usuário tem" : "usuários têm"} este cargo; as mudanças valem na hora.`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={cargo.nome} description={quem} />
      <FormCargo cargo={cargo} />
      <FormAcao
        acao={apagarCargo}
        rotulo="Apagar cargo"
        rotuloEnviando="Apagando…"
        variante="perigo"
        confirmar={`Apagar o cargo “${cargo.nome}”?${cargo.usuarios > 0 ? " Os usuários dele ficam só com as permissões individuais." : ""}`}
        className="vidro flex flex-col gap-3 rounded-[1.75rem] p-6"
      >
        <input type="hidden" name="id" value={cargo.id} />
        <p className="text-sm text-neutral-600">
          {cargo.usuarios > 0
            ? "Quem tem este cargo perde as permissões dele e fica só com as individuais."
            : "O cargo não está em uso."}
        </p>
      </FormAcao>
    </div>
  );
}
