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
} satisfies Record<string, QueryKey | ((...a: never[]) => QueryKey)>;
