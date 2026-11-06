import { CalendarX2, Link2Off, PencilRuler } from "lucide-react";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { FormularioPublico } from "@/components/formularios/formulario-publico";
import type { MotivoFechado } from "@/lib/formularios/formulario";
import { formularioPeloToken } from "@/server/formularios/base";

// Formulário pelo link, sem login. O token é conferido no servidor a cada
// acesso e a cada envio; link de rascunho, encerrado ou inexistente mostra
// o motivo.

export default function Page({ params }: PageProps<"/responder/[token]">) {
  return (
    <Suspense
      fallback={
        <TelaCarregando>
          <CartaoCarregando altura="h-32" />
          <CartaoCarregando altura="h-40" />
          <CartaoCarregando altura="h-40" />
        </TelaCarregando>
      }
    >
      <Conteudo params={params} />
    </Suspense>
  );
}

async function Conteudo({
  params,
}: Pick<PageProps<"/responder/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const p = await formularioPeloToken(token);
  if ("motivo" in p) return <LinkFechado motivo={p.motivo} />;
  const f = p.formulario;
  return (
    <>
      <Topo />
      <FormularioPublico
        titulo={f.titulo}
        descricao={f.descricao}
        campos={f.campos}
        mensagemFinal={f.mensagem_final}
        token={f.token}
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
      <span className="text-sm font-semibold leading-tight text-neutral-900">
        ARP
      </span>
    </header>
  );
}

const MOTIVO: Record<
  MotivoFechado,
  { titulo: string; texto: string; icone: typeof Link2Off }
> = {
  inexistente: {
    titulo: "Este link não existe",
    texto:
      "Confira se o endereço está completo, como você recebeu. Se precisar, peça o link de novo a quem enviou.",
    icone: Link2Off,
  },
  rascunho: {
    titulo: "Formulário ainda não aberto",
    texto:
      "Este formulário ainda está sendo preparado. Tente de novo mais tarde.",
    icone: PencilRuler,
  },
  encerrado: {
    titulo: "Formulário encerrado",
    texto:
      "Este formulário não recebe mais respostas. Obrigado pelo interesse!",
    icone: CalendarX2,
  },
};

function LinkFechado({ motivo }: { motivo: MotivoFechado }) {
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
