import type { Modulo } from "@/app/rota";

// Telas de Operações. A permissão é conferida dentro de cada página (o
// cabeçalho aparece mesmo sem acesso, como antes). Parte B: obras, Diário
// de Obras, limpeza e configurações.

export const operacoes: Modulo = {
  nome: "operacoes",
  autenticadas: [
    // app/(app)/operacoes/page.tsx
    {
      caminho: "operacoes",
      titulo: "Painel de Operações",
      pagina: () => import("./paginas/painel"),
    },
    // app/(app)/operacoes/agua/page.tsx
    {
      caminho: "operacoes/agua",
      titulo: "Água",
      pagina: () => import("./paginas/agua"),
    },
    // app/(app)/operacoes/agua/extrato/page.tsx
    {
      caminho: "operacoes/agua/extrato",
      titulo: "Água · Extrato",
      pagina: () => import("./paginas/agua-extrato"),
    },
    // app/(app)/operacoes/agua/extrato/pdf/route.ts (agora na API)
    {
      caminho: "operacoes/agua/extrato/pdf",
      pagina: () => import("./paginas/agua-extrato-pdf"),
    },
    // app/(app)/operacoes/agua/galeria/page.tsx
    {
      caminho: "operacoes/agua/galeria",
      titulo: "Água · Galeria de fotos",
      pagina: () => import("./paginas/agua-galeria"),
    },
    // app/(app)/operacoes/agua/hidrometros/page.tsx
    {
      caminho: "operacoes/agua/hidrometros",
      titulo: "Água · Hidrômetros",
      pagina: () => import("./paginas/agua-hidrometros"),
    },
    // app/(app)/operacoes/agua/importar/page.tsx
    {
      caminho: "operacoes/agua/importar",
      titulo: "Água · Importar",
      pagina: () => import("./paginas/agua-importar"),
    },
    // app/(app)/operacoes/agua/[hidrometro]/page.tsx
    {
      caminho: "operacoes/agua/:hidrometro",
      pagina: () => import("./paginas/agua-hidrometro"),
    },
    // app/(app)/operacoes/energia/page.tsx
    {
      caminho: "operacoes/energia",
      titulo: "Energia · Quadros de medidores",
      pagina: () => import("./paginas/energia"),
    },
    // app/(app)/operacoes/energia/caixa/[id]/page.tsx
    {
      caminho: "operacoes/energia/caixa/:id",
      titulo: "Ficha da caixa de energia",
      pagina: () => import("./paginas/energia-caixa"),
    },
    // app/(app)/operacoes/energia/contas/page.tsx
    {
      caminho: "operacoes/energia/contas",
      titulo: "Contas de energia",
      pagina: () => import("./paginas/energia-contas"),
    },
    // app/(app)/operacoes/energia/contas/[fatura]/page.tsx
    {
      caminho: "operacoes/energia/contas/:fatura",
      titulo: "Fatura de energia",
      pagina: () => import("./paginas/energia-fatura"),
    },
    // app/(app)/operacoes/energia/solar/page.tsx
    {
      caminho: "operacoes/energia/solar",
      titulo: "Energia solar",
      pagina: () => import("./paginas/energia-solar"),
    },
    // app/(app)/operacoes/energia/termo/page.tsx
    {
      caminho: "operacoes/energia/termo",
      titulo: "Termo de autorização de energia",
      pagina: () => import("./paginas/energia-termo"),
    },
    // app/(app)/operacoes/energia/termo/[id]/route.ts (agora na API)
    {
      caminho: "operacoes/energia/termo/:id",
      pagina: () => import("./paginas/energia-termo-arquivo"),
    },
    // --- Parte B ---
    // app/(app)/operacoes/obras/page.tsx
    {
      caminho: "operacoes/obras",
      titulo: "Obras",
      pagina: () => import("./paginas/obras"),
    },
    // app/(app)/operacoes/obras/[id]/page.tsx
    {
      caminho: "operacoes/obras/:id",
      titulo: "Obra · previsto e realizado",
      pagina: () => import("./paginas/obra"),
    },
    // app/(app)/operacoes/obras/diario/relatorios/page.tsx
    {
      caminho: "operacoes/obras/diario/relatorios",
      titulo: "Relatórios do Diário de Obra",
      pagina: () => import("./paginas/diario-relatorios"),
    },
    // app/(app)/operacoes/obras/diario/relatorios/[id]/page.tsx
    {
      caminho: "operacoes/obras/diario/relatorios/:id",
      titulo: "Relatório do Diário de Obra",
      pagina: () => import("./paginas/diario-relatorio"),
    },
    // app/(app)/operacoes/obras/diario/[obra]/page.tsx
    {
      caminho: "operacoes/obras/diario/:obra",
      titulo: "Obra — Diário de Obra",
      pagina: () => import("./paginas/diario-obra"),
    },
    // app/(app)/operacoes/obras/diario/[obra]/tarefas/[tarefa]/page.tsx
    {
      caminho: "operacoes/obras/diario/:obra/tarefas/:tarefa",
      titulo: "Tarefa — Diário de Obra",
      pagina: () => import("./paginas/diario-tarefa"),
    },
    // app/(app)/operacoes/limpeza/page.tsx
    {
      caminho: "operacoes/limpeza",
      titulo: "Rateio da limpeza",
      pagina: () => import("./paginas/limpeza"),
    },
    // app/(app)/operacoes/limpeza/[mes]/demonstrativo/route.ts (agora na API)
    {
      caminho: "operacoes/limpeza/:mes/demonstrativo",
      pagina: () => import("./paginas/limpeza-arquivo"),
    },
    // app/(app)/operacoes/limpeza/[mes]/planilha/route.ts (agora na API)
    {
      caminho: "operacoes/limpeza/:mes/planilha",
      pagina: () => import("./paginas/limpeza-arquivo"),
    },
    // app/(app)/operacoes/configuracoes/layout.tsx
    {
      caminho: "operacoes/configuracoes",
      pagina: () => import("./paginas/configuracoes/layout"),
      filhas: [
        // app/(app)/operacoes/configuracoes/page.tsx
        {
          indice: true,
          pagina: () => import("./paginas/configuracoes/inicio"),
        },
        // app/(app)/operacoes/configuracoes/cadastros/page.tsx
        {
          caminho: "cadastros",
          titulo: "Cadastros de Operações",
          pagina: () => import("./paginas/configuracoes/cadastros"),
        },
        // app/(app)/operacoes/configuracoes/importacoes/page.tsx
        {
          caminho: "importacoes",
          titulo: "Importações de Operações",
          pagina: () => import("./paginas/configuracoes/importacoes"),
        },
        // app/(app)/operacoes/configuracoes/importacoes/[id]/page.tsx
        {
          caminho: "importacoes/:id",
          titulo: "Importação",
          pagina: () => import("./paginas/configuracoes/importacao"),
        },
        // app/(app)/operacoes/configuracoes/parametros/page.tsx
        {
          caminho: "parametros",
          titulo: "Parâmetros de Operações",
          pagina: () => import("./paginas/configuracoes/parametros"),
        },
      ],
    },
  ],
};
