import type { Permissao } from "@/lib/permissions";

/** Nome do ícone (lucide), traduzido em components/shell/icones.tsx. */
export type Icone =
  | "dashboard"
  | "painel"
  | "custo"
  | "quadro"
  | "jornada"
  | "endomarketing"
  | "folha"
  | "beneficios"
  | "parametros"
  | "inadimplencia"
  | "faturamento"
  | "contas"
  | "fluxo"
  | "orcamento"
  | "performance"
  | "importacao"
  | "usuarios"
  | "empresa"
  | "integracoes";

export interface NavItem {
  href: string;
  label: string;
  icone: Icone;
  /** null: qualquer usuário logado (o conteúdo filtra pelas permissões). */
  permissao: Permissao | null;
}

export interface NavSection {
  titulo: string;
  itens: NavItem[];
}

/** Primeira tela depois do login. */
export const INICIO = "/gestao";

export const navigation: NavSection[] = [
  {
    titulo: "Gestão",
    itens: [
      { href: INICIO, label: "Dashboard", icone: "dashboard", permissao: null },
    ],
  },
  {
    titulo: "RH",
    itens: [
      { href: "/rh", label: "Painel", icone: "painel", permissao: "rh.painel" },
      {
        href: "/rh/custo-de-pessoal",
        label: "Custo de pessoal",
        icone: "custo",
        permissao: "rh.custo_pessoal",
      },
      {
        href: "/rh/quadro",
        label: "Quadro e turnover",
        icone: "quadro",
        permissao: "rh.quadro",
      },
      {
        href: "/rh/jornada",
        label: "Jornada",
        icone: "jornada",
        permissao: "rh.jornada",
      },
      {
        href: "/rh/endomarketing",
        label: "Endomarketing",
        icone: "endomarketing",
        permissao: "rh.endomarketing",
      },
      {
        href: "/rh/folha",
        label: "Importar folha",
        icone: "folha",
        permissao: "rh.folha",
      },
      {
        href: "/rh/beneficios",
        label: "Benefícios",
        icone: "beneficios",
        permissao: "rh.beneficios",
      },
      {
        href: "/rh/parametros",
        label: "Parâmetros",
        icone: "parametros",
        permissao: "rh.parametros",
      },
    ],
  },
  {
    titulo: "Financeiro",
    itens: [
      {
        href: "/financeiro",
        label: "Painel",
        icone: "painel",
        permissao: "financeiro.painel",
      },
      {
        href: "/financeiro/inadimplencia",
        label: "Inadimplência",
        icone: "inadimplencia",
        permissao: "financeiro.inadimplencia",
      },
      {
        href: "/financeiro/faturamento",
        label: "Faturamento e recebimentos",
        icone: "faturamento",
        permissao: "financeiro.faturamento",
      },
      {
        href: "/financeiro/contas-a-pagar",
        label: "Contas a pagar",
        icone: "contas",
        permissao: "financeiro.contas_a_pagar",
      },
      {
        href: "/financeiro/fluxo-de-caixa",
        label: "Fluxo de caixa",
        icone: "fluxo",
        permissao: "financeiro.fluxo_de_caixa",
      },
      {
        href: "/financeiro/plano-orcamentario",
        label: "Plano orçamentário",
        icone: "orcamento",
        permissao: "financeiro.plano_orcamentario",
      },
      {
        href: "/financeiro/performance-e-capital",
        label: "Performance & Capital",
        icone: "performance",
        permissao: "financeiro.performance_capital",
      },
      {
        href: "/financeiro/importacao",
        label: "Importação e parâmetros",
        icone: "importacao",
        permissao: "financeiro.importacao_parametros",
      },
    ],
  },
  {
    titulo: "Administração",
    itens: [
      {
        href: "/admin/usuarios",
        label: "Usuários e cargos",
        icone: "usuarios",
        permissao: "admin.usuarios",
      },
      {
        href: "/admin/empresa",
        label: "Empresa",
        icone: "empresa",
        permissao: "admin.empresa",
      },
      {
        href: "/admin/integracoes",
        label: "Integrações",
        icone: "integracoes",
        permissao: "admin.integracoes",
      },
    ],
  },
];

/** Mantém só os itens que o usuário pode ver e remove seções vazias. */
export function navigationFor(pode: (p: Permissao) => boolean): NavSection[] {
  return navigation
    .map((s) => ({
      ...s,
      itens: s.itens.filter((i) => i.permissao === null || pode(i.permissao)),
    }))
    .filter((s) => s.itens.length > 0);
}

/** Seção e item da tela atual (para o título da barra superior). */
export function ondeEstou(sections: NavSection[], pathname: string) {
  let achado: { secao: string; item: NavItem } | null = null;
  for (const s of sections) {
    for (const item of s.itens) {
      const casa =
        pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (casa && item.href.length > (achado?.item.href.length ?? 0)) {
        achado = { secao: s.titulo, item };
      }
    }
  }
  return achado;
}
