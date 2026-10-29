// Endereços das telas do módulo Tickets (um lugar só, para os links
// das notificações, do WhatsApp e das telas não se perderem).

export const ROTAS_OS = {
  caixa: "/os",
  novo: "/os/novo",
  novaOrdem: "/os/ordens/nova",
  meuSetor: "/os/meu-setor",
  quadro: "/os/quadro",
  avisos: "/os/avisos",
  disparos: "/os/disparos",
  calendario: "/os/calendario",
  ordens: "/os/ordens",
  ordensCaixa: "/os/ordens/caixa",
  ordensGeral: "/os/ordens/geral",
  ordensQuadro: "/os/ordens/quadro",
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

/** Página inteira da OS. */
export function rotaOrdem(id: string): string {
  return `/os/ordens/${id}`;
}

/** Página do chamado ou da OS. */
export function rotaDo(x: { id: string; tipo: string }): string {
  return x.tipo === "os" ? rotaOrdem(x.id) : rotaChamado(x.id);
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

/** Vistoria para o locatário conferir e assinar (sem login), pelo token. */
export function rotaAssinaturaVistoria(token: string): string {
  return `/vistoria/${token}`;
}

/** OS do terceirizado (sem login), aberta pelo token. */
export function rotaTerceirizado(token: string): string {
  return `/ordem/${token}`;
}
