import type { Permissao } from "@arp/shared/permissions";
import type { Aba } from "@/components/abas-de-configuracoes";
import type { Sessao } from "@/lib/sessao";

// Configurações de Operações (o src/server/operacoes/configuracoes.ts
// antigo): o que alimenta o módulo, separado das telas de consulta.
// Primeiro se cadastra, depois se importa; os parâmetros por último. Cada
// aba aparece para quem tem ao menos uma das permissões dela.

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

/** Abas que o usuário pode abrir. */
export function abasDeConfiguracoesOp(sessao: Sessao): Aba[] {
  return ABAS.filter((a) => sessao.pode(a.permissoes)).map(
    ({ permissoes: _, ...aba }) => aba,
  );
}
