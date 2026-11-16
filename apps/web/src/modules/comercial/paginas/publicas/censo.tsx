import { situacaoDoLink } from "@arp/shared/comercial/censo";
import { formatarData, formatarDataHora } from "@arp/shared/formato";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarX, Link2Off } from "lucide-react";
import { Suspense, useEffect } from "react";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { useParametro } from "@/lib/navegacao";
import { Questionario } from "@/modules/comercial/components/censo/questionario";
import { consultaCensoPublico } from "../../api/censo";

// /censo/:token: questionário do Censo pelo link único da empresa, sem login
// (app/censo/[token]/page.tsx e o layout dela). O token é conferido na API a
// cada acesso e a cada envio; a página mostra só o convite daquele token.
// Responder de novo corrige a mesma resposta até a rodada fechar.

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
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <Suspense
          fallback={
            <TelaCarregando>
              <CartaoCarregando altura="h-32" />
              <CartaoCarregando altura="h-[40rem]" />
            </TelaCarregando>
          }
        >
          <Conteudo />
        </Suspense>
      </div>
      <p className="mx-auto mt-10 max-w-xl text-center text-xs text-neutral-500">
        Censo · Espaço ARP, Nova Friburgo
      </p>
    </div>
  );
}

function Conteudo() {
  const token = useParametro("token");
  const { data: c } = useSuspenseQuery(consultaCensoPublico(token));
  if ("motivo" in c)
    return (
      <Aviso
        icone={<Link2Off className="size-7" aria-hidden />}
        titulo="Este link não existe"
        texto="Confira se o endereço chegou inteiro. Se precisar de um link novo, fale com a administração do Espaço ARP."
      />
    );
  const situacao = situacaoDoLink(c.rodada, c.hoje);
  if (situacao !== "aberta")
    return (
      <Aviso
        icone={<CalendarX className="size-7" aria-hidden />}
        titulo={
          situacao === "antes"
            ? `O ${c.rodada.nome} começa em ${formatarData(c.rodada.inicio)}`
            : `O ${c.rodada.nome} está encerrado`
        }
        texto={
          situacao === "antes"
            ? "Volte a abrir este link a partir dessa data."
            : c.respondidaEm
              ? "A sua resposta foi registrada. Obrigado por participar!"
              : "A rodada fechou e o link não aceita mais respostas. Obrigado!"
        }
      />
    );

  return (
    <>
      <Topo />
      <section className="destaque flex flex-col gap-2 rounded-[1.75rem] p-5">
        <p className="text-xs font-medium tracking-[0.14em] text-[rgb(255_255_255/0.6)] uppercase">
          {c.rodada.nome} · até {formatarData(c.rodada.fim)}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {c.convite.empresa_nome}
        </h1>
        <p className="text-sm">
          Leva uns 3 minutos. As respostas ajudam a planejar o Espaço ARP.
        </p>
        {c.respondidaEm && (
          <p className="text-sm text-[rgb(255_255_255/0.75)]">
            Respondido em {formatarDataHora(c.respondidaEm).slice(0, 16)}. Pode
            corrigir até a rodada fechar.
          </p>
        )}
      </section>
      <section className="vidro rounded-[1.75rem] p-5">
        <Questionario
          modo="link"
          token={c.convite.token}
          opcoes={c.opcoes}
          diasPadrao={c.diasPadrao}
          inicial={c.inicial}
          corrigindo={!!c.respondidaEm}
        />
      </section>
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
          Censo das empresas do espaço
        </span>
      </span>
    </header>
  );
}

function Aviso({
  icone,
  titulo,
  texto,
}: {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <>
      <Topo />
      <div className="vidro flex flex-col items-center gap-4 rounded-[1.75rem] px-6 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-neutral-900 text-white">
          {icone}
        </span>
        <h1 className="text-xl font-semibold">{titulo}</h1>
        <p className="max-w-sm text-sm text-neutral-600">{texto}</p>
      </div>
    </>
  );
}
