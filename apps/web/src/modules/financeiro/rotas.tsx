import type { Modulo } from "@/app/rota";

// Financeiro: as telas do ENET ainda são marcadores (aguardam a API), como no
// sistema antigo; cada uma confere a própria permissão. O Estacionamento já
// tem dados (WPS).

export const financeiro: Modulo = {
  nome: "financeiro",
  autenticadas: [
    {
      caminho: "financeiro",
      titulo: "Painel financeiro",
      pagina: () => import("./paginas/painel"),
    },
    {
      caminho: "financeiro/contas-a-pagar",
      titulo: "Contas a pagar",
      pagina: () => import("./paginas/contas-a-pagar"),
    },
    {
      caminho: "financeiro/faturamento",
      titulo: "Faturamento e recebimentos",
      pagina: () => import("./paginas/faturamento"),
    },
    {
      caminho: "financeiro/estacionamento",
      titulo: "Estacionamento",
      permissao: "financeiro.estacionamento",
      pagina: () => import("./paginas/estacionamento"),
    },
    {
      caminho: "financeiro/fluxo-de-caixa",
      titulo: "Fluxo de caixa",
      pagina: () => import("./paginas/fluxo-de-caixa"),
    },
    {
      caminho: "financeiro/importacao",
      titulo: "Importação e parâmetros",
      pagina: () => import("./paginas/importacao"),
    },
    {
      caminho: "financeiro/inadimplencia",
      titulo: "Inadimplência",
      pagina: () => import("./paginas/inadimplencia"),
    },
    {
      caminho: "financeiro/performance-e-capital",
      titulo: "Performance & Capital",
      pagina: () => import("./paginas/performance-e-capital"),
    },
    {
      caminho: "financeiro/plano-orcamentario",
      titulo: "Plano orçamentário",
      pagina: () => import("./paginas/plano-orcamentario"),
    },
  ],
};
