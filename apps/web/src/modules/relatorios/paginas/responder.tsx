import type { MotivoFechado } from "@arp/shared/formularios/formulario";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarX2, Link2Off, PencilRuler } from "lucide-react";
import { Suspense, useEffect } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { useParametro } from "@/lib/navegacao";
import { consultaDoLink } from "../api";
import { FormularioPublico } from "../components/formulario-publico";

// /responder/:token: o formulário pelo link, sem login e sem o menu do
// sistema (mesma moldura da ficha cadastral). O token é conferido na API a
// cada acesso e a cada envio; link de rascunho, encerrado ou inexistente
// mostra o motivo.

export default function Pagina() {
  // O token está no endereço: nada de enviá-lo como origem para outros sites.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "referrer";
    meta.content = "no-referrer";
    document.head.append(meta);
    return () => meta.remove();
  }, []);
  return (
    <div className="min-h-dvh px-4 py-5 sm:py-8">
      <div aria-hidden className="aurora">
        <i />
        <i />
        <i />
      </div>
      <div className="relative mx-auto flex max-w-2xl flex-col gap-4">
        <Suspense
          fallback={
            <TelaCarregando>
              <CartaoCarregando altura="h-32" />
              <CartaoCarregando altura="h-40" />
              <CartaoCarregando altura="h-40" />
            </TelaCarregando>
          }
        >
          <Conteudo />
        </Suspense>
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-neutral-500">
        Espaço ARP, Nova Friburgo
      </p>
    </div>
  );
}

function Conteudo() {
  const token = useParametro("token");
  const { data } = useSuspenseQuery(consultaDoLink(token));
  if ("motivo" in data) return <LinkFechado motivo={data.motivo} />;
  const f = data.formulario;
  return (
    <>
      <Topo />
      <FormularioPublico
        titulo={f.titulo}
        descricao={f.descricao}
        campos={f.campos}
        mensagemFinal={f.mensagem_final}
        token={f.token}
        cor={f.cor}
        paginar={f.paginas}
        redirecionarPara={f.redirecionar_para}
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
