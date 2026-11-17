import type { Aba } from "@/components/abas-de-configuracoes";
import type { Sessao } from "@/lib/sessao";

/** Abas de Administração › Configurações (cada uma com a sua permissão). */
export function abasDeConfiguracoes(sessao: Sessao): Aba[] {
  return [
    {
      href: "/admin/configuracoes/ia",
      rotulo: "IA",
      descricao: "Assistente IA ARP: uso, custos, limites e ajustes",
      pode: sessao.pode("ia.gerenciar"),
    },
  ].flatMap(({ pode, ...aba }) => (pode ? [aba] : []));
}
