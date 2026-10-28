// Layout do laudo de vistoria homologado (spec 4.16 B), sem PDF: tamanho
// das fotos e quebra de página. Tudo em milímetros, com o y medido do topo
// da folha. O gerador (server/os/pdf/laudo.ts) mede os textos com a fonte
// e desenha nas posições que estas funções devolvem.

export const LAUDO = {
  /** A4 retrato. */
  largura: 210,
  altura: 297,
  lateral: 14,
  /** Cabeçalho de toda página. */
  cabecalho: 38,
  /**
   * Onde o conteúdo começa (abaixo do cabeçalho) e termina: acima do
   * rodapé do papel timbrado, cuja linha fica a 252 mm (como no PDF da OS).
   */
  conteudoTopo: 53,
  conteudoFim: 249,
  larguraUtil: 210 - 2 * 14,
  /** Rótulo das linhas de identificação; o valor vem 50 mm adiante. */
  recuoDoValor: 50,
} as const;

// Folga de arredondamento (frações de mm não abrem página nem linha nova).
const FOLGA = 0.01;

export const FOTOS = {
  /** Espaço entre as fotos, na linha e entre as linhas. */
  vao: 3,
  /** Altura de toda foto: três horizontais 4:3 enchem a largura útil. */
  altura: 44,
} as const;

/** Alturas fixas dos blocos (mm), as mesmas que o gerador desenha. */
export const ALTURAS = {
  tituloDeSecao: 10,
  linhaDeDado: 5,
  /** Entrelinha do texto 8,5 e do 8. */
  linha85: 3.9,
  linha8: 3.7,
  depoisDoTexto: 4,
  faixa: 6,
  depoisDaFaixa: 2.5,
  rotuloDeFotos: 5,
  separador: 6,
} as const;

export interface Dimensao {
  largura: number;
  altura: number;
}

export interface FotoNaLinha {
  /** Posição da foto na lista de entrada. */
  indice: number;
  /** Distância da margem esquerda. */
  x: number;
  largura: number;
  altura: number;
}

export interface LinhaDeFotos {
  altura: number;
  fotos: FotoNaLinha[];
}

/** Maior tamanho que cabe na caixa mantendo a proporção (nunca estica). */
export function caber(
  d: Dimensao,
  larguraMax: number,
  alturaMax: number,
): Dimensao {
  const escala = Math.min(larguraMax / d.largura, alturaMax / d.altura);
  return { largura: d.largura * escala, altura: d.altura * escala };
}

/**
 * Fotos lado a lado, na ordem, todas com 44 mm de altura e a largura da
 * proporção: entram na linha enquanto couberem (três horizontais ou cinco
 * verticais) e a que não cabe abre a seguinte. Panorama mais largo que a
 * página encolhe até caber.
 */
export function linhasDeFotos(
  fotos: Dimensao[],
  larguraUtil: number = LAUDO.larguraUtil,
): LinhaDeFotos[] {
  const linhas: LinhaDeFotos[] = [];
  let proximoX = 0;
  fotos.forEach((d, indice) => {
    const t = caber(d, larguraUtil, FOTOS.altura);
    let atual = linhas.at(-1);
    if (!atual || proximoX + t.largura > larguraUtil + FOLGA) {
      atual = { altura: 0, fotos: [] };
      linhas.push(atual);
      proximoX = 0;
    }
    atual.fotos.push({ indice, x: proximoX, ...t });
    atual.altura = Math.max(atual.altura, t.altura);
    proximoX += t.largura + FOTOS.vao;
  });
  return linhas;
}

// ---------------------------------------------------------------------------
// Quebra de página
// ---------------------------------------------------------------------------

export interface Peca<T> {
  altura: number;
  /** Se não couber no fim da página, some em vez de abrir outra (separador). */
  opcional?: boolean;
  /** Fica na mesma página que a peça seguinte (rótulo das fotos). */
  comAProxima?: boolean;
  conteudo: T;
}

export interface Grupo<T> {
  pecas: Peca<T>[];
  /**
   * Quantas peças do começo ficam sempre na mesma página (no ambiente:
   * título, descrição e a primeira linha de fotos). Se não couberem no
   * fim da página, o grupo inteiro começa na seguinte.
   */
  juntas: number;
}

export interface Posicao {
  pagina: number;
  /** Topo da peça, em mm do topo da folha. */
  y: number;
}

export interface Area {
  topo: number;
  fim: number;
}

const AREA: Area = { topo: LAUDO.conteudoTopo, fim: LAUDO.conteudoFim };

/**
 * Posição de cada peça (null: peça opcional que não coube). Uma peça que
 * não cabe vai para a página seguinte; a cabeça do grupo nunca se separa,
 * a menos que seja maior que uma página inteira.
 */
export function paginar<T>(
  grupos: Grupo<T>[],
  area: Area = AREA,
  inicio: Posicao = { pagina: 0, y: area.topo },
): { posicoes: (Posicao | null)[][]; fim: Posicao } {
  let { pagina, y } = inicio;
  const cabe = (h: number) => y + h <= area.fim + FOLGA;
  const virar = () => {
    pagina += 1;
    y = area.topo;
  };

  const posicoes = grupos.map((g) => {
    const cabeca = g.pecas
      .slice(0, Math.max(1, g.juntas))
      .reduce((s, p) => s + p.altura, 0);
    if (!cabe(cabeca) && y > area.topo) virar();
    return g.pecas.map((p, i): Posicao | null => {
      const junto = p.comAProxima ? (g.pecas[i + 1]?.altura ?? 0) : 0;
      if (!cabe(p.altura + junto)) {
        if (p.opcional) return null;
        if (y > area.topo) virar();
      }
      const aqui = { pagina, y };
      y += p.altura;
      return aqui;
    });
  });
  return { posicoes, fim: { pagina, y } };
}

// ---------------------------------------------------------------------------
// Ambiente do laudo
// ---------------------------------------------------------------------------

export type PecaDoAmbiente =
  | { tipo: "faixa" }
  | { tipo: "descricao"; linha: number }
  | { tipo: "rotulo"; qual: "entrada" | "saida" }
  | { tipo: "fotos"; qual: "entrada" | "saida"; linha: number }
  | { tipo: "separador" };

/**
 * Peças de um ambiente na ordem do laudo. Com as fotos da entrada (saída
 * com comparação), elas vêm antes, com o rótulo "Na entrada", e as atuais
 * com "Na saída". A cabeça vai até a primeira linha de fotos.
 */
export function grupoDoAmbiente(a: {
  linhasDescricao: number;
  fotos: LinhaDeFotos[];
  fotosDaEntrada?: LinhaDeFotos[];
  ultimo?: boolean;
}): Grupo<PecaDoAmbiente> {
  const pecas: Peca<PecaDoAmbiente>[] = [
    {
      altura: ALTURAS.faixa + ALTURAS.depoisDaFaixa,
      conteudo: { tipo: "faixa" },
    },
  ];
  const descricao = Math.max(1, a.linhasDescricao);
  for (let i = 0; i < descricao; i++)
    pecas.push({
      // A última linha leva o respiro antes das fotos.
      altura: ALTURAS.linha85 + (i === descricao - 1 ? 2 : 0),
      conteudo: { tipo: "descricao", linha: i },
    });

  const comparar = !!a.fotosDaEntrada?.length;
  const blocos: ["entrada" | "saida", LinhaDeFotos[]][] = comparar
    ? [
        ["entrada", a.fotosDaEntrada ?? []],
        ["saida", a.fotos],
      ]
    : [["saida", a.fotos]];
  let juntas = pecas.length;
  let primeiraLinha = true;
  for (const [qual, linhas] of blocos) {
    if (comparar && linhas.length) {
      pecas.push({
        altura: ALTURAS.rotuloDeFotos,
        comAProxima: true,
        conteudo: { tipo: "rotulo", qual },
      });
      if (primeiraLinha) juntas = pecas.length;
    }
    linhas.forEach((l, i) => {
      pecas.push({
        altura: l.altura + FOTOS.vao,
        conteudo: { tipo: "fotos", qual, linha: i },
      });
      if (primeiraLinha) {
        juntas = pecas.length;
        primeiraLinha = false;
      }
    });
  }
  if (!a.ultimo)
    pecas.push({
      altura: ALTURAS.separador,
      opcional: true,
      conteudo: { tipo: "separador" },
    });
  return { pecas, juntas };
}

/** Quantas páginas a paginação usou (a do termo vem depois). */
export function paginasUsadas(posicoes: (Posicao | null)[][]): number {
  let maior = 0;
  for (const g of posicoes)
    for (const p of g) if (p && p.pagina > maior) maior = p.pagina;
  return maior + 1;
}
