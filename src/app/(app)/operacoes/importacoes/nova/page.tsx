import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { AbasDaTela } from "@/components/dashboard/tela";
import { ImportarAgua } from "@/components/operacoes/agua/importar";
import { ImportarEnergisa } from "@/components/operacoes/energia/importar-contas";
import {
  EtapasDaImportacao,
  ROTA_IMPORTACOES,
} from "@/components/operacoes/importacoes/historico";
import { ImportarLimpeza } from "@/components/operacoes/limpeza/importar";
import { ImportarOrcamento } from "@/components/operacoes/obras/importar";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import {
  ehTipo,
  TIPOS_IMPORTACAO,
  type TipoImportacao,
  tiposQuePode,
} from "@/lib/operacoes/importacoes";
import { contextoOp } from "@/server/operacoes/base";

export const metadata: Metadata = { title: "Nova importação" };

type Busca = Record<string, string | string[] | undefined>;

// Cada área faz o próprio envio → prévia → confirmação (contrato do módulo:
// componente cliente, sem props). Aqui só se escolhe o tipo.
const COMPONENTES: Record<TipoImportacao, () => React.ReactNode> = {
  agua: () => <ImportarAgua />,
  energisa: () => <ImportarEnergisa />,
  orcamento: () => <ImportarOrcamento />,
  limpeza: () => <ImportarLimpeza />,
};

export default function Page({
  searchParams,
}: PageProps<"/operacoes/importacoes/nova">) {
  return (
    <>
      <Link
        href={ROTA_IMPORTACOES}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Importações
      </Link>
      <PageHeader
        title="Nova importação"
        description="Escolha o tipo e envie os arquivos como recebeu. Nada entra nos dados antes de você conferir a prévia e confirmar."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Nova busca={searchParams} />
      </Suspense>
    </>
  );
}

async function Nova({ busca }: { busca: Promise<Busca> }) {
  const [ctx, sp] = await Promise.all([contextoOp(), busca]);
  const tipos = tiposQuePode(ctx.pode);
  if (!tipos.length) return <SemAcesso />;
  const pedido = Array.isArray(sp.tipo) ? sp.tipo[0] : sp.tipo;
  const tipo: TipoImportacao =
    ehTipo(pedido) && tipos.includes(pedido)
      ? pedido
      : (tipos[0] as TipoImportacao);
  const Importar = COMPONENTES[tipo];

  return (
    <div className="flex flex-col gap-6">
      <EtapasDaImportacao />
      <div data-guia="op-importacoes-tipo" className="flex flex-col gap-2">
        <p className="text-xs font-medium text-neutral-600">
          Tipo de importação
        </p>
        <AbasDaTela
          rotulo="Tipo de importação"
          ativa={tipo}
          abas={tipos.map((t) => ({
            chave: t,
            rotulo: TIPOS_IMPORTACAO[t].rotulo,
            href: `${ROTA_IMPORTACOES}/nova?tipo=${t}`,
          }))}
        />
      </div>
      <Secao
        titulo={TIPOS_IMPORTACAO[tipo].rotulo}
        descricao={TIPOS_IMPORTACAO[tipo].descricao}
      >
        <Importar />
      </Secao>
    </div>
  );
}
