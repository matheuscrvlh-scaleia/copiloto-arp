import type { Metadata } from "next";
import { Suspense } from "react";
import { EsqueletoDoAssistente } from "@/app/(app)/comercial/contratos/tela-do-assistente";
import {
  EditorDistrato,
  EscolherContratoEnet,
} from "@/components/comercial/contratos/distrato";
import { EXEMPLO, TopoComercial } from "@/components/comercial/tela";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { lerDistrato } from "@/lib/comercial/contrato";
import { contextoCom, parametros } from "@/server/comercial/base";
import {
  contratosParaDistrato,
  vistoriaDoLuc,
} from "@/server/comercial/contratos";

export const metadata: Metadata = { title: "Novo distrato" };

export default function Page({
  searchParams,
}: PageProps<"/comercial/contratos/distrato/novo">) {
  return (
    <>
      <PageHeader
        title="Central de Contratos"
        description="Distrato a partir de um contrato do ENET, no modelo de 31/05/2026."
      />
      <Suspense fallback={<EsqueletoDoAssistente />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Tela({
  busca,
}: {
  busca: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [ctx, b] = await Promise.all([contextoCom(), busca]);
  if (!ctx.pode("comercial.contratos.editar")) return <SemAcesso />;
  const codigo = typeof b.contrato === "string" ? b.contrato : "";
  const [{ contratos, exemplo }, p] = await Promise.all([
    contratosParaDistrato(),
    parametros(),
  ]);
  const c = contratos.find((x) => x.codigo === codigo);
  const selo = exemplo ? <TopoComercial exemplo={EXEMPLO.enet} /> : null;
  if (!c)
    return (
      <div className="flex flex-col gap-4">
        {selo}
        {codigo && (
          <p className="text-sm text-red-700">
            Contrato {codigo} não encontrado entre os ativos do ENET.
          </p>
        )}
        <EscolherContratoEnet contratos={contratos} />
      </div>
    );
  const endereco = [
    `${p.endereco_logradouro}, ${p.endereco_numero}`,
    c.rua,
    p.endereco_bairro,
    `${p.endereco_cidade}/${p.endereco_uf}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const vistoria = await vistoriaDoLuc([c.luc], "saida");
  return (
    <div className="flex flex-col gap-4">
      {selo}
      <EditorDistrato
        inicial={{
          id: null,
          status: "rascunho",
          versao: 1,
          atualizadoEm: null,
          atualizadoPor: null,
          dados: lerDistrato({
            contrato_enet: c.codigo,
            locatario: c.locatario,
            documento: c.documento,
            inicio: c.inicio,
            termino: c.termino ?? "",
            indeterminado: c.indeterminado,
            luc: c.luc,
            bloco: c.bloco,
            endereco,
          }),
        }}
        vistoriaSaida={vistoria}
        pode={{
          editar: true,
          valores: ctx.pode("comercial.valores.ver"),
          gerar: ctx.pode("comercial.contratos.gerar"),
        }}
        exemplo={exemplo}
      />
    </div>
  );
}
