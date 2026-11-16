import type { Permissao } from "@arp/shared/permissions";
import type { Aba } from "@/components/abas-de-configuracoes";
import { CONFIGURACOES_RH } from "@/config/navigation";
import type { Sessao } from "@/lib/sessao";

// O que alimenta o RH, separado das telas de consulta. Cada aba aparece para
// quem tem ao menos uma das permissões dela; dentro, cada bloco confere a sua.

export const ABAS_DE_CONFIGURACOES: (Aba & { permissoes: Permissao[] })[] = [
  {
    href: CONFIGURACOES_RH.importacoes,
    rotulo: "Importações",
    descricao: "Extrato Mensal da folha e tabela de faixas do plano",
    permissoes: ["rh.folha", "rh.beneficios"],
  },
  {
    href: CONFIGURACOES_RH.cadastros,
    rotulo: "Cadastros",
    descricao:
      "Benefícios, departamentos, rubricas, faturamento e categorias de gasto",
    permissoes: ["rh.beneficios", "rh.parametros", "rh.orcamento.lancar"],
  },
  {
    href: CONFIGURACOES_RH.parametros,
    rotulo: "Parâmetros",
    descricao:
      "Jornada, encargos e provisões, banco de horas, metas e semáforo",
    permissoes: ["rh.parametros"],
  },
];

/** Abas que o usuário pode abrir. */
export function abasDoUsuario(sessao: Sessao): Aba[] {
  return ABAS_DE_CONFIGURACOES.filter((a) => sessao.pode(a.permissoes)).map(
    ({ permissoes: _, ...aba }) => aba,
  );
}
