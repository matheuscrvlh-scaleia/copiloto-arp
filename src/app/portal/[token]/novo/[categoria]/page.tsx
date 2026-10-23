import Link from "next/link";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { IconeCatalogo } from "@/components/os/configuracoes/icones";
import { FormularioPedido } from "@/components/os/portal/publico/formulario-pedido";
import { LinkInativo } from "@/components/os/portal/publico/visual";
import { type DiaDaEscolha, paraEscolha } from "@/lib/os/portal";
import { rotaPortal } from "@/lib/os/rotas";
import { diasLivres } from "@/server/os/agenda";
import { osAdmin } from "@/server/os/base";
import { agendaDoPortal, categoriasDoPortal } from "@/server/os/portal-publico";
import { acessoDaPagina } from "../../acesso";

// Novo pedido de uma categoria: campos do catálogo e, com agenda, só os
// horários livres (janela, limite do dia, bloqueios e o que já foi marcado).

export default function Page({
  params,
}: PageProps<"/portal/[token]/novo/[categoria]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-[36rem]" />
        </TelaCarregando>
      }
    >
      <Novo params={params} />
    </Suspense>
  );
}

async function Novo({
  params,
}: Pick<PageProps<"/portal/[token]/novo/[categoria]">, "params">) {
  const { token, categoria: categoriaId } = await params;
  const acesso = await acessoDaPagina(token);
  if (!acesso) return <LinkInativo />;
  const base = rotaPortal(token);
  const categoria = (await categoriasDoPortal()).find(
    (c) => c.id === categoriaId,
  );

  const voltar = (
    <Link
      href={base}
      className="w-fit rounded-full px-1 text-sm text-neutral-500 hover:text-neutral-900"
    >
      ← {acesso.loja.nome}
    </Link>
  );
  if (!categoria)
    return (
      <>
        {voltar}
        <div className="vidro rounded-[1.75rem] p-6 text-sm text-neutral-600">
          Este tipo de pedido não está mais disponível. Volte e escolha outro.
        </div>
      </>
    );

  let dias: DiaDaEscolha[] | null = null;
  let orientacao = categoria.orientacao;
  if (categoria.agendaId) {
    const agenda = await agendaDoPortal(categoria.agendaId);
    dias = agenda
      ? paraEscolha(await diasLivres(osAdmin(), agenda, new Date()))
      : [];
    if (agenda?.orientacao && agenda.orientacao !== orientacao)
      orientacao = [orientacao, agenda.orientacao].filter(Boolean).join(" ");
  }

  return (
    <>
      {voltar}
      <section className="vidro rounded-[1.75rem] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-marca text-[#fff] shadow-sm">
            <IconeCatalogo nome={categoria.icone} className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">
              {categoria.nome}
            </h1>
            <p className="text-sm text-neutral-500">{acesso.loja.nome}</p>
          </div>
        </div>
        <FormularioPedido
          token={token}
          base={base}
          categoria={{
            id: categoria.id,
            nome: categoria.nome,
            orientacao,
            campos: categoria.campos,
          }}
          dias={dias}
        />
      </section>
    </>
  );
}
