import { useLocation, useParams } from "react-router";
import { Redirecionar } from "@/lib/navegacao";

// Telas que viraram abas ou filtros: links e favoritos antigos continuam
// funcionando (eram os `redirects` do next.config.ts). `*` no fim casa com o
// resto do endereço e é copiado para o destino; a busca (?tipo=) segue junto.

export const REDIRECIONAMENTOS: { de: string; para: string }[] = [
  // Relatórios voltou a se chamar Formulários (19/11/2026).
  { de: "relatorios/*", para: "/formularios/*" },
  { de: "os/abertos-por-mim", para: "/os?aberto_por=eu" },
  { de: "os/modelos", para: "/os/disparos" },
  { de: "rh/folha", para: "/rh/configuracoes/importacoes" },
  { de: "rh/parametros", para: "/rh/configuracoes/parametros" },
  // Endomarketing virou Planejamento orçamentário (07/11/2026).
  { de: "rh/endomarketing", para: "/rh/planejamento-orcamentario" },
  { de: "rh/beneficios", para: "/rh/configuracoes/cadastros#beneficios" },
  // Diário de Obra entrou na tela única de Obras (11/11/2026).
  { de: "operacoes/diario", para: "/operacoes/obras" },
  { de: "operacoes/obras/diario", para: "/operacoes/obras" },
  { de: "operacoes/diario/*", para: "/operacoes/obras/diario/*" },
  // Cadastros, Importações e Parâmetros de Operações viraram abas de
  // Configurações (11/11/2026).
  {
    de: "operacoes/importacoes/nova",
    para: "/operacoes/configuracoes/importacoes",
  },
  ...["importacoes", "cadastros", "parametros"].map((aba) => ({
    de: `operacoes/${aba}/*`,
    para: `/operacoes/configuracoes/${aba}/*`,
  })),
];

/** Monta o destino: troca o `*`, junta a busca atual e mantém a âncora. */
export function destinoDoRedirecionamento(
  para: string,
  resto: string,
  local: { search: string; hash: string },
): string {
  const [semAncora = "", ancora] = para.split("#");
  const [caminho = "", busca] = semAncora.split("?");
  const params = new URLSearchParams(local.search);
  for (const [chave, valor] of new URLSearchParams(busca))
    params.set(chave, valor);
  const query = params.toString();
  const hash = ancora ? `#${ancora}` : local.hash;
  return (
    caminho.replace("*", resto).replace(/\/+$/, "") +
    (query ? `?${query}` : "") +
    hash
  );
}

export function RedirecionamentoAntigo({ para }: { para: string }) {
  const local = useLocation();
  const resto = useParams()["*"] ?? "";
  return <Redirecionar para={destinoDoRedirecionamento(para, resto, local)} />;
}
