import "server-only";
import type { Aba } from "@/components/abas-de-configuracoes";
import type { Permissao } from "@/lib/permissions";
import { usuarioAtual } from "@/server/auth";

// Configurações de Operações: o que alimenta o módulo, separado das telas de
// consulta. Primeiro se cadastra, depois se importa; os parâmetros por último.
// Cada aba aparece para quem tem ao menos uma das permissões dela.

export const ROTA_CONFIGURACOES_OP = "/operacoes/configuracoes";

const ABAS: (Aba & { permissoes: Permissao[] })[] = [
  {
    href: `${ROTA_CONFIGURACOES_OP}/cadastros`,
    rotulo: "Cadastros",
    descricao: "Hidrômetros e salas da energia",
    permissoes: [
      "operacoes.agua.ver",
      "operacoes.agua.importar",
      "operacoes.energia.ver",
    ],
  },
  {
    href: `${ROTA_CONFIGURACOES_OP}/importacoes`,
    rotulo: "Importações",
    descricao:
      "Água, fotos dos hidrômetros, conta da concessionária, Energisa, limpeza e orçamento de obra, com os logs",
    // Os tipos de operacoes.pode_importar e quem vê os logs da área.
    permissoes: [
      "operacoes.agua.importar",
      "operacoes.energia.contas",
      "operacoes.obras.importar",
      "operacoes.limpeza.fechar",
      "operacoes.agua.ver",
      "operacoes.obras.ver",
      "operacoes.limpeza.ver",
    ],
  },
  {
    href: `${ROTA_CONFIGURACOES_OP}/parametros`,
    rotulo: "Parâmetros",
    descricao: "Limites dos alertas, termo, quadros, contas, limpeza e obras",
    permissoes: ["operacoes.parametros"],
  },
];

/** Todas as permissões que abrem alguma aba (o item do menu). */
export const PERMISSOES_CONFIGURACOES_OP = [
  ...new Set(ABAS.flatMap((a) => a.permissoes)),
];

/** Abas que o usuário pode abrir. Lê a sessão: use dentro de <Suspense>. */
export async function abasDeConfiguracoesOp(): Promise<Aba[]> {
  const { permissoes } = await usuarioAtual();
  return ABAS.filter((a) =>
    a.permissoes.some((p) => permissoes.includes(p)),
  ).map(({ permissoes: _, ...aba }) => aba);
}
