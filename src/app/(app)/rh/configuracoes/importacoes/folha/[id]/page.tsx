import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { SemAcesso } from "@/components/protegido";
import { CONFIGURACOES_RH } from "@/config/navigation";
import { formatarMes } from "@/lib/formato";
import { pode } from "@/server/auth";
import { folhaParaEditar } from "@/server/rh/folha";
import { EditorDaFolha } from "./editor-folha";

export const metadata: Metadata = { title: "Folha importada" };

export default function Page({
  params,
}: PageProps<"/rh/configuracoes/importacoes/folha/[id]">) {
  return (
    <>
      <Link
        href={`${CONFIGURACOES_RH.importacoes}#folha`}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Importações
      </Link>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando />
          </TelaCarregando>
        }
      >
        <Folha params={params} />
      </Suspense>
    </>
  );
}

/** Conferir e corrigir a folha importada, pessoa a pessoa (valores individuais). */
async function Folha({
  params,
}: Pick<PageProps<"/rh/configuracoes/importacoes/folha/[id]">, "params">) {
  const [{ id }, folha, individual] = await Promise.all([
    params,
    pode("rh.folha"),
    pode("rh.custo_pessoal.individual"),
  ]);
  if (!folha || !individual) return <SemAcesso />;
  if (!z.uuid().safeParse(id).success) notFound();
  const dados = await folhaParaEditar(id);
  if (!dados) notFound();
  const { folha: f } = dados;
  const editavel = f.status !== "fechada";

  return (
    <Secao
      titulo={`Folha de ${formatarMes(f.competencia)}`}
      descricao={`${dados.pessoas.length} pessoas. Abra uma pessoa para corrigir departamento, cargo, contrato, horas e rubricas sem enviar outro PDF. Salvar recalcula o custo do mês.`}
    >
      {!editavel && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta folha está fechada: dá para conferir, mas não para editar.
        </p>
      )}
      {f.ficticia && (
        <p className="mb-4 text-xs text-neutral-500">
          Modo protótipo: o salário de todos está em R$ 2.000,00 e não é
          editado.
        </p>
      )}
      <EditorDaFolha
        folhaId={f.id}
        editavel={editavel}
        ficticia={f.ficticia}
        pessoas={dados.pessoas}
        departamentos={dados.departamentos}
        cargos={dados.cargos}
        rubricas={dados.rubricas}
      />
    </Secao>
  );
}
