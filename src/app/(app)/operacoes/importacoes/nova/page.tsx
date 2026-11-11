import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Secao } from "@/components/dashboard/tabela";
import { AbasDaTela } from "@/components/dashboard/tela";
import { ImportarAgua } from "@/components/operacoes/agua/importar";
import { ImportarContaAgua } from "@/components/operacoes/agua/importar-conta";
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
  AREAS_IMPORTACAO,
  ehTipo,
  hrefDoCartao,
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
  agua_conta: () => <ImportarContaAgua />,
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
  const foco = sp.foco === "fotos" && tipo === "agua" ? "fotos" : undefined;
  const cartoes = AREAS_IMPORTACAO.flatMap((a) =>
    a.cartoes
      .filter((c) => tipos.includes(c.tipo))
      .map((c) => ({ ...c, area: a.titulo })),
  );
  const ativo =
    cartoes.find((c) => c.tipo === tipo && c.foco === foco) ?? cartoes[0];

  return (
    <div className="flex flex-col gap-6">
      <EtapasDaImportacao />
      <div data-guia="op-importacoes-tipo" className="flex flex-col gap-2">
        <p className="text-xs font-medium text-neutral-600">
          O que você vai importar?
        </p>
        <AbasDaTela
          rotulo="Tipo de importação"
          ativa={ativo?.chave ?? tipo}
          abas={cartoes.map((c) => ({
            chave: c.chave,
            rotulo: c.titulo,
            href: hrefDoCartao(c),
          }))}
        />
      </div>
      {foco === "fotos" && (
        <p className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong className="font-semibold">Só as fotos:</strong> escolha a
          pasta de fotos (ou as fotos soltas) de um mês que já foi importado.
          Cada foto se liga ao hidrômetro pelo nome do arquivo, no formato
          MES_AA_NÚMERO.jpg (ex.: SET_26_A19L036553.jpg). A prévia mostra
          quantas foram ligadas e quais ficaram sem leitura; as leituras do mês
          não mudam.
        </p>
      )}
      <Secao
        titulo={ativo?.titulo ?? TIPOS_IMPORTACAO[tipo].rotulo}
        descricao={`${ativo?.texto ?? TIPOS_IMPORTACAO[tipo].descricao} Aceita: ${ativo?.aceita ?? ""}.`}
      >
        <Importar />
      </Secao>
    </div>
  );
}
