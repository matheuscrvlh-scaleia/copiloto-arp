import type { Modulo } from "@/app/rota";

// Telas do Tickets (módulo `os`). Tudo fica dentro do layout de /os (o botão
// "+ Novo" de todas as telas): cada área acrescenta as suas telas em
// `filhas`, com o caminho relativo a "os". A permissão é conferida dentro de
// cada página (o cabeçalho aparece mesmo sem acesso, como antes).

export const os: Modulo = {
  nome: "os",
  autenticadas: [
    {
      // app/(app)/os/layout.tsx
      caminho: "os",
      pagina: () => import("./paginas/layout"),
      filhas: [
        // app/(app)/os/page.tsx
        {
          indice: true,
          titulo: "Minha caixa",
          pagina: () => import("./paginas/caixa"),
        },
        // app/(app)/os/chamados/[id]/page.tsx
        {
          caminho: "chamados/:id",
          titulo: "Chamado",
          pagina: () => import("./paginas/chamado"),
        },
        // app/(app)/os/chamados/[id]/imprimir/page.tsx
        {
          caminho: "chamados/:id/imprimir",
          titulo: "Imprimir chamado",
          pagina: () => import("./paginas/chamado-imprimir"),
        },
        // app/(app)/os/novo/page.tsx
        {
          caminho: "novo",
          titulo: "Novo chamado",
          pagina: () => import("./paginas/novo"),
        },
        // app/(app)/os/quadro/page.tsx
        {
          caminho: "quadro",
          titulo: "Quadro",
          pagina: () => import("./paginas/quadro"),
        },
        // app/(app)/os/meu-setor/page.tsx
        {
          caminho: "meu-setor",
          titulo: "Geral",
          pagina: () => import("./paginas/meu-setor"),
        },
        // app/(app)/os/avisos/page.tsx
        {
          caminho: "avisos",
          titulo: "Avisos",
          pagina: () => import("./paginas/avisos"),
        },
        // app/(app)/os/calendario/page.tsx
        {
          caminho: "calendario",
          titulo: "Calendário",
          pagina: () => import("./paginas/calendario"),
        },
        // app/(app)/os/disparos/page.tsx
        {
          caminho: "disparos",
          titulo: "Disparos e lembretes",
          pagina: () => import("./paginas/disparos"),
        },
      ],
    },
  ],
};
