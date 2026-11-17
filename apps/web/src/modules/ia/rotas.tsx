import type { Modulo } from "@/app/rota";

// IA ARP. O chat abre pelo botão do cabeçalho (app/shell/botao-ia.tsx); aqui
// fica a tela de gestão, em Administração › Configurações › IA.

export const ia: Modulo = {
  nome: "ia",
  autenticadas: [
    {
      caminho: "admin/configuracoes",
      pagina: () => import("./paginas/configuracoes/layout"),
      filhas: [
        {
          indice: true,
          titulo: "Configurações",
          pagina: () => import("./paginas/configuracoes/inicio"),
        },
        {
          caminho: "ia",
          titulo: "IA",
          permissao: ["ia.gerenciar", "ia.conversas"],
          pagina: () => import("./paginas/configuracoes/ia"),
        },
      ],
    },
  ],
};
