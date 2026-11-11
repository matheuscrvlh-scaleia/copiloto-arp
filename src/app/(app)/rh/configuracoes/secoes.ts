import "server-only";
import type { Aba } from "@/components/abas-de-configuracoes";
import { CONFIGURACOES_RH } from "@/config/navigation";
import type { Permissao } from "@/lib/permissions";
import { usuarioAtual } from "@/server/auth";

// O que alimenta o RH, separado das telas de consulta. Cada aba aparece para
// quem tem ao menos uma das permissões dela; dentro, cada bloco confere a sua.

const ABAS: (Aba & { permissoes: Permissao[] })[] = [
  {
    href: CONFIGURACOES_RH.importacoes,
    rotulo: "Importações",
    descricao: "Extrato Mensal da folha e tabela de faixas do plano",
    permissoes: ["rh.folha", "rh.beneficios"],
  },
  {
    href: CONFIGURACOES_RH.cadastros,
    rotulo: "Cadastros",
    descricao: "Benefícios, departamentos, rubricas, faturamento e notas de PJ",
    permissoes: ["rh.beneficios", "rh.parametros"],
  },
  {
    href: CONFIGURACOES_RH.parametros,
    rotulo: "Parâmetros",
    descricao:
      "Jornada, encargos e provisões, banco de horas, metas e semáforo",
    permissoes: ["rh.parametros"],
  },
];

/** Abas que o usuário pode abrir. Lê a sessão: use dentro de <Suspense>. */
export async function abasDoUsuario(): Promise<Aba[]> {
  const { permissoes } = await usuarioAtual();
  return ABAS.filter((a) =>
    a.permissoes.some((p) => permissoes.includes(p)),
  ).map(({ permissoes: _, ...aba }) => aba);
}
