import type { Permissao } from "@arp/shared/permissions";
import type { Aba } from "@/components/abas-de-configuracoes";
import { CONFIGURACOES_OS } from "@/config/navigation";
import { useSessao } from "@/lib/sessao";

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
    href: CONFIGURACOES_OS.modelos,
    rotulo: "Modelos e lembretes",
    descricao: "Cadastro dos modelos de entrada e saída de cliente e rotinas",
    permissoes: ["os.modelos"],
  },
  {
    href: CONFIGURACOES_OS.terceirizados,
    rotulo: "Internos e terceirizados",
    descricao: "Equipe interna, empresas terceirizadas e contatos do WhatsApp",
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
    href: CONFIGURACOES_OS.historico,
    rotulo: "Histórico",
    descricao: "Quem alterou o quê e quando nos chamados e parâmetros",
    permissoes: ["os.historico", "admin.historico"],
  },
];

/** Abas que o usuário pode abrir. */
export function useAbasDoUsuario(): Aba[] {
  const { pode } = useSessao();
  return ABAS.filter((a) => pode(a.permissoes)).map(
    ({ permissoes: _, ...aba }) => aba,
  );
}
