import type { Modulo } from "@/app/rota";

// Telas do RH. A permissão é conferida dentro de cada página (o cabeçalho
// aparece mesmo sem acesso, como antes). Parte A: Painel, Funcionários,
// Quadro e Jornada; Custo de pessoal, Planejamento e Configurações entram
// nesta lista com a parte B.

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
  ],
};
