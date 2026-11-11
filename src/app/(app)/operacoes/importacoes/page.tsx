import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  CartaoCarregando,
  FiltrosCarregando,
  TelaCarregando,
} from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { AbasDaTela } from "@/components/dashboard/tela";
import { BOTAO_SECUNDARIO } from "@/components/operacoes/agua/estilos";
import { FotoDoHidrometro } from "@/components/operacoes/agua/foto-do-hidrometro";
import { ImportarAgua } from "@/components/operacoes/agua/importar";
import { ImportarContaAgua } from "@/components/operacoes/agua/importar-conta";
import { ImportarEnergisa } from "@/components/operacoes/energia/importar-contas";
import {
  EtapasDaImportacao,
  FiltrosDeImportacoes,
  ROTA_IMPORTACOES,
  TabelaDeImportacoes,
} from "@/components/operacoes/importacoes/historico";
import { ImportarLimpeza } from "@/components/operacoes/limpeza/importar";
import { ImportarOrcamento } from "@/components/operacoes/obras/importar";
import { hrefDaPagina, Paginacao } from "@/components/os/paginacao";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarData, formatarNumero } from "@/lib/formato";
import {
  AREAS_IMPORTACAO,
  ehTipo,
  type FiltroImportacoes,
  hrefDoCartao,
  lerFiltroImportacoes,
  POR_PAGINA,
  STATUS_IMPORTACAO,
  TIPOS,
  TIPOS_IMPORTACAO,
  type TipoImportacao,
  tiposQuePode,
} from "@/lib/operacoes/importacoes";
import { totalDePaginas } from "@/lib/os/paginacao";
import { mesesImportados } from "@/server/operacoes/agua";
import { contextoOp } from "@/server/operacoes/base";
import { hidrometrosCadastrados } from "@/server/operacoes/cadastros";
import { paginaDeImportacoes } from "@/server/operacoes/importacoes";

export const metadata: Metadata = { title: "Importações de Operações" };

type Busca = Record<string, string | string[] | undefined>;

// Cada área faz o próprio envio → prévia → confirmação (contrato do módulo:
// componente cliente, sem props). Aqui se escolhe o tipo; os logs (histórico
// de importações) ficam no fim da mesma tela.
const COMPONENTES: Record<TipoImportacao, () => React.ReactNode> = {
  agua: () => <ImportarAgua />,
  agua_conta: () => <ImportarContaAgua />,
  energisa: () => <ImportarEnergisa />,
  orcamento: () => <ImportarOrcamento />,
  limpeza: () => <ImportarLimpeza />,
};

export default function Page({
  searchParams,
}: PageProps<"/operacoes/importacoes">) {
  return (
    <>
      <PageHeader
        title="Importações"
        description="Tudo o que entra por arquivo em Operações. Escolha o tipo e envie os arquivos como recebeu: nada entra nos dados antes de você conferir a prévia e confirmar. Os logs, no fim da tela, guardam cada importação com o comprovante e os dados convertidos."
      />
      <Suspense fallback={<Esqueleto />}>
        <Tela busca={searchParams} />
      </Suspense>
    </>
  );
}

function descrever(f: FiltroImportacoes): string {
  return [
    `Tipo: ${f.tipo ? TIPOS_IMPORTACAO[f.tipo].curto : "todos"}`,
    `Situação: ${f.status ? STATUS_IMPORTACAO[f.status].rotulo : "todas"}`,
    (f.de || f.ate) &&
      `Enviadas: ${f.de ? formatarData(f.de) : "início"} a ${f.ate ? formatarData(f.ate) : "hoje"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

const um = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? "";

async function Tela({ busca }: { busca: Promise<Busca> }) {
  const [ctx, sp] = await Promise.all([contextoOp(), busca]);
  const podeTipo = tiposQuePode(ctx.pode);
  // Quem vê os logs: quem importa algum tipo (o menu) ou vê a área.
  const vistos = TIPOS.filter(
    (t) =>
      podeTipo.includes(t) ||
      ((t === "agua" || t === "agua_conta") &&
        ctx.pode("operacoes.agua.ver")) ||
      (t === "orcamento" && ctx.pode("operacoes.obras.ver")) ||
      (t === "limpeza" && ctx.pode("operacoes.limpeza.ver")),
  );
  if (!vistos.length) return <SemAcesso />;

  return (
    <div className="flex flex-col gap-8">
      {podeTipo.length > 0 && <Importar sp={sp} tipos={podeTipo} />}
      <Logs sp={sp} vistos={vistos} podeTipo={podeTipo} />
    </div>
  );
}

async function Importar({ sp, tipos }: { sp: Busca; tipos: TipoImportacao[] }) {
  const pedido = um(sp.tipo);
  const tipo: TipoImportacao =
    ehTipo(pedido) && tipos.includes(pedido)
      ? pedido
      : (tipos[0] as TipoImportacao);
  const Componente = COMPONENTES[tipo];
  const foco = um(sp.foco) === "fotos" && tipo === "agua" ? "fotos" : undefined;
  const cartoes = AREAS_IMPORTACAO.flatMap((a) =>
    a.cartoes.filter((c) => tipos.includes(c.tipo)),
  );
  const ativo =
    cartoes.find((c) => c.tipo === tipo && c.foco === foco) ?? cartoes[0];
  const [hidrometros, meses] = foco
    ? await Promise.all([hidrometrosCadastrados(), mesesImportados()])
    : [[], []];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        <Link
          href="#logs"
          data-guia="op-importacoes-ir-logs"
          className={BOTAO_SECUNDARIO}
        >
          <ClipboardList className="size-4" aria-hidden />
          Ver logs
        </Link>
      </div>
      <EtapasDaImportacao />
      {foco === "fotos" && (
        <Secao
          titulo="Foto de um hidrômetro"
          descricao="Escolha o mês, o hidrômetro do cadastro e a foto do visor: a foto se liga à leitura daquele hidrômetro no mês, sem depender do nome do arquivo."
        >
          <FotoDoHidrometro
            hidrometros={hidrometros
              .filter((h) => h.ativo)
              .map((h) => ({
                id: h.id,
                numero: h.numero,
                bloco: h.bloco,
                sala: h.sala,
                descricao: h.descricao,
              }))}
            meses={meses.map((m) => m.referencia)}
          />
        </Secao>
      )}
      <Secao
        titulo={
          foco === "fotos"
            ? "Várias fotos de uma vez (pelo nome do arquivo)"
            : (ativo?.titulo ?? TIPOS_IMPORTACAO[tipo].rotulo)
        }
        descricao={
          foco === "fotos"
            ? "Escolha a pasta de fotos (ou as fotos soltas) de um mês que já foi importado. Cada foto se liga ao hidrômetro pelo nome do arquivo, no formato MES_AA_NÚMERO.jpg (ex.: SET_26_A19L036553.jpg). A prévia mostra quantas foram ligadas e quais ficaram sem leitura; as leituras do mês não mudam."
            : `${ativo?.texto ?? TIPOS_IMPORTACAO[tipo].descricao} Aceita: ${ativo?.aceita ?? ""}.`
        }
      >
        <Componente />
      </Secao>
    </div>
  );
}

async function Logs({
  sp,
  vistos,
  podeTipo,
}: {
  sp: Busca;
  vistos: TipoImportacao[];
  podeTipo: TipoImportacao[];
}) {
  const f = lerFiltroImportacoes(sp);
  const { linhas, total } = await paginaDeImportacoes(f);
  const ultima = totalDePaginas(total, POR_PAGINA);
  if (f.pagina > ultima)
    redirect(`${hrefDaPagina(ROTA_IMPORTACOES, sp, ultima)}#logs`);
  const manter = Object.fromEntries(
    (["tipo", "foco"] as const).flatMap((k) =>
      um(sp[k]) ? [[k, um(sp[k])]] : [],
    ),
  );

  return (
    <section
      id="logs"
      aria-labelledby="titulo-logs"
      className="flex scroll-mt-6 flex-col gap-4 border-t border-neutral-900/[0.08] pt-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="titulo-logs" className="text-lg font-semibold">
          Logs de importações
        </h2>
        <p className="text-sm text-neutral-600">
          {descrever(f)} · {formatarNumero(total)}{" "}
          {total === 1 ? "importação" : "importações"}, da mais nova para a mais
          antiga. O olho abre o comprovante, os dados importados (com corrigir e
          excluir) e os avisos.
        </p>
      </div>
      <FiltrosDeImportacoes f={f} tipos={vistos} manter={manter} />
      <div className="flex flex-col gap-4">
        <TabelaDeImportacoes linhas={linhas} podeTipo={podeTipo} />
        <Paginacao
          pagina={f.pagina}
          total={total}
          porPagina={POR_PAGINA}
          href={(p) => `${hrefDaPagina(ROTA_IMPORTACOES, sp, p)}#logs`}
        />
      </div>
      <Nota>
        Desfazer apaga o que a importação trouxe; na água e na conta da
        concessionária, se ela substituiu outra do mesmo mês, a anterior volta a
        valer. Mês que não batia com o resumo do arquivo só entra com motivo e
        fica marcado “incompleto”. Correções feitas depois ficam no histórico do
        sistema, com quem alterou e o valor de antes.
      </Nota>
    </section>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <FiltrosCarregando />
      <CartaoCarregando altura="h-96" />
      <FiltrosCarregando />
      <CartaoCarregando altura="h-[24rem]" />
    </TelaCarregando>
  );
}
