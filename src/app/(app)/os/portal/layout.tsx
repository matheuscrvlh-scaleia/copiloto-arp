import { Suspense } from "react";
import { Abas as AbasDaTela } from "@/components/os/abas";
import { LinkDoPortal } from "@/components/os/portal/acoes-link";
import { PageHeader } from "@/components/page-header";
import { contexto } from "@/server/os/base";
import { urlDoPortal } from "@/server/os/portal";

// Portal lojista: links das lojas, cadastro das lojas (até o ENET) e as
// agendas (telhado e outras) com bloqueios e remarcação.

export default function Layout({ children }: LayoutProps<"/os/portal">) {
  return (
    <>
      <PageHeader
        title="Portal lojista"
        description="Cada loja abre e acompanha os pedidos por um link próprio, sem senha. Aqui você gera e envia os links, cuida do cadastro das lojas e das agendas, como a do telhado."
      />
      <Suspense
        fallback={
          <div className="vidro mb-6 h-11 w-80 max-w-full rounded-full" />
        }
      >
        <Topo />
      </Suspense>
      {children}
    </>
  );
}

// Abas à esquerda e, para quem cuida dos links, o link do portal à direita.
async function Topo() {
  const ctx = await contexto();
  const abas = [
    ...(ctx.pode("os.portal")
      ? [
          { href: "/os/portal", rotulo: "Links das lojas" },
          { href: "/os/portal/lojas", rotulo: "Lojas (contratos)" },
        ]
      : []),
    ...(ctx.pode("os.portal_agenda")
      ? [{ href: "/os/portal/agendas", rotulo: "Agendas" }]
      : []),
  ];
  const link = ctx.pode("os.portal");
  if (abas.length < 2 && !link) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      {abas.length > 1 && (
        <AbasDaTela abas={abas} rotulo="Seções de Portal lojista" />
      )}
      {link && <LinkDoPortal url={urlDoPortal()} />}
    </div>
  );
}
