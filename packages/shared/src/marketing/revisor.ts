// Revisor de texto da Marca (spec 4.4): comparação simples de palavras, sem
// IA. Acha no texto as palavras proibidas e as proprietárias da base da
// marca, sem diferença de maiúscula e acento, casando expressões de várias
// palavras ("Tem de tudo") só em palavra inteira ("Shopping" não casa
// "Shoppings"). Não reescreve nada: só aponta e sugere.

export type TipoTrecho = "normal" | "proibida" | "propria";

/** Pedaço do texto original, na ordem, para desenhar com destaque. */
export interface Trecho {
  tipo: TipoTrecho;
  texto: string;
  /** Termo da lista que casou (como está cadastrado). */
  termo?: string;
}

export interface Contagem {
  termo: string;
  vezes: number;
}

export interface Revisao {
  trechos: Trecho[];
  /** Proibidas encontradas, na ordem da lista. */
  proibidas: Contagem[];
  /** Soma das ocorrências de proibidas. */
  totalProibidas: number;
  /** Proprietárias que o texto já usa. */
  proprietariasUsadas: Contagem[];
  /** Proprietárias que ainda não aparecem ("Use no lugar"). */
  sugestoes: string[];
}

/** Minúsculas e sem acento, para comparar. */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Texto normalizado e, para cada caractere dele, a posição no original
 * (normalizar muda o tamanho: "É" vira "e" + acento, e o acento sai).
 */
function mapear(texto: string): { norm: string; origem: number[] } {
  let norm = "";
  const origem: number[] = [];
  let i = 0;
  for (const ch of texto) {
    const n = normalizar(ch);
    for (const c of n) {
      norm += c;
      origem.push(i);
    }
    i += ch.length;
  }
  origem.push(texto.length);
  return { norm, origem };
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Termo → regex de palavra inteira, com qualquer espaço entre as palavras. */
function padrao(termo: string): RegExp | null {
  const partes = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!partes.length) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${partes.map(escapar).join("\\s+")}(?![\\p{L}\\p{N}])`,
    "gu",
  );
}

interface Achado {
  inicio: number;
  fim: number;
  tipo: Exclude<TipoTrecho, "normal">;
  termo: string;
}

function achar(norm: string, termos: string[], tipo: Achado["tipo"]): Achado[] {
  const achados: Achado[] = [];
  for (const termo of termos) {
    const re = padrao(termo);
    if (!re) continue;
    for (const m of norm.matchAll(re))
      achados.push({
        inicio: m.index,
        fim: m.index + m[0].length,
        tipo,
        termo,
      });
  }
  return achados;
}

/** Termos sem repetição (mesmo termo com outra grafia conta uma vez). */
function unicos(termos: string[]): string[] {
  const vistos = new Set<string>();
  return termos
    .map((t) => t.trim())
    .filter((t) => {
      const n = normalizar(t).replace(/\s+/g, " ");
      if (!n || vistos.has(n)) return false;
      vistos.add(n);
      return true;
    });
}

export function revisar(
  texto: string,
  listas: { proibidas: string[]; proprietarias: string[] },
): Revisao {
  const proibidas = unicos(listas.proibidas);
  const proprietarias = unicos(listas.proprietarias);
  const { norm, origem } = mapear(texto);

  // Proibida vence proprietária no mesmo trecho; entre iguais, a mais longa
  // ("Super Espaço" antes de "Espaço"). Sobreposição: fica a primeira.
  const todos = [
    ...achar(norm, proibidas, "proibida"),
    ...achar(norm, proprietarias, "propria"),
  ].sort(
    (a, b) =>
      a.inicio - b.inicio ||
      (a.tipo === b.tipo ? 0 : a.tipo === "proibida" ? -1 : 1) ||
      b.fim - a.fim,
  );
  const escolhidos: Achado[] = [];
  let ate = -1;
  for (const a of todos) {
    if (a.inicio < ate) continue;
    escolhidos.push(a);
    ate = a.fim;
  }

  const trechos: Trecho[] = [];
  let pos = 0;
  for (const a of escolhidos) {
    const de = origem[a.inicio] as number;
    const para = origem[a.fim] as number;
    if (de > pos) trechos.push({ tipo: "normal", texto: texto.slice(pos, de) });
    trechos.push({
      tipo: a.tipo,
      texto: texto.slice(de, para),
      termo: a.termo,
    });
    pos = para;
  }
  if (pos < texto.length)
    trechos.push({ tipo: "normal", texto: texto.slice(pos) });

  const contar = (lista: string[], tipo: Achado["tipo"]): Contagem[] =>
    lista
      .map((termo) => ({
        termo,
        vezes: escolhidos.filter((a) => a.tipo === tipo && a.termo === termo)
          .length,
      }))
      .filter((c) => c.vezes > 0);
  const achadasProibidas = contar(proibidas, "proibida");
  const usadas = contar(proprietarias, "propria");
  const usadasSet = new Set(usadas.map((u) => u.termo));
  return {
    trechos,
    proibidas: achadasProibidas,
    totalProibidas: achadasProibidas.reduce((s, c) => s + c.vezes, 0),
    proprietariasUsadas: usadas,
    sugestoes: proprietarias.filter((t) => !usadasSet.has(t)),
  };
}
