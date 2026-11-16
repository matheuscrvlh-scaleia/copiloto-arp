import type { Modulo } from "@/app/rota";

// Módulo de exemplo do mecanismo de rotas. A tela de Gestão (o Dashboard)
// ainda é um marcador: entra de verdade quando o módulo for portado.

export const inicio: Modulo = {
  nome: "inicio",
  autenticadas: [
    {
      caminho: "gestao",
      titulo: "Dashboard",
      pagina: () => import("./paginas/gestao"),
    },
  ],
};
