import { ROTA_PORTAL } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, Redirecionar, useParametro } from "@/lib/navegacao";
import { consultaDoNovoPedido } from "@/modules/os/api-portal";
import { IconeCatalogo } from "@/modules/os/components/configuracoes/icones";
import { FormularioPedido } from "@/modules/os/components/portal/publico/formulario-pedido";

// Novo pedido de uma categoria: campos do catálogo e, com agenda, só os
// horários livres (janela, limite do dia, bloqueios e o que já foi marcado).

export default function Novo() {
  const { data } = useSuspenseQuery(
    consultaDoNovoPedido(useParametro("categoria")),
  );
  const { loja, categoria, dias } = data;
  if (!loja) return <Redirecionar para={ROTA_PORTAL} />;
  const base = ROTA_PORTAL;

  const voltar = (
    <Link
      href={base}
      className="w-fit rounded-full px-1 text-sm text-neutral-500 hover:text-neutral-900"
    >
      ← {loja.nome}
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
            <p className="text-sm text-neutral-500">{loja.nome}</p>
          </div>
        </div>
        <FormularioPedido
          base={base}
          categoria={{
            id: categoria.id,
            nome: categoria.nome,
            orientacao: categoria.orientacao,
            campos: categoria.campos,
          }}
          dias={dias}
        />
      </section>
    </>
  );
}
