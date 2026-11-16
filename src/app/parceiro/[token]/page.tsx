import { Link2Off } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { formatarMes } from "@/lib/formato";
import { mesDeBrasilia } from "@/lib/sustentabilidade/programas-link";
import {
  acessoDoParceiro,
  paginaDoParceiro,
  registrarAcesso,
} from "@/server/sustentabilidade/parceiro";
import { AreaDoParceiro } from "./area";

// Link do parceiro (spec 4.8), sem login: ele vê SÓ o formulário publicado
// do programa e o que este link lançou no mês, e corrige até o fim do mês.
// Nada de indicadores, painel, menu, outros programas ou clientes. O token
// é conferido no servidor (hash no banco) a cada acesso e a cada envio.

export default function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-20" />
          <CartaoCarregando altura="h-96" />
        </TelaCarregando>
      }
    >
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const acesso = await acessoDoParceiro(token);
  if (!acesso) return <LinkInativo />;
  registrarAcesso(acesso.linkId);
  const agora = new Date();
  const p = await paginaDoParceiro(acesso, agora);
  return (
    <>
      <Topo programa={p.programa} />
      <AreaDoParceiro
        token={token}
        mes={formatarMes(mesDeBrasilia(agora))}
        formularios={p.formularios}
        versoes={p.versoes}
        lancamentos={p.lancamentos}
        listas={p.listas}
      />
    </>
  );
}

function Topo({ programa }: { programa?: string }) {
  return (
    <header className="flex items-center gap-2.5">
      <Image
        src="/brand/logo.png"
        alt="ARP"
        width={36}
        height={36}
        className="rounded-xl"
        priority
      />
      <span className="text-sm leading-tight">
        <span className="block font-semibold text-neutral-900">
          {programa ?? "ARP"}
        </span>
        <span className="block text-xs text-neutral-500">
          Lançamento do parceiro · Espaço ARP
        </span>
      </span>
    </header>
  );
}

function LinkInativo() {
  return (
    <>
      <Topo />
      <div className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-neutral-900 text-white">
          <Link2Off className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">Este link não está mais ativo</h1>
        <p className="max-w-sm text-sm text-neutral-600">
          Fale com a equipe da ARP para receber um novo link de lançamento.
        </p>
      </div>
    </>
  );
}
