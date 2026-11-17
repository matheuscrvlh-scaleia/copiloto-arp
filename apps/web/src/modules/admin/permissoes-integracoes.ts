import type { ModuloDeIntegracao } from "@arp/shared/integracoes";
import type { Permissao } from "@arp/shared/permissions";

/**
 * Quem abre as integrações de cada módulo em Configurações › Integrações (o
 * mesmo que o servidor exige em GET /admin/integracoes?modulo=).
 */
export const PERMISSOES_POR_MODULO: Record<ModuloDeIntegracao, Permissao[]> = {
  admin: ["admin.integracoes"],
  marketing: ["admin.integracoes", "marketing.parametros"],
  sustentabilidade: ["admin.integracoes", "sustentabilidade.parametros"],
};

/** Todas as permissões que abrem a tela (a aba e o item do menu). */
export const PERMISSOES_INTEGRACOES = [
  ...new Set(Object.values(PERMISSOES_POR_MODULO).flat()),
];
