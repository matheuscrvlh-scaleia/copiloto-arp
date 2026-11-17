import { TELA_DAS_INTEGRACOES } from "@arp/shared/integracoes";
import type { Aba } from "@/components/abas-de-configuracoes";
import type { Sessao } from "@/lib/sessao";
import { PERMISSOES_INTEGRACOES } from "@/modules/admin/permissoes-integracoes";

/** Abas de Administração › Configurações (cada uma com a sua permissão). */
export function abasDeConfiguracoes(sessao: Sessao): Aba[] {
  return [
    {
      href: TELA_DAS_INTEGRACOES,
      rotulo: "Integrações",
      descricao:
        "Acesso a todos os sistemas externos, agrupados por área: ponto, estacionamento, CRM, Marketing, energia solar e IA",
      pode: sessao.pode(PERMISSOES_INTEGRACOES),
    },
    {
      href: "/admin/configuracoes/ia",
      rotulo: "IA",
      descricao: "Assistente IA ARP: uso, custos, limites, ajustes e conversas",
      pode: sessao.pode(["ia.gerenciar", "ia.conversas"]),
    },
  ].flatMap(({ pode, ...aba }) => (pode ? [aba] : []));
}
