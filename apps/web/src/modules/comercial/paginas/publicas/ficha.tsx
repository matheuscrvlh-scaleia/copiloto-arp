import type { MotivoInativo } from "@arp/shared/comercial/contratos/fichas";
import { lerRespostas, respostasVazias } from "@arp/shared/comercial/ficha";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarX2, CircleCheck, Link2Off } from "lucide-react";
import { Suspense, useEffect } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { useParametro } from "@/lib/navegacao";
import { FormularioFicha } from "@/modules/comercial/components/fichas/formulario";
import { consultaFichaPublica } from "../../api/fichas";

// /ficha/:token: a ficha cadastral pelo link único, sem login (spec 4.12 e
// 6), sem o menu do sistema (app/ficha/[token]/page.tsx e o layout dela):
// quem abre vê só a própria ficha. O token é conferido na API a cada acesso
// e a cada gravação; link vencido, cancelado ou já enviado mostra o motivo.

export default function Page() {
  // O token está no endereço: nada de enviá-lo como origem para outros sites.
  useEffect(() => {
    const metas = [
      ["referrer", "no-referrer"],
      ["robots", "noindex, nofollow"],
    ].map(([nome, conteudo]) => {
      const meta = document.createElement("meta");
      meta.name = nome ?? "";
      meta.content = conteudo ?? "";
      document.head.append(meta);
      return meta;
    });
    return () => {
      for (const m of metas) m.remove();
    };
  }, []);
  return (
    <div className="min-h-dvh px-4 py-5 sm:py-8">
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Suspense
          fallback={
            <TelaCarregando>
              <CartaoCarregando altura="h-40" />
              <CartaoCarregando altura="h-56" />
              <CartaoCarregando altura="h-72" />
            </TelaCarregando>
          }
        >
          <Conteudo />
        </Suspense>
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-neutral-500">
        Ficha cadastral · Espaço ARP, Nova Friburgo
      </p>
    </div>
  );
}

function Conteudo() {
  const token = useParametro("token");
  const { data: p } = useSuspenseQuery(consultaFichaPublica(token));
  if ("motivo" in p) return <LinkInativo motivo={p.motivo} />;
  const { ficha } = p;
  return (
    <>
      <Topo />
      <FormularioFicha
        token={ficha.token}
        inicial={
          ficha.respostas === null
            ? respostasVazias(ficha.luc, ficha.tipo)
            : lerRespostas(ficha.respostas)
        }
        boasVindas={p.textos.boasVindas}
        termoLgpd={p.textos.termoLgpd}
        documentos={p.documentos}
        enviados={ficha.documentos}
        lucs={p.lucs}
        lucDoLink={ficha.luc}
        hoje={p.hoje}
      />
    </>
  );
}

function Topo() {
  return (
    <header className="flex items-center gap-2.5">
      <img
        src="/brand/logo.png"
        alt="ARP"
        width={36}
        height={36}
        className="rounded-xl"
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
