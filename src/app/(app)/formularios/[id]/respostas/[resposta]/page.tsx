import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { Nota, Secao } from "@/components/dashboard/tabela";
import { FormAcao } from "@/components/form-acao";
import { SemAcesso } from "@/components/protegido";
import { formatarDataHora } from "@/lib/formato";
import {
  recebeResposta,
  type TipoCampo,
  textoDaResposta,
} from "@/lib/formularios/campos";
import { excluirResposta } from "@/server/formularios/acoes/formularios";
import {
  contexto,
  formularioPorId,
  respostaPorId,
  rotaDoFormulario,
} from "@/server/formularios/base";

export const metadata: Metadata = { title: "Resposta do formulário" };

export default function Page({
  params,
}: PageProps<"/formularios/[id]/respostas/[resposta]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-24" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Tela params={params} />
    </Suspense>
  );
}

interface Item {
  id: string;
  titulo: string;
  tipo: TipoCampo | null;
  valor: unknown;
}

async function Tela({
  params,
}: Pick<PageProps<"/formularios/[id]/respostas/[resposta]">, "params">) {
  const [{ id, resposta }, ctx] = await Promise.all([params, contexto()]);
  if (!ctx.ve) return <SemAcesso />;
  const [f, r] = await Promise.all([
    formularioPorId(id),
    respostaPorId(id, resposta),
  ]);
  if (!f || !r) notFound();

  // Perguntas atuais na ordem do formulário; depois, o que foi respondido a
  // perguntas que já saíram (com o título guardado no envio).
  const atuais: Item[] = f.campos.filter(recebeResposta).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    valor: r.respostas[c.id],
  }));
  const ids = new Set(atuais.map((a) => a.id));
  const antigas: Item[] = Object.keys(r.respostas)
    .filter((k) => !ids.has(k))
    .map((k) => ({
      id: k,
      titulo: r.perguntas[k] ?? "Pergunta removida",
      tipo: null,
      valor: r.respostas[k],
    }));

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={rotaDoFormulario(f.id)}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {f.titulo}
      </Link>
      <header data-guia="titulo">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Resposta
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Enviada em {formatarDataHora(r.enviada_em)}
        </p>
      </header>

      <Secao titulo="Respostas">
        <Lista itens={atuais} />
      </Secao>

      {antigas.length > 0 && (
        <Secao
          titulo="Perguntas que saíram do formulário"
          descricao="Respondidas antes de a pergunta ser excluída ou trocada. O título é o da época do envio."
        >
          <Lista itens={antigas} />
        </Secao>
      )}

      {ctx.edita && (
        <Secao titulo="Excluir resposta">
          <div className="flex flex-col gap-3">
            <Nota>
              Para respostas de teste ou enviadas por engano. O total do
              formulário é recalculado.
            </Nota>
            <FormAcao
              acao={excluirResposta}
              rotulo="Excluir resposta"
              rotuloEnviando="Excluindo…"
              variante="perigo"
              confirmar="Excluir esta resposta? Não tem volta."
            >
              <input type="hidden" name="formulario" value={f.id} />
              <input type="hidden" name="resposta" value={r.id} />
            </FormAcao>
          </div>
        </Secao>
      )}
    </div>
  );
}

function Lista({ itens }: { itens: Item[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
      {itens.map((i, n) => {
        const texto = textoDaResposta(i.tipo, i.valor);
        return (
          <div key={i.id} className="contents">
            <dt className="text-xs text-neutral-500 sm:pt-0.5">
              {i.tipo ? `${n + 1}. ` : ""}
              {i.titulo}
            </dt>
            <dd className="min-w-0 whitespace-pre-line break-words font-medium text-neutral-900">
              {texto || <span className="font-normal text-neutral-400">—</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
