import { formatarNumero } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Power, Trash2 } from "lucide-react";
import { Suspense, useMemo } from "react";
import { Carregando } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, naoEncontrado, useNavegar, useParametro } from "@/lib/navegacao";
import { AcaoRapida } from "@/modules/admin/components/acao-rapida";
import { Situacao } from "@/modules/admin/components/ui";
import { alternarCargo, apagarCargo, consultaDosCargos } from "../api";
import { FormCargo } from "../components/form-cargo";
import { confirmarExclusao, confirmarInativacao } from "../components/textos";

export default function Page() {
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
          <Edicao />
        </Protegido>
      </Suspense>
    </>
  );
}

function Edicao() {
  const id = useParametro("id");
  const { data: lista } = useSuspenseQuery(consultaDosCargos);
  const navegar = useNavegar();
  const apagar = useMemo(
    () => apagarCargo(() => navegar.push("/admin/usuarios/cargos")),
    [navegar],
  );
  const cargo = lista.find((c) => c.id === id);
  if (!cargo) naoEncontrado();
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
            acao={apagar}
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
