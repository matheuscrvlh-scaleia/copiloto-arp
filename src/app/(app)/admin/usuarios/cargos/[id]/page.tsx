import { Power, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AcaoRapida } from "@/components/admin/acao-rapida";
import { Situacao } from "@/components/admin/ui";
import { Carregando } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { formatarNumero } from "@/lib/formato";
import { cargos } from "@/server/admin/dados";
import { alternarCargo, apagarCargo } from "../../actions";
import { FormCargo } from "../form-cargo";
import { confirmarExclusao, confirmarInativacao } from "../textos";

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
      : `${formatarNumero(cargo.usuarios)} ${cargo.usuarios === 1 ? "usuário tem" : "usuários têm"} este cargo.`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-3 text-4xl font-semibold tracking-tight md:text-5xl">
            <span className="truncate">{cargo.nome}</span>
            {cargo.ativo ? (
              <Situacao tipo="ok">Ativo</Situacao>
            ) : (
              <Situacao tipo="neutro">Inativo</Situacao>
            )}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">{quem}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AcaoRapida
            acao={alternarCargo}
            campos={{ id: cargo.id, ativo: String(!cargo.ativo) }}
            rotulo={cargo.ativo ? "Inativar" : "Reativar"}
            icone={<Power className="size-4" aria-hidden />}
            confirmar={cargo.ativo ? confirmarInativacao(cargo) : undefined}
            comTexto
          />
          <AcaoRapida
            acao={apagarCargo}
            campos={{ id: cargo.id }}
            rotulo="Excluir"
            icone={<Trash2 className="size-4" aria-hidden />}
            confirmar={confirmarExclusao(cargo)}
            perigo
            comTexto
          />
        </div>
      </header>

      {!cargo.ativo && (
        <p className="rounded-3xl bg-neutral-100 px-4 py-3 text-sm text-neutral-600">
          Cargo inativo: não aparece na escolha e não dá nenhuma permissão a
          quem ainda o tem. Reative para devolver o acesso.
        </p>
      )}

      <FormCargo cargo={cargo} />
    </div>
  );
}
