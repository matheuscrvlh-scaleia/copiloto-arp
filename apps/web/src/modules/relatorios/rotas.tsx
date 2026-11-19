import type { Modulo } from "@/app/rota";

// Telas de Formulários (a pasta e a API ainda se chamam relatorios). A permissão (formularios.ver ou
// formularios.editar, conforme a tela) é conferida dentro de cada página,
// como antes. O endereço antigo /formularios/* leva para cá
// (app/redirecionamentos.tsx).

export const relatorios: Modulo = {
  nome: "relatorios",
  autenticadas: [
    // app/(app)/relatorios/page.tsx
    {
      caminho: "formularios",
      titulo: "Formulários",
      pagina: () => import("./paginas/lista"),
    },
    // app/(app)/relatorios/[id]/page.tsx
    {
      caminho: "formularios/:id",
      titulo: "Respostas do formulário",
      pagina: () => import("./paginas/respostas"),
    },
    // app/(app)/relatorios/[id]/arquivo/route.ts (agora na API)
    {
      caminho: "formularios/:id/arquivo",
      pagina: () => import("./paginas/arquivo"),
    },
    // app/(app)/relatorios/[id]/configuracoes/page.tsx
    {
      caminho: "formularios/:id/configuracoes",
      titulo: "Link e configurações",
      pagina: () => import("./paginas/configuracoes"),
    },
    // app/(app)/relatorios/[id]/editar/page.tsx
    {
      caminho: "formularios/:id/editar",
      titulo: "Perguntas do formulário",
      pagina: () => import("./paginas/editar"),
    },
    // app/(app)/relatorios/[id]/previa/page.tsx
    {
      caminho: "formularios/:id/previa",
      titulo: "Prévia do formulário",
      pagina: () => import("./paginas/previa"),
    },
    // app/(app)/relatorios/[id]/respostas/[resposta]/page.tsx
    {
      caminho: "formularios/:id/respostas/:resposta",
      titulo: "Resposta do formulário",
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
