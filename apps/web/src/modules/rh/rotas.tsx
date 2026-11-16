import type { Modulo } from "@/app/rota";

// Telas do RH. A permissão é conferida dentro de cada página (o cabeçalho
// aparece mesmo sem acesso, como antes); nas telas dentro de um layout, pela
// rota, abaixo do cabeçalho do layout.

export const rh: Modulo = {
  nome: "rh",
  autenticadas: [
    // app/(app)/rh/page.tsx
    {
      caminho: "rh",
      titulo: "Painel de RH",
      pagina: () => import("./paginas/painel"),
    },
    // app/(app)/rh/funcionarios/page.tsx
    {
      caminho: "rh/funcionarios",
      titulo: "Funcionários",
      pagina: () => import("./paginas/funcionarios"),
    },
    // app/(app)/rh/funcionarios/[id]/page.tsx
    {
      caminho: "rh/funcionarios/:id",
      titulo: "Funcionário",
      pagina: () => import("./paginas/funcionario"),
    },
    // app/(app)/rh/quadro/page.tsx
    {
      caminho: "rh/quadro",
      titulo: "Quadro e turnover",
      pagina: () => import("./paginas/quadro"),
    },
    // app/(app)/rh/jornada/page.tsx
    {
      caminho: "rh/jornada",
      titulo: "Jornada",
      pagina: () => import("./paginas/jornada"),
    },
    // app/(app)/rh/jornada/banco-de-horas/page.tsx
    {
      caminho: "rh/jornada/banco-de-horas",
      titulo: "Fechamento do banco de horas",
      pagina: () => import("./paginas/banco-de-horas"),
    },
    // app/(app)/rh/custo-de-pessoal/page.tsx
    {
      caminho: "rh/custo-de-pessoal",
      titulo: "Custo de pessoal",
      pagina: () => import("./paginas/custo-de-pessoal"),
    },
    // app/(app)/rh/custo-de-pessoal/comparacao/page.tsx
    {
      caminho: "rh/custo-de-pessoal/comparacao",
      titulo: "Custo de pessoal: comparação",
      pagina: () => import("./paginas/custo-comparacao"),
    },
    // app/(app)/rh/planejamento-orcamentario/layout.tsx
    {
      caminho: "rh/planejamento-orcamentario",
      pagina: () => import("./paginas/orcamento-layout"),
      filhas: [
        // app/(app)/rh/planejamento-orcamentario/page.tsx
        {
          indice: true,
          titulo: "Planejamento orçamentário",
          permissao: ["rh.orcamento", "rh.orcamento.lancar"],
          pagina: () => import("./paginas/orcamento"),
        },
        // app/(app)/rh/planejamento-orcamentario/lancamentos/page.tsx
        {
          caminho: "lancamentos",
          titulo: "Lançamentos · Planejamento orçamentário",
          permissao: ["rh.orcamento", "rh.orcamento.lancar"],
          pagina: () => import("./paginas/orcamento-lancamentos"),
        },
      ],
    },
    // app/(app)/rh/configuracoes/layout.tsx
    {
      caminho: "rh/configuracoes",
      pagina: () => import("./paginas/configuracoes-layout"),
      filhas: [
        // app/(app)/rh/configuracoes/page.tsx
        {
          indice: true,
          titulo: "Configurações do RH",
          pagina: () => import("./paginas/configuracoes"),
        },
        // app/(app)/rh/configuracoes/cadastros/page.tsx
        {
          caminho: "cadastros",
          titulo: "Cadastros do RH",
          permissao: ["rh.beneficios", "rh.parametros", "rh.orcamento.lancar"],
          pagina: () => import("./paginas/cadastros"),
        },
        // app/(app)/rh/configuracoes/cadastros/beneficios/[id]/page.tsx
        {
          caminho: "cadastros/beneficios/:id",
          titulo: "Benefício",
          pagina: () => import("./paginas/beneficio"),
        },
        // app/(app)/rh/configuracoes/parametros/page.tsx
        {
          caminho: "parametros",
          titulo: "Parâmetros do RH",
          pagina: () => import("./paginas/parametros"),
        },
        // app/(app)/rh/configuracoes/importacoes/page.tsx
        {
          caminho: "importacoes",
          titulo: "Importações do RH",
          permissao: ["rh.folha", "rh.beneficios"],
          pagina: () => import("./paginas/importacoes"),
        },
        // app/(app)/rh/configuracoes/importacoes/folha/[id]/page.tsx
        {
          caminho: "importacoes/folha/:id",
          titulo: "Folha importada",
          pagina: () => import("./paginas/folha"),
        },
      ],
    },
  ],
};
