import "server-only";
import type { AbaConfiguracao } from "@/components/comercial/configuracoes/abas";
import type { Permissao } from "@/lib/permissions";
import { usuarioAtual } from "@/server/auth";
import { tiposQuePodeImportar } from "@/server/comercial/importacoes";

// Abas de Comercial › Configurações (spec 4.13). Cada uma aparece só para
// quem tem a permissão dela; Importações, para quem importa algum tipo
// (comercial.pode_importar).

const BASE = "/comercial/configuracoes";

const ABAS: (AbaConfiguracao & { permissao: Permissao | "importar" })[] = [
  {
    href: `${BASE}/parametros`,
    rotulo: "Parâmetros",
    descricao:
      "Tabelas de apoio de cada tela: fontes, faixas, prazos, textos e listas",
    permissao: "comercial.parametros.editar",
  },
  {
    href: `${BASE}/metas`,
    rotulo: "Metas",
    descricao: "Meta do Painel por indicador e mês",
    permissao: "comercial.painel.metas",
  },
  {
    href: `${BASE}/importacoes`,
    rotulo: "Importações",
    descricao:
      "Histórico das planilhas: Censo 2026, Forms cadastral, pesquisa e feedbacks",
    permissao: "importar",
  },
  {
    href: `${BASE}/historico`,
    rotulo: "Histórico",
    descricao: "Quem alterou parâmetros e cadastros, quando, antes e depois",
    permissao: "comercial.parametros.editar",
  },
  {
    href: `${BASE}/exemplos`,
    rotulo: "Dados de exemplo",
    descricao: "Remover os registros de exemplo da demonstração",
    permissao: "comercial.parametros.editar",
  },
];

/** Abas que a pessoa pode abrir. Lê a sessão: use dentro de <Suspense>. */
export async function abasDoUsuario(): Promise<AbaConfiguracao[]> {
  const [{ permissoes }, tipos] = await Promise.all([
    usuarioAtual(),
    tiposQuePodeImportar(),
  ]);
  return ABAS.filter((a) =>
    a.permissao === "importar"
      ? tipos.length > 0
      : permissoes.includes(a.permissao),
  ).map(({ permissao: _, ...aba }) => aba);
}
