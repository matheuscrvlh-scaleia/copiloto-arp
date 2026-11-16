import {
  Outlet,
  type RouteObject,
  ScrollRestoration,
  useLocation,
  useRouteError,
} from "react-router";
import { AvisoDeErro } from "@/components/limite-de-erro";
import { NaoEncontrada } from "@/components/nao-encontrada";
import { Notificacoes } from "@/components/notificacoes";
import { INICIO } from "@/config/navigation";
import { Redirecionar } from "@/lib/navegacao";
import { ExigeSessao, ROTA_TROCAR_SENHA } from "@/lib/sessao";
import { Casca, CascaCarregando } from "./casca";
import { REDIRECIONAMENTOS, RedirecionamentoAntigo } from "./redirecionamentos";
import { type Modulo, paraRotaDoRoteador } from "./rota";

// Roteador do app. Os endereços são os mesmos do sistema antigo:
//
//   /login, /trocar-senha     telas de acesso (modules/acesso)
//   públicas dos módulos      sem casca e sem sessão (portal, links por token)
//   autenticadas dos módulos  dentro da casca, com sessão
//
// As telas vêm de app/modulos.ts; aqui não se registra tela de módulo. O
// roteador em si é criado em app/provedores.tsx.

/** Raiz de todas as telas: rolagem ao navegar e as notificações do canto. */
function Raiz() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
      <Notificacoes />
    </>
  );
}

/**
 * Último recurso: erro fora de uma tela (ex.: o arquivo da tela não baixou
 * porque saiu uma versão nova). Recarregar busca a versão atual.
 */
function ErroDaRaiz() {
  const erro = useRouteError();
  console.error(erro);
  return (
    <div className="mx-auto max-w-xl p-6">
      <AvisoDeErro
        erro={erro}
        rotulo="Recarregar a página"
        aoTentarDeNovo={() => window.location.reload()}
      />
    </div>
  );
}

/** Sessão obrigatória; enquanto ela chega, a moldura da casca já aparece. */
function Autenticado() {
  const trocando = useLocation().pathname === ROTA_TROCAR_SENHA;
  return (
    <ExigeSessao
      inicio={INICIO}
      carregando={trocando ? null : <CascaCarregando />}
    />
  );
}

/** Monta a árvore de rotas a partir da lista de módulos. */
export function montarRotas(modulos: Modulo[]): RouteObject[] {
  const publicas = modulos.flatMap((m) =>
    (m.publicas ?? []).map((r) => paraRotaDoRoteador(r, true)),
  );
  const autenticadas = modulos.flatMap((m) =>
    (m.autenticadas ?? []).map((r) => paraRotaDoRoteador(r, false)),
  );
  return [
    {
      path: "/",
      Component: Raiz,
      ErrorBoundary: ErroDaRaiz,
      HydrateFallback: () => null,
      children: [
        {
          path: "login",
          lazy: async () => ({
            Component: (await import("@/modules/acesso/login")).default,
          }),
        },
        ...publicas,
        {
          Component: Autenticado,
          children: [
            // Logado: "/" leva direto para a primeira tela (Gestão).
            { index: true, element: <Redirecionar para={INICIO} /> },
            {
              path: "trocar-senha",
              lazy: async () => ({
                Component: (await import("@/modules/acesso/trocar-senha"))
                  .default,
              }),
            },
            {
              Component: Casca,
              children: [
                ...autenticadas,
                ...REDIRECIONAMENTOS.map(({ de, para }) => ({
                  path: de,
                  element: <RedirecionamentoAntigo para={para} />,
                })),
                { path: "*", Component: NaoEncontrada },
              ],
            },
          ],
        },
      ],
    },
  ];
}
