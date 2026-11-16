import type { QueryKey } from "@tanstack/react-query";

// Chaves de consulta do Comercial (/api/v1/comercial). Toda chave começa por
// "comercial"; gravação que mexe em configuração invalida `tudo` (parâmetros
// e listas aparecem em várias telas). A parte B (censo, fichas, kit,
// eventos, pesquisa) acrescenta as suas aqui.

export const chavesCom = {
  tudo: ["comercial"] as const,
  painel: (ano: number | null) => ["comercial", "painel", ano] as const,
  metas: () => ["comercial", "metas"] as const,
  funil: () => ["comercial", "funil"] as const,
  ocupacao: () => ["comercial", "ocupacao"] as const,
  luc: (numero: string) => ["comercial", "ocupacao", "luc", numero] as const,
  vencimentos: () => ["comercial", "vencimentos"] as const,
  vencimento: (c: string) => ["comercial", "vencimentos", c] as const,
  relacionamento: ["comercial", "relacionamento"] as const,
  configRelacionamento: () =>
    ["comercial", "relacionamento", "config"] as const,
  locatarios: () => ["comercial", "relacionamento", "locatarios"] as const,
  aniversarios: (mes: number | null) =>
    ["comercial", "relacionamento", "aniversarios", mes] as const,
  contatos: (filtros: Record<string, string>) =>
    ["comercial", "relacionamento", "contatos", filtros] as const,
  contato: (id: string) =>
    ["comercial", "relacionamento", "contato", id] as const,
  contratos: ["comercial", "contratos"] as const,
  listaContratos: (atualizacao: string) =>
    ["comercial", "contratos", "lista", atualizacao] as const,
  apoioContrato: () => ["comercial", "contratos", "apoio"] as const,
  contrato: (id: string) => ["comercial", "contratos", "um", id] as const,
  contratosEnet: () => ["comercial", "contratos", "enet"] as const,
  vistoria: (luc: string, tipo: string) =>
    ["comercial", "contratos", "vistoria", luc, tipo] as const,
  configuracoes: ["comercial", "configuracoes"] as const,
  parametros: () => ["comercial", "configuracoes", "parametros"] as const,
  blocoParametros: (bloco: string) =>
    ["comercial", "configuracoes", "parametros", bloco] as const,
  historico: (grupo: string, limite: number) =>
    ["comercial", "configuracoes", "historico", grupo, limite] as const,
  importacoes: ["comercial", "importacoes"] as const,
  tiposImportacao: () => ["comercial", "importacoes", "tipos"] as const,
  // Parte B
  censo: ["comercial", "censo"] as const,
  telaCenso: () => ["comercial", "censo", "tela"] as const,
  indicadoresCenso: () => ["comercial", "censo", "indicadores"] as const,
  feedbacksCenso: (rodada: string, origem: string) =>
    ["comercial", "censo", "feedbacks", rodada, origem] as const,
  rodadasCenso: () => ["comercial", "censo", "rodadas"] as const,
  rodadaCenso: (id: string) => ["comercial", "censo", "rodadas", id] as const,
  questionarioCenso: () => ["comercial", "censo", "questionario"] as const,
  presencialCenso: (convite: string) =>
    ["comercial", "censo", "presencial", convite] as const,
  fichas: ["comercial", "fichas"] as const,
  listaFichas: (desde: string, tipo: string) =>
    ["comercial", "fichas", "lista", desde, tipo] as const,
  demonstracaoFicha: () => ["comercial", "fichas", "demonstracao"] as const,
  ficha: (id: string) => ["comercial", "fichas", "uma", id] as const,
  kit: ["comercial", "kit"] as const,
  telaKit: () => ["comercial", "kit", "tela"] as const,
  documentoKit: (id: string) => ["comercial", "kit", "documento", id] as const,
  eventos: ["comercial", "eventos"] as const,
  telaEventos: () => ["comercial", "eventos", "tela"] as const,
  apoioEventos: () => ["comercial", "eventos", "apoio"] as const,
  feriadosEventos: (anos: string) =>
    ["comercial", "eventos", "feriados", anos] as const,
  proposta: (id: string) => ["comercial", "eventos", "proposta", id] as const,
  pesquisa: ["comercial", "pesquisa"] as const,
  telaPesquisa: () => ["comercial", "pesquisa", "tela"] as const,
  apoioPesquisa: () => ["comercial", "pesquisa", "apoio"] as const,
  imovel: (id: string) => ["comercial", "pesquisa", "imovel", id] as const,
} satisfies Record<string, QueryKey | ((...a: never[]) => QueryKey)>;
