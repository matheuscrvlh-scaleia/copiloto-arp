// Chamados que o Módulo Sustentabilidade cria pelo sistema: as categorias
// (migration 20261116140000_sustentabilidade_chamados.sql), a referência de
// origem e os caminhos do botão "Executar". Funções puras: o servidor
// (src/server/sustentabilidade/rotinas.ts) usa daqui.

/** Categorias do módulo no Chamados, todas sem confirmação do solicitante. */
export const CATEGORIAS_DO_MODULO = [
  { nome: "Entrevista de resíduos", setor: "Sustentabilidade" },
  { nome: "Ronda dos coletores", setor: "Sustentabilidade" },
  { nome: "Lançar nota do RCC", setor: "Sustentabilidade" },
  { nome: "Renovar termo do Clube", setor: "Sustentabilidade" },
  { nome: "Cobrar lançamento do parceiro", setor: "Sustentabilidade" },
  { nome: "Relatório de Sustentabilidade do mês", setor: "Sustentabilidade" },
  // Sem o setor Operações, a migration põe em Sustentabilidade.
  { nome: "Recolhimento de coletor", setor: "Operações" },
] as const;

export type CategoriaDoModulo = (typeof CATEGORIAS_DO_MODULO)[number]["nome"];

export const MODULO_DOS_CHAMADOS = "sustentabilidade";

/** origem_ref do chamado da entrevista de um contrato. */
export function refDaEntrevista(contratoId: string): string {
  return `entrevista:${contratoId}`;
}

export const ROTA_ENTREVISTAS = "/sustentabilidade/entrevistas";

/** Ficha da entrevista do contrato. */
export function rotaFicha(contratoId: string): string {
  return `${ROTA_ENTREVISTAS}/${contratoId}`;
}

/** Tela de aplicar (o "Executar" do chamado). */
export function rotaAplicar(contratoId: string): string {
  return `${ROTA_ENTREVISTAS}/${contratoId}/aplicar`;
}

/** "Entrevista de resíduos – Loja X (LUC 11_129/11_130)". */
export function tituloDoChamado(c: {
  cliente_nome: string;
  lucs: readonly string[];
}): string {
  const luc = c.lucs.length ? ` (LUC ${c.lucs.join("/")})` : "";
  return `Entrevista de resíduos – ${c.cliente_nome}${luc}`.slice(0, 200);
}
