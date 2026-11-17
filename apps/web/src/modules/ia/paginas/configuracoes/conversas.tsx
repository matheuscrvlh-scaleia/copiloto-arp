import { formatarDataHora } from "@arp/shared/formato";
import { ROTULO_DO_STATUS, tituloDoModulo } from "@arp/shared/ia/contratos";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Eye, Search, ThumbsDown, ThumbsUp } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { classeCampo } from "@/components/estilos";
import { mensagemDoErro } from "@/lib/api";
import { consultaConversaDaEquipe, consultaConversasDaEquipe } from "../../api";
import { Markdown } from "../../components/markdown";

// Configurações › IA › Conversas (ia.conversas): as conversas das pessoas
// com a IA, só para ler. Cada conversa aberta fica no histórico do sistema
// (evento ia_conversa_lida), e o painel do chat avisa isso a quem conversa.

export default function ConversasDaEquipe() {
  const [pessoa, setPessoa] = useState("");
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const termo = useDeferredValue(busca.trim());
  const q = {
    usuario_id: pessoa || undefined,
    busca: termo || undefined,
    de: de || undefined,
    ate: ate || undefined,
  };
  const lista = useInfiniteQuery(consultaConversasDaEquipe(q));
  const pessoas = lista.data?.pages[0]?.pessoas ?? [];
  const conversas = lista.data?.pages.flatMap((p) => p.conversas) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="flex min-w-0 flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-4">
        <label className="relative block">
          <span className="sr-only">Buscar nas conversas</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400"
            aria-hidden
          />
          <input
            type="search"
            value={busca}
            maxLength={200}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no título, pergunta ou resposta"
            className={`${classeCampo} pl-9`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-neutral-500">
          Pessoa
          <select
            value={pessoa}
            onChange={(e) => setPessoa(e.target.value)}
            className={classeCampo}
          >
            <option value="">Todas</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            De
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className={classeCampo}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Até
            <input
              type="date"
              value={ate}
              min={de || undefined}
              onChange={(e) => setAte(e.target.value)}
              className={classeCampo}
            />
          </label>
        </div>

        {lista.isPending ? (
          <p className="py-3 text-sm text-neutral-500">Carregando…</p>
        ) : lista.error ? (
          <p role="alert" className="py-3 text-sm text-red-700">
            {mensagemDoErro(lista.error)}
          </p>
        ) : conversas.length === 0 ? (
          <p className="py-3 text-sm text-neutral-500">
            Nenhuma conversa com esses filtros.
          </p>
        ) : (
          <ul className="-mx-1 flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {conversas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setAberta(c.id)}
                  aria-current={c.id === aberta ? "true" : undefined}
                  className={`w-full rounded-2xl px-3 py-2.5 text-left transition hover:bg-neutral-100 ${c.id === aberta ? "bg-neutral-100" : ""}`}
                >
                  <span className="block truncate text-sm text-neutral-800">
                    {c.titulo}
                  </span>
                  <span className="block truncate text-[11px] text-neutral-500">
                    {c.pessoa} · {formatarDataHora(c.atualizada_em)} ·{" "}
                    {c.perguntas} {c.perguntas === 1 ? "pergunta" : "perguntas"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {lista.hasNextPage && (
          <button
            type="button"
            disabled={lista.isFetchingNextPage}
            onClick={() => void lista.fetchNextPage()}
            className="self-center rounded-full px-4 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:opacity-50"
          >
            {lista.isFetchingNextPage ? "Carregando…" : "Carregar mais"}
          </button>
        )}
      </section>

      <section className="min-w-0 rounded-3xl border border-neutral-200 bg-white p-5">
        {aberta ? (
          <Conversa id={aberta} />
        ) : (
          <p className="flex items-center gap-2 text-sm text-neutral-500">
            <Eye className="size-4" aria-hidden />
            Escolha uma conversa para ler. Cada conversa aberta fica registrada
            no histórico do sistema.
          </p>
        )}
      </section>
    </div>
  );
}

function Conversa({ id }: { id: string }) {
  const { data, isPending, error } = useQuery(consultaConversaDaEquipe(id));
  if (isPending) return <p className="text-sm text-neutral-500">Carregando…</p>;
  if (error)
    return (
      <p role="alert" className="text-sm text-red-700">
        {mensagemDoErro(error)}
      </p>
    );
  return (
    <article className="flex flex-col gap-5">
      <header>
        <h2 className="text-base font-semibold text-neutral-900">
          {data.titulo}
        </h2>
        <p className="text-xs text-neutral-500">Conversa de {data.pessoa}</p>
      </header>
      {data.perguntas.map((p) => {
        const modulos = [
          ...new Set(p.fontes.map((f) => tituloDoModulo(f.modulo))),
        ];
        return (
          <div key={p.id} className="flex flex-col gap-2">
            <p className="text-[11px] text-neutral-400">
              {formatarDataHora(p.criada_em)}
              {p.status !== "ok" &&
                ` · ${ROTULO_DO_STATUS[p.status] ?? p.status}`}
              {modulos.length > 0 && ` · consultou ${modulos.join(", ")}`}
            </p>
            <p className="max-w-[85%] self-end rounded-3xl rounded-br-lg bg-neutral-900 px-4 py-2.5 text-sm whitespace-pre-wrap text-white">
              {p.pergunta}
            </p>
            {p.resposta && <Markdown texto={p.resposta} />}
            {p.avaliacao !== null && (
              <p className="flex items-center gap-1 text-[11px] text-neutral-500">
                {p.avaliacao === 1 ? (
                  <ThumbsUp className="size-3" aria-hidden />
                ) : (
                  <ThumbsDown className="size-3" aria-hidden />
                )}
                {p.avaliacao === 1
                  ? "A pessoa achou boa a resposta"
                  : "A pessoa achou ruim a resposta"}
              </p>
            )}
          </div>
        );
      })}
    </article>
  );
}
