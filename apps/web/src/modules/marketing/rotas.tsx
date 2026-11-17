import type { Modulo } from "@/app/rota";

// Telas do Marketing. A permissão é conferida dentro de cada página (o
// cabeçalho aparece mesmo sem acesso, como antes). Configurações, Marca e
// Reputação acrescentam as suas aqui.

export const marketing: Modulo = {
  nome: "marketing",
  autenticadas: [
    // app/(app)/marketing/page.tsx
    {
      caminho: "marketing",
      titulo: "Painel do Marketing",
      pagina: () => import("./paginas/painel"),
    },
    // app/(app)/marketing/anuncios/page.tsx
    {
      caminho: "marketing/anuncios",
      titulo: "Performance de anúncios",
      pagina: () => import("./paginas/anuncios"),
    },
    // app/(app)/marketing/anuncios/[id]/page.tsx
    {
      caminho: "marketing/anuncios/:id",
      titulo: "Detalhe da campanha",
      pagina: () => import("./paginas/campanha"),
    },
    // app/(app)/marketing/site/page.tsx
    {
      caminho: "marketing/site",
      titulo: "Site e leads",
      pagina: () => import("./paginas/site"),
    },
    // app/(app)/marketing/redes/page.tsx
    {
      caminho: "marketing/redes",
      titulo: "Redes sociais",
      pagina: () => import("./paginas/redes"),
    },
    // app/(app)/marketing/publico/page.tsx
    {
      caminho: "marketing/publico",
      titulo: "Público e visitação",
      pagina: () => import("./paginas/publico"),
    },
    // app/(app)/marketing/eventos/page.tsx
    {
      caminho: "marketing/eventos",
      titulo: "Eventos",
      pagina: () => import("./paginas/eventos"),
    },
    // app/(app)/marketing/radar/page.tsx
    {
      caminho: "marketing/radar",
      titulo: "Radar operacional",
      pagina: () => import("./paginas/radar"),
    },
    // app/(app)/marketing/reputacao/page.tsx
    {
      caminho: "marketing/reputacao",
      titulo: "Reputação",
      pagina: () => import("./paginas/reputacao"),
    },
    // app/(app)/marketing/reputacao/[id]/page.tsx
    {
      caminho: "marketing/reputacao/:id",
      titulo: "Avaliações do locatário",
      pagina: () => import("./paginas/reputacao-local"),
    },
    // app/(app)/marketing/marca/page.tsx
    {
      caminho: "marketing/marca",
      titulo: "Marca",
      pagina: () => import("./paginas/marca"),
    },
    // app/(app)/marketing/configuracoes/layout.tsx
    {
      caminho: "marketing/configuracoes",
      pagina: () => import("./paginas/configuracoes/layout"),
      filhas: [
        // app/(app)/marketing/configuracoes/page.tsx
        {
          indice: true,
          titulo: "Configurações do Marketing",
          pagina: () => import("./paginas/configuracoes/cadastros"),
        },
        // app/(app)/marketing/configuracoes/visualizacao/page.tsx
        {
          caminho: "visualizacao",
          titulo: "Visualização do Marketing",
          pagina: () => import("./paginas/configuracoes/visualizacao"),
        },
        // Mudou para Administração › Configurações › Integrações.
        {
          caminho: "integracoes",
          titulo: "Integrações do Marketing",
          pagina: () => import("@/modules/admin/paginas/para-integracoes"),
        },
        // app/(app)/marketing/configuracoes/historico/page.tsx
        {
          caminho: "historico",
          titulo: "Histórico do Marketing",
          pagina: () => import("./paginas/configuracoes/historico"),
        },
      ],
    },
  ],
};
