import type { Modulo } from "@/app/rota";

// Telas do Comercial (parte A). A permissão é conferida dentro de cada
// página (o cabeçalho aparece mesmo sem acesso, como antes). A parte B
// (censo, fichas, kit, eventos, pesquisa e as telas públicas por token)
// acrescenta as suas aqui.

export const comercial: Modulo = {
  nome: "comercial",
  autenticadas: [
    // app/(app)/comercial/page.tsx
    {
      caminho: "comercial",
      titulo: "Painel comercial",
      pagina: () => import("./paginas/painel"),
    },
    // app/(app)/comercial/funil/page.tsx
    {
      caminho: "comercial/funil",
      titulo: "Funil comercial",
      pagina: () => import("./paginas/funil"),
    },
    // app/(app)/comercial/ocupacao/page.tsx
    {
      caminho: "comercial/ocupacao",
      titulo: "Ocupação e estoque",
      pagina: () => import("./paginas/ocupacao"),
    },
    // app/(app)/comercial/ocupacao/[luc]/page.tsx
    {
      caminho: "comercial/ocupacao/:luc",
      titulo: "LUC",
      pagina: () => import("./paginas/luc"),
    },
    // app/(app)/comercial/vencimentos/page.tsx
    {
      caminho: "comercial/vencimentos",
      titulo: "Vencimentos de contrato",
      pagina: () => import("./paginas/vencimentos"),
    },
    // app/(app)/comercial/vencimentos/[contrato]/page.tsx
    {
      caminho: "comercial/vencimentos/:contrato",
      titulo: "Contrato",
      pagina: () => import("./paginas/vencimento"),
    },
    // app/(app)/comercial/relacionamento/page.tsx
    {
      caminho: "comercial/relacionamento",
      titulo: "Relacionamento",
      pagina: () => import("./paginas/relacionamento"),
    },
    // app/(app)/comercial/relacionamento/contatos/novo/page.tsx
    {
      caminho: "comercial/relacionamento/contatos/novo",
      titulo: "Registrar contato",
      pagina: () => import("./paginas/contato-novo"),
    },
    // app/(app)/comercial/relacionamento/contatos/[id]/page.tsx
    {
      caminho: "comercial/relacionamento/contatos/:id",
      titulo: "Contato com locatário",
      pagina: () => import("./paginas/contato"),
    },
    // app/(app)/comercial/contratos/page.tsx
    {
      caminho: "comercial/contratos",
      titulo: "Contratos",
      pagina: () => import("./paginas/contratos"),
    },
    // app/(app)/comercial/contratos/novo/page.tsx
    {
      caminho: "comercial/contratos/novo",
      titulo: "Novo contrato",
      pagina: () => import("./paginas/contrato-novo"),
    },
    // app/(app)/comercial/contratos/distrato/novo/page.tsx
    {
      caminho: "comercial/contratos/distrato/novo",
      titulo: "Novo distrato",
      pagina: () => import("./paginas/distrato-novo"),
    },
    // app/(app)/comercial/contratos/[id]/page.tsx
    {
      caminho: "comercial/contratos/:id",
      titulo: "Contrato",
      pagina: () => import("./paginas/contrato"),
    },
    // app/(app)/comercial/configuracoes/layout.tsx
    {
      caminho: "comercial/configuracoes",
      pagina: () => import("./paginas/configuracoes/layout"),
      filhas: [
        // app/(app)/comercial/configuracoes/page.tsx
        {
          indice: true,
          pagina: () => import("./paginas/configuracoes/inicio"),
        },
        // app/(app)/comercial/configuracoes/parametros/page.tsx
        {
          caminho: "parametros",
          titulo: "Parâmetros do Comercial",
          pagina: () => import("./paginas/configuracoes/parametros"),
        },
        // app/(app)/comercial/configuracoes/metas/page.tsx
        {
          caminho: "metas",
          titulo: "Metas do Comercial",
          pagina: () => import("./paginas/configuracoes/metas"),
        },
        // app/(app)/comercial/configuracoes/importacoes/page.tsx
        {
          caminho: "importacoes",
          titulo: "Importações do Comercial",
          pagina: () => import("./paginas/configuracoes/importacoes"),
        },
        // app/(app)/comercial/configuracoes/historico/page.tsx
        {
          caminho: "historico",
          titulo: "Histórico do Comercial",
          pagina: () => import("./paginas/configuracoes/historico"),
        },
      ],
    },
  ],
};
