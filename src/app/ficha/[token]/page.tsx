import { CalendarX2, CircleCheck, Link2Off } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormularioFicha } from "@/components/comercial/fichas/formulario";
import { respostasVazias } from "@/lib/comercial/ficha";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { type MotivoInativo, paginaDaFicha } from "@/server/comercial/fichas";

// Ficha cadastral pelo link único, sem login (spec 4.12 e 6): quem abre vê
// só a própria ficha. O token é conferido no servidor a cada acesso e a
// cada gravação; link vencido, cancelado ou já enviado mostra o motivo.

export default function Page({ params }: PageProps<"/ficha/[token]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-56" />
          <CartaoCarregando altura="h-72" />
        </TelaCarregando>
      }
    >
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({
  params,
}: Pick<PageProps<"/ficha/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const p = await paginaDaFicha(token);
  if ("motivo" in p) return <LinkInativo motivo={p.motivo} />;
  const { ficha } = p;
  return (
    <>
      <Topo />
      <FormularioFicha
        token={ficha.token}
        inicial={ficha.respostas ?? respostasVazias(ficha.luc, ficha.tipo)}
        boasVindas={p.textos.boasVindas}
        termoLgpd={p.textos.termoLgpd}
        documentos={p.documentos}
        enviados={ficha.documentos}
        lucs={p.lucs}
        lucDoLink={ficha.luc}
        hoje={hojeEmBrasilia(new Date())}
      />
    </>
  );
}

function Topo() {
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
        <span className="block font-semibold text-neutral-900">ARP</span>
        <span className="block text-xs text-neutral-500">
          Ficha cadastral para locação
        </span>
      </span>
    </header>
  );
}

const MOTIVO: Record<
  MotivoInativo,
  { titulo: string; texto: string; icone: typeof Link2Off }
> = {
  inexistente: {
    titulo: "Este link não existe",
    texto:
      "Confira se o endereço está completo, como a ARP enviou. Se precisar, peça um novo link à equipe.",
    icone: Link2Off,
  },
  expirada: {
    titulo: "Este link venceu",
    texto:
      "O prazo para preencher a ficha terminou. Peça à equipe da ARP para reenviar o link: o que você salvou continua guardado.",
    icone: CalendarX2,
  },
  cancelada: {
    titulo: "Este link foi cancelado",
    texto:
      "A ARP cancelou este link. Se ainda quiser enviar a ficha, fale com a equipe para receber um novo.",
    icone: Link2Off,
  },
  enviada: {
    titulo: "Ficha já enviada",
    texto:
      "Recebemos a sua ficha. Obrigado! Para corrigir algo, fale com a equipe da ARP.",
    icone: CircleCheck,
  },
};

function LinkInativo({ motivo }: { motivo: MotivoInativo }) {
  const m = MOTIVO[motivo];
  const Icone = m.icone;
  return (
    <>
      <Topo />
      <div className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-neutral-900 text-white">
          <Icone className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold">{m.titulo}</h1>
        <p className="max-w-sm text-sm text-neutral-600">{m.texto}</p>
      </div>
    </>
  );
}
