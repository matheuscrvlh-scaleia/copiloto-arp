import type { Permissao } from "@/lib/permissions";

/** Nome do ícone (lucide), traduzido em components/shell/icones.tsx. */
export type Icone =
  | "dashboard"
  | "painel"
  | "custo"
  | "quadro"
  | "jornada"
  | "funcionarios"
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
  | "integracoes"
  | "historico"
  | "configuracoes"
  | "caixa"
  | "setor"
  | "enviados"
  | "quadro_kanban"
  | "calendario"
  | "ordens"
  | "ativos"
  | "vistorias"
  | "portal"
  | "paineis"
  | "marca"
  | "anuncios"
  | "site"
  | "redes"
  | "reputacao"
  | "radar"
  | "eventos"
  | "funil"
  | "ocupacao"
  | "vencimentos"
  | "relacionamento"
  | "censo"
  | "contratos"
  | "fichas"
  | "kit"
  | "simulador"
  | "pesquisa"
  | "formularios";

export interface NavItem {
  href: string;
  label: string;
  icone: Icone;
  /**
   * null: qualquer usuário logado (o conteúdo filtra pelas permissões).
   * Lista: basta uma delas (ex.: Configurações, com abas por permissão).
   */
  permissao: Permissao | Permissao[] | null;
}

export interface NavSection {
  titulo: string;
  itens: NavItem[];
}

/** Primeira tela depois do login. */
export const INICIO = "/gestao";

/** Abas de RH › Configurações: o que alimenta o módulo, longe das telas de consulta. */
export const CONFIGURACOES_RH = {
  importacoes: "/rh/configuracoes/importacoes",
  cadastros: "/rh/configuracoes/cadastros",
  parametros: "/rh/configuracoes/parametros",
} as const;

/** Página de um benefício (quem recebe, valores do mês, dependentes). */
export const rotaDoBeneficio = (id: string, aba?: string) =>
  `${CONFIGURACOES_RH.cadastros}/beneficios/${id}${aba ? `?aba=${aba}` : ""}`;

/** Abas de Tickets › Configurações (cada uma com a sua permissão). */
export const CONFIGURACOES_OS = {
  catalogo: "/os/configuracoes/catalogo",
  setores: "/os/configuracoes/setores",
  modelos: "/os/configuracoes/modelos",
  terceirizados: "/os/configuracoes/terceirizados",
  parametros: "/os/configuracoes/parametros",
  historico: "/os/configuracoes/historico",
} as const;

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
        href: "/rh/funcionarios",
        label: "Funcionários",
        icone: "funcionarios",
        permissao: "rh.funcionarios",
      },
      {
        href: "/rh/jornada",
        label: "Jornada",
        icone: "jornada",
        permissao: "rh.jornada",
      },
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
        href: "/rh/endomarketing",
        label: "Endomarketing",
        icone: "endomarketing",
        permissao: "rh.endomarketing",
      },
      {
        href: "/rh/configuracoes",
        label: "Configurações",
        icone: "configuracoes",
        permissao: ["rh.folha", "rh.beneficios", "rh.parametros"],
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
    titulo: "Tickets",
    // Painéis no topo; depois o dia a dia (calendário e chamados),
    // ordens, ativos, vistorias e portal e, por último, a configuração.
    itens: [
      {
        href: "/os/paineis",
        label: "Painéis",
        icone: "paineis",
        permissao: ["os.painel_setor", "os.painel_geral"],
      },
      {
        href: "/os/calendario",
        label: "Calendário",
        icone: "calendario",
        permissao: "os.acessar",
      },
      {
        // Abas: Minha caixa, Geral, Quadro, Avisos e Disparos e lembretes (as
        // com permissão própria só aparecem para quem a tem).
        href: "/os",
        label: "Chamados",
        icone: "caixa",
        permissao: "os.acessar",
      },
      {
        href: "/os/ordens",
        label: "Ordens de serviço",
        icone: "ordens",
        permissao: "os.acessar",
      },
      {
        href: "/os/vistorias",
        label: "Vistorias",
        icone: "vistorias",
        permissao: "os.vistorias",
      },
      {
        href: "/os/portal",
        label: "Portal lojista",
        icone: "portal",
        permissao: ["os.portal", "os.portal_agenda"],
      },
      {
        href: "/os/ativos",
        label: "Ativos",
        icone: "ativos",
        permissao: ["os.ativos", "os.ativos_gerenciar"],
      },
      {
        href: "/os/configuracoes",
        label: "Configurações",
        icone: "configuracoes",
        permissao: [
          "os.catalogo",
          "os.modelos",
          "os.terceirizados",
          "os.parametros",
          "os.historico",
        ],
      },
    ],
  },
  {
    titulo: "Marketing",
    // Painel no topo; depois as consultas e, por último, os parâmetros.
    itens: [
      {
        href: "/marketing",
        label: "Painel",
        icone: "painel",
        permissao: "marketing.painel",
      },
      {
        href: "/marketing/marca",
        label: "Marca",
        icone: "marca",
        permissao: "marketing.marca",
      },
      {
        href: "/marketing/anuncios",
        label: "Performance de anúncios",
        icone: "anuncios",
        permissao: "marketing.anuncios",
      },
      {
        href: "/marketing/site",
        label: "Site e leads",
        icone: "site",
        permissao: "marketing.site",
      },
      {
        href: "/marketing/redes",
        label: "Redes sociais",
        icone: "redes",
        permissao: "marketing.redes",
      },
      {
        href: "/marketing/reputacao",
        label: "Reputação",
        icone: "reputacao",
        permissao: "marketing.reputacao",
      },
      {
        href: "/marketing/eventos",
        label: "Eventos",
        icone: "eventos",
        permissao: "marketing.eventos",
      },
      {
        href: "/marketing/radar",
        label: "Radar operacional",
        icone: "radar",
        permissao: "marketing.radar",
      },
      {
        href: "/marketing/configuracoes",
        label: "Configurações",
        icone: "parametros",
        permissao: "marketing.parametros",
      },
    ],
  },
  {
    titulo: "Comercial",
    // Painel no topo; depois as consultas, as ferramentas e os parâmetros.
    itens: [
      {
        href: "/comercial",
        label: "Painel",
        icone: "painel",
        permissao: "comercial.painel.ver",
      },
      {
        href: "/comercial/funil",
        label: "Funil comercial",
        icone: "funil",
        permissao: "comercial.funil.ver",
      },
      {
        href: "/comercial/ocupacao",
        label: "Ocupação e estoque",
        icone: "ocupacao",
        permissao: "comercial.ocupacao.ver",
      },
      {
        href: "/comercial/vencimentos",
        label: "Vencimentos",
        icone: "vencimentos",
        permissao: "comercial.vencimentos.ver",
      },
      {
        href: "/comercial/relacionamento",
        label: "Relacionamento",
        icone: "relacionamento",
        permissao: "comercial.relacionamento.ver",
      },
      {
        href: "/comercial/censo",
        label: "Censo",
        icone: "censo",
        permissao: "comercial.censo.ver",
      },
      {
        href: "/comercial/contratos",
        label: "Contratos",
        icone: "contratos",
        permissao: "comercial.contratos.ver",
      },
      {
        href: "/comercial/fichas",
        label: "Fichas cadastrais",
        icone: "fichas",
        permissao: ["comercial.formulario.ver", "comercial.formulario.link"],
      },
      {
        href: "/comercial/kit",
        label: "Kit de entrega",
        icone: "kit",
        permissao: "comercial.kit.ver",
      },
      {
        href: "/comercial/eventos",
        label: "Eventos",
        icone: "simulador",
        permissao: "comercial.eventos.ver",
      },
      {
        href: "/comercial/pesquisa",
        label: "Pesquisa de mercado",
        icone: "pesquisa",
        permissao: "comercial.pesquisa.ver",
      },
      {
        href: "/comercial/configuracoes",
        label: "Configurações",
        icone: "parametros",
        // Quem abre alguma aba: Parâmetros, Metas ou Importações (os mesmos
        // tipos de comercial.pode_importar).
        permissao: [
          "comercial.parametros.editar",
          "comercial.painel.metas",
          "comercial.censo.importar",
          "comercial.formulario.ver",
          "comercial.pesquisa.editar",
          "comercial.relacionamento.registrar",
        ],
      },
    ],
  },
  {
    titulo: "Formulários",
    itens: [
      {
        href: "/formularios",
        label: "Formulários",
        icone: "formularios",
        permissao: ["formularios.ver", "formularios.editar"],
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
      {
        href: "/admin/historico",
        label: "Histórico de alterações",
        icone: "historico",
        permissao: "admin.historico",
      },
    ],
  },
];

/** Mantém só os itens que o usuário pode ver e remove seções vazias. */
export function navigationFor(pode: (p: Permissao) => boolean): NavSection[] {
  return navigation
    .map((s) => ({
      ...s,
      itens: s.itens.filter((i) =>
        i.permissao === null
          ? true
          : Array.isArray(i.permissao)
            ? i.permissao.some(pode)
            : pode(i.permissao),
      ),
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
