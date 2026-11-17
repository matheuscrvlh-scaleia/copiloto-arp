import type { PaginaDaVistoria } from "@arp/shared/os/contratos/vistorias";
import { dataHoraBr } from "@arp/shared/os/relatorios";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, FileText, Link2Off, PenLine } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Assinatura } from "@/components/assinatura";
import { CartaoCarregando, TelaCarregando } from "@/components/carregando";
import { useParametro } from "@/lib/navegacao";
import {
  assinarVistoriaPeloLink,
  consultaDaVistoriaPublica,
  hrefDoLaudoPublico,
} from "@/modules/os/api-vistorias";

// /vistoria/:token: a vistoria para o locatário, sem login. Ele confere o
// laudo (ambientes, fotos, observações e o termo), marca que concorda e
// assina por último, depois da ARP. O token é conferido na API a cada
// acesso. Página pública, sem o menu do sistema (mesma moldura do link da
// OS).

export default function Pagina() {
  // O token está no endereço: nada de enviá-lo como origem para outros
  // sites, nem de indexar a página.
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
      for (const meta of metas) meta.remove();
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
              <CartaoCarregando altura="h-64" />
              <CartaoCarregando altura="h-56" />
            </TelaCarregando>
          }
        >
          <Conteudo />
        </Suspense>
      </div>
      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-neutral-500">
        Vistoria · Espaço ARP, Nova Friburgo
      </p>
    </div>
  );
}

function Conteudo() {
  const token = useParametro("token");
  const { data: p } = useSuspenseQuery(consultaDaVistoriaPublica(token));
  if (!p) return <LinkInativo />;

  return (
    <>
      <Topo />
      <section className="destaque flex flex-col gap-3 rounded-[1.75rem] p-5">
        <p className="text-xs font-medium tracking-[0.14em] text-[rgb(255_255_255/0.6)] uppercase">
          {p.tipo} · {p.codigo}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {p.unidade || "Vistoria"}
        </h1>
        <p className="text-sm">
          {p.locatario} · {p.data}
        </p>
        <a
          href={hrefDoLaudoPublico(p.token)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 self-start rounded-full bg-white px-4 py-2.5 text-sm font-medium text-neutral-900"
        >
          <FileText className="size-4" aria-hidden />
          Ver o laudo em PDF
        </a>
      </section>

      <Assinaturas p={p} />

      <section className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5">
        <h2 className="text-sm font-semibold">Ambientes</h2>
        <ol className="flex flex-col gap-5">
          {p.ambientes.map((a, i) => (
            <li key={a.id} className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {i + 1}. {a.titulo}
              </p>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">
                {a.texto}
              </p>
              {a.fotos.length > 0 && (
                <ul className="grid grid-cols-3 gap-2">
                  {a.fotos.map((f) => (
                    <li key={f.id}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square overflow-hidden rounded-2xl ring-1 ring-neutral-900/10"
                      >
                        <img
                          src={f.url}
                          alt={f.nome}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </section>

      {[
        ["Observação", p.observacao],
        ["Considerações adicionais", p.consideracoes],
        ["Termo de responsabilidade", p.termo],
      ].map(([titulo, texto]) =>
        texto?.trim() ? (
          <section
            key={titulo}
            className="vidro flex flex-col gap-2 rounded-[1.75rem] p-5"
          >
            <h2 className="text-sm font-semibold">{titulo}</h2>
            <p className="whitespace-pre-wrap text-sm text-neutral-700">
              {texto}
            </p>
          </section>
        ) : null,
      )}

      {!p.assinado && !p.motivo && (
        <section className="vidro flex flex-col gap-4 rounded-[1.75rem] p-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <PenLine className="size-4" aria-hidden />
              Assinar o laudo
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {p.localData || "Confira tudo acima antes de assinar."}
            </p>
          </div>
          <AssinarVistoria token={p.token} nome={p.locatario} />
        </section>
      )}
    </>
  );
}

/** A da ARP (locador) e a do locatário, ou o que falta. */
function Assinaturas({ p }: { p: PaginaDaVistoria }) {
  return (
    <section className="vidro grid grid-cols-1 gap-4 rounded-[1.75rem] p-5 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-neutral-600">Locador (ARP)</p>
        <div className="grid h-24 place-items-center rounded-2xl border border-neutral-200 bg-white">
          {p.assinaturaLocador ? (
            <img
              src={p.assinaturaLocador}
              alt={`Assinatura de ${p.locador}`}
              className="max-h-20 max-w-full object-contain"
            />
          ) : (
            <span className="text-xs text-neutral-500">Aguardando</span>
          )}
        </div>
        <p className="text-xs text-neutral-500">{p.locador}</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-neutral-600">Locatário(a)</p>
        {p.assinado ? (
          <p className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-green-50 text-center text-sm text-green-800">
            <Check className="size-5" aria-hidden />
            Assinado
            {p.assinado.em && ` em ${dataHoraBr(p.assinado.em).slice(0, 16)}`}
          </p>
        ) : (
          <p className="grid h-24 place-items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-3 text-center text-xs text-neutral-500">
            {p.motivo ?? "Falta a sua assinatura, no fim desta página."}
          </p>
        )}
        <p className="text-xs text-neutral-500">
          {p.assinado
            ? [p.assinado.nome, p.assinado.documento]
                .filter(Boolean)
                .join(" · ")
            : p.locatario}
        </p>
      </div>
    </section>
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
          Laudo de vistoria para assinar
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
          A vistoria foi cancelada ou o link não existe. Se precisar de algo,
          fale com a administração do Espaço ARP.
        </p>
      </div>
    </>
  );
}

// "Li e concordo" e a assinatura do locatário (nome, CPF/CNPJ e o quadro).
// O quadro só abre depois de marcar que concorda.

function AssinarVistoria({ token, nome }: { token: string; nome: string }) {
  const [concordo, setConcordo] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
        <input
          type="checkbox"
          checked={concordo}
          onChange={(e) => setConcordo(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-neutral-900"
        />
        <span>
          Li o laudo e o termo de responsabilidade e concordo com o estado do
          imóvel aqui descrito.
        </span>
      </label>
      <Assinatura
        acao={assinarVistoriaPeloLink}
        campos={{ token, concordo: concordo ? "1" : "" }}
        podeEditar
        documento
        bloqueio={
          concordo ? null : "Marque que leu e concorda para assinar o laudo."
        }
        rotuloSalvar="Assinar o laudo"
        atual={null}
        nomeSugerido={nome}
      />
    </div>
  );
}
