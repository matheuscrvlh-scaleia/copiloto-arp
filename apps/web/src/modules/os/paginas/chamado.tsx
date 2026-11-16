import { ROTAS_OS, rotaOrdem } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { Link, Redirecionar, useParametro } from "@/lib/navegacao";
import { consultaDoChamado } from "@/modules/os/api";
import {
  DetalheCarregando,
  DetalheChamado,
} from "@/modules/os/components/chamado/detalhe";

// Página inteira do chamado (a mesma visão da janela lateral das listas).
// Id de OS (link antigo, notificação de antes da separação): vai para a
// página da OS.
export default function Pagina() {
  return (
    <>
      <Link
        href={ROTAS_OS.caixa}
        className="mb-3 inline-flex min-h-10 items-center text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Minha caixa
      </Link>
      <Suspense fallback={<DetalheCarregando />}>
        <Protegido permissao="os.acessar">
          <Conteudo />
        </Protegido>
      </Suspense>
    </>
  );
}

function Conteudo() {
  const id = useParametro("id");
  // A mesma leitura do detalhe (a consulta é uma só): não lê duas vezes.
  const { data: d } = useSuspenseQuery(consultaDoChamado(id));
  if (d?.ch.tipo === "os") return <Redirecionar para={rotaOrdem(id)} />;
  return <DetalheChamado id={id} />;
}
