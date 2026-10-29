// Sorteio determinístico dos dados de exemplo: a mesma semente dá sempre o
// mesmo número. As sementes levam a data do calendário (não "há N dias"),
// então o número de um dia não muda quando a tela é aberta no dia seguinte.

/** Hash de texto em 32 bits (cyrb53 reduzido). */
function hash(texto: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

export interface Sorteio {
  /** [0, 1) */
  n(): number;
  /** Inteiro em [a, b]. */
  int(a: number, b: number): number;
  /** Valor em torno de `base`, variando até ±`variacao` (fração). */
  perto(base: number, variacao: number): number;
  escolha<T>(lista: readonly T[]): T;
  /** Escolha com pesos ([valor, peso]). */
  pesada<T>(lista: readonly (readonly [T, number])[]): T;
  /** Quantidade com média `media` (Poisson). */
  contagem(media: number): number;
  chance(p: number): boolean;
}

/** Gerador mulberry32 a partir de qualquer texto. */
export function sorteio(semente: string): Sorteio {
  let a = hash(semente);
  const n = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const s: Sorteio = {
    n,
    int: (x, y) => x + Math.floor(n() * (y - x + 1)),
    perto: (base, v) => base * (1 + (n() * 2 - 1) * v),
    escolha: (lista) => lista[Math.floor(n() * lista.length)] as never,
    pesada: (lista) => {
      const total = lista.reduce((t, [, p]) => t + p, 0);
      let r = n() * total;
      for (const [v, p] of lista) {
        r -= p;
        if (r < 0) return v;
      }
      return (lista.at(-1) as readonly [never, number])[0];
    },
    contagem: (media) => {
      if (media <= 0) return 0;
      // Knuth até 30; acima, normal aproximada.
      if (media > 30)
        return Math.max(
          0,
          Math.round(media + Math.sqrt(media) * (n() + n() + n() - 1.5) * 2),
        );
      const l = Math.exp(-media);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= n();
      } while (p > l);
      return k - 1;
    },
    chance: (p) => n() < p,
  };
  return s;
}

/** Arredonda para `casas` decimais. */
export const arred = (v: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
};

/**
 * Guarda o resultado por chave (a data de hoje e o que mais a geração usa):
 * os dados de exemplo são calculados uma vez por dia em cada servidor.
 */
export function memo<T>(gerar: (chave: string) => T): (chave: string) => T {
  const guardado = new Map<string, T>();
  return (chave) => {
    const pronto = guardado.get(chave);
    if (pronto !== undefined) return pronto;
    const novo = gerar(chave);
    if (guardado.size > 4) guardado.clear();
    guardado.set(chave, novo);
    return novo;
  };
}
