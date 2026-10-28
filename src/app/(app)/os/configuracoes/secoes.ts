import "server-only";
import { CONFIGURACOES_OS } from "@/config/navigation";
import type { Permissao } from "@/lib/permissions";
import { usuarioAtual } from "@/server/auth";
import type { Aba } from "./abas";

// O que configura o módulo Tickets (spec 4.5 e 4.15). Cada aba aparece
// para quem tem ao menos uma das permissões dela; dentro, cada bloco confere
// a sua.

const ABAS: (Aba & { permissoes: Permissao[] })[] = [
  {
    href: CONFIGURACOES_OS.catalogo,
    rotulo: "Catálogo",
    descricao: "Categorias de cada setor: prazo, campos, checklist e portal",
    permissoes: ["os.catalogo"],
  },
  {
    href: CONFIGURACOES_OS.setores,
    rotulo: "Setores e pessoas",
    descricao: "Setores, quem é de cada um e quem é gestor",
    permissoes: ["os.catalogo"],
  },
  {
    href: CONFIGURACOES_OS.terceirizados,
    rotulo: "Terceirizados e contatos",
    descricao: "Empresas, profissionais e contatos do WhatsApp",
    permissoes: ["os.terceirizados", "os.parametros"],
  },
  {
    href: CONFIGURACOES_OS.parametros,
    rotulo: "Parâmetros",
    descricao:
      "Prazos, técnicos, ativos, vistorias, metas, mensagens e papel timbrado",
    permissoes: ["os.parametros"],
  },
  {
    href: CONFIGURACOES_OS.importacao,
    rotulo: "Importação e exemplos",
    descricao: "Importação do sistema de OS atual e dados de exemplo",
    permissoes: ["os.importacao"],
  },
  {
    href: CONFIGURACOES_OS.lixeira,
    rotulo: "Lixeira",
    descricao: "Chamados excluídos: restaure quando precisar",
    permissoes: ["os.excluir"],
  },
  {
    href: CONFIGURACOES_OS.historico,
    rotulo: "Histórico",
    descricao: "Quem alterou o quê e quando nos chamados e parâmetros",
    permissoes: ["os.historico", "admin.historico"],
  },
];

/** Abas que o usuário pode abrir. Lê a sessão: use dentro de <Suspense>. */
export async function abasDoUsuario(): Promise<Aba[]> {
  const { permissoes } = await usuarioAtual();
  return ABAS.filter((a) =>
    a.permissoes.some((p) => permissoes.includes(p)),
  ).map(({ permissoes: _, ...aba }) => aba);
}
