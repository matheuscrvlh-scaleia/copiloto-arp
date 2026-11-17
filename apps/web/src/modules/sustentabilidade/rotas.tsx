import type { Modulo } from "@/app/rota";

// Telas do Sustentabilidade. A permissão é conferida dentro de cada página
// (o cabeçalho aparece mesmo sem acesso, como antes). Parte A: painel,
// relatório do mês e configurações. As partes B (programas, parceiro,
// rondas, RCC) e C (clube, entrevistas) acrescentam as suas no fim de
// `autenticadas` (e a pública do parceiro em `publicas`).

export const sustentabilidade: Modulo = {
  nome: "sustentabilidade",
  autenticadas: [
    // app/(app)/sustentabilidade/page.tsx
    {
      caminho: "sustentabilidade",
      titulo: "Painel de Sustentabilidade",
      pagina: () => import("./paginas/painel"),
    },
    // app/(app)/sustentabilidade/relatorio/[mes]/route.ts (agora na API)
    {
      caminho: "sustentabilidade/relatorio/:mes",
      titulo: "Relatório de Sustentabilidade do mês",
      pagina: () => import("./paginas/relatorio"),
    },
    // app/(app)/sustentabilidade/configuracoes/layout.tsx + as páginas dele
    {
      caminho: "sustentabilidade/configuracoes",
      pagina: () => import("./paginas/configuracoes/layout"),
      filhas: [
        {
          indice: true,
          titulo: "Configurações de Sustentabilidade",
          pagina: () => import("./paginas/configuracoes/inicio"),
        },
        {
          caminho: "coletores",
          titulo: "Coletores",
          pagina: () => import("./paginas/configuracoes/coletores"),
        },
        {
          caminho: "importacoes",
          titulo: "Importações de Sustentabilidade",
          pagina: () => import("./paginas/configuracoes/importacoes"),
        },
        {
          caminho: "importacoes/:id",
          titulo: "Importação de Sustentabilidade",
          pagina: () => import("./paginas/configuracoes/importacao"),
        },
        {
          caminho: "parametros",
          titulo: "Parâmetros de Sustentabilidade",
          pagina: () => import("./paginas/configuracoes/parametros"),
        },
        {
          caminho: "integracoes",
          titulo: "Integrações de Sustentabilidade",
          pagina: () => import("./paginas/configuracoes/integracoes"),
        },
      ],
    },
    // Parte B: app/(app)/sustentabilidade/programas, rondas e rcc
    {
      caminho: "sustentabilidade/programas",
      titulo: "Programas",
      pagina: () => import("./paginas/programas/lista"),
    },
    {
      caminho: "sustentabilidade/programas/:id",
      titulo: "Programa",
      pagina: () => import("./paginas/programas/programa"),
    },
    {
      caminho: "sustentabilidade/rondas",
      titulo: "Rondas dos coletores",
      pagina: () => import("./paginas/rondas"),
    },
    {
      caminho: "sustentabilidade/rondas/lancar",
      titulo: "Lançar ronda",
      pagina: () => import("./paginas/rondas-lancar"),
    },
    {
      caminho: "sustentabilidade/rcc",
      titulo: "RCC",
      pagina: () => import("./paginas/rcc"),
    },
    // Parte C: app/(app)/sustentabilidade/clube e entrevistas
    {
      caminho: "sustentabilidade/clube",
      titulo: "Clube SustentArp",
      pagina: () => import("./paginas/clube/lista"),
    },
    {
      caminho: "sustentabilidade/clube/contribuicoes",
      titulo: "Contribuições do Clube",
      pagina: () => import("./paginas/clube/contribuicoes"),
    },
    {
      caminho: "sustentabilidade/clube/:id",
      titulo: "Participante do Clube",
      pagina: () => import("./paginas/clube/participante"),
    },
    {
      caminho: "sustentabilidade/entrevistas",
      titulo: "Entrevistas",
      pagina: () => import("./paginas/entrevistas/controle"),
    },
    {
      caminho: "sustentabilidade/entrevistas/respostas",
      titulo: "Respostas das entrevistas",
      pagina: () => import("./paginas/entrevistas/respostas"),
    },
    {
      caminho: "sustentabilidade/entrevistas/questionario",
      titulo: "Editar questionário",
      pagina: () => import("./paginas/entrevistas/questionario"),
    },
    {
      caminho: "sustentabilidade/entrevistas/:contrato",
      titulo: "Ficha da entrevista",
      pagina: () => import("./paginas/entrevistas/ficha"),
    },
    {
      caminho: "sustentabilidade/entrevistas/:contrato/aplicar",
      titulo: "Aplicar entrevista",
      pagina: () => import("./paginas/entrevistas/aplicar"),
    },
  ],
  publicas: [
    // Parte B: app/parceiro/[token] (página, área e layout)
    {
      caminho: "parceiro/:token",
      titulo: "Lançamento do programa",
      pagina: () => import("./paginas/parceiro"),
    },
  ],
};
