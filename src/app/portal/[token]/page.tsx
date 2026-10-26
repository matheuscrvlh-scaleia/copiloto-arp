import { ChevronRight, CircleAlert, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { IconeCatalogo } from "@/components/os/configuracoes/icones";
import {
  dataDe,
  ItemPedido,
  LinkInativo,
  Logo,
} from "@/components/os/portal/publico/visual";
import { podeAvaliar } from "@/lib/os/portal";
import { rotaPortal } from "@/lib/os/rotas";
import { acessoDaPagina } from "@/server/os/portal-acesso";
import {
  categoriasDoPortal,
  documentosDaLoja,
  type Pedido,
  parametrosDoPortal,
  pedidosDaLoja,
} from "@/server/os/portal-publico";

// Início do portal: nome da loja, "Fazer um pedido", os tipos de pedido
// do catálogo, "Meus pedidos" com o status em palavras simples e os
// documentos da loja (laudos de vistoria liberados).

export default function Page({ params }: PageProps<"/portal/[token]">) {
  return (
    <Suspense fallback={<Esqueleto />}>
      <Inicio params={params} />
    </Suspense>
  );
}

function Esqueleto() {
  return (
    <TelaCarregando>
      <CartaoCarregando altura="h-48" />
      <CartaoCarregando altura="h-56" />
      <CartaoCarregando altura="h-64" />
    </TelaCarregando>
  );
}

const encerrado = (p: Pedido) =>
  p.status === "concluido" ||
  p.status === "fechado" ||
  p.status === "cancelado";

async function Inicio({
  params,
}: Pick<PageProps<"/portal/[token]">, "params">) {
  const { token } = await params;
  const acesso = await acessoDaPagina(token);
  if (!acesso) return <LinkInativo />;
  const [categorias, p, pedidos, documentos] = await Promise.all([
    categoriasDoPortal(),
    parametrosDoPortal(),
    pedidosDaLoja(acesso.loja.id),
    documentosDaLoja(acesso.loja.id),
  ]);
  const base = rotaPortal(token);
  // Concluído sem avaliação fica em cima: falta o lojista avaliar.
  const emCima = (x: Pedido) => !encerrado(x) || podeAvaliar(x);
  const abertos = pedidos.filter(emCima);
  const encerrados = pedidos.filter((x) => !emCima(x));
  const esperando = abertos.filter(
    (x) => x.status === "aguardando" && x.aguardando_tipo === "lojista",
  ).length;
  const item = (x: Pedido) => (
    <ItemPedido
      key={x.id}
      href={`${base}/pedidos/${x.id}`}
      numero={x.numero}
      titulo={x.titulo}
      status={x.status}
      aguardando={x.aguardando_tipo}
      criadoEm={x.criado_em}
      avaliar={podeAvaliar(x)}
      icone={<IconeCatalogo nome={x.icone} className="size-5" />}
    />
  );

  return (
    <>
      <header className="vidro flex flex-col gap-5 rounded-[1.75rem] p-5 sm:p-6">
        <Logo />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {acesso.loja.nome}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            LUC {acesso.loja.luc}
            {acesso.loja.bloco && ` · Bloco ${acesso.loja.bloco}`}
          </p>
        </div>
        {p.portal_boas_vindas && (
          <p className="text-sm text-neutral-700">{p.portal_boas_vindas}</p>
        )}
        <a
          href="#pedir"
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-neutral-800 sm:w-fit"
        >
          <Plus className="size-5" aria-hidden />
          Fazer um pedido
        </a>
      </header>

      {esperando > 0 && (
        <p className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <CircleAlert className="size-5 shrink-0" aria-hidden />
          {esperando === 1
            ? "Um pedido está aguardando a sua resposta."
            : `${esperando} pedidos estão aguardando a sua resposta.`}
        </p>
      )}

      <section
        id="pedir"
        aria-labelledby="titulo-pedir"
        className="vidro scroll-mt-4 rounded-[1.75rem] p-5 sm:p-6"
      >
        <h2 id="titulo-pedir" className="text-lg font-semibold">
          Fazer um pedido
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Escolha o que você precisa.
        </p>
        {categorias.length ? (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categorias.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${base}/novo/${c.id}`}
                  className="flex h-full items-center gap-4 rounded-2xl border border-neutral-900/[0.06] bg-white/70 p-4 transition hover:border-neutral-400 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-neutral-900/10"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-marca text-[#fff] shadow-sm">
                    <IconeCatalogo nome={c.icone} className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">
                      {c.nome}
                    </span>
                    {c.orientacao && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-neutral-500">
                        {c.orientacao}
                      </span>
                    )}
                  </span>
                  <ChevronRight
                    className="size-5 shrink-0 text-neutral-400"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            Nenhum tipo de pedido disponível agora. Fale com a administração.
          </p>
        )}
      </section>

      <section
        aria-labelledby="titulo-pedidos"
        className="vidro rounded-[1.75rem] p-5 sm:p-6"
      >
        <h2 id="titulo-pedidos" className="text-lg font-semibold">
          Meus pedidos
        </h2>
        {pedidos.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            Os pedidos da sua loja aparecem aqui, com o andamento de cada um.
          </p>
        ) : (
          <>
            {abertos.length > 0 ? (
              <ul className="-mx-2 mt-3 flex flex-col">{abertos.map(item)}</ul>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                Nenhum pedido em andamento.
              </p>
            )}
            {encerrados.length > 0 && (
              <details className="group mt-4 border-t border-neutral-900/[0.06] pt-3">
                <summary className="cursor-pointer list-none rounded-xl py-1 text-sm font-medium text-neutral-600 hover:text-neutral-900">
                  Concluídos e cancelados ({encerrados.length})
                  <ChevronRight
                    className="ml-1 inline size-4 transition group-open:rotate-90"
                    aria-hidden
                  />
                </summary>
                <ul className="-mx-2 mt-2 flex flex-col">
                  {encerrados.map(item)}
                </ul>
              </details>
            )}
          </>
        )}
      </section>

      {documentos.length > 0 && (
        <section
          aria-labelledby="titulo-documentos"
          className="vidro rounded-[1.75rem] p-5 sm:p-6"
        >
          <h2 id="titulo-documentos" className="text-lg font-semibold">
            Documentos
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Laudos de vistoria da sua loja.
          </p>
          <ul className="mt-3 flex flex-col gap-1.5">
            {documentos.map((d) => {
              const conteudo = (
                <>
                  <FileText
                    className="size-4 shrink-0 text-neutral-500"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{d.nome}</span>
                  <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                    {dataDe(d.em)}
                  </span>
                </>
              );
              return (
                <li key={d.id}>
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2.5 text-sm font-medium transition hover:bg-white"
                    >
                      {conteudo}
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 rounded-xl bg-white/40 px-3 py-2.5 text-sm text-neutral-500">
                      {conteudo}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
