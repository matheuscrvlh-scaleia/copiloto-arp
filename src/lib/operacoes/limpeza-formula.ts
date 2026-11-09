// Fórmulas do Excel no subconjunto que a planilha do rateio usa nas células
// da área comum e dos extras ("5*F3+F7+B23", "278.68+3897*2",
// "SUM(B21:B22)", "SUM(B26*B27)", "38509.83*4.51%"): números (com %),
// referências (A1, $A$1), intervalos dentro de SUM/SOMA, + - * /, sinal e
// parênteses. Qualquer outra coisa (outra função, outra aba, texto) não é
// lida: quem chama segue pelo caminho dos valores calculados.

export interface Ref {
  coluna: string;
  linha: number;
}

export type NoFormula =
  | { t: "num"; v: number }
  | { t: "ref"; ref: Ref }
  /** Parcelas com sinal ("a+b-c", SUM(...)). */
  | { t: "soma"; parcelas: { sinal: 1 | -1; no: NoFormula }[] }
  /** Fatores: o primeiro multiplica; os outros multiplicam ou dividem. */
  | { t: "prod"; fatores: { op: "*" | "/"; no: NoFormula }[] };

/** Células de um intervalo; acima disso a fórmula não é lida. */
const MAX_INTERVALO = 200;

type Token =
  | { k: "num"; v: number }
  | { k: "ref"; ref: Ref; ate: Ref | null }
  | { k: "fn"; nome: string }
  | { k: "op"; v: string };

const TOKEN =
  /\s*(?:(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(%?)|\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?(?![A-Z(\d])|([A-Z][A-Z0-9.]*)\(|([-+*/(),;]))/y;

function tokens(formula: string): Token[] | null {
  const f = formula.trim().replace(/^=/, "").toUpperCase();
  const out: Token[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < f.length) {
    const inicio = TOKEN.lastIndex;
    const m = TOKEN.exec(f);
    if (!m) return f.slice(inicio).trim() === "" ? out : null;
    if (m[1] !== undefined) {
      const v = Number(m[1]);
      out.push({ k: "num", v: m[2] ? v / 100 : v });
    } else if (m[3] !== undefined) {
      const ref = { coluna: m[3], linha: Number(m[4]) };
      const ate =
        m[5] !== undefined ? { coluna: m[5], linha: Number(m[6]) } : null;
      out.push({ k: "ref", ref, ate });
    } else if (m[7] !== undefined) out.push({ k: "fn", nome: m[7] });
    else if (m[8] !== undefined) out.push({ k: "op", v: m[8] });
  }
  return out;
}

const FUNCOES_SOMA = new Set(["SUM", "SOMA"]);

/** Árvore da fórmula, ou null se ela sai do subconjunto lido. */
export function lerFormula(formula: string): NoFormula | null {
  const lidos = tokens(formula);
  if (!lidos?.length) return null;
  const ts: Token[] = lidos;
  let i = 0;
  const ver = () => ts[i];
  const eOp = (v: string) => {
    const t = ts[i];
    return t?.k === "op" && t.v === v;
  };

  function expr(): NoFormula {
    const parcelas: { sinal: 1 | -1; no: NoFormula }[] = [
      { sinal: 1, no: termo() },
    ];
    while (eOp("+") || eOp("-")) {
      const sinal = eOp("-") ? -1 : 1;
      i++;
      parcelas.push({ sinal, no: termo() });
    }
    return somaDe(parcelas);
  }
  function termo(): NoFormula {
    const fatores: { op: "*" | "/"; no: NoFormula }[] = [
      { op: "*", no: unario() },
    ];
    while (eOp("*") || eOp("/")) {
      const op = eOp("/") ? "/" : "*";
      i++;
      fatores.push({ op, no: unario() });
    }
    return fatores.length === 1 ? (fatores[0]?.no as NoFormula) : prod(fatores);
  }
  function unario(): NoFormula {
    if (eOp("+")) {
      i++;
      return unario();
    }
    if (eOp("-")) {
      i++;
      return somaDe([{ sinal: -1, no: unario() }]);
    }
    return primario();
  }
  function primario(): NoFormula {
    const t = ver();
    i++;
    if (!t) throw new Error("fim");
    if (t.k === "num") return { t: "num", v: t.v };
    if (t.k === "ref") {
      if (t.ate) throw new Error("intervalo fora de função");
      return { t: "ref", ref: t.ref };
    }
    if (t.k === "fn") {
      if (!FUNCOES_SOMA.has(t.nome)) throw new Error(`função ${t.nome}`);
      const parcelas: { sinal: 1 | -1; no: NoFormula }[] = [];
      if (!eOp(")"))
        do {
          if (parcelas.length) i++;
          const a = ver();
          const prox = ts[i + 1];
          if (
            a?.k === "ref" &&
            a.ate &&
            (!prox ||
              (prox.k === "op" &&
                (prox.v === "," || prox.v === ";" || prox.v === ")")))
          ) {
            i++;
            for (const ref of intervalo(a.ref, a.ate))
              parcelas.push({ sinal: 1, no: { t: "ref", ref } });
          } else parcelas.push({ sinal: 1, no: expr() });
        } while (eOp(",") || eOp(";"));
      if (!eOp(")")) throw new Error("falta )");
      i++;
      return somaDe(parcelas);
    }
    if (t.v === "(") {
      const e = expr();
      if (!eOp(")")) throw new Error("falta )");
      i++;
      return e;
    }
    throw new Error(`inesperado ${t.v}`);
  }

  try {
    const no = expr();
    return i === ts.length ? no : null;
  } catch {
    return null;
  }
}

const prod = (fatores: { op: "*" | "/"; no: NoFormula }[]): NoFormula => ({
  t: "prod",
  fatores,
});

/** Soma achatada: SUM(a+b) e -(a-b) viram parcelas de um nível só. */
function somaDe(parcelas: { sinal: 1 | -1; no: NoFormula }[]): NoFormula {
  const planas: { sinal: 1 | -1; no: NoFormula }[] = [];
  for (const p of parcelas)
    if (p.no.t === "soma")
      for (const q of p.no.parcelas)
        planas.push({ sinal: (p.sinal * q.sinal) as 1 | -1, no: q.no });
    else planas.push(p);
  const unica = planas[0];
  return planas.length === 1 && unica?.sinal === 1
    ? unica.no
    : { t: "soma", parcelas: planas };
}

const numColuna = (c: string) =>
  [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const letraColuna = (n: number): string =>
  n <= 0
    ? ""
    : letraColuna(Math.floor((n - 1) / 26)) +
      String.fromCharCode(65 + ((n - 1) % 26));

function intervalo(de: Ref, ate: Ref): Ref[] {
  const [c1, c2] = [numColuna(de.coluna), numColuna(ate.coluna)].sort(
    (a, b) => a - b,
  ) as [number, number];
  const [l1, l2] = [de.linha, ate.linha].sort((a, b) => a - b) as [
    number,
    number,
  ];
  if ((c2 - c1 + 1) * (l2 - l1 + 1) > MAX_INTERVALO)
    throw new Error("intervalo grande");
  const refs: Ref[] = [];
  for (let c = c1; c <= c2; c++)
    for (let l = l1; l <= l2; l++)
      refs.push({ coluna: letraColuna(c), linha: l });
  return refs;
}

export const endereco = (r: Ref) => `${r.coluna}${r.linha}`;

/** Referências da árvore (com repetição). */
export function refsDe(no: NoFormula): Ref[] {
  if (no.t === "ref") return [no.ref];
  if (no.t === "num") return [];
  if (no.t === "soma") return no.parcelas.flatMap((p) => refsDe(p.no));
  return no.fatores.flatMap((f) => refsDe(f.no));
}

/**
 * Valor da árvore; `valorDe` dá o valor de cada referência (célula vazia
 * conta 0, como no Excel). null se alguma referência não tem valor numérico
 * ou há divisão por zero.
 */
export function avaliar(
  no: NoFormula,
  valorDe: (r: Ref) => number | null,
): number | null {
  if (no.t === "num") return no.v;
  if (no.t === "ref") return valorDe(no.ref);
  if (no.t === "soma") {
    let s = 0;
    for (const p of no.parcelas) {
      const v = avaliar(p.no, valorDe);
      if (v === null) return null;
      s += p.sinal * v;
    }
    return s;
  }
  let r = 1;
  for (const f of no.fatores) {
    const v = avaliar(f.no, valorDe);
    if (v === null) return null;
    if (f.op === "/") {
      if (v === 0) return null;
      r /= v;
    } else r *= v;
  }
  return r;
}
