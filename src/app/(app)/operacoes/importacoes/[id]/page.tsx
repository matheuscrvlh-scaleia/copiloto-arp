import { CircleAlert, Download, Info, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { type Coluna, Secao, Tabela } from "@/components/dashboard/tabela";
import {
  BotaoDesfazer,
  ContagemDeAvisos,
  Resultado,
  ROTA_IMPORTACOES,
  rotaDaImportacao,
} from "@/components/operacoes/importacoes/historico";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarDataHora, formatarMoeda, formatarNumero } from "@/lib/formato";
import {
  type AvisoImportacao,
  podeDesfazer,
  TIPOS_IMPORTACAO,
  textoDaReferencia,
  tiposQuePode,
} from "@/lib/operacoes/importacoes";
import { contextoOp } from "@/server/operacoes/base";
import { importacao } from "@/server/operacoes/importacoes";

export const metadata: Metadata = { title: "Importação" };

export default function Page({
  params,
}: PageProps<"/operacoes/importacoes/[id]">) {
  return (
    <>
      <Link
        href={ROTA_IMPORTACOES}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Importações
      </Link>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-48" />
            <CartaoCarregando altura="h-96" />
          </TelaCarregando>
        }
      >
        <Detalhe params={params} />
      </Suspense>
    </>
  );
}

const NIVEL = {
  erro: { Icone: CircleAlert, cor: "text-red-700", rotulo: "Erro" },
  aviso: { Icone: TriangleAlert, cor: "text-amber-700", rotulo: "Aviso" },
  info: { Icone: Info, cor: "text-neutral-600", rotulo: "Informação" },
} as const;

const COLUNAS_AVISOS: Coluna<AvisoImportacao & { n: number }>[] = [
  {
    titulo: "Nível",
    valor: (a) => {
      const { Icone, cor, rotulo } = NIVEL[a.nivel];
      return (
        <span className={`inline-flex items-center gap-1.5 ${cor}`}>
          <Icone className="size-4" aria-hidden />
          {rotulo}
        </span>
      );
    },
  },
  { titulo: "Bloco", valor: (a) => (a.bloco === undefined ? "—" : a.bloco) },
  {
    titulo: "Linha",
    numero: true,
    valor: (a) => (a.linha === undefined ? "—" : a.linha),
  },
  { titulo: "Mensagem", valor: (a) => a.mensagem },
];

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="text-sm break-words">{valor}</dd>
    </div>
  );
}

async function Detalhe({
  params,
}: {
  params: PageProps<"/operacoes/importacoes/[id]">["params"];
}) {
  const [ctx, { id }] = await Promise.all([contextoOp(), params]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const podeTipo = tiposQuePode(ctx.pode);
  const vê =
    podeTipo.length > 0 ||
    ctx.pode("operacoes.agua.ver") ||
    ctx.pode("operacoes.obras.ver") ||
    ctx.pode("operacoes.limpeza.ver");
  if (!vê) return <SemAcesso />;
  const i = await importacao(id, ctx.pode("operacoes.agua.valores"));
  if (!i) notFound();
  const tipo = TIPOS_IMPORTACAO[i.tipo];
  const avisos = i.listaDeAvisos.map((a, n) => ({ ...a, n }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${tipo.curto} · ${textoDaReferencia(i.referencia)}`}
        description={tipo.rotulo}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Resultado i={i} />
        <ContagemDeAvisos avisos={i.avisos} />
        {podeTipo.includes(i.tipo) && podeDesfazer(i.status) && (
          <BotaoDesfazer i={i} comTexto />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Secao titulo="Quem e quando">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo
              rotulo="Enviada"
              valor={`${formatarDataHora(i.criadoEm)} por ${i.criadoPor ?? "—"}`}
            />
            <Campo
              rotulo="Confirmada"
              valor={
                i.confirmadoEm
                  ? `${formatarDataHora(i.confirmadoEm)} por ${i.confirmadoPor ?? "—"}`
                  : "—"
              }
            />
            {i.desfeitoEm && (
              <Campo
                rotulo={i.status === "cancelada" ? "Descartada" : "Desfeita"}
                valor={`${formatarDataHora(i.desfeitoEm)} por ${i.desfeitoPor ?? "—"}`}
              />
            )}
            {i.motivo && (
              <Campo rotulo="Motivo (confirmada sem bater)" valor={i.motivo} />
            )}
            {i.substitui && (
              <Campo
                rotulo="Substituiu"
                valor={
                  <Link
                    href={rotaDaImportacao(i.substitui)}
                    className="underline underline-offset-2"
                  >
                    a importação anterior do mês
                  </Link>
                }
              />
            )}
            {i.substituidaPor && (
              <Campo
                rotulo="Substituída por"
                valor={
                  <Link
                    href={rotaDaImportacao(i.substituidaPor)}
                    className="underline underline-offset-2"
                  >
                    a importação seguinte
                  </Link>
                }
              />
            )}
            {i.exemplo && (
              <Campo rotulo="Dados" valor="De exemplo (fictícios)" />
            )}
          </dl>
        </Secao>

        <Secao
          titulo="Arquivos enviados"
          descricao="Como foram recebidos; o link vale por 10 minutos."
        >
          {i.arquivosComLink.length ? (
            <ul className="flex flex-col gap-2">
              {i.arquivosComLink.map((a) => (
                <li
                  key={`${a.nome}-${a.caminho ?? ""}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 break-all">{a.nome}</span>
                  <span className="flex items-center gap-3 text-xs text-neutral-500">
                    {a.bytes !== undefined &&
                      `${formatarNumero(a.bytes / 1024, 0)} KB`}
                    {a.url ? (
                      <a
                        href={a.url}
                        className="inline-flex items-center gap-1 font-medium text-neutral-800 underline-offset-2 hover:underline"
                      >
                        <Download className="size-3.5" aria-hidden />
                        Baixar
                      </a>
                    ) : (
                      "arquivo não guardado"
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">
              Nenhum arquivo registrado nesta importação.
            </p>
          )}
        </Secao>
      </div>

      <Secao
        titulo="O que foi lido"
        descricao="Resumo gravado na prévia: linhas, totais e o resumo do próprio arquivo."
      >
        {i.resumo.length ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {i.resumo.map((r) => (
              <Campo key={r.rotulo} rotulo={r.rotulo} valor={r.valor} />
            ))}
          </dl>
        ) : (
          <p className="text-sm text-neutral-500">Sem resumo gravado.</p>
        )}
      </Secao>

      {i.valores && (
        <Secao
          titulo="Conciliação em reais"
          descricao="Soma das linhas lidas contra o resumo do arquivo, por bloco."
        >
          <Tabela
            colunas={[
              { titulo: "Bloco", valor: (b) => b.bloco },
              {
                titulo: "Valor do resumo",
                numero: true,
                valor: (b) => formatarMoeda(b.arquivo),
              },
              {
                titulo: "Valor das linhas",
                numero: true,
                valor: (b) => formatarMoeda(b.lido),
              },
              {
                titulo: "Diferença",
                numero: true,
                valor: (b) =>
                  b.arquivo === null || b.lido === null
                    ? "—"
                    : formatarMoeda(b.lido - b.arquivo),
              },
            ]}
            linhas={i.valores.porBloco}
            chave={(b) => b.bloco}
            vazio="Sem detalhe por bloco."
            rodape={[
              "Total",
              formatarMoeda(i.valores.arquivo),
              formatarMoeda(i.valores.lido),
              i.valores.arquivo === null || i.valores.lido === null
                ? "—"
                : formatarMoeda(i.valores.lido - i.valores.arquivo),
            ]}
          />
        </Secao>
      )}

      <Secao
        titulo="Avisos das conferências"
        descricao="Erros impedem confirmar sem motivo; avisos e informações só pedem conferência."
      >
        <Tabela
          colunas={COLUNAS_AVISOS}
          linhas={avisos}
          chave={(a) => String(a.n)}
          vazio="Nenhum aviso: tudo bateu."
        />
      </Secao>
    </div>
  );
}
