/**
 * Pontos da tela onde um passo do guia pode apontar. Cada um é um atributo
 * `data-guia` num componente comum (título, filtros, cartões, abas…), então
 * toda tela que usa o componente já tem o ponto, sem marcar página por página.
 * Para apontar para algo só daquela tela, ponha `data-guia="<nome>"` no
 * elemento e acrescente o nome aqui.
 */
export type Alvo =
  // Moldura (iguais em todas as telas)
  | "menu"
  | "menu-modulo"
  | "onde-estou"
  | "busca-telas"
  | "avisos"
  | "guia"
  // Componentes das telas
  | "titulo"
  | "fonte"
  | "exportar"
  | "filtros"
  | "abas"
  | "cartoes"
  | "secao"
  | "dica"
  | "tabela"
  | "busca";

export interface Passo {
  /** Sem alvo, o passo aparece no centro da tela (abertura, resumo). */
  alvo?: Alvo;
  titulo: string;
  texto: string;
}

export interface Guia {
  /**
   * Suba ao mudar o guia: quem já tinha visto volta a ver o aviso de
   * novidade no botão.
   */
  versao: number;
  passos: Passo[];
}
