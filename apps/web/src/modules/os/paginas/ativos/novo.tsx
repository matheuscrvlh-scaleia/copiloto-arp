import { ROTAS_OS } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { PageHeader } from "@/components/page-header";
import { Protegido } from "@/components/protegido";
import { Link, useNavegar } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { consultaDasOpcoes, salvarAtivo } from "@/modules/os/api-ativos";
import { FormAtivo } from "@/modules/os/components/ativos/form-ativo";

// /os/ativos/novo: cadastro de um ativo (depois abre a ficha).

export default function Pagina() {
  return (
    <>
      <Link
        href={ROTAS_OS.ativos}
        className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Ativos
      </Link>
      <PageHeader
        title="Novo ativo"
        description="Só o nome é obrigatório; complete o resto quando tiver. Sem reposição, vida útil e compra, o sinal de troca não sai."
      />
      <Suspense
        fallback={
          <TelaCarregando>
            <CartaoCarregando altura="h-[48rem]" />
          </TelaCarregando>
        }
      >
        <Protegido permissao="os.ativos_gerenciar">
          <Formulario />
        </Protegido>
      </Suspense>
    </>
  );
}

function Formulario() {
  const verCustos = usePermissao("os.custos");
  const navegar = useNavegar();
  const acao = useMemo(() => salvarAtivo(navegar.push), [navegar]);
  const { data: opcoes } = useSuspenseQuery(consultaDasOpcoes);
  return <FormAtivo acao={acao} verCustos={verCustos} {...opcoes} />;
}
