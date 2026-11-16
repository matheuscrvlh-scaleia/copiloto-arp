import type { Modulo } from "@/app/rota";

// Telas de Relatórios (antigo Formulários). A permissão (formularios.ver ou
// formularios.editar, conforme a tela) é conferida dentro de cada página,
// como antes. O endereço antigo /formularios/* leva para cá
// (app/redirecionamentos.tsx).

export const relatorios: Modulo = {
  nome: "relatorios",
  autenticadas: [
    // app/(app)/relatorios/page.tsx
    {
      caminho: "relatorios",
      titulo: "Relatórios",
      pagina: () => import("./paginas/lista"),
    },
    // app/(app)/relatorios/[id]/page.tsx
    {
      caminho: "relatorios/:id",
      titulo: "Respostas do relatório",
      pagina: () => import("./paginas/respostas"),
    },
    // app/(app)/relatorios/[id]/arquivo/route.ts (agora na API)
    {
      caminho: "relatorios/:id/arquivo",
      pagina: () => import("./paginas/arquivo"),
    },
    // app/(app)/relatorios/[id]/configuracoes/page.tsx
    {
      caminho: "relatorios/:id/configuracoes",
      titulo: "Link e configurações",
      pagina: () => import("./paginas/configuracoes"),
    },
    // app/(app)/relatorios/[id]/editar/page.tsx
    {
      caminho: "relatorios/:id/editar",
      titulo: "Perguntas do relatório",
      pagina: () => import("./paginas/editar"),
    },
    // app/(app)/relatorios/[id]/previa/page.tsx
    {
      caminho: "relatorios/:id/previa",
      titulo: "Prévia do relatório",
      pagina: () => import("./paginas/previa"),
    },
    // app/(app)/relatorios/[id]/respostas/[resposta]/page.tsx
    {
      caminho: "relatorios/:id/respostas/:resposta",
      titulo: "Resposta do relatório",
      pagina: () => import("./paginas/resposta"),
    },
  ],
  publicas: [
    // app/responder/[token]: sem casca e sem sessão
    {
      caminho: "responder/:token",
      titulo: "Formulário",
      pagina: () => import("./paginas/responder"),
    },
  ],
};
