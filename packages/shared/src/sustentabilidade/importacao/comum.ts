import { decodificarTexto, lerCsv } from "../../marketing/parametros";

// Base dos leitores do histórico (spec 4.10): arquivo → abas (matriz de
// células), texto/data/número em pt-BR, cabeçalho por título aproximado,
// blocos mensais, similaridade de nomes e LUC. Tudo puro; só `abasDoArquivo`
// carrega o exceljs (dinâmico, como em Operações).
//
// A lição do repo: leitor escrito sem a planilha real erra. Por isso nada
// aqui depende de linha ou coluna fixa; o que não se encaixa vira aviso.

// ---------------------------------------------------------------------------
// Contrato comum
// ---------------------------------------------------------------------------

export type Celula = string | number | boolean | Date | null;

/** Uma aba: linhas e colunas a partir de 0 (linha 0 = linha 1 do Excel). */
export interface Aba {
  nome: string;
  linhas: Celula[][];
}

export type NivelAviso = "erro" | "aviso" | "info";

export interface Aviso {
  nivel: NivelAviso;
  aba?: string;
  /** Linha no arquivo (1 = primeira linha da aba). */
  linha?: number;
  mensagem: string;
}

/** O que a prévia pede ao usuário antes de confirmar. */
export type Decisao =
  | {
      tipo: "vincular_contrato";
      id: string;
      aba?: string;
      linha: number;
      luc_texto: string | null;
      empresa: string | null;
      /** Contratos prováveis (LUC parecida ou nome do cliente). */
      sugestoes: {
        contrato_id: string;
        cliente_nome: string;
        motivo: string;
      }[];
      mensagem: string;
    }
  | {
      tipo: "unificar_nomes";
      id: string;
      nomes: { nome: string; ocorrencias: number }[];
      /** O mais usado; a pessoa pode escolher outro ou manter separados. */
      sugerido: string;
      mensagem: string;
    }
  | {
      tipo: "confirmar_motivo";
      id: string;
      aba?: string;
      linha?: number;
      lido: number;
      escrito: number;
      mensagem: string;
    };

export interface Periodo {
  de: string | null;
  ate: string | null;
}

export interface ResumoBase {
  linhas: number;
  periodo: Periodo;
}

export interface Leitura<T, R extends ResumoBase = ResumoBase> {
  linhas: T[];
  resumo: R;
  avisos: Aviso[];
  decisoes: Decisao[];
}

/** Contrato da cópia `sustentabilidade.contratos`, só o que o casamento usa. */
export interface ContratoParaCasar {
  id: string;
  lucs: string[];
  cliente_nome: string;
}

// ---------------------------------------------------------------------------
// Arquivo → abas
// ---------------------------------------------------------------------------

/** Valor do exceljs → célula simples (fórmula vira o resultado). */
export function celulaDoExcel(v: unknown): Celula {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.error === "string") return null;
    if ("formula" in o || "sharedFormula" in o) return celulaDoExcel(o.result);
    if (Array.isArray(o.richText))
      return (o.richText as { text?: string }[])
        .map((p) => p.text ?? "")
        .join("");
    if (typeof o.text === "string") return o.text;
  }
  return null;
}

const ehZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b;

/**
 * Abas de um .xlsx (exceljs) ou de um CSV (uma aba "CSV"). Célula mesclada
 * repete o valor da principal em todas (o exceljs já faz assim): data
 * mesclada na vertical vale para cada linha.
 */
export async function abasDoArquivo(
  arquivo: ArrayBuffer | Uint8Array,
): Promise<Aba[]> {
  const bytes =
    arquivo instanceof Uint8Array ? arquivo : new Uint8Array(arquivo);
  if (!ehZip(bytes))
    return [
      {
        nome: "CSV",
        linhas: lerCsv(decodificarTexto(bytes)).map((l) =>
          l.map((c) => (c.trim() === "" ? null : c)),
        ),
      },
    ];
  const { default: ExcelJS } = await import("exceljs");
  const livro = new ExcelJS.Workbook();
  // atalho: exceljs tipa o load com o Buffer antigo do Node.
  await livro.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  return livro.worksheets.map((ws) => {
    // Só as células com valor (aba formatada até a coluna XFD não pesa).
    const linhas: Celula[][] = Array.from({ length: ws.rowCount }, () => []);
    ws.eachRow((row, r) => {
      const l: Celula[] = [];
      row.eachCell((cell, c) => {
        while (l.length < c - 1) l.push(null);
        l[c - 1] = celulaDoExcel(cell.value);
      });
      while (l.length && vazia(l[l.length - 1])) l.pop();
      linhas[r - 1] = l;
    });
    return { nome: ws.name, linhas };
  });
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Texto da célula, sem espaços nas pontas ("" quando vazia). */
export function texto(c: Celula | undefined): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return isoDaData(c);
  return String(c).replace(/\s+/g, " ").trim();
}

/** Sem acento, minúsculo, espaços simples, sem pontuação nas pontas. */
export function normalizar(t: string | Celula | undefined): string {
  return texto(t as Celula)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.:;,\-–—*•]+|[\s.:;,\-–—*•?]+$/g, "")
    .trim();
}

/** Vazia, só espaço ou só pontuação ("." "-" "–"). */
export function vazia(c: Celula | undefined): boolean {
  return /^[\s.\-–—_]*$/.test(texto(c));
}

export const linhaVazia = (l: Celula[] | undefined) => !l || l.every(vazia);

// ---------------------------------------------------------------------------
// Números e datas pt-BR
// ---------------------------------------------------------------------------

/**
 * Número: célula numérica, "4,25", "1.234,56", "R$ 1.234,56", "1234.5",
 * "-5.954,72". Vazio ou "-" → null; texto que não é número → NaN.
 */
export function lerNumero(c: Celula | undefined): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : Number.NaN;
  if (c instanceof Date || typeof c === "boolean") return Number.NaN;
  let t = texto(c)
    .replace(/r\$/gi, "")
    .replace(/\s/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  if (!t || /^[-–—]+$/.test(t)) return null;
  t = t.replace(/^[–—]/, "-");
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^-?\d+,\d+$/.test(t))
    t = t.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "aaaa-mm-dd" se a data existe; senão null. */
export function isoDe(ano: number, mes: number, dia: number): string | null {
  if (
    !Number.isInteger(ano) ||
    !Number.isInteger(mes) ||
    !Number.isInteger(dia)
  )
    return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    d.getUTCFullYear() !== ano ||
    d.getUTCMonth() !== mes - 1 ||
    d.getUTCDate() !== dia ||
    ano < 1990 ||
    ano > 2100
  )
    return null;
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/** Data do exceljs (meia-noite UTC = o dia escrito no Excel) → iso. */
export function isoDaData(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const SERIAL_MIN = 20000; // 1954
const SERIAL_MAX = 80000; // 2119

/** Número de série do Excel → Date (UTC). */
export function dataDoSerial(n: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86_400_000));
}

/**
 * Partes da data como escritas, sem validar dia × mês: Date, série do
 * Excel, "dd/mm/aaaa", "dd/mm/aa", "dd-mm-aaaa", "dd.mm.aaaa", "aaaa-mm-dd"
 * ou "dd/mm" (ano null). Serve para inverter dia e mês trocados.
 */
export function partesDaData(
  c: Celula | undefined,
): { dia: number; mes: number; ano: number | null } | null {
  let d: Date | null = null;
  if (c instanceof Date) d = c;
  else if (typeof c === "number" && c > SERIAL_MIN && c < SERIAL_MAX)
    d = dataDoSerial(c);
  if (d)
    return {
      dia: d.getUTCDate(),
      mes: d.getUTCMonth() + 1,
      ano: d.getUTCFullYear(),
    };
  const t = texto(c);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?(?:\s|$)/.exec(t);
  if (m) {
    const ano = m[3] ? Number(m[3]) : null;
    return {
      dia: Number(m[1]),
      mes: Number(m[2]),
      ano: ano === null ? null : ano < 100 ? 2000 + ano : ano,
    };
  }
  return null;
}

/** Data pt-BR → "aaaa-mm-dd" (sem ano: usa `anoPadrao`). */
export function lerData(
  c: Celula | undefined,
  anoPadrao?: number,
): string | null {
  const p = partesDaData(c);
  if (!p) return null;
  const ano = p.ano ?? anoPadrao;
  return ano ? isoDe(ano, p.mes, p.dia) : null;
}

/** Hora "14:30", "14h30", "14h" ou fração do dia do Excel → "hh:mm". */
export function lerHora(c: Celula | undefined): string | null {
  if (c instanceof Date)
    return `${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}`;
  if (typeof c === "number" && c >= 0 && c < 1) {
    const min = Math.round(c * 24 * 60);
    return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
  }
  const m = /^(\d{1,2})\s*(?::|h)\s*(\d{2})?/i.exec(texto(c));
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  return h < 24 && mi < 60 ? `${pad(h)}:${pad(mi)}` : null;
}

export const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** "jan", "fev." ou "janeiro" → 1..12. */
export function mesDoNome(t: string): number | null {
  const n = normalizar(t).replace(/\.$/, "");
  if (n.length < 3) return null;
  const i = MESES.findIndex(
    (m) => m === n || (n.length === 3 && m.startsWith(n)),
  );
  return i < 0 ? null : i + 1;
}

/**
 * Título de mês, a célula inteira: "Janeiro 2026", "JANEIRO/2026",
 * "Janeiro de 26", "Jan-26" ou só "Janeiro" (ano null).
 */
export function mesDoTitulo(
  c: Celula | undefined,
): { mes: number; ano: number | null } | null {
  const m = /^([a-zç.]{3,10})(?:\s*(?:de|\/|-|–)?\s*(\d{2}|\d{4}))?$/.exec(
    normalizar(c),
  );
  if (!m) return null;
  const mes = mesDoNome(m[1] ?? "");
  if (!mes) return null;
  const ano = m[2]
    ? m[2].length === 2
      ? 2000 + Number(m[2])
      : Number(m[2])
    : null;
  return { mes, ano };
}

/** "aaaa-mm" da data iso. */
export const competencia = (iso: string) => iso.slice(0, 7);

/** Menor e maior data. */
export function periodoDe(datas: (string | null | undefined)[]): Periodo {
  const v = datas.filter((d): d is string => !!d).sort();
  return { de: v[0] ?? null, ate: v[v.length - 1] ?? null };
}

/** Ano de 4 dígitos no nome ou no texto ("Atração 2025", "Feira -25"). */
export function anoDoTexto(t: string): number | null {
  const m4 = /(?:^|\D)(20\d{2})(?:\D|$)/.exec(t);
  if (m4) return Number(m4[1]);
  const m2 = /(?:^|[\s_\-–])(\d{2})\s*$/.exec(t);
  return m2 ? 2000 + Number(m2[1]) : null;
}

// ---------------------------------------------------------------------------
// Cabeçalho por título aproximado
// ---------------------------------------------------------------------------

/** Regra de uma coluna: o cabeçalho normalizado casa com alguma das expressões. */
export type RegrasDeColunas<K extends string> = Record<K, RegExp[]>;

/**
 * Índice de cada coluna pelo título (normalizado). Cada coluna serve a um
 * campo só; a ordem das chaves é a prioridade.
 */
export function acharColunas<K extends string>(
  cabecalho: Celula[],
  regras: RegrasDeColunas<K>,
): Partial<Record<K, number>> {
  const usadas = new Set<number>();
  const achadas: Partial<Record<K, number>> = {};
  const nomes = cabecalho.map(normalizar);
  for (const k of Object.keys(regras) as K[]) {
    const i = nomes.findIndex(
      (n, idx) => n && !usadas.has(idx) && regras[k].some((re) => re.test(n)),
    );
    if (i >= 0) {
      achadas[k] = i;
      usadas.add(i);
    }
  }
  return achadas;
}

/** Índice da primeira linha (a partir de `de`) que satisfaz a condição. */
export function acharLinha(
  aba: Aba,
  cond: (l: Celula[], i: number) => boolean,
  de = 0,
  ate = aba.linhas.length,
): number {
  for (let i = de; i < Math.min(ate, aba.linhas.length); i++)
    if (cond(aba.linhas[i] ?? [], i)) return i;
  return -1;
}

// ---------------------------------------------------------------------------
// Blocos mensais na vertical (atrações, ecocopos)
// ---------------------------------------------------------------------------

export interface LinhaDeBloco {
  /** Linha no arquivo (1 = primeira). */
  linha: number;
  celulas: Celula[];
}

export interface BlocoMensal<K extends string> {
  /** Título como está ("Janeiro 2026"); null quando o bloco não tem título. */
  titulo: string | null;
  mes: number | null;
  ano: number | null;
  /** Linha do título (ou do cabeçalho, sem título). */
  linha: number;
  colunas: Partial<Record<K, number>>;
  cabecalho: string[];
  linhas: LinhaDeBloco[];
  /** Linhas de total/soma do bloco (não entram). */
  totais: LinhaDeBloco[];
}

const TOTAL = /^(sub\s*)?(total|soma)\b/;
const CONTADOS =
  /^(ativacoes|atracoes|eventos|registros|lancamentos|perguntas)$/;

/** Linha de total: começa com "Total"/"Soma" ou é só "<n> <palavra>" ("12 ativações"). */
export function ehLinhaDeTotal(l: Celula[]): boolean {
  const cheias = l.filter((c) => !vazia(c)).map(normalizar);
  if (!cheias.length) return false;
  if (cheias.some((t) => TOTAL.test(t))) return true;
  if (cheias.length > 2) return false;
  // "12 ativações" numa célula, ou "12" | "ativações" em duas.
  return (
    cheias.some((t) => /^\d+\s+[a-z]/.test(t)) ||
    (cheias.length === 2 &&
      /^\d+$/.test(cheias[0] ?? "") &&
      CONTADOS.test(cheias[1] ?? ""))
  );
}

/**
 * Número escrito na linha de total: a primeira célula numérica ("Total |
 * 12", "Total 2025 | 45"); sem ela, o último número do texto ("12
 * ativações", "Total: 12", "Total 2025: 323").
 */
export function numeroDoTotal(l: Celula[]): number | null {
  const n = l.find((c) => typeof c === "number" && Number.isInteger(c));
  if (typeof n === "number") return n;
  for (const c of l) {
    const nums = normalizar(c).match(/\d+/g);
    if (nums?.length) return Number(nums[nums.length - 1]);
  }
  return null;
}

/**
 * Blocos de uma aba: (título de mês) → cabeçalho → linhas → (total). O
 * cabeçalho é a linha que tem a coluna `chave` e mais uma conhecida. Bloco
 * acaba no próximo título, cabeçalho ou em duas linhas vazias seguidas.
 */
export function blocosMensais<K extends string>(
  aba: Aba,
  regras: RegrasDeColunas<K>,
  chave: NoInfer<K>,
): BlocoMensal<K>[] {
  const ehCabecalho = (l: Celula[]) => {
    const c = acharColunas(l, regras);
    return c[chave] !== undefined && Object.keys(c).length >= 2;
  };
  const tituloDa = (l: Celula[]) => {
    const cheias = l.filter((c) => !vazia(c));
    if (!cheias.length || cheias.length > 3) return null;
    for (const c of cheias) {
      const t = mesDoTitulo(c);
      if (t) return { t, texto: texto(c) };
    }
    return null;
  };
  const blocos: BlocoMensal<K>[] = [];
  let titulo: {
    t: { mes: number; ano: number | null };
    texto: string;
    linha: number;
  } | null = null;
  let atual: BlocoMensal<K> | null = null;
  let vazias = 0;
  aba.linhas.forEach((l, i) => {
    const cab = ehCabecalho(l);
    const t = tituloDa(l);
    if (t && !cab) {
      atual = null;
      titulo = { ...t, linha: i + 1 };
      return;
    }
    if (cab) {
      // Título na mesma linha do cabeçalho ("Janeiro 2026 | Data | Tipo").
      const mesmo = l.map(mesDoTitulo).findIndex(Boolean);
      if (mesmo >= 0)
        titulo = {
          t: mesDoTitulo(l[mesmo]) as { mes: number; ano: number | null },
          texto: texto(l[mesmo]),
          linha: i + 1,
        };
      atual = {
        titulo: titulo?.texto ?? null,
        mes: titulo?.t.mes ?? null,
        ano: titulo?.t.ano ?? null,
        linha: titulo?.linha ?? i + 1,
        colunas: acharColunas(l, regras),
        cabecalho: l.map(texto),
        linhas: [],
        totais: [],
      };
      blocos.push(atual);
      titulo = null;
      vazias = 0;
      return;
    }
    const b = atual as BlocoMensal<K> | null;
    if (!b) return;
    if (linhaVazia(l)) {
      if (++vazias >= 2) atual = null;
      return;
    }
    vazias = 0;
    if (ehLinhaDeTotal(l)) b.totais.push({ linha: i + 1, celulas: l });
    else b.linhas.push({ linha: i + 1, celulas: l });
  });
  return blocos;
}

// ---------------------------------------------------------------------------
// Nomes parecidos
// ---------------------------------------------------------------------------

/** Distância de edição (Levenshtein). */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let ant = Int32Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Int32Array(b.length + 1);
    cur[0] = i;
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(
        (ant[j] as number) + 1,
        (cur[j - 1] as number) + 1,
        (ant[j - 1] as number) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    ant = cur;
  }
  return ant[b.length] as number;
}

/** 0..1 sobre os nomes normalizados (1 = iguais). */
export function similaridade(a: string, b: string): number {
  const x = normalizar(a);
  const y = normalizar(b);
  const max = Math.max(x.length, y.length);
  return max ? 1 - distancia(x, y) / max : 1;
}

/** Limiar padrão para sugerir unir dois nomes (só sugestão; a pessoa decide). */
export const LIMIAR_PARECIDOS = 0.8;

/**
 * Grupos de nomes parecidos (cada grupo com 2+ grafias). Nomes iguais sem
 * acento/caixa já são o mesmo e não aparecem aqui.
 */
export function gruposParecidos(
  nomes: string[],
  limiar = LIMIAR_PARECIDOS,
): string[][] {
  const unicos = [
    ...new Map(nomes.map((n) => [normalizar(n), n])).keys(),
  ].filter(Boolean);
  const pai = unicos.map((_, i) => i);
  const raiz = (i: number): number => {
    const p = pai[i] as number;
    if (p === i) return i;
    const r = raiz(p);
    pai[i] = r;
    return r;
  };
  unicos.forEach((x, i) => {
    unicos.slice(i + 1).forEach((y, k) => {
      if (similaridade(x, y) >= limiar) pai[raiz(i)] = raiz(i + 1 + k);
    });
  });
  const grupos = new Map<number, string[]>();
  unicos.forEach((n, i) => {
    const r = raiz(i);
    grupos.set(r, [...(grupos.get(r) ?? []), n]);
  });
  return [...grupos.values()].filter((g) => g.length > 1);
}

// ---------------------------------------------------------------------------
// LUC
// ---------------------------------------------------------------------------

/** Chave comparável da LUC: maiúscula, só letras e dígitos ("00H_42" → "00H42"). */
export function chaveLuc(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * LUCs escritas numa célula: "11_129/130/202" → ["11_129", "11_130",
 * "11_202"] (o prefixo vale para os números soltos); "00H39, 00H_42" → duas.
 */
export function lucsDoTexto(t: string): string[] {
  const partes = texto(t)
    .split(/\s*(?:[/,;|+&]|\s+e\s+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  let prefixo = "";
  return partes.map((p) => {
    const m = /^(.*[_\s-])\d+$/.exec(p);
    if (m) prefixo = m[1] ?? "";
    else if (/^\d+$/.test(p) && prefixo) return prefixo + p;
    return p;
  });
}

const semZerosAEsquerda = (k: string) => k.replace(/^0+/, "");

/**
 * Contrato pela LUC escrita: casa pela chave (sem separadores) e, se não
 * achar, sem zeros à esquerda. Mais de um contrato → ambíguo.
 */
export function casarLuc(
  lucTexto: string,
  contratos: ContratoParaCasar[],
): { contrato_id: string | null; candidatos: ContratoParaCasar[] } {
  const lucs = lucsDoTexto(lucTexto).map(chaveLuc).filter(Boolean);
  if (!lucs.length) return { contrato_id: null, candidatos: [] };
  const achar = (f: (k: string) => string) => {
    const quer = new Set(lucs.map(f));
    return contratos.filter((c) =>
      c.lucs.some((l) => quer.has(f(chaveLuc(l)))),
    );
  };
  let c = achar((k) => k);
  if (!c.length) c = achar(semZerosAEsquerda);
  return {
    contrato_id: c.length === 1 ? (c[0]?.id ?? null) : null,
    candidatos: c,
  };
}
