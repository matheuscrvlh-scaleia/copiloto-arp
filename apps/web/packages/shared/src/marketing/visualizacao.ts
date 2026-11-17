// Visualização padrão do Marketing: o administrador (Configurações ›
// Visualização) esconde quadros de cada tela e vale para todos do módulo.
// Não há escolha por usuário. No banco fica a lista "tela.quadro" dos
// escondidos (marketing.parametros.quadros_ocultos): quadro novo nasce
// visível.

export const TELAS_VISUALIZACAO = {
  painel: {
    rotulo: "Painel",
    quadros: {
      fluxo: "Fluxo de visitantes",
      buscas_marca: "Buscas pela marca ARP",
      eventos: "Eventos e ativações",
      campanhas: "Campanhas ativas",
      investimento: "Investimento em anúncios",
      leads: "Leads no RD",
      custo_por_lead: "Custo por lead",
      onde_agir: "Onde agir",
      buscas_site: "Buscas no Google que levam ao site",
      redes: "Redes sociais: engajamento",
      resumo: "Resumo por frente",
      leads_semana: "Leads no RD por semana",
      cpl_semana: "Custo por lead por semana",
    },
  },
  publico: {
    rotulo: "Público e visitação",
    quadros: {
      cartoes: "Cartões de fluxo",
      por_dia: "Fluxo por dia",
      por_hora: "Fluxo por hora",
      dia_da_semana: "Média por dia da semana",
      comparativo_anual: "Comparativo anual por dia da semana",
    },
  },
  anuncios: {
    rotulo: "Performance de anúncios",
    quadros: {
      cartoes: "Cartões do topo",
      campanhas: "Campanhas",
      verba: "Onde a verba rende",
    },
  },
  site: {
    rotulo: "Site e leads",
    quadros: {
      cartoes: "Cartões do topo",
      trafego: "Tráfego por canal",
      leads: "Leads do período",
      buscas: "Buscas no Google que trazem ao site",
      funil: "Do site ao cliente",
      origem: "De onde vêm os leads",
    },
  },
  redes: {
    rotulo: "Redes sociais",
    quadros: {
      cartoes: "Cartões do topo",
      posts: "Posts do período",
      seguidores: "Seguidores por rede",
      demografia: "Demografia",
    },
  },
  reputacao: {
    rotulo: "Reputação",
    quadros: {
      cartoes_arp: "Cartões da ARP",
      avaliacoes: "Avaliações da ARP",
      nota_mes: "Nota média por mês",
      locatarios: "Locatários-chave",
      temas: "Reclamações por tema",
      benchmark: "Aba Benchmark",
    },
  },
} as const satisfies Record<
  string,
  { rotulo: string; quadros: Record<string, string> }
>;

export type TelaVisualizacao = keyof typeof TELAS_VISUALIZACAO;
export type QuadroDe<T extends TelaVisualizacao> =
  keyof (typeof TELAS_VISUALIZACAO)[T]["quadros"];

/** Todas as chaves "tela.quadro" que existem (as outras são ignoradas). */
export const CHAVES_QUADROS: string[] = Object.entries(
  TELAS_VISUALIZACAO,
).flatMap(([t, d]) => Object.keys(d.quadros).map((q) => `${t}.${q}`));

/** Diz se o quadro aparece, pela lista de escondidos. */
export function visiveisDa<T extends TelaVisualizacao>(
  tela: T,
  ocultos: readonly string[],
): (quadro: QuadroDe<T>) => boolean {
  const fora = new Set(ocultos);
  return (q) => !fora.has(`${tela}.${String(q)}`);
}

/** Escondidos a gravar: os que existem e não vieram marcados como visíveis. */
export function ocultosDoFormulario(visiveis: readonly string[]): string[] {
  const ve = new Set(visiveis);
  return CHAVES_QUADROS.filter((c) => !ve.has(c));
}
