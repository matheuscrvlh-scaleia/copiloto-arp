import type { Modulo } from "@/app/rota";

// Telas do Calendário. A permissão é conferida dentro de cada página (o
// cabeçalho aparece mesmo sem acesso, como antes).

export const calendario: Modulo = {
  nome: "calendario",
  autenticadas: [
    // app/(app)/calendario/page.tsx
    {
      caminho: "calendario",
      titulo: "Agenda",
      pagina: () => import("./paginas/agenda"),
    },
    // app/(app)/calendario/configuracoes/page.tsx
    {
      caminho: "calendario/configuracoes",
      titulo: "Tipos de item",
      pagina: () => import("./paginas/configuracoes"),
    },
  ],
};
