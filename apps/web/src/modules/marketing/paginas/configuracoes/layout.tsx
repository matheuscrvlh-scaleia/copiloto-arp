import { PageHeader } from "@/components/page-header";
import { Filhas, Link, usePathname } from "@/lib/navegacao";

// app/(app)/marketing/configuracoes/layout.tsx (e abas.tsx)

const BASE = "/marketing/configuracoes";

const ABAS = [
  { href: BASE, rotulo: "Cadastros e regras" },
  { href: `${BASE}/visualizacao`, rotulo: "Visualização" },
  { href: `${BASE}/historico`, rotulo: "Histórico" },
];

export default function Layout() {
  return (
    <>
      <PageHeader
        title="Configurações do Marketing"
        description="Tudo o que as ferramentas não entregam e o Marketing informa: cadastros, metas, regras de alerta (os acessos às ferramentas ficam em Administração › Configurações › Integrações). Cada alteração fica no histórico, com a opção de voltar."
      />
      <div className="mb-6">
        <AbasConfiguracoes />
      </div>
      <Filhas />
    </>
  );
}

/** Subtelas das Configurações do Marketing: a ativa fica escura. */
function AbasConfiguracoes() {
  const atual = usePathname();
  return (
    <nav
      aria-label="Seções das configurações do Marketing"
      className="vidro flex w-full gap-1 overflow-x-auto rounded-full p-1 sm:w-fit"
    >
      {ABAS.map((a) => {
        const ativa =
          a.href === BASE
            ? atual === BASE
            : atual === a.href || atual.startsWith(`${a.href}/`);
        return (
          <Link
            key={a.href}
            href={a.href}
            data-guia="aba"
            data-guia-titulo={a.rotulo}
            aria-current={ativa ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition ${
              ativa
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:bg-white/60 hover:text-neutral-900"
            }`}
          >
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
