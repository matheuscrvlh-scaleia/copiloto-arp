import { ROTA_PORTAL } from "@arp/shared/os/rotas";
import { Abas as AbasDaTela } from "@/components/abas";
import { PageHeader } from "@/components/page-header";
import { Filhas } from "@/lib/navegacao";
import { usePermissao } from "@/lib/sessao";
import { LinkDoPortal } from "@/modules/os/components/portal/acoes-link";

// Portal lojista: links das lojas, cadastro das lojas (até o ENET) e as
// agendas (telhado e outras) com bloqueios e remarcação.

export default function Layout() {
  return (
    <>
      <PageHeader
        title="Portal lojista"
        description="Cada loja abre e acompanha os pedidos por um link próprio, sem senha. Aqui você gera e envia os links, cuida do cadastro das lojas e das agendas, como a do telhado."
      />
      <Topo />
      <Filhas />
    </>
  );
}

// Abas à esquerda e, para quem cuida dos links, o link do portal à direita.
function Topo() {
  const portal = usePermissao("os.portal");
  const agenda = usePermissao("os.portal_agenda");
  const abas = [
    ...(portal
      ? [
          { href: "/os/portal", rotulo: "Links das lojas" },
          { href: "/os/portal/lojas", rotulo: "Lojas (contratos)" },
        ]
      : []),
    ...(agenda ? [{ href: "/os/portal/agendas", rotulo: "Agendas" }] : []),
  ];
  if (abas.length < 2 && !portal) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      {abas.length > 1 && (
        <AbasDaTela abas={abas} rotulo="Seções de Portal lojista" />
      )}
      {/* O portal sai do mesmo endereço do sistema. */}
      {portal && (
        <LinkDoPortal url={`${window.location.origin}${ROTA_PORTAL}`} />
      )}
    </div>
  );
}
