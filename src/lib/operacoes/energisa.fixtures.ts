import type { ItemPdf } from "./energisa";

// Fatura da Energisa sintética para os testes (só usada por *.test.ts).
// Segue o layout descrito na spec (seção 4.7): cabeçalho com razão social e
// datas de leitura, referência/vencimento/total numa linha, linha do
// medidor, tabela "Itens da Fatura" com cabeçalho em duas linhas, números
// alinhados à direita, "Lançamentos e Serviços", linha "TOTAL:", saldo de
// créditos e nota fiscal. Matrícula, nomes e valores são fictícios.
//
// A mesma descrição sai como textos com posição (o que o pdf.js devolve) ou
// como um PDF de verdade (pdf-lib), para o teste ponta a ponta.

export interface LinhaItem {
  descricao: string;
  /** Segunda linha da descrição (quebrada no PDF). */
  continua?: string;
  unid?: string;
  quant?: string;
  preco?: string;
  valor: string;
  pis?: string;
  base?: string;
  aliq?: string;
  icms?: string;
  tarifa?: string;
}

export interface FaturaSintetica {
  distribuidora: string;
  razao: string;
  endereco: string;
  debitoAutomatico: string | null;
  classificacao: string;
  fornecimento: string;
  referencia: string;
  vencimento: string;
  totalAPagar: string;
  leituras: [string, string, string, string];
  medidor: {
    numero: string;
    grandeza: string;
    posto: string;
    anterior: string;
    atual: string;
    constante: string;
    consumo: string;
  };
  medidorInjetada?: FaturaSintetica["medidor"];
  itens: LinhaItem[];
  lancamentos: LinhaItem[];
  total: { valor: string; pis: string; base: string; icms: string };
  /** O rótulo "TOTAL:" na coluna do preço, e não na da descrição. */
  totalNaColuna?: boolean;
  gd: string | null;
  saldo: string | null;
  nota: {
    numero: string;
    serie: string;
    emissao: string;
    chave: string;
  } | null;
  contingencia: boolean;
  /** Cada palavra dos rótulos do cabeçalho como um texto separado. */
  palavrasSeparadas?: boolean;
  /** Textos à direita da tabela, na altura dos itens (devem ser ignorados). */
  ruidoDireita?: boolean;
  /** Números um pouco abaixo da descrição (outra fonte, outra linha de base). */
  tremido?: boolean;
}

/** Exemplo fictício: 1.324,40 − 911,00 − 121,17 + 3,15 + 47,12 = 342,50. */
export function faturaExemplo(): FaturaSintetica {
  return {
    distribuidora: "ENERGISA MINAS RIO - DISTRIBUIDORA DE ENERGIA S.A.",
    razao: "CONDOMINIO FICTICIO DE EXEMPLO",
    endereco: "RUA DAS FLORES, 100 - BL 01 SL 101 1 PAV",
    debitoAutomatico: "0009100001-4",
    classificacao:
      "Classificação: MTC-Convencional Baixa Tensão / B3 Comercial",
    fornecimento: "Tipo de fornecimento: Trifásico",
    referencia: "Setembro / 2026",
    vencimento: "11/10/2026",
    totalAPagar: "R$ 342,50",
    leituras: ["24/08/2026", "23/09/2026", "30", "23/10/2026"],
    medidor: {
      numero: "XY123456",
      grandeza: "Energia ativa em kWh",
      posto: "Ponta",
      anterior: "52.300",
      atual: "53.320",
      constante: "1",
      consumo: "1.020",
    },
    itens: [
      {
        descricao: "Consumo em kWh",
        unid: "KWH",
        quant: "1.020,00",
        preco: "1,298431",
        valor: "1.324,40",
        pis: "21,95",
        base: "1.324,40",
        aliq: "18,00",
        icms: "238,39",
        tarifa: "0,901220",
      },
      {
        descricao: "Energia Atv Injetada GDI oUC 9/2026 mPT",
        unid: "KWH",
        quant: "-812,00",
        preco: "1,121921",
        valor: "-911,00",
        pis: "-15,10",
        base: "-911,00",
        aliq: "18,00",
        icms: "-163,98",
        tarifa: "0,781220",
      },
      {
        descricao: "Energia Atv Injetada GDI mUC 6/2024 mPT",
        unid: "KWH",
        quant: "-108,00",
        preco: "1,121944",
        valor: "-121,17",
        pis: "-2,01",
        base: "-121,17",
        aliq: "18,00",
        icms: "-21,81",
        tarifa: "0,781220",
      },
      {
        descricao: "Adic. B. Amarela",
        valor: "3,15",
        pis: "0,05",
        base: "3,15",
        aliq: "18,00",
        icms: "0,57",
      },
    ],
    lancamentos: [{ descricao: "CONTRIBUIÇÃO ILUM PUBLICA", valor: "47,12" }],
    total: { valor: "342,50", pis: "4,89", base: "295,38", icms: "53,17" },
    gd: "UC de compensação de energia classificada como GD_I, conforme Lei 14.300/22",
    saldo: "Saldo Acumulado: 1.621 A expirar no próximo ciclo: 0",
    nota: {
      numero: "NOTA FISCAL Nº 000.123.456 - SÉRIE 001",
      emissao: "DATA DE EMISSÃO: 25/09/2026",
      serie: "",
      chave:
        "Chave de acesso: 3326 0900 0000 0000 0000 5500 1000 1234 5610 0012 3456",
    },
    contingencia: true,
  };
}

/** Texto a desenhar: à esquerda (x), centrado (centro) ou à direita (dir). */
interface Texto {
  str: string;
  y: number;
  tam: number;
  x?: number;
  centro?: number;
  dir?: number;
}

/** Centro de cada coluna da tabela e a borda direita dos números. */
const COLUNAS = {
  unid: 190,
  quant: 228,
  preco: 272,
  valor: 318,
  pis: 360,
  base: 402,
  aliq: 440,
  icms: 476,
  tarifa: 520,
} as const;
const DIREITA = 15;
type Col = keyof typeof COLUNAS;

const ROTULOS: Record<Col, [string, string?]> = {
  unid: ["Unid."],
  quant: ["Quant."],
  preco: ["Preço unit (R$)", "com tributos"],
  valor: ["Valor (R$)"],
  pis: ["PIS/COFINS"],
  base: ["Base Calc.", "ICMS (R$)"],
  aliq: ["Alíq.", "ICMS"],
  icms: ["ICMS"],
  tarifa: ["Tarifa unit", "(R$)"],
};

function textos(f: FaturaSintetica): Texto[] {
  const t: Texto[] = [];
  const add = (
    str: string,
    y: number,
    tam: number,
    pos: Omit<Texto, "str" | "y" | "tam">,
  ) => t.push({ str, y, tam, ...pos });

  add(f.distribuidora, 810, 8, { x: 30 });
  add("CNPJ 00.000.000/0001-00", 800, 6, { x: 30 });
  add("Leitura anterior", 770, 6, { x: 330 });
  add("Leitura atual", 770, 6, { x: 385 });
  add("Nº de dias", 770, 6, { x: 440 });
  add("Próxima leitura", 770, 6, { x: 480 });
  add(f.razao, 760, 7, { x: 30 });
  add(f.leituras[0], 760, 7, { x: 330 });
  add(f.leituras[1], 760, 7, { x: 385 });
  add(f.leituras[2], 760, 7, { x: 448 });
  add(f.leituras[3], 760, 7, { x: 480 });
  add(f.endereco, 750, 7, { x: 30 });
  add("Roteiro 01-001-0001", 750, 6, { x: 330 });
  add("CEP 28600-000 NOVA FRIBURGO RJ", 740, 7, { x: 30 });
  add(f.classificacao, 725, 7, { x: 30 });
  add(f.fornecimento, 725, 7, { x: 330 });
  add("REFERÊNCIA", 705, 6, { x: 30 });
  add("VENCIMENTO", 705, 6, { x: 150 });
  add("TOTAL A PAGAR", 705, 6, { x: 260 });
  add(f.referencia, 693, 9, { x: 30 });
  add(f.vencimento, 693, 9, { x: 150 });
  add(f.totalAPagar, 693, 9, { x: 260 });
  if (f.debitoAutomatico)
    add(`Código de débito automático: ${f.debitoAutomatico}`, 675, 7, {
      x: 30,
    });

  // Medição.
  for (const [r, x] of [
    ["Medidor", 30],
    ["Grandeza", 80],
    ["Posto", 170],
    ["Leitura anterior", 215],
    ["Leitura atual", 270],
    ["Constante", 320],
    ["Consumo", 370],
  ] as const)
    add(r, 655, 6, { x });
  const medicao = (m: FaturaSintetica["medidor"], y: number) => {
    add(m.numero, y, 7, { x: 30 });
    add(m.grandeza, y, 7, { x: 80 });
    add(m.posto, y, 7, { x: 170 });
    add(m.anterior, y, 7, { dir: 260 });
    add(m.atual, y, 7, { dir: 310 });
    add(m.constante, y, 7, { dir: 350 });
    add(m.consumo, y, 7, { dir: 400 });
  };
  medicao(f.medidor, 645);
  if (f.medidorInjetada) medicao(f.medidorInjetada, 635);

  // Cabeçalho da tabela: "Itens da Fatura" entre as duas linhas de rótulos.
  const rotulo = (str: string, y: number, centro: number) => {
    if (!f.palavrasSeparadas) return add(str, y, 6, { centro });
    // Uma palavra por texto, separadas por um espaço (largura ~ 0,5 × tam).
    const palavras = str.split(" ");
    const larg = (s: string) => s.length * 3;
    const todo = larg(str);
    let x = centro - todo / 2;
    for (const p of palavras) {
      add(p, y, 6, { x });
      x += larg(p) + 3;
    }
  };
  rotulo("Itens da Fatura", 596, 30 + 22);
  for (const [col, [l1, l2]] of Object.entries(ROTULOS) as [
    Col,
    [string, string?],
  ][]) {
    rotulo(l1, 600, COLUNAS[col]);
    if (l2) rotulo(l2, 592, COLUNAS[col]);
  }

  let y = 580;
  const dy = f.tremido ? -1.2 : 0;
  const linhaItem = (i: LinhaItem) => {
    add(i.descricao, y, 7, { x: 30 });
    for (const col of Object.keys(COLUNAS) as Col[]) {
      const v = i[col];
      if (!v) continue;
      if (col === "unid") add(v, y + dy, 7, { centro: COLUNAS[col] });
      else add(v, y + dy, 7, { dir: COLUNAS[col] + DIREITA });
    }
    if (f.ruidoDireita) add("Pague pelo PIX 99", y, 7, { x: 575 });
    y -= 10;
    if (i.continua) {
      add(i.continua, y + 2, 7, { x: 30 });
      y -= 8;
    }
  };
  for (const i of f.itens) linhaItem(i);
  add("Lançamentos e Serviços", y, 7, { x: 30 });
  y -= 10;
  for (const i of f.lancamentos) linhaItem(i);
  if (f.totalNaColuna) add("TOTAL:", y, 7, { dir: COLUNAS.preco + DIREITA });
  else add("TOTAL:", y, 7, { x: 30 });
  add(f.total.valor, y, 7, { dir: COLUNAS.valor + DIREITA });
  add(f.total.pis, y, 7, { dir: COLUNAS.pis + DIREITA });
  add(f.total.base, y, 7, { dir: COLUNAS.base + DIREITA });
  add(f.total.icms, y, 7, { dir: COLUNAS.icms + DIREITA });

  // Créditos, nota fiscal e histórico (abaixo da tabela, longe).
  if (f.gd) add(f.gd, 420, 7, { x: 30 });
  if (f.saldo) add(f.saldo, 410, 7, { x: 30 });
  if (f.nota) {
    add(f.nota.numero, 380, 7, { x: 30 });
    add(f.nota.emissao, 370, 7, { x: 30 });
    add(f.nota.chave, 360, 7, { x: 30 });
  }
  if (f.contingencia) add("EMITIDO EM CONTINGÊNCIA", 350, 8, { x: 30 });
  add("HISTÓRICO DE CONSUMO", 300, 7, { x: 30 });
  ["SET/25", "OUT/25", "NOV/25", "DEZ/25"].forEach((m, i) => {
    add(m, 290, 6, { x: 30 + i * 40 });
    add("30", 282, 6, { x: 34 + i * 40 });
  });
  return t;
}

const larguraAproximada = (s: string, tam: number) => s.length * tam * 0.5;

function posicionar(
  t: Texto,
  largura: (s: string, tam: number) => number,
): ItemPdf {
  const w = largura(t.str, t.tam);
  const x = t.x ?? (t.dir !== undefined ? t.dir - w : (t.centro ?? 0) - w / 2);
  return { str: t.str, x, y: t.y, w };
}

/** Os textos com posição, como o pdf.js devolve (uma página). */
export function itensDaFatura(f: FaturaSintetica): ItemPdf[][] {
  return [textos(f).map((t) => posicionar(t, larguraAproximada))];
}

/** A mesma fatura num PDF de verdade (A4, Helvetica). */
export async function pdfDaFatura(f: FaturaSintetica): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const pagina = doc.addPage([595, 842]);
  // Helvetica padrão (WinAnsi) não tem "−"; os textos aqui só usam ASCII e latim.
  for (const t of textos(f)) {
    const { x } = posicionar(t, (s, tam) => fonte.widthOfTextAtSize(s, tam));
    pagina.drawText(t.str, { x, y: t.y, size: t.tam, font: fonte });
  }
  return doc.save();
}
