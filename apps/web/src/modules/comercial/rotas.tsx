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
    // app/(app)/comercial/censo/page.tsx
    {
      caminho: "comercial/censo",
      titulo: "Censo",
      pagina: () => import("./paginas/censo/censo"),
    },
    // app/(app)/comercial/censo/demonstracao/page.tsx
    {
      caminho: "comercial/censo/demonstracao",
      titulo: "Questionário do Censo (demonstração)",
      pagina: () => import("./paginas/censo/demonstracao"),
    },
    // app/(app)/comercial/censo/presencial/[convite]/page.tsx
    {
      caminho: "comercial/censo/presencial/:convite",
      titulo: "Lançar resposta do Censo",
      pagina: () => import("./paginas/censo/presencial"),
    },
    // app/(app)/comercial/fichas/page.tsx
    {
      caminho: "comercial/fichas",
      titulo: "Fichas cadastrais",
      pagina: () => import("./paginas/fichas/fichas"),
    },
    // app/(app)/comercial/fichas/demonstracao/page.tsx
    {
      caminho: "comercial/fichas/demonstracao",
      titulo: "Ficha cadastral (demonstração)",
      pagina: () => import("./paginas/fichas/demonstracao"),
    },
    // app/(app)/comercial/fichas/[id]/page.tsx
    {
      caminho: "comercial/fichas/:id",
      titulo: "Ficha cadastral",
      pagina: () => import("./paginas/fichas/ficha"),
    },
    // app/(app)/comercial/kit/page.tsx
    {
      caminho: "comercial/kit",
      titulo: "Kit de entrega",
      pagina: () => import("./paginas/kit/kit"),
    },
    // app/(app)/comercial/kit/[id]/page.tsx
    {
      caminho: "comercial/kit/:id",
      titulo: "Documento do kit",
      pagina: () => import("./paginas/kit/documento"),
    },
    // app/(app)/comercial/eventos/page.tsx
    {
      caminho: "comercial/eventos",
      titulo: "Eventos",
      pagina: () => import("./paginas/eventos/eventos"),
    },
    // app/(app)/comercial/eventos/proposta/nova/page.tsx
    {
      caminho: "comercial/eventos/proposta/nova",
      titulo: "Nova proposta de evento",
      pagina: () => import("./paginas/eventos/nova"),
    },
    // app/(app)/comercial/eventos/proposta/[id]/page.tsx
    {
      caminho: "comercial/eventos/proposta/:id",
      titulo: "Proposta de evento",
      pagina: () => import("./paginas/eventos/proposta"),
    },
    // app/(app)/comercial/pesquisa/page.tsx
    {
      caminho: "comercial/pesquisa",
      titulo: "Pesquisa de mercado",
      pagina: () => import("./paginas/pesquisa/pesquisa"),
    },
    // app/(app)/comercial/pesquisa/novo/page.tsx
    {
      caminho: "comercial/pesquisa/novo",
      titulo: "Cadastrar imóvel pesquisado",
      pagina: () => import("./paginas/pesquisa/novo"),
    },
    // app/(app)/comercial/pesquisa/[id]/page.tsx
    {
      caminho: "comercial/pesquisa/:id",
      titulo: "Imóvel pesquisado",
      pagina: () => import("./paginas/pesquisa/imovel"),
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
  publicas: [
    // app/ficha/[token]/page.tsx (e o layout dela)
    {
      caminho: "ficha/:token",
      titulo: "Ficha cadastral",
      pagina: () => import("./paginas/publicas/ficha"),
    },
    // app/censo/[token]/page.tsx (e o layout dela)
    {
      caminho: "censo/:token",
      titulo: "Censo ARP",
      pagina: () => import("./paginas/publicas/censo"),
    },
  ],
};
