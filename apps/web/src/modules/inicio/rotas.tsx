import type { Modulo } from "@/app/rota";

// A primeira tela: o Dashboard da Gestão (números do RH no período).

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
