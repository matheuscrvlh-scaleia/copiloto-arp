import type { Modulo } from "@/app/rota";

// Administração. Cada página desenha o título e confere a permissão em
// volta do conteúdo (como no sistema antigo): por isso as rotas não
// declaram `permissao`.

export const admin: Modulo = {
  nome: "admin",
  autenticadas: [
    {
      caminho: "admin/usuarios",
      titulo: "Usuários e cargos",
      pagina: () => import("./paginas/usuarios"),
    },
    {
      caminho: "admin/usuarios/novo",
      titulo: "Novo usuário",
      pagina: () => import("./paginas/usuario-novo"),
    },
    {
      caminho: "admin/usuarios/cargos",
      titulo: "Cargos",
      pagina: () => import("./paginas/cargos"),
    },
    {
      caminho: "admin/usuarios/cargos/novo",
      titulo: "Novo cargo",
      pagina: () => import("./paginas/cargo-novo"),
    },
    {
      caminho: "admin/usuarios/cargos/:id",
      titulo: "Cargo",
      pagina: () => import("./paginas/cargo"),
    },
    {
      caminho: "admin/usuarios/:id",
      titulo: "Usuário",
      pagina: () => import("./paginas/usuario"),
    },
    {
      caminho: "admin/empresa",
      titulo: "Empresa",
      pagina: () => import("./paginas/empresa"),
    },
    {
      caminho: "admin/historico",
      titulo: "Histórico de alterações",
      pagina: () => import("./paginas/historico"),
    },
    {
      caminho: "admin/integracoes",
      titulo: "Integrações",
      pagina: () => import("./paginas/integracoes"),
    },
  ],
};
