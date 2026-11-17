import type { Modulo } from "@/app/rota";
import { PERMISSOES_INTEGRACOES } from "@/modules/admin/permissoes-integracoes";

// IA ARP. O chat abre pelo botão do cabeçalho (app/shell/botao-ia.tsx); aqui
// fica a tela de gestão, em Administração › Configurações › IA. O mesmo
// layout recebe a aba Integrações (a tela é do módulo Administração).

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
          caminho: "integracoes",
          titulo: "Integrações",
          permissao: PERMISSOES_INTEGRACOES,
          pagina: () => import("@/modules/admin/paginas/integracoes"),
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
