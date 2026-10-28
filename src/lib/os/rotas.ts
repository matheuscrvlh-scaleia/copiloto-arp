// Endereços das telas do módulo Tickets (um lugar só, para os links
// das notificações, do WhatsApp e das telas não se perderem).

export const ROTAS_OS = {
  caixa: "/os",
  novo: "/os/novo",
  meuSetor: "/os/meu-setor",
  quadro: "/os/quadro",
  avisos: "/os/avisos",
  modelos: "/os/modelos",
  calendario: "/os/calendario",
  ordens: "/os/ordens",
  ativos: "/os/ativos",
  vistorias: "/os/vistorias",
  portal: "/os/portal",
  paineis: "/os/paineis",
  configuracoes: "/os/configuracoes",
} as const;

/** Página inteira do chamado. */
export function rotaChamado(id: string): string {
  return `/os/chamados/${id}`;
}

/** Novo chamado para o Financeiro, preenchido com a OS concluída. */
export function rotaTicketFinanceiro(osId: string): string {
  return `/os/novo?financeiro=${osId}`;
}

/** Abre o chamado na janela lateral da tela atual (?c=<id>). */
export const PARAM_PAINEL = "c";

export function rotaAtivo(id: string): string {
  return `/os/ativos/${id}`;
}

export function rotaVistoria(id: string): string {
  return `/os/vistorias/${id}`;
}

/** PDF do laudo (?entrada=1 inclui as fotos da entrada; ?baixar=1 baixa). */
export function rotaLaudo(id: string): string {
  return `/os/vistorias/${id}/laudo`;
}

/** Portal do lojista: um endereço só; a loja entra com o CNPJ. */
export const ROTA_PORTAL = "/portal";

/** OS do terceirizado (sem login), aberta pelo token. */
export function rotaTerceirizado(token: string): string {
  return `/ordem/${token}`;
}
