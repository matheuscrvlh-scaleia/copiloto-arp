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
  | "busca"
  | "visao"
  // Tickets
  | "mais-filtros"
  | "lote"
  | "novo"
  | "novo-categoria"
  | "novo-arquivos"
  | "novo-propriedades"
  | "chamado-acoes"
  | "chamado-descricao"
  | "chamado-checklist"
  | "chamado-destinos"
  | "chamado-conversa"
  | "chamado-informacoes"
  | "calendario"
  | "em-construcao"
  | "novo-titulo"
  | "novo-enviar"
  | "os-cronometro"
  | "os-bloco"
  | "novo-contrato"
  | "fichas-gerar"
  // Formulários
  | "formularios-novo"
  | "formularios-editor"
  | "formularios-situacao"
  | "formularios-link";

/**
 * Bloco, cartão ou aba pelo título que aparece na tela, sem marcar a página:
 * "secao:Onde agir", "cartao:Custo por lead", "aba:Locatários-chave".
 */
export type AlvoPorTitulo = `${"secao" | "cartao" | "aba"}:${string}`;

export interface Passo {
  /** Sem alvo, o passo aparece no centro da tela (abertura, resumo). */
  alvo?: Alvo | AlvoPorTitulo;
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

/** Passo de uma trilha: pode estar em outra tela e esperar a pessoa agir. */
export interface PassoTrilha extends Passo {
  /** Tela onde o passo acontece; o guia vai até ela. Sem rota: a do passo anterior. */
  rota?: string;
  /**
   * Avança sozinho quando este ponto aparece (a pessoa abriu o formulário,
   * escolheu a categoria, abriu uma OS). O Próximo continua valendo.
   */
  ate?: Alvo;
  /** Texto no centro quando o alvo não está na tela (ex.: lista vazia). */
  semAlvo?: string;
}

/** Processo de ponta a ponta, atravessando telas (ex.: a OS do começo ao fim). */
export interface Trilha {
  id: string;
  titulo: string;
  /** Uma linha no menu do botão Guia. */
  resumo: string;
  /** Aparece no menu das telas que começam com este endereço (ex.: "/os"). */
  modulo: string;
  versao: number;
  passos: PassoTrilha[];
}
