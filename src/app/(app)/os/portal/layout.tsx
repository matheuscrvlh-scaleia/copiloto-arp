import { Suspense } from "react";
import { AbasDoPortal } from "@/components/os/portal/abas";
import { PageHeader } from "@/components/page-header";
import { contexto } from "@/server/os/base";

// Portal e agenda: links das lojas, cadastro das lojas (até o ENET) e as
// agendas (telhado e outras) com bloqueios e remarcação.

export default function Layout({ children }: LayoutProps<"/os/portal">) {
  return (
    <>
      <PageHeader
        title="Portal e agenda"
        description="Cada loja abre e acompanha os pedidos por um link próprio, sem senha. Aqui você gera e envia os links, cuida do cadastro das lojas e das agendas, como a do telhado."
      />
      <div className="mb-6">
        <Suspense
          fallback={<div className="vidro h-11 w-80 max-w-full rounded-full" />}
        >
          <Abas />
        </Suspense>
      </div>
      {children}
    </>
  );
}

async function Abas() {
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
  if (abas.length < 2) return null;
  return <AbasDoPortal abas={abas} />;
}
