// Endereços das telas do módulo Tickets (um lugar só, para os links
// das notificações, do WhatsApp e das telas não se perderem).

export const ROTAS_OS = {
  caixa: "/os",
  novo: "/os/novo",
  meuSetor: "/os/meu-setor",
  abertosPorMim: "/os/abertos-por-mim",
  quadro: "/os/quadro",
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

/** Links públicos (sem login), abertos pelo token. */
export function rotaPortal(token: string): string {
  return `/portal/${token}`;
}

export function rotaTerceirizado(token: string): string {
  return `/ordem/${token}`;
}
