import { z } from "zod";

// Leitor da fatura da Energisa (PDF com texto). Recebe os textos de cada
// página com a posição (x, y, largura), como o pdf.js devolve (ver
// ./energisa-pdf.ts), e devolve a fatura estruturada. Puro: sem banco, sem
// Next; testado com textos sintéticos (energisa.fixtures.ts).
//
// Por que posição e não o texto corrido: no texto plano do PDF as colunas da
// tabela "Itens da Fatura" saem fora de ordem. Aqui os textos são agrupados
// em linhas pelo y (com tolerância) e ordenados pelo x; as colunas da tabela
// saem do cabeçalho (Unid., Quant., Preço unit., Valor, PIS/COFINS, Base
// ICMS, Alíq., ICMS, Tarifa) e cada número vai para a coluna mais próxima.
// O resto (matrícula, referência, leituras, medidor, saldo de créditos, nota
// fiscal) sai por rótulo, linha a linha.
//
// Dinheiro em centavos inteiros (o PDF já traz 2 casas; nada é arredondado
// além de converter "1.172,55" em 117255). kWh em número.
//
// Layout conferido com duas faturas reais da Energisa Minas Rio (setembro
// de 2026, fora do repositório: têm dados do cliente). As fixtures
// (energisa.fixtures.ts) reproduzem as posições e os rótulos delas, com
// valores, matrícula, nomes e endereço fictícios.

export interface ItemPdf {
  str: string;
  x: number;
  /** Linha de base, de baixo para cima (maior = mais alto na página). */
  y: number;
  /** Largura do texto: x + w é a borda direita. */
  w: number;
}

export interface Linha {
  y: number;
  pagina: number;
  itens: ItemPdf[];
  texto: string;
}

export type NivelAviso = "erro" | "aviso" | "info";
export interface Aviso {
  nivel: NivelAviso;
  mensagem: string;
}

export const TIPOS_ITEM = [
  "consumo",
  "injetada",
  "bandeira",
  "iluminacao",
  "outro",
] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];
export type Origem = "oUC" | "mUC";

const centavos = z.number().int();
const kwh = z.number().finite();
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mesIso = z.string().regex(/^\d{4}-\d{2}-01$/);

export const itemFaturaSchema = z.object({
  descricao: z.string().min(1).max(300),
  tipo: z.enum(TIPOS_ITEM),
  /** oUC: crédito de outra unidade; mUC: da própria. */
  origem: z.enum(["oUC", "mUC"]).nullable(),
  /** Mês em que o crédito foi gerado (aaaa-mm-01). */
  mesGeracao: mesIso.nullable(),
  unidade: z.string().max(20).nullable(),
  quantidade: kwh.nullable(),
  precoUnitario: z.number().finite().nullable(),
  valor: centavos,
  pisCofins: centavos.nullable(),
  baseIcms: centavos.nullable(),
  aliquotaIcms: z.number().finite().nullable(),
  icms: centavos.nullable(),
  tarifaUnitaria: z.number().finite().nullable(),
});
export type ItemFatura = z.infer<typeof itemFaturaSchema>;

export const avisoSchema = z.object({
  nivel: z.enum(["erro", "aviso", "info"]),
  mensagem: z.string().max(500),
});

export const faturaLidaSchema = z.object({
  matricula: z.string().regex(/^\d{6,12}$/),
  referencia: mesIso,
  vencimento: dataIso.nullable(),
  leituraAnteriorData: dataIso.nullable(),
  leituraAtualData: dataIso.nullable(),
  proximaLeitura: dataIso.nullable(),
  dias: z.number().int().nullable(),
  endereco: z.string().max(300).nullable(),
  classificacao: z.string().max(200).nullable(),
  ligacao: z.string().max(40).nullable(),
  medidor: z.string().max(40).nullable(),
  leituraAnterior: kwh.nullable(),
  leituraAtual: kwh.nullable(),
  /** Consumo da linha do medidor ("Energia ativa em kWh"). */
  consumoMedidoKwh: kwh.nullable(),
  /** Energia injetada na rede, da linha do medidor (unidade que gera). */
  injetadaKwh: kwh.nullable(),
  itens: z.array(itemFaturaSchema).min(1).max(200),
  consumoKwh: kwh,
  valorConsumo: centavos,
  /** kWh compensados (positivo; na fatura vem negativo). */
  compensadoKwh: kwh,
  /** Valor compensado (positivo; na fatura vem negativo). */
  valorCompensado: centavos,
  bandeira: z.string().max(60).nullable(),
  valorBandeira: centavos,
  iluminacaoPublica: centavos,
  icms: centavos,
  pisCofins: centavos,
  /** Linha "TOTAL:" da tabela de itens. */
  total: centavos,
  /** "Total a pagar" do cabeçalho (junto da referência e do vencimento). */
  totalAPagar: centavos.nullable(),
  saldoKwh: kwh.nullable(),
  expirarKwh: kwh.nullable(),
  classificacaoGd: z.string().max(20).nullable(),
  notaFiscal: z.string().max(300).nullable(),
  observacao: z.string().max(500).nullable(),
  /** Soma dos valores dos itens; tem de ser igual ao total. */
  somaItens: centavos,
  bate: z.boolean(),
  avisos: z.array(avisoSchema),
});
export type FaturaLida = z.infer<typeof faturaLidaSchema>;

/** O PDF não é uma fatura da Energisa que o leitor entenda. */
export class ErroEnergisa extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroEnergisa";
  }
}

// ---------------------------------------------------------------------------
// Números, datas e textos
// ---------------------------------------------------------------------------

const NUMERO_BR = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/;

/**
 * "1.172,55" → 1172.55; "-804,73", "804,73-" e "(804,73)" → -804.73;
 * "18,00%" → 18; "146.814" → 146814 (ponto é milhar). Outro texto → null.
 */
export function numeroBr(texto: string): number | null {
  let t = texto.replace(/R\$|\s/g, "").replace(/%$/, "");
  if (!t) return null;
  let negativo = false;
  if (t.startsWith("(") && t.endsWith(")")) {
    negativo = true;
    t = t.slice(1, -1);
  }
  if (/^[-−–]/.test(t)) {
    negativo = true;
    t = t.slice(1);
  } else if (/[-−–]$/.test(t)) {
    negativo = true;
    t = t.slice(0, -1);
  }
  if (!NUMERO_BR.test(t)) return null;
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  return negativo && n !== 0 ? -n : n;
}

/** "1.172,55" → 117255 (centavos); outro texto → null. */
export function centavosBr(texto: string): number | null {
  const n = numeroBr(texto);
  return n === null ? null : Math.round(n * 100);
}

/** "24/08/2026" → "2026-08-24" (só datas que existem). */
export function dataBr(texto: string | undefined): string | null {
  const m = texto?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m as unknown as [string, string, string, string];
  const data = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d)));
  if (data.getUTCMonth() !== Number(mes) - 1 || data.getUTCDate() !== Number(d))
    return null;
  return `${a}-${mes}-${d}`;
}

const MESES = [
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

export const semAcento = (t: string) =>
  t.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const mesIsoDe = (mes: number, ano: number) =>
  mes >= 1 && mes <= 12 && ano >= 2000 && ano <= 2100
    ? `${ano}-${String(mes).padStart(2, "0")}-01`
    : null;

/** "9/2026", "09/2026" ou "9/26" → "2026-09-01". */
export function mesDeGeracao(texto: string): string | null {
  const m = texto.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const ano = Number(m[2]);
  return mesIsoDe(Number(m[1]), ano < 100 ? 2000 + ano : ano);
}

const DATA = String.raw`\d{2}/\d{2}/\d{4}`;

// ---------------------------------------------------------------------------
// Linhas
// ---------------------------------------------------------------------------

/**
 * Agrupa os textos de uma página em linhas: mesmo y (com `tolerancia`), de
 * cima para baixo, e da esquerda para a direita dentro da linha.
 */
export function linhasDaPagina(
  itens: ItemPdf[],
  pagina = 1,
  tolerancia = 2.5,
): Linha[] {
  const ordenados = itens
    .map((i) => ({ ...i, str: i.str.replace(/\s+/g, " ").trim() }))
    .filter((i) => i.str)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const linhas: Omit<Linha, "texto">[] = [];
  for (const item of ordenados) {
    const linha = linhas.find((l) => Math.abs(l.y - item.y) <= tolerancia);
    if (linha) linha.itens.push(item);
    else linhas.push({ y: item.y, pagina, itens: [item] });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) => {
      l.itens.sort((a, b) => a.x - b.x);
      return { ...l, texto: l.itens.map((i) => i.str).join(" ") };
    });
}

// ---------------------------------------------------------------------------
// Tabela "Itens da Fatura"
// ---------------------------------------------------------------------------
//
// Layout real (Energisa Minas Rio, 2026): o cabeçalho ocupa três linhas, com
// "Itens da Fatura" na de baixo, e cada rótulo fica em uma, duas ou três
// delas ("Preço unit (R$)" / "com tributos"; "PIS/" / "COFINS (R$)"). Rótulos
// vizinhos ficam a 2 ou 3 pt um do outro ("Valor (R$)" e "COFINS (R$)"), então
// a coluna sai da sobreposição no x entre as linhas, e não da proximidade na
// mesma linha. À direita, na mesma altura, há um quadro de tributos ("Tributo
// | Base de Cálc. | Alíquota | Valor") e o histórico de consumo: a tabela
// termina no rótulo "Tributo". A linha "TOTAL:" fica bem abaixo dos itens
// (mais de 100 pt), com o histórico no meio.

type Campo =
  | "descricao"
  | "unidade"
  | "quantidade"
  | "preco"
  | "valor"
  | "pisCofins"
  | "baseIcms"
  | "aliquota"
  | "icms"
  | "tarifa";

interface Coluna {
  campo: Campo;
  esq: number;
  dir: number;
  centro: number;
  rotulo: string;
}

/** Ordem importa: "Base Calc. ICMS" é base, não ICMS; "% Alíq. ICMS" é alíquota. */
const ROTULOS: [Exclude<Campo, "descricao">, RegExp][] = [
  ["baseIcms", /\bbase\b/i],
  ["aliquota", /al[ií]q|%/i],
  ["preco", /pre[cç]o/i],
  ["tarifa", /tarifa/i],
  ["pisCofins", /pis|cofins/i],
  ["valor", /^valor/i],
  ["quantidade", /^quant/i],
  ["unidade", /^unid/i],
  ["icms", /icms/i],
];

const ANCORA_ITENS = /itens\s+d[ae]\s+fatura/i;
/** Quadro de tributos à direita dos itens: ali a tabela de itens acaba. */
const QUADRO_TRIBUTOS = /^tributo/i;
const SECAO =
  /^(lan[cç]amentos|servi[cç]os|demais|outros|tributos|itens|d[ée]bitos|cr[ée]ditos|informa[cç])/i;
/** Distância máxima (pt) de uma linha do cabeçalho até a do "Itens da Fatura". */
const ALTURA_CABECALHO = 12;
/** Palavras do mesmo rótulo em textos separados: só o espaço entre elas (pt). */
const ESPACO_PALAVRAS = 1.5;
/** Fração da largura que um texto precisa ter dentro da coluna para ser dela. */
const DENTRO = 0.5;
/** Folga (pt) para o início da descrição e entre as palavras dela. */
const MARGEM = 4;
/** Sem a linha "TOTAL:", a tabela acaba num vão maior que este múltiplo do espaço entre linhas. */
const VAO_FIM = 3;

interface Faixa {
  x: number;
  w: number;
}

/** Quanto duas faixas no x se sobrepõem (negativo: o vão entre elas). */
const sobreposicao = (a: Faixa, b: Faixa) =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);

const temNumero = (l: Linha) => l.itens.some((t) => numeroBr(t.str) !== null);

/**
 * Colunas a partir dos rótulos do cabeçalho. Textos de linhas diferentes que
 * se sobrepõem no x (metade da largura do menor) são da mesma coluna; na
 * mesma linha, só se encostam (palavras do mesmo rótulo). Devolve também onde
 * a tabela acaba à direita (o quadro "Tributo"), se houver.
 */
function colunasDoCabecalho(linhas: Linha[]): {
  colunas: Coluna[];
  fim: number | null;
} {
  const tokens = linhas.flatMap((l, li) => l.itens.map((i) => ({ ...i, li })));
  const pai = tokens.map((_, i) => i);
  const raiz = (i: number): number => {
    while (pai[i] !== i) i = pai[i] as number;
    return i;
  };
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i] as (typeof tokens)[number];
      const b = tokens[j] as (typeof tokens)[number];
      const s = sobreposicao(a, b);
      const junta =
        a.li === b.li
          ? s >= -ESPACO_PALAVRAS
          : s >= DENTRO * Math.min(a.w, b.w);
      if (junta) pai[raiz(j)] = raiz(i);
    }
  }
  const grupos = new Map<number, typeof tokens>();
  tokens.forEach((t, i) => {
    const r = raiz(i);
    grupos.set(r, [...(grupos.get(r) ?? []), t]);
  });
  const ordenados = [...grupos.values()]
    .map((g) => ({
      esq: Math.min(...g.map((t) => t.x)),
      dir: Math.max(...g.map((t) => t.x + t.w)),
      rotulo: g
        .sort((a, b) => a.li - b.li || a.x - b.x)
        .map((t) => t.str)
        .join(" "),
    }))
    .sort((a, b) => a.esq - b.esq);
  const colunas: Coluna[] = [];
  const usados = new Set<Campo>();
  for (const g of ordenados) {
    if (QUADRO_TRIBUTOS.test(g.rotulo)) return { colunas, fim: g.esq };
    const campo: Campo | undefined = ANCORA_ITENS.test(g.rotulo)
      ? "descricao"
      : ROTULOS.find(([, re]) => re.test(g.rotulo))?.[0];
    if (!campo || usados.has(campo)) continue;
    usados.add(campo);
    colunas.push({ campo, ...g, centro: (g.esq + g.dir) / 2 });
  }
  return { colunas, fim: null };
}

interface Tabela {
  itens: ItemFatura[];
  avisos: Aviso[];
  total: {
    valor: number | null;
    pisCofins: number | null;
    icms: number | null;
  } | null;
}

interface Celulas {
  y: number;
  descricao: string;
  valores: Map<Campo, string>;
  total: boolean;
}

/**
 * Células de uma linha da tabela. A descrição é o texto que começa na coluna
 * "Itens da Fatura" (e as palavras seguidas dele, antes da primeira coluna de
 * dados). O resto vai para a coluna em que cai (ao menos metade da largura
 * dentro dela) ou, se não cai em nenhuma, para a de centro mais próximo. A
 * unidade ("KWH") começa antes do rótulo "Unid." e não é descrição.
 */
function celulas(
  linha: Linha,
  dados: Coluna[],
  inicioDescricao: number,
  direita: number,
): Celulas {
  const primeira = Math.min(...dados.map((c) => c.esq));
  const descricao: string[] = [];
  let fimDescricao: number | null = null;
  const valores = new Map<Campo, string>();
  let total = false;
  for (const t of linha.itens) {
    if (t.x + t.w <= inicioDescricao - MARGEM || t.x >= direita) continue;
    // O rótulo "TOTAL:" pode estar em qualquer coluna.
    if (/^total:?$/i.test(t.str)) {
      total = true;
      continue;
    }
    const comecaDescricao =
      fimDescricao === null && Math.abs(t.x - inicioDescricao) <= MARGEM;
    const continuaDescricao =
      fimDescricao !== null && t.x - fimDescricao <= MARGEM;
    if ((comecaDescricao || continuaDescricao) && t.x < primeira) {
      descricao.push(t.str);
      fimDescricao = t.x + t.w;
      continue;
    }
    let coluna: Coluna | undefined;
    let dentro = 0;
    for (const c of dados) {
      const s = sobreposicao(t, { x: c.esq, w: c.dir - c.esq });
      if (s > dentro) [coluna, dentro] = [c, s];
    }
    if (!coluna || dentro < DENTRO * t.w) {
      const centro = t.x + t.w / 2;
      coluna = dados.reduce((m, c) =>
        Math.abs(c.centro - centro) < Math.abs(m.centro - centro) ? c : m,
      );
    }
    const antes = valores.get(coluna.campo);
    valores.set(coluna.campo, antes ? `${antes} ${t.str}` : t.str);
  }
  const texto = descricao.join(" ").trim();
  return {
    y: linha.y,
    descricao: texto,
    valores,
    total: total || /^total\b/i.test(texto),
  };
}

const num = (v: Map<Campo, string>, c: Campo) => {
  const t = v.get(c);
  return t === undefined ? null : numeroBr(t);
};
const cents = (v: Map<Campo, string>, c: Campo) => {
  const t = v.get(c);
  return t === undefined ? null : centavosBr(t);
};

const mediana = (xs: number[]) => {
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2
    ? (o[m] as number)
    : ((o[m - 1] as number) + (o[m] as number)) / 2;
};

/**
 * Linhas do corpo da tabela: até a linha "TOTAL:" (a primeira abaixo do
 * cabeçalho, a qualquer distância). Sem ela, até o primeiro vão bem maior que
 * o espaço normal entre as linhas da tabela.
 */
function corpoDaTabela(
  linhas: Celulas[],
  fundoCabecalho: number,
): { corpo: Celulas[]; total: Celulas | null } {
  const cheias = linhas.filter((l) => l.descricao || l.valores.size || l.total);
  const i = cheias.findIndex((l) => l.total);
  if (i >= 0) return { corpo: cheias.slice(0, i), total: cheias[i] ?? null };
  const vaos: number[] = [];
  let acima = fundoCabecalho;
  const corpo: Celulas[] = [];
  for (const l of cheias) {
    const vao = acima - l.y;
    if (vaos.length && vao > VAO_FIM * mediana(vaos)) break;
    vaos.push(vao);
    corpo.push(l);
    acima = l.y;
  }
  return { corpo, total: null };
}

function lerTabela(linhas: Linha[]): Tabela {
  const ancora = linhas.find((l) => ANCORA_ITENS.test(l.texto));
  if (!ancora) {
    throw new ErroEnergisa(
      'Não achei a tabela "Itens da Fatura". Confira se o PDF é a fatura da Energisa (o leitor não lê fatura escaneada).',
    );
  }
  const daPagina = linhas.filter((l) => l.pagina === ancora.pagina);
  // A linha do "Itens da Fatura" e as vizinhas só com rótulos (sem números).
  const cabecalho = daPagina.filter(
    (l) =>
      l === ancora ||
      (Math.abs(l.y - ancora.y) <= ALTURA_CABECALHO && !temNumero(l)),
  );
  const { colunas, fim } = colunasDoCabecalho(cabecalho);
  if (!colunas.some((c) => c.campo === "valor")) {
    throw new ErroEnergisa(
      'Achei a tabela "Itens da Fatura", mas não a coluna "Valor". O layout da fatura pode ter mudado: avise a equipe técnica.',
    );
  }
  const dados = colunas.filter((c) => c.campo !== "descricao");
  const descricaoCol = colunas.find((c) => c.campo === "descricao");
  // Onde as descrições começam: o rótulo "Itens da Fatura" (ou o início da linha dele).
  const inicioDescricao = descricaoCol?.esq ?? ancora.itens[0]?.x ?? 0;
  const direita = fim ?? Math.max(...dados.map((c) => c.dir)) + 30;
  const fundoCabecalho = Math.min(...cabecalho.map((l) => l.y));

  const { corpo, total: linhaTotal } = corpoDaTabela(
    daPagina
      .filter((l) => l.y < fundoCabecalho - 1)
      .map((l) => celulas(l, dados, inicioDescricao, direita)),
    fundoCabecalho,
  );

  const itens: ItemFatura[] = [];
  const avisos: Aviso[] = [];
  type Anterior = { y: number; item: ItemFatura | null };
  let anterior = null as Anterior | null;
  for (const { y, descricao, valores } of corpo) {
    // Subtotal de um grupo de itens não é item: somaria duas vezes.
    if (/^sub-?\s*total/i.test(descricao)) {
      anterior = { y, item: null };
      continue;
    }
    const v = cents(valores, "valor");
    if (v === null) {
      // Descrição quebrada em duas linhas: continua a do item de cima.
      const ultimo: ItemFatura | null = anterior?.item ?? null;
      if (
        ultimo &&
        descricao &&
        !SECAO.test(descricao) &&
        anterior &&
        anterior.y - y <= 12
      ) {
        ultimo.descricao = `${ultimo.descricao} ${descricao}`.slice(0, 300);
        Object.assign(ultimo, classificar(ultimo.descricao));
        anterior = { y, item: ultimo };
      } else if (descricao) {
        anterior = { y, item: null };
      }
      continue;
    }
    if (!descricao) {
      // Sem descrição não é item (a conferência com o total acusa se faltar).
      avisos.push({
        nivel: "aviso",
        mensagem: `Linha da tabela de itens com valor (${valores.get("valor")}) e sem descrição: ficou de fora.`,
      });
      anterior = { y, item: null };
      continue;
    }
    const item: ItemFatura = {
      descricao: descricao.slice(0, 300),
      ...classificar(descricao),
      unidade: valores.get("unidade")?.slice(0, 20) ?? null,
      quantidade: num(valores, "quantidade"),
      precoUnitario: num(valores, "preco"),
      valor: v,
      pisCofins: cents(valores, "pisCofins"),
      baseIcms: cents(valores, "baseIcms"),
      aliquotaIcms: num(valores, "aliquota"),
      icms: cents(valores, "icms"),
      tarifaUnitaria: num(valores, "tarifa"),
    };
    itens.push(item);
    anterior = { y, item };
  }
  if (!itens.length) {
    throw new ErroEnergisa(
      'A tabela "Itens da Fatura" veio sem itens. O layout da fatura pode ter mudado: avise a equipe técnica.',
    );
  }
  const total = linhaTotal && {
    valor: cents(linhaTotal.valores, "valor"),
    pisCofins: cents(linhaTotal.valores, "pisCofins"),
    icms: cents(linhaTotal.valores, "icms"),
  };
  return { itens, avisos, total };
}

// ---------------------------------------------------------------------------
// Tipo de cada item
// ---------------------------------------------------------------------------

const ILUMINACAO =
  /(contrib\w*|cosip|\bcip\b).*ilum|ilum\w*\.?\s*p[uú]b|^cosip\b|^cip\b/i;
const BANDEIRA =
  /(adic\w*\.?\s*(b\.|band\.?|bandeira)|bandeira)\s*(tarif[aá]ria\s*)?(verde|amarela|vermelha|escassez)/i;

/** "Adic. B. Vermelha P1" → "Vermelha P1"; null se não é bandeira. */
export function corDaBandeira(descricao: string): string | null {
  const m = descricao.match(BANDEIRA);
  if (!m) return null;
  const cor = semAcento(m[4] ?? "").toLowerCase();
  if (cor === "escassez") return "Escassez hídrica";
  if (cor === "vermelha") {
    const resto = descricao.slice((m.index ?? 0) + m[0].length);
    const p = resto.match(/^\s*(?:p|patamar)\s*\.?\s*([12])/i);
    return p ? `Vermelha P${p[1]}` : "Vermelha";
  }
  return cor === "amarela" ? "Amarela" : "Verde";
}

/** Tipo do item, origem do crédito (oUC/mUC) e mês em que foi gerado. */
export function classificar(
  descricao: string,
): Pick<ItemFatura, "tipo" | "origem" | "mesGeracao"> {
  const d = semAcento(descricao);
  if (/injetad|compensad/i.test(d)) {
    const m = d.match(/\b(ouc|muc)\b\s*(\d{1,2}\/\d{2,4})?/i);
    const origem: Origem | null = m
      ? m[1]?.toLowerCase() === "ouc"
        ? "oUC"
        : "mUC"
      : null;
    return {
      tipo: "injetada",
      origem,
      mesGeracao: m?.[2] ? mesDeGeracao(m[2]) : null,
    };
  }
  const sem = { origem: null, mesGeracao: null };
  if (ILUMINACAO.test(d)) return { tipo: "iluminacao", ...sem };
  if (corDaBandeira(descricao)) return { tipo: "bandeira", ...sem };
  if (/^consumo\b(?!.*reativ)|energia\s+ativa\s+(fornecida|consumida)/i.test(d))
    return { tipo: "consumo", ...sem };
  return { tipo: "outro", ...sem };
}

// ---------------------------------------------------------------------------
// Campos fora da tabela
// ---------------------------------------------------------------------------

/** Matrícula com 10 dígitos (zeros à esquerda), como no nome do arquivo. */
export function normalizarMatricula(digitos: string): string {
  return digitos.length < 10 ? digitos.padStart(10, "0") : digitos;
}

/** Matrícula e referência do nome "ENERGISAMR-Fat-Matricula-0002722684-09-2026.PDF". */
export function dadosDoNome(nome: string | undefined): {
  matricula: string | null;
  referencia: string | null;
} {
  const m = nome?.match(
    /matr[ií]cula[-_ ]?(\d{6,12})[-_ ](\d{1,2})[-_ ](\d{4})/i,
  );
  if (!m) return { matricula: null, referencia: null };
  return {
    matricula: normalizarMatricula(m[1] as string),
    referencia: mesIsoDe(Number(m[2]), Number(m[3])),
  };
}

function matriculaDoTexto(linhas: Linha[]): string | null {
  const proximas = (i: number) =>
    linhas
      .slice(i, i + 3)
      .map((l) => l.texto)
      .join(" ");
  // 1) Código do débito automático: "0002722684-4".
  for (const [i, l] of linhas.entries()) {
    if (!/d[eé]bito\s+autom[aá]tico/i.test(l.texto)) continue;
    const m = proximas(i).match(/\b(\d{6,12})-\d\b/);
    if (m) return normalizarMatricula(m[1] as string);
  }
  // 2) Rótulo "Matrícula".
  for (const [i, l] of linhas.entries()) {
    if (!/matr[ií]cula/i.test(l.texto)) continue;
    const m = proximas(i).match(/matr[ií]cula\s*:?\s*(\d{6,12})\b/i);
    if (m) return normalizarMatricula(m[1] as string);
    const n = linhas[i + 1]?.texto.match(/^(\d{6,12})\b/);
    if (n) return normalizarMatricula(n[1] as string);
  }
  // 3) O mesmo formato do débito automático em qualquer lugar.
  for (const l of linhas) {
    if (/chave|c[oó]digo\s+de\s+barras|linha\s+digit/i.test(l.texto)) continue;
    const m = l.texto.match(/(?:^|\s)(\d{10})-\d(?:\s|$)/);
    if (m) return m[1] as string;
  }
  return null;
}

function referenciaDoTexto(linhas: Linha[]): {
  referencia: string | null;
  linha: Linha | null;
} {
  const re = new RegExp(
    String.raw`\b(${MESES.join("|")})\s*/\s*(\d{4})\b`,
    "i",
  );
  let primeira: { referencia: string; linha: Linha } | null = null;
  for (const l of linhas) {
    const m = semAcento(l.texto).match(re);
    if (!m) continue;
    const ref = mesIsoDe(
      MESES.indexOf((m[1] as string).toLowerCase()) + 1,
      Number(m[2]),
    );
    if (!ref) continue;
    // A linha da referência traz também o vencimento.
    if (new RegExp(DATA).test(l.texto)) return { referencia: ref, linha: l };
    primeira ??= { referencia: ref, linha: l };
  }
  // Não usar "Referência: 07/2026": na página 2 é o mês dos indicadores de
  // qualidade (DIC/FIC), não o da fatura. Sem o mês por extenso, vale o do
  // nome do arquivo.
  return primeira ?? { referencia: null, linha: null };
}

interface Leituras {
  anterior: string | null;
  atual: string | null;
  dias: number | null;
  proxima: string | null;
  linha: Linha | null;
}

function leiturasDoTexto(linhas: Linha[]): Leituras {
  const quatro = new RegExp(
    String.raw`(${DATA})\s+(${DATA})\s+(\d{1,3})\s+(${DATA})`,
  );
  const tres = new RegExp(String.raw`(${DATA})\s+(${DATA})\s+(\d{1,3})\b`);
  for (const re of [quatro, tres]) {
    for (const l of linhas) {
      const m = l.texto.match(re);
      if (!m) continue;
      const anterior = dataBr(m[1]);
      const atual = dataBr(m[2]);
      if (!anterior || !atual || anterior >= atual) continue;
      return {
        anterior,
        atual,
        dias: Number(m[3]),
        proxima: dataBr(m[4]),
        linha: l,
      };
    }
  }
  return {
    anterior: null,
    atual: null,
    dias: null,
    proxima: null,
    linha: null,
  };
}

/** Endereço: a linha logo abaixo da razão social (à esquerda das datas). */
function enderecoDoTexto(linhas: Linha[], leituras: Leituras): string | null {
  if (!leituras.linha) return null;
  const i = linhas.indexOf(leituras.linha);
  const abaixo = linhas[i + 1];
  if (!abaixo || abaixo.pagina !== leituras.linha.pagina) return null;
  const primeiraData = leituras.linha.itens.find((t) =>
    new RegExp(DATA).test(t.str),
  );
  const limite = primeiraData ? primeiraData.x - 5 : Number.POSITIVE_INFINITY;
  const texto = abaixo.itens
    .filter((t) => t.x < limite)
    .map((t) => t.str)
    .join(" ")
    // O CEP no fim da linha ("... 1 PAV - 28605270") não é do endereço.
    .replace(/\s*-\s*\d{5}-?\d{3}$/, "")
    .trim();
  return texto ? texto.slice(0, 300) : null;
}

interface Medicao {
  medidor: string | null;
  anterior: number | null;
  atual: number | null;
  consumo: number | null;
}

/**
 * Linha do medidor: "NF786075 Energia ativa em kWh Ponta 146.814 147.694 1 880"
 * (número, grandeza, posto, leitura anterior, atual, constante, consumo).
 * Na mesma linha, à direita, vem texto legal ("Conf. art.14 do RICMS/RJ...
 * Lei nº 2.657/96"): só contam os números seguidos logo depois do posto.
 */
function medicao(linhas: Linha[], grandeza: RegExp): Medicao {
  const vazia = { medidor: null, anterior: null, atual: null, consumo: null };
  for (const l of linhas) {
    const m = l.texto.match(grandeza);
    if (!m || m.index === undefined) continue;
    const antes = l.texto.slice(0, m.index).trim().split(/\s+/).at(-1) ?? "";
    const numeros: number[] = [];
    for (const p of l.texto
      .slice(m.index + m[0].length)
      .trim()
      .split(/\s+/)) {
      const n = numeroBr(p);
      if (n !== null) numeros.push(n);
      else if (numeros.length) break;
    }
    if (numeros.length < 3) continue;
    return {
      medidor: /^[A-Z0-9][A-Z0-9-]{3,}$/i.test(antes) ? antes : null,
      anterior: numeros[0] ?? null,
      atual: numeros[1] ?? null,
      consumo: Math.abs(numeros.at(-1) ?? 0),
    };
  }
  return vazia;
}

/** Distância máxima (pt) da linha que continua um texto quebrado. */
const CONTINUA_LINHA = 9;

const LIGACAO = /\b(monof[aá]sic[oa]|bif[aá]sic[oa]|trif[aá]sic[oa])\b/i;

/**
 * Classificação depois do rótulo "Classificação:". No layout real ela quebra
 * em duas linhas ("MTC-CONVENCIONAL BAIXA TENSÃO / B3" e, logo abaixo,
 * "COMERCIAL / COMERCIAL", com "LIGAÇÃO: TRIFASICO" à direita): a linha de
 * baixo continua a de cima se começa no mesmo x e está logo abaixo; de cada
 * linha só conta o que vem antes do próximo rótulo ("Algo:").
 */
function classificacaoRotulada(linhas: Linha[]): string | null {
  const ateRotulo = (itens: ItemPdf[]) => {
    const fim = itens.findIndex((t) => t.str.includes(":"));
    return itens.slice(0, fim < 0 ? undefined : fim).map((t) => t.str);
  };
  for (const [i, l] of linhas.entries()) {
    const k = l.itens.findIndex((t) => /classifica[cç][aã]o\s*:/i.test(t.str));
    if (k < 0) continue;
    const rotulo = l.itens[k] as ItemPdf;
    const partes = [
      rotulo.str.replace(/^.*classifica[cç][aã]o\s*:\s*/i, ""),
      ...ateRotulo(l.itens.slice(k + 1)),
    ];
    let acima = l;
    for (const abaixo of linhas.slice(i + 1, i + 3)) {
      const primeiro = abaixo.itens[0];
      if (
        !primeiro ||
        abaixo.pagina !== l.pagina ||
        Math.abs(primeiro.x - rotulo.x) > 2 ||
        acima.y - abaixo.y > CONTINUA_LINHA ||
        primeiro.str.includes(":")
      )
        break;
      partes.push(...ateRotulo(abaixo.itens));
      acima = abaixo;
    }
    const texto = partes.join(" ").replace(/\s+/g, " ").trim();
    if (texto) return texto.slice(0, 200);
  }
  return null;
}

function classificacaoDoTexto(linhas: Linha[]): string | null {
  const rotulada = classificacaoRotulada(linhas);
  if (rotulada) return rotulada;
  for (const l of linhas) {
    const m = l.texto.match(
      /\b([A-Z]{2,4}\s*-\s*Convencional[^/]*\/\s*B\d\s+[A-Za-zÀ-ú]+(?:\s+P[uú]blic[oa])?)/i,
    );
    if (m) return (m[1] as string).replace(/\s+/g, " ").trim();
  }
  for (const l of linhas) {
    const m = l.texto.match(
      /\b(B[1-4]\s+(?:Residencial|Comercial|Industrial|Rural|Poder\s+P[uú]blico|Servi[cç]o\s+P[uú]blico|Ilumina[cç][aã]o\s+P[uú]blica))\b/i,
    );
    if (m) return (m[1] as string).replace(/\s+/g, " ").trim();
  }
  return null;
}

function ligacaoDoTexto(linhas: Linha[]): string | null {
  for (const l of linhas) {
    const m = semAcento(l.texto).match(LIGACAO);
    if (m) {
      const t = (m[1] as string).toLowerCase();
      return t.startsWith("mono")
        ? "Monofásico"
        : t.startsWith("bi")
          ? "Bifásico"
          : "Trifásico";
    }
  }
  return null;
}

function notaFiscalDoTexto(texto: string): string | null {
  const numero = texto.match(
    /nota\s+fiscal(?:\s+(?:fatura|eletr[oô]nica))?\s*(?:n[º°o.]*|n[uú]mero)?\s*:?\s*(\d[\d.]*)/i,
  );
  if (!numero) return null;
  const partes = [`Nº ${numero[1]}`];
  const serie = texto.match(/s[ée]rie\s*:?\s*([A-Z0-9]{1,5})\b/i);
  if (serie) partes.push(`série ${serie[1]}`);
  const emissao = texto.match(
    new RegExp(String.raw`emiss[aã]o\s*:?\s*(${DATA})`, "i"),
  );
  if (emissao) partes.push(`emitida em ${emissao[1]}`);
  const chave = texto.match(/chave\s+de\s+acesso\s*:?\s*((?:\d[\s.]?){44})/i);
  if (chave) partes.push(`chave ${(chave[1] as string).replace(/\D/g, "")}`);
  return partes.join(", ").slice(0, 300);
}

function kwhDepois(texto: string, rotulo: RegExp): number | null {
  const m = texto.match(rotulo);
  return m?.[1] ? numeroBr(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Fatura
// ---------------------------------------------------------------------------

/** Itens repetidos só pela divisão TE/TUSD contam uma vez no kWh. */
function kwhDosItens(itens: ItemFatura[]): number {
  const vistos = new Set<string>();
  let soma = 0;
  for (const i of itens) {
    const q = Math.abs(i.quantidade ?? 0);
    const base = semAcento(i.descricao)
      .replace(/\b(TE|TUSD)\b/gi, "")
      .replace(/[\s-]+/g, " ")
      .trim()
      .toLowerCase();
    const dividido = /\b(TE|TUSD)\b/i.test(i.descricao);
    const chave = `${base}|${q}`;
    if (dividido && vistos.has(chave)) continue;
    vistos.add(chave);
    soma += q;
  }
  return Math.round(soma * 100) / 100;
}

const somar = (itens: ItemFatura[], tipo: TipoItem) =>
  itens.filter((i) => i.tipo === tipo).reduce((s, i) => s + i.valor, 0);

const reais = (c: number) =>
  (c / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Lê a fatura. `nomeArquivo` (opcional) confere matrícula e mês com o nome
 * padrão da Energisa. Erro (ErroEnergisa) quando falta o essencial:
 * matrícula, referência, a tabela de itens ou o total.
 */
export function lerFaturaEnergisa(
  paginas: ItemPdf[][],
  nomeArquivo?: string,
): FaturaLida {
  const linhas = paginas.flatMap((p, i) => linhasDaPagina(p, i + 1));
  if (linhas.length < 5) {
    throw new ErroEnergisa(
      "O PDF não tem texto para ler (fatura escaneada ou em imagem). Baixe a fatura em PDF no site da Energisa.",
    );
  }
  const textoTodo = linhas.map((l) => l.texto).join("\n");
  if (!/energisa/i.test(textoTodo)) {
    throw new ErroEnergisa(
      "Não parece uma fatura da Energisa (o nome da distribuidora não aparece no PDF).",
    );
  }
  const avisos: Aviso[] = [];
  const doNome = dadosDoNome(nomeArquivo);

  const matriculaTexto = matriculaDoTexto(linhas);
  const matricula = matriculaTexto ?? doNome.matricula;
  if (!matricula) {
    throw new ErroEnergisa(
      'Não achei a matrícula na fatura (código do débito automático) nem no nome do arquivo ("...-Matricula-0000000000-09-2026.PDF").',
    );
  }
  if (!matriculaTexto) {
    avisos.push({
      nivel: "aviso",
      mensagem: `Matrícula lida do nome do arquivo (${matricula}): não achei o código do débito automático no PDF.`,
    });
  } else if (doNome.matricula && doNome.matricula !== matriculaTexto) {
    avisos.push({
      nivel: "erro",
      mensagem: `A matrícula da fatura (${matriculaTexto}) é diferente da do nome do arquivo (${doNome.matricula}). Vale a da fatura: confira o arquivo.`,
    });
  }

  const ref = referenciaDoTexto(linhas);
  const referencia = ref.referencia ?? doNome.referencia;
  if (!referencia) {
    throw new ErroEnergisa(
      'Não achei o mês de referência da fatura (ex.: "Setembro / 2026").',
    );
  }
  if (!ref.referencia) {
    avisos.push({
      nivel: "aviso",
      mensagem: "Mês de referência lido do nome do arquivo.",
    });
  } else if (doNome.referencia && doNome.referencia !== ref.referencia) {
    avisos.push({
      nivel: "erro",
      mensagem: `O mês da fatura (${ref.referencia.slice(5, 7)}/${ref.referencia.slice(0, 4)}) é diferente do mês do nome do arquivo (${doNome.referencia.slice(5, 7)}/${doNome.referencia.slice(0, 4)}).`,
    });
  }

  // Vencimento e total a pagar: na mesma linha da referência.
  let vencimento: string | null = null;
  let totalAPagar: number | null = null;
  if (ref.linha) {
    const datas = ref.linha.itens
      .map((t) => dataBr(t.str))
      .filter((d): d is string => d !== null);
    vencimento = datas[0] ?? null;
    const dinheiro = ref.linha.itens
      .map((t) => t.str)
      .filter((s) => /^(R\$\s*)?-?[\d.]+,\d{2}$/.test(s));
    const ultimo = dinheiro.at(-1);
    totalAPagar = ultimo ? centavosBr(ultimo) : null;
  }
  if (!vencimento) {
    const m = textoTodo.match(
      new RegExp(String.raw`vencimento\s*:?\s*(${DATA})`, "i"),
    );
    vencimento = dataBr(m?.[1]);
  }
  if (!vencimento)
    avisos.push({ nivel: "aviso", mensagem: "Não achei o vencimento." });

  const tabela = lerTabela(linhas);
  const { itens } = tabela;
  avisos.push(...tabela.avisos);
  const somaItens = itens.reduce((s, i) => s + i.valor, 0);
  let total = tabela.total?.valor ?? null;
  if (total === null) {
    if (totalAPagar === null) {
      throw new ErroEnergisa(
        'Não achei o total da fatura (linha "TOTAL:" da tabela de itens).',
      );
    }
    total = totalAPagar;
    avisos.push({
      nivel: "aviso",
      mensagem:
        'Não achei a linha "TOTAL:" da tabela de itens; usei o total a pagar.',
    });
  } else if (totalAPagar !== null && totalAPagar !== total) {
    avisos.push({
      nivel: "aviso",
      mensagem: `O total a pagar (${reais(totalAPagar)}) é diferente do total dos itens (${reais(total)}). Pode haver débito anterior ou desconto na fatura.`,
    });
  }
  const bate = somaItens === total;
  if (!bate) {
    avisos.push({
      nivel: "erro",
      mensagem: `A soma dos itens (${reais(somaItens)}) não bate com o total da fatura (${reais(total)}): diferença de ${reais(total - somaItens)}.`,
    });
  }

  const leituras = leiturasDoTexto(linhas);
  if (!leituras.anterior)
    avisos.push({
      nivel: "aviso",
      mensagem: "Não achei as datas de leitura (anterior e atual).",
    });
  const ativa = medicao(linhas, /energia\s+ativa\s+em\s+kwh/i);
  const injetada = medicao(
    linhas,
    /energia\s+(?:ativa\s+)?injetada\s+(?:em\s+)?kwh/i,
  );

  const consumoItens = itens.filter((i) => i.tipo === "consumo");
  const consumoDosItens = kwhDosItens(consumoItens);
  const consumoKwh = ativa.consumo ?? consumoDosItens;
  if (
    ativa.consumo !== null &&
    consumoItens.length &&
    Math.abs(ativa.consumo - consumoDosItens) > 0.5
  ) {
    avisos.push({
      nivel: "aviso",
      mensagem: `O consumo do medidor (${ativa.consumo} kWh) é diferente do item "Consumo" (${consumoDosItens} kWh).`,
    });
  }
  if (!consumoItens.length)
    avisos.push({
      nivel: "aviso",
      mensagem: 'A fatura não tem o item "Consumo em kWh".',
    });

  const injetadas = itens.filter((i) => i.tipo === "injetada");
  for (const i of injetadas) {
    if (!i.origem || !i.mesGeracao)
      avisos.push({
        nivel: "aviso",
        mensagem: `Crédito sem origem (oUC/mUC) ou mês de geração: "${i.descricao}".`,
      });
  }
  const compensadoKwh = kwhDosItens(injetadas);
  const bandeiras = [
    ...new Set(
      itens
        .filter((i) => i.tipo === "bandeira")
        .map((i) => corDaBandeira(i.descricao)),
    ),
  ].filter((c): c is string => c !== null);
  const verde = /bandeira\s+(tarif[aá]ria\s+)?(vigente\s*:?\s*)?verde/i.test(
    textoTodo,
  );

  const saldoKwh = kwhDepois(
    textoTodo,
    /saldo\s+acumulado\s*(?:\(kwh\))?\s*:?\s*(-?[\d.]+(?:,\d+)?)/i,
  );
  const expirarKwh = kwhDepois(
    textoTodo,
    /a\s+expirar\s+no\s+pr[oó]ximo\s+ciclo\s*(?:\(kwh\))?\s*:?\s*([\d.]+(?:,\d+)?)/i,
  );
  const gd = textoTodo.match(/classificada\s+como\s+(GD[_\s]?(?:I{1,3}|\d))/i);
  if (injetadas.length && saldoKwh === null)
    avisos.push({
      nivel: "aviso",
      mensagem:
        'A fatura tem crédito compensado, mas não achei o "Saldo Acumulado".',
    });

  const observacoes: string[] = [];
  if (/emitid[oa]\s+em\s+conting[eê]ncia/i.test(textoTodo))
    observacoes.push("Nota fiscal emitida em contingência.");

  const pisItens = itens.reduce((s, i) => s + (i.pisCofins ?? 0), 0);
  const icmsItens = itens.reduce((s, i) => s + (i.icms ?? 0), 0);

  return {
    matricula,
    referencia,
    vencimento,
    leituraAnteriorData: leituras.anterior,
    leituraAtualData: leituras.atual,
    proximaLeitura: leituras.proxima,
    dias: leituras.dias,
    endereco: enderecoDoTexto(linhas, leituras),
    classificacao: classificacaoDoTexto(linhas),
    ligacao: ligacaoDoTexto(linhas),
    medidor:
      ativa.medidor ??
      // No pé da página 2: "Medidor: NF786075".
      textoTodo.match(/medidor\s*:\s*([A-Z0-9][A-Z0-9-]{3,39})\b/i)?.[1] ??
      null,
    leituraAnterior: ativa.anterior,
    leituraAtual: ativa.atual,
    consumoMedidoKwh: ativa.consumo,
    injetadaKwh: injetada.consumo,
    itens,
    consumoKwh,
    valorConsumo: somar(itens, "consumo"),
    compensadoKwh,
    valorCompensado: Math.abs(somar(itens, "injetada")),
    bandeira: bandeiras.length ? bandeiras.join(" e ") : verde ? "Verde" : null,
    valorBandeira: somar(itens, "bandeira"),
    iluminacaoPublica: somar(itens, "iluminacao"),
    icms: tabela.total?.icms ?? icmsItens,
    pisCofins: tabela.total?.pisCofins ?? pisItens,
    total,
    totalAPagar,
    saldoKwh,
    expirarKwh,
    classificacaoGd: gd
      ? (gd[1] as string).replace(/\s/, "_").toUpperCase()
      : null,
    notaFiscal: notaFiscalDoTexto(textoTodo),
    observacao: observacoes.length ? observacoes.join(" ") : null,
    somaItens,
    bate,
    avisos,
  };
}

// ---------------------------------------------------------------------------
// Gravação (o formato das tabelas operacoes.energia_faturas e _itens)
// ---------------------------------------------------------------------------

const emReais = (c: number) => c / 100;
const emReaisOuNull = (c: number | null) => (c === null ? null : c / 100);

/** Colunas de operacoes.energia_faturas (sem importação, arquivo e quem). */
export function faturaParaGravar(f: FaturaLida) {
  return {
    matricula: f.matricula,
    referencia: f.referencia,
    vencimento: f.vencimento,
    leitura_anterior_data: f.leituraAnteriorData,
    leitura_atual_data: f.leituraAtualData,
    proxima_leitura: f.proximaLeitura,
    dias: f.dias,
    medidor: f.medidor,
    leitura_anterior: f.leituraAnterior,
    leitura_atual: f.leituraAtual,
    consumo_kwh: f.consumoKwh,
    valor_consumo: emReais(f.valorConsumo),
    compensado_kwh: f.compensadoKwh,
    valor_compensado: emReais(f.valorCompensado),
    injetada_kwh: f.injetadaKwh,
    bandeira: f.bandeira,
    valor_bandeira: emReais(f.valorBandeira),
    iluminacao_publica: emReais(f.iluminacaoPublica),
    icms: emReais(f.icms),
    pis_cofins: emReais(f.pisCofins),
    total: emReais(f.total),
    saldo_kwh: f.saldoKwh,
    expirar_kwh: f.expirarKwh,
    classificacao_gd: f.classificacaoGd,
    nota_fiscal: f.notaFiscal,
    observacao: f.observacao,
  };
}

/** Linhas de operacoes.energia_fatura_itens (sem o id da fatura). */
export function itensParaGravar(f: FaturaLida) {
  return f.itens.map((i, ordem) => ({
    ordem: ordem + 1,
    descricao: i.descricao,
    tipo: i.tipo,
    origem: i.origem,
    mes_geracao: i.mesGeracao,
    unidade: i.unidade,
    quantidade: i.quantidade,
    preco_unitario: i.precoUnitario,
    valor: emReais(i.valor),
    pis_cofins: emReaisOuNull(i.pisCofins),
    base_icms: emReaisOuNull(i.baseIcms),
    aliquota_icms: i.aliquotaIcms,
    icms: emReaisOuNull(i.icms),
    tarifa_unitaria: i.tarifaUnitaria,
  }));
}
