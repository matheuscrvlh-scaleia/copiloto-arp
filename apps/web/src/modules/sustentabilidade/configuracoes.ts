import type { Permissao } from "@arp/shared/permissions";
import type { Aba } from "@/components/abas-de-configuracoes";
import type { Sessao } from "@/lib/sessao";

// Configurações do Sustentabilidade: o que alimenta o módulo, separado das
// telas de consulta (mesmo padrão de Operações). Cada aba aparece para quem
// tem a permissão dela. As abas Importações e Coletores têm as próprias telas.

export const ROTA_CONFIGURACOES_SU = "/sustentabilidade/configuracoes";

const ABAS: (Aba & { permissoes: Permissao[] })[] = [
  {
    href: `${ROTA_CONFIGURACOES_SU}/importacoes`,
    rotulo: "Importações",
    descricao:
      "Respostas do Forms, atrações, produtores, ecocopos, quiosque e tour: prévia, conferências e desfazer, com o histórico",
    permissoes: ["sustentabilidade.importar"],
  },
  {
    href: `${ROTA_CONFIGURACOES_SU}/coletores`,
    rotulo: "Coletores",
    descricao: "Cadastro dos coletores: local, cor, contêineres e capacidade",
    permissoes: ["sustentabilidade.parametros"],
  },
  {
    href: `${ROTA_CONFIGURACOES_SU}/parametros`,
    rotulo: "Parâmetros",
    descricao:
      "Prazos das entrevistas, clube, limite dos coletores, RCC, grupos do painel, metas e marcos",
    permissoes: ["sustentabilidade.parametros"],
  },
  {
    href: `${ROTA_CONFIGURACOES_SU}/integracoes`,
    rotulo: "Integrações",
    descricao:
      "Portal do inversor da usina solar (Growatt): token, teste e leituras",
    permissoes: ["sustentabilidade.parametros"],
  },
];

/** Todas as permissões que abrem alguma aba (o item do menu). */
export const PERMISSOES_CONFIGURACOES_SU = [
  ...new Set(ABAS.flatMap((a) => a.permissoes)),
];

/** Abas que o usuário pode abrir. */
export function abasDeConfiguracoesSu(sessao: Sessao): Aba[] {
  return ABAS.filter((a) => sessao.pode(a.permissoes)).map(
    ({ permissoes: _, ...aba }) => aba,
  );
}
