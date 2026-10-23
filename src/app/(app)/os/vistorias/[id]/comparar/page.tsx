import { CircleAlert, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { SemAcesso } from "@/components/protegido";
import { formatarData } from "@/lib/formato";
import { rotaVistoria } from "@/lib/os/rotas";
import { RESPOSTAS_AMBIENTE } from "@/lib/os/rotulos";
import { localDaUnidade } from "@/lib/os/vistoria-regras";
import { contexto } from "@/server/os/base";
import { type Foto, vistoriaCompleta } from "@/server/os/vistorias";

export const metadata: Metadata = { title: "Entrada × saída" };

// Entrada e saída do mesmo contrato lado a lado, ambiente por ambiente,
// para ver o que mudou antes de devolver as chaves.

export default function Page({
  params,
}: PageProps<"/os/vistorias/[id]/comparar">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-[40rem]" />
        </TelaCarregando>
      }
    >
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({
  params,
}: Pick<PageProps<"/os/vistorias/[id]/comparar">, "params">) {
  const ctx = await contexto();
  if (!ctx.pode("os.vistorias")) return <SemAcesso />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const dados = await vistoriaCompleta(id);
  if (!dados) notFound();
  const { vistoria: v, entrada } = dados;

  return (
    <>
      <Link
        href={rotaVistoria(v.id)}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← {v.codigo}
      </Link>
      <PageHeader
        title="Entrada × saída"
        description={`${v.locatario || "Sem locatário"} · ${localDaUnidade(v.bloco, v.unidade)}. Entrada ${entrada ? `${entrada.codigo} de ${formatarData(entrada.data)}` : "não encontrada"}; saída ${v.codigo} de ${formatarData(v.data)}.`}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <a
          href={`${rotaVistoria(v.id)}/laudo?entrada=1`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-800"
        >
          <FileText className="size-4" aria-hidden />
          Laudo com as fotos da entrada
        </a>
      </div>
      {!entrada ? (
        <p className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
          Não há vistoria de entrada deste contrato para comparar.
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {dados.ambientes.map((a, i) => (
            <li key={a.id} className="vidro rounded-[1.75rem] p-5">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
                {i + 1}. {a.titulo}
                {a.problema && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    <CircleAlert className="size-3.5" aria-hidden />
                    Com problema
                  </span>
                )}
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Lado
                  titulo="Na entrada"
                  resposta={
                    a.entrada ? RESPOSTAS_AMBIENTE[a.entrada.resposta] : null
                  }
                  descricao={
                    a.entrada
                      ? a.entrada.descricao
                      : "Este ambiente não existia na entrada."
                  }
                  fotos={a.entrada?.fotos ?? []}
                />
                <Lado
                  titulo="Na saída"
                  resposta={RESPOSTAS_AMBIENTE[a.resposta]}
                  descricao={a.descricao}
                  fotos={a.fotos}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Lado({
  titulo,
  resposta,
  descricao,
  fotos,
}: {
  titulo: string;
  resposta: string | null;
  descricao: string | null;
  fotos: Foto[];
}) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-neutral-900/[0.06] bg-white/60 p-3">
      <h3 className="text-xs font-semibold text-neutral-700">
        {titulo}
        {resposta && (
          <span className="font-normal text-neutral-500"> · {resposta}</span>
        )}
      </h3>
      <p className="text-sm whitespace-pre-line text-neutral-700">
        {descricao?.trim() || "Sem observações registradas."}
      </p>
      {fotos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {fotos.map((f, i) => (
            <li key={f.id}>
              {f.url ? (
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener"
                  className="block overflow-hidden rounded-xl bg-neutral-100"
                >
                  {/* biome-ignore lint/performance/noImgElement: endereço assinado e temporário do bucket */}
                  <img
                    src={f.url}
                    alt={`${titulo}: foto ${i + 1}`}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </a>
              ) : (
                <span className="grid aspect-square place-items-center rounded-xl bg-neutral-100 text-xs text-neutral-500">
                  Foto indisponível
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
