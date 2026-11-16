import { lerDistrato } from "@arp/shared/comercial/contrato";
import type { ContratoEnetParaDistrato } from "@arp/shared/comercial/contratos/contratos";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { useBusca } from "@/lib/navegacao";
import { useSessao } from "@/lib/sessao";
import {
  EditorDistrato,
  EscolherContratoEnet,
} from "@/modules/comercial/components/contratos/distrato";
import { EXEMPLO, TopoComercial } from "@/modules/comercial/components/tela";
import { consultaContratosEnet, consultaVistoria } from "../api/contratos";
import { EsqueletoDoAssistente } from "./tela-do-assistente";

// /comercial/contratos/distrato/novo
// (app/(app)/comercial/contratos/distrato/novo/page.tsx).

export default function Page() {
  return (
    <>
      <PageHeader
        title="Central de Contratos"
        description="Distrato a partir de um contrato do ENET, no modelo de 31/05/2026."
      />
      <Suspense fallback={<EsqueletoDoAssistente />}>
        <Tela />
      </Suspense>
    </>
  );
}

function Tela() {
  const ctx = useSessao();
  if (!ctx.pode("comercial.contratos.editar")) return <SemAcesso />;
  return <Distrato />;
}

function Distrato() {
  const b = useBusca();
  const codigo = typeof b.contrato === "string" ? b.contrato : "";
  const {
    data: { contratos, exemplo, endereco: p },
  } = useSuspenseQuery(consultaContratosEnet);
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
    `${p.logradouro}, ${p.numero}`,
    c.rua,
    p.bairro,
    `${p.cidade}/${p.uf}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col gap-4">
      {selo}
      <Editor c={c} endereco={endereco} exemplo={exemplo} />
    </div>
  );
}

function Editor({
  c,
  endereco,
  exemplo,
}: {
  c: ContratoEnetParaDistrato;
  endereco: string;
  exemplo: boolean;
}) {
  const ctx = useSessao();
  const {
    data: { vistoria },
  } = useSuspenseQuery(consultaVistoria(c.luc, "saida"));
  return (
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
  );
}
