import type { Permissao } from "@arp/shared/permissions";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useSessao } from "@/lib/sessao";
import { consultaTiposImportacao } from "../../api/importacoes";
import type { AbaConfiguracao } from "../../components/configuracoes/abas";

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
];

/** Abas que a pessoa pode abrir. Use dentro de <Suspense>. */
export function useAbasDoUsuario(): AbaConfiguracao[] {
  const { pode } = useSessao();
  const {
    data: { tipos },
  } = useSuspenseQuery(consultaTiposImportacao);
  return ABAS.filter((a) =>
    a.permissao === "importar" ? tipos.length > 0 : pode(a.permissao),
  ).map(({ permissao: _, ...aba }) => aba);
}
