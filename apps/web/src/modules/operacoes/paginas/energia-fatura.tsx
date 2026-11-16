import { formatarMes } from "@arp/shared/formato";
import { nomeDaUnidade } from "@arp/shared/operacoes/energisa-contas";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { z } from "zod";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { TopoDaTela } from "@/components/dashboard/tela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { ErroDaApi } from "@/lib/api";
import { Link, naoEncontrado, useParametro } from "@/lib/navegacao";
import { consultaDaFatura, consultaDasUnidades } from "../api";
import { DetalheDaFatura } from "../components/energia/contas/detalhe";
import { ROTA_CONTAS } from "../components/energia/contas/lista";
import { useContextoOp } from "../contexto";

const CARREGANDO = (
  <TelaCarregando>
    <CartaoCarregando altura="h-64" />
    <CartaoCarregando altura="h-80" />
  </TelaCarregando>
);

export default function Page() {
  return (
    <>
      <Link
        href={ROTA_CONTAS}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Contas de energia
      </Link>
      <Suspense fallback={CARREGANDO}>
        <Protegido permissao="operacoes.energia.contas">
          <Tela />
        </Protegido>
      </Suspense>
    </>
  );
}

function Tela() {
  const id = z.uuid().safeParse(useParametro("fatura"));
  if (!id.success) naoEncontrado();
  return <Fatura id={id.data} />;
}

function Fatura({ id }: { id: string }) {
  const { data: du } = useSuspenseQuery(consultaDasUnidades);
  const consulta = useQuery({ ...consultaDaFatura(id), retry: false });
  const ctx = useContextoOp(consulta.dataUpdatedAt || undefined);
  const f = consulta.data?.fatura;
  const unidade = f
    ? du.unidades.find((u) => u.matricula === f.matricula)
    : undefined;
  if (consulta.isPending) return CARREGANDO;
  if (consulta.error) {
    if (consulta.error instanceof ErroDaApi && consulta.error.status === 404)
      naoEncontrado();
    throw consulta.error;
  }
  if (!f) naoEncontrado();
  return (
    <>
      <PageHeader
        title={`${nomeDaUnidade(f.matricula, unidade)} · ${formatarMes(f.referencia)}`}
        description={
          f.vigente
            ? "Fatura da Energisa confirmada na importação."
            : "Fatura ainda em prévia: só passa a valer nas telas depois de confirmada em Operações › Importações."
        }
      />
      <div className="flex flex-col gap-6">
        <TopoDaTela
          dadosDe={ctx.dadosDe}
          exemplo={f.exemplo ? "fatura de exemplo" : undefined}
        />
        <DetalheDaFatura
          fatura={f}
          unidade={unidade}
          pdf={consulta.data.pdf ?? undefined}
        />
      </div>
    </>
  );
}
