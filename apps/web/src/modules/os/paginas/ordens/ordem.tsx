import { ROTAS_OS, rotaChamado } from "@arp/shared/os/rotas";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Protegido } from "@/components/protegido";
import { Link, Redirecionar, useParametro } from "@/lib/navegacao";
import { consultaDoChamado } from "@/modules/os/api";
import {
  DetalheCarregando,
  DetalheChamado,
} from "@/modules/os/components/chamado/detalhe";

// Página inteira da OS: o mesmo detalhe do chamado, com o bloco da OS
// (tempo, materiais, custos, terceirizado). Id de chamado vai para a
// página do chamado.
export default function Pagina() {
  return (
    <>
      <Link
        href={ROTAS_OS.ordens}
        className="mb-3 inline-flex min-h-10 items-center text-sm text-neutral-500 hover:text-neutral-900"
      >
        ← Ordens de serviço
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
  if (d && d.ch.tipo !== "os") return <Redirecionar para={rotaChamado(id)} />;
  return <DetalheChamado id={id} />;
}
