import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Situacao } from "@/components/admin/ui";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import {
  EditarDocumento,
  SubirNovaVersao,
} from "@/components/comercial/kit/formularios";
import { TabelaLista } from "@/components/comercial/tela";
import { Secao } from "@/components/dashboard/tabela";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { rotuloSituacao, situacaoDaValidade } from "@/lib/comercial/kit";
import { formatarData, formatarDataHora } from "@/lib/formato";
import {
  contextoCom,
  parametros,
  valoresDaLista,
} from "@/server/comercial/base";
import { documentoDoKit, nomesDoKit } from "@/server/comercial/kit";

export const metadata: Metadata = { title: "Documento do kit" };

const TOM = {
  vencido: "erro",
  vence: "rodando",
  valido: "ok",
  sem_validade: "neutro",
} as const;

const linkBaixar =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-400";

export default function Page({ params }: PageProps<"/comercial/kit/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/comercial/kit"
        className="w-fit text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Kit de entrega
      </Link>
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-40" />
            <CartaoCarregando altura="h-64" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="comercial.kit.ver">
          <Detalhe params={params} />
        </Protegido>
      </Suspense>
    </div>
  );
}

async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const [ctx, achado, p, categorias] = await Promise.all([
    contextoCom(),
    documentoDoKit(id),
    parametros(),
    valoresDaLista("kit_categoria"),
  ]);
  if (!achado) notFound();
  const { documento: d, versoes } = achado;
  const nomes = await nomesDoKit(versoes.map((v) => v.enviado_por));
  const atual = d.atual;
  const situacao = situacaoDaValidade(
    atual?.validade ?? null,
    ctx.hoje,
    p.kit_aviso_dias,
  );
  const podeEditar = ctx.pode("comercial.kit.editar");

  return (
    <>
      <PageHeader title={d.nome} description={d.categoria} />
      <div className="flex flex-col gap-6">
        <Secao titulo="Versão atual">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Item rotulo="Versão">{atual?.versao ?? "Sem versão"}</Item>
            <Item rotulo="Data">
              {formatarData(atual?.data ?? null) || "—"}
            </Item>
            <Item rotulo="Validade">
              {atual?.validade ? (
                <span className={situacao === "vencido" ? "text-red-700" : ""}>
                  {formatarData(atual.validade)}
                </span>
              ) : (
                "Sem validade"
              )}
            </Item>
            <Item rotulo="Situação">
              {d.ativo ? (
                <Situacao tipo={TOM[situacao]}>
                  {rotuloSituacao(situacao, p.kit_aviso_dias)}
                </Situacao>
              ) : (
                <Situacao tipo="neutro">Inativo (fora do kit)</Situacao>
              )}
            </Item>
            <Item rotulo="Vai em todo contrato">
              {d.todo_contrato ? "Sim" : "Não"}
            </Item>
            <Item rotulo="Blocos atendidos">
              {d.blocos.length ? d.blocos.join(", ") : "—"}
            </Item>
            <Item rotulo="Arquivo">
              {atual?.temArquivo ? (
                (atual.arquivo_nome ?? "PDF")
              ) : (
                <span className="text-red-700">Sem arquivo ainda</span>
              )}
            </Item>
            <Item rotulo="Atualizado por">
              {atual?.enviado_por
                ? (nomes.get(atual.enviado_por) ?? "—")
                : "Carga inicial"}
              {atual ? ` · ${formatarDataHora(atual.enviado_em)}` : ""}
            </Item>
          </dl>
          {situacao === "vencido" && d.ativo && (
            <p className="mt-4 rounded-xl bg-red-500/[0.06] p-3 text-sm text-red-800">
              Documento vencido: suba a versão nova antes do próximo contrato.
            </p>
          )}
          {!atual?.temArquivo && (
            <p className="mt-4 rounded-xl bg-red-500/[0.06] p-3 text-sm text-red-800">
              Sem arquivo ainda — suba o PDF
              {!podeEditar
                ? " (quem edita o kit faz isso)"
                : atual
                  ? " em “Enviar o PDF”"
                  : " em “Subir nova versão”"}
              . Até lá, ele não entra no kit baixado.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {atual?.temArquivo && (
              <a
                href={`/comercial/kit/arquivo/${atual.id}`}
                className={linkBaixar}
              >
                <Download className="size-4" aria-hidden />
                Baixar PDF
              </a>
            )}
            {podeEditar && (
              <>
                <SubirNovaVersao
                  documentoId={d.id}
                  versaoSemArquivo={
                    atual && !atual.temArquivo ? atual.id : null
                  }
                />
                <EditarDocumento
                  categorias={categorias}
                  documento={{
                    id: d.id,
                    nome: d.nome,
                    categoria: d.categoria,
                    blocos: d.blocos,
                    todo_contrato: d.todo_contrato,
                    ativo: d.ativo,
                    versaoId: atual?.id ?? null,
                    validade: atual?.validade ?? null,
                  }}
                />
              </>
            )}
          </div>
        </Secao>

        <Secao
          titulo="Histórico de versões"
          descricao="As versões antigas ficam guardadas (no lugar da pasta “Old”); nada é apagado."
        >
          <TabelaLista
            semBusca
            colunas={[
              { titulo: "Versão" },
              { titulo: "Data" },
              { titulo: "Validade" },
              { titulo: "Enviada em" },
              { titulo: "Por" },
              { titulo: "Arquivo" },
            ]}
            vazio="Nenhuma versão cadastrada."
            linhas={versoes.map((v) => ({
              chave: v.id,
              busca: v.versao,
              ordem: [
                v.versao,
                v.data,
                v.validade,
                v.enviado_em,
                v.enviado_por ? (nomes.get(v.enviado_por) ?? "") : "",
                v.arquivo_nome,
              ],
              celulas: [
                <span key="v" className="font-medium">
                  {v.versao}
                  {v.atual && (
                    <span className="ml-2 text-xs font-normal text-green-700">
                      atual
                    </span>
                  )}
                </span>,
                formatarData(v.data) || "—",
                v.validade ? formatarData(v.validade) : "Sem validade",
                formatarDataHora(v.enviado_em),
                v.enviado_por
                  ? (nomes.get(v.enviado_por) ?? "—")
                  : "Carga inicial",
                v.temArquivo ? (
                  <a
                    key="a"
                    href={`/comercial/kit/arquivo/${v.id}`}
                    className="text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Baixar
                  </a>
                ) : (
                  <span key="s" className="text-red-700">
                    sem arquivo ainda
                  </span>
                ),
              ],
            }))}
          />
        </Secao>
      </div>
    </>
  );
}

function Item({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-neutral-500">{rotulo}</dt>
      <dd className="font-medium text-neutral-900">{children}</dd>
    </div>
  );
}
