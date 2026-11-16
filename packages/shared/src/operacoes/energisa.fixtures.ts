import type { ItemPdf } from "./energisa";

// Fatura da Energisa sintética para os testes (só usada por *.test.ts).
// Reproduz o layout de duas faturas reais da Energisa Minas Rio (setembro de
// 2026): as posições (x, y) e os rótulos são os delas; matrícula, nomes,
// endereço, medidor, nota fiscal e valores são fictícios.
//
// O que o layout real tem de difícil, e está aqui:
// - cabeçalho da tabela em três linhas ("Preço unit (R$)" / "com tributos";
//   "PIS/" / "COFINS (R$)"), com "Itens da Fatura" na de baixo e rótulos
//   vizinhos a 2 ou 3 pt um do outro ("Valor (R$)" e "COFINS (R$)");
// - à direita dos itens, na mesma altura, o quadro de tributos ("Tributo |
//   Base de Cálc.(R$) | Alíquota (%) | Valor (R$)") e o histórico de consumo;
// - a unidade ("KWH") começa antes do rótulo "Unid.";
// - a linha "TOTAL:" mais de 100 pt abaixo do último item;
// - a classificação quebrada em duas linhas, com "LIGAÇÃO:" à direita;
// - a linha do medidor seguida de texto legal com números;
// - segunda página com saldo de créditos, um quadro "Total" e "Medidor:".
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

interface Medidor {
  numero: string;
  grandeza: string;
  posto: string;
  anterior: string;
  atual: string;
  constante: string;
  consumo: string;
}

export interface FaturaSintetica {
  distribuidora: string;
  razao: string;
  /** Linha do endereço como no PDF (termina no CEP). */
  endereco: string;
  bairro: string;
  cidade: string;
  debitoAutomatico: string | null;
  /** Classificação em duas linhas, como no PDF. */
  classificacao: [string, string];
  ligacao: string;
  referencia: string;
  vencimento: string;
  totalAPagar: string;
  leituras: [string, string, string, string];
  medidor: Medidor;
  medidorInjetada?: Medidor;
  itens: LinhaItem[];
  lancamentos: LinhaItem[];
  total: { valor: string; pis: string; base: string; icms: string };
  /** Quadro à direita dos itens: tributo, base, alíquota, valor. */
  tributos: [string, string, string, string][];
  /** O rótulo "TOTAL:" na coluna do preço, e não onde fica no layout real. */
  totalNaColuna?: boolean;
  gd: string | null;
  saldo: string | null;
  nota: { numero: string; emissao: string; chave: [string, string] } | null;
  contingencia: boolean;
  /** Cada palavra dos rótulos do cabeçalho como um texto separado. */
  palavrasSeparadas?: boolean;
  /** Mais textos à direita da tabela, na altura dos itens (ignorados). */
  ruidoDireita?: boolean;
  /** Números um pouco abaixo da descrição (outra fonte, outra linha de base). */
  tremido?: boolean;
}

/** Exemplo fictício: 1.324,40 − 911,00 − 121,17 + 3,15 + 47,12 = 342,50. */
export function faturaExemplo(): FaturaSintetica {
  return {
    distribuidora: "ENERGISA MINAS RIO - DISTRIBUIDORA DE ENERGIA S.A.",
    razao: "CONDOMINIO FICTICIO DE EXEMPLO LTDA",
    endereco: "RUA DAS FLORES, 100 - BL 01 SL 101 1 PAV - 28600000",
    bairro: "CENTRO",
    cidade: "CIDADE EXEMPLO (AG: 999)",
    debitoAutomatico: "0009100001-4",
    classificacao: [
      "MTC-CONVENCIONAL BAIXA TENSÃO / B3",
      "COMERCIAL / COMERCIAL",
    ],
    ligacao: "LIGAÇÃO: TRIFASICO",
    referencia: "Setembro / 2026",
    vencimento: "11/10/2026",
    totalAPagar: "R$ 342,50",
    leituras: ["24/08/2026", "23/09/2026", "30", "23/10/2026"],
    medidor: {
      numero: "XY123456",
      grandeza: "Energia ativa em kWh",
      posto: "Ponta",
      anterior: "52300",
      atual: "53320",
      constante: "1",
      consumo: "1020",
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
        aliq: "18",
        icms: "238,39",
        tarifa: "0,901220",
      },
      {
        descricao: "Energia Atv Injetada GDI oUC 9/2026 mPT",
        unid: "KWH",
        quant: "812,00",
        preco: "1,121921",
        valor: "-911,00",
        pis: "-15,10",
        base: "-911,00",
        aliq: "18",
        icms: "-163,98",
        tarifa: "0,781220",
      },
      {
        descricao: "Energia Atv Injetada GDI mUC 6/2024 mPT",
        unid: "KWH",
        quant: "108,00",
        preco: "1,121944",
        valor: "-121,17",
        pis: "-2,01",
        base: "-121,17",
        aliq: "18",
        icms: "-21,81",
        tarifa: "0,781220",
      },
      {
        descricao: "Adic. B. Amarela",
        valor: "3,15",
        pis: "0,05",
        base: "3,15",
        aliq: "18",
        icms: "0,57",
      },
    ],
    lancamentos: [
      {
        descricao: "CONTRIBUIÇÃO ILUM PUBLICA",
        valor: "47,12",
        pis: "0,00",
        base: "0,00",
        aliq: "0",
        icms: "0,00",
      },
    ],
    total: { valor: "342,50", pis: "4,89", base: "295,38", icms: "53,17" },
    tributos: [
      ["PIS", "103,40", "1,6500", "0,86"],
      ["COFINS", "103,40", "7,6000", "4,03"],
      ["ICMS", "295,38", "18,00", "53,17"],
    ],
    gd: "UC de compensação de energia classificada como GD_I, conforme Lei 14.300/22",
    saldo: "Saldo Acumulado: 1.621 A expirar no próximo ciclo: 0",
    nota: {
      numero: "NOTA FISCAL Nº: 000.123.456 - Série: 001",
      emissao: "DATA DE EMISSÃO:25/09/2026",
      chave: ["3326 0900 0000 0000 0000 5500 1000 1234 5610 0012", "3456"],
    },
    contingencia: true,
  };
}

/** Texto a desenhar, alinhado à esquerda (x) ou à direita (dir). */
interface Texto {
  str: string;
  y: number;
  tam: number;
  pagina: 1 | 2;
  x?: number;
  dir?: number;
  /** Uma palavra por texto (ver `palavrasSeparadas`). */
  palavras?: boolean;
}

// Posições do layout real (pt, origem no canto de baixo à esquerda).

/** Borda direita dos números de cada coluna da tabela de itens. */
const DIREITA = {
  quant: 203.1,
  preco: 234.5,
  valor: 271.5,
  pis: 300.7,
  base: 339.2,
  aliq: 350.6,
  icms: 387.5,
  tarifa: 419,
} as const;
const X_DESCRICAO = 27.1;
const X_UNIDADE = 149.6;
/** Rótulos do cabeçalho: [texto, x] de cada uma das três linhas. */
const CABECALHO: [number, [string, number][]][] = [
  [
    506.5,
    [
      ["Preço unit (R$)", 205.3],
      ["PIS/", 294.7],
      ["Base Calc.", 315.2],
      ["% Alíq.", 341.5],
      ["ICMS", 376],
      ["Tarifa", 406.7],
      ["Tributo", 430.8],
      ["Base de", 458],
      ["Alíquota", 484],
      ["Valor", 519.4],
    ],
  ],
  [
    501.2,
    [
      ["Cálc.(R$)", 456.7],
      ["(%)", 489],
      ["(R$)", 520.9],
    ],
  ],
  [
    498.7,
    [
      ["Itens da Fatura", X_DESCRICAO],
      ["Unid.", 153.7],
      ["Quant.", 186],
      ["com tributos", 210.1],
      ["Valor (R$)", 250.9],
      ["COFINS (R$)", 275.5],
      ["ICMS (R$)", 316.9],
      ["ICMS", 342.8],
      ["(R$)", 378.6],
      ["Unit (R$)", 399.5],
    ],
  ],
];
/** Quadro de tributos: x do nome e borda direita de base, alíquota e valor. */
const TRIBUTOS = { x: 430.4, base: 476, aliq: 500.1, valor: 531.6 };
const Y_TRIBUTOS = [493, 485.6, 478.4];
const Y_PRIMEIRO_ITEM = 489.4;
const ENTRE_ITENS = 7.8;
/** Distância da segunda linha de uma descrição quebrada. */
const CONTINUACAO = 4.2;
const Y_TOTAL = 304.3;
const HISTORICO = [
  "SET/26",
  "AGO/26",
  "JUL/26",
  "JUN/26",
  "MAI/26",
  "ABR/26",
  "MAR/26",
  "FEV/26",
  "JAN/26",
  "DEZ/25",
  "NOV/25",
  "OUT/25",
  "SET/25",
];

const COLUNAS = [
  "quant",
  "preco",
  "valor",
  "pis",
  "base",
  "aliq",
  "icms",
  "tarifa",
] as const;

function textos(f: FaturaSintetica): Texto[] {
  const t: Texto[] = [];
  const add = (
    str: string,
    y: number,
    pos: { x: number } | { dir: number },
    tam = 5,
    pagina: 1 | 2 = 1,
    palavras = false,
  ) => t.push({ str, y, tam, pagina, palavras, ...pos });

  // Cabeçalho da nota.
  add(
    "DANF3E - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA",
    821.6,
    { x: 147.5 },
  );
  add(f.distribuidora, 814, { x: 147.5 });
  add("Av. Exemplo, 1, Centro", 808.3, { x: 147.5 });
  add("CNPJ 00.000.000/0000-00", 796.3, { x: 147.5 });
  add("Data de Apresentação:", 744.6, { x: 383.9 });
  add("02/10/2026", 744.6, { x: 443.9 });
  add("DOM. BANC.:", 734.4, { x: 47 });
  add("DOM. ENT.:", 734.4, { x: 173.3 });
  add(`Classificação: ${f.classificacao[0]}`, 716, { x: 48.5 });
  add(f.classificacao[1], 710.7, { x: 48.5 });
  add(f.ligacao, 710.7, { x: 204.6 });
  add("TENSÃO NOMINAL EM VOLTS", 695, { x: 47 });
  add("DISP:", 695, { x: 119.9 });
  add("380", 695, { x: 140.4 });
  add(f.razao, 679, { x: 48.5 });
  f.leituras.forEach((l, i) => {
    add(l, 675.6, { x: [359.2, 406.2, 458.9, 493.2][i] as number });
  });
  add(f.endereco, 661, { x: 48.5 });
  add(f.bairro, 648.8, { x: 48.5 });
  add("000.000.000-00", 645.7, { x: 236.6 });
  add(f.cidade, 640.2, { x: 48.5 });
  if (f.nota) {
    add(f.nota.numero, 648.8, { x: 410.4 });
    add(f.nota.emissao, 640.2, { x: 410.4 });
    add("Consulte pela Chave de Acesso em:", 628.4, { x: 410.4 });
    add("https://dfe-portal.svrs.rs.gov.br/nf3e/consulta", 621.1, {
      x: 410.4,
    });
    add("chave de acesso:", 613.9, { x: 410.4 });
    add(f.nota.chave[0], 606.1, { x: 410.4 });
    add(f.nota.chave[1], 600.7, { x: 410.4 });
  }
  add("CNPJ/CPF/RANI: 0X.XXX.XXX/XXX1-00", 624.8, { x: 48.5 });
  add("Insc. Est.: 000XXXXXX", 617, { x: 48.5 });
  if (f.contingencia)
    add("EMITIDO EM CONTINGÊNCIA Pendente de Autorização", 593.5, {
      x: 410.4,
    });
  add(f.referencia, 585.1, { x: 62.8 }, 8);
  add(f.vencimento, 585.1, { x: 156 }, 8);
  add(f.totalAPagar, 585.1, { x: 235.8 }, 8);
  add("- Conheça seus direitos e deveres. Acesse:", 560.6, { x: 39.1 });

  // Cabeçalho da tabela de itens e do quadro de tributos.
  for (const [y, rotulos] of CABECALHO)
    for (const [str, x] of rotulos)
      add(str, y, { x }, 4.5, 1, f.palavrasSeparadas);
  f.tributos.forEach(([nome, base, aliq, valor], i) => {
    const y = Y_TRIBUTOS[i] as number;
    add(nome, y, { x: TRIBUTOS.x });
    add(base, y, { dir: TRIBUTOS.base });
    add(aliq, y, { dir: TRIBUTOS.aliq });
    add(valor, y, { dir: TRIBUTOS.valor });
  });

  // Itens.
  let y = Y_PRIMEIRO_ITEM;
  const dy = f.tremido ? -1.2 : 0;
  const linhaItem = (i: LinhaItem) => {
    add(i.descricao, y, { x: X_DESCRICAO }, 5.5);
    if (i.unid) add(i.unid, y + dy, { x: X_UNIDADE });
    for (const col of COLUNAS) {
      const v = i[col];
      if (v) add(v, y + dy, { dir: DIREITA[col] });
    }
    if (f.ruidoDireita) add("Pague pelo PIX 99", y, { x: 575 });
    if (i.continua) {
      add(i.continua, y - CONTINUACAO, { x: X_DESCRICAO }, 5.5);
      y -= CONTINUACAO;
    }
    y -= ENTRE_ITENS;
  };
  for (const i of f.itens) linhaItem(i);
  add("LANÇAMENTOS E SERVIÇOS", y, { x: X_DESCRICAO }, 5.5);
  add("Nº DIAS", y, { x: 520.4 });
  y -= ENTRE_ITENS;
  for (const i of f.lancamentos) linhaItem(i);

  // Histórico de consumo, à direita, entre os itens e o TOTAL.
  add("CONSUMO FATURADO", 447.8, { x: 443.2 });
  add("FAT", 447.8, { x: 525.6 });
  HISTORICO.forEach((mes, i) => {
    add(mes, 437.4 - i * 8.55, { x: 440 });
    add(String(28 + (i % 5)), 437.4 - i * 8.55, { x: 527.6 });
  });
  add("Consumo kWh", 360.4, { x: 434.4 });

  // TOTAL, bem abaixo dos itens.
  add(
    "TOTAL:",
    Y_TOTAL,
    f.totalNaColuna ? { dir: DIREITA.preco } : { x: 181.1 },
  );
  add(f.total.valor, Y_TOTAL, { dir: DIREITA.valor });
  add(f.total.pis, Y_TOTAL, { dir: DIREITA.pis });
  add(f.total.base, Y_TOTAL, { dir: DIREITA.base });
  add(f.total.icms, Y_TOTAL, { dir: DIREITA.icms });

  // Medição, seguida de texto legal com números.
  const medicao = (m: Medidor, y: number) => {
    add(m.numero, y, { x: 37.8 });
    add(m.grandeza, y, { x: 81.2 });
    add(m.posto, y, { x: 145.4 });
    add(m.anterior, y, { dir: 203 });
    add(m.atual, y, { dir: 235 });
    add(m.constante, y, { dir: 264.9 });
    add(m.consumo, y, { dir: 296.5 });
  };
  medicao(f.medidor, 276.6);
  add(
    'Conf. art.14 do RICMS/RJ, VI, alínea "b" Lei nº 2.657/96 e art. 2, Lei 210/23 ref. FCP',
    276.6,
    { x: 319.2 },
  );
  if (f.medidorInjetada) medicao(f.medidorInjetada, 268);

  // Ficha de compensação.
  if (f.debitoAutomatico)
    add(
      `CADASTRE SUA FATURA EM DÉBITO AUTOMÁTICO UTILIZANDO O CÓDIGO: ${f.debitoAutomatico}`,
      233.7,
      { x: 99 },
    );
  add("VENCIMENTO", 212.1, { x: 362.6 });
  add(f.vencimento, 206.2, { x: 389.8 });
  add("(=)VALOR DO DOCUMENTO", 175, { x: 362.6 });
  add("24/09/2026", 169.2, { x: 37.8 });
  add("9100001-2026-09-0", 169.2, { x: 106.8 });
  add(f.total.valor, 169.2, { dir: 417.5 });

  // Página 2: créditos, quadro "Total" e o medidor no pé.
  if (f.gd) add(f.gd, 788.1, { x: 52.7 }, 5, 2);
  if (f.saldo) add(f.saldo, 781.6, { x: 52.7 }, 5, 2);
  add("Referência:", 607.9, { x: 44.9 }, 5, 2);
  add("07/2026", 607.9, { x: 130.1 }, 5, 2);
  add("Leitura Anterior:", 537.7, { x: 248.2 }, 5, 2);
  add(f.leituras[0], 537.7, { x: 292.8 }, 5, 2);
  add("Leitura Atual:", 537.7, { x: 330.7 }, 5, 2);
  add(f.leituras[1], 537.7, { x: 368.4 }, 5, 2);
  add("Compra de energia", 505.6, { x: 35.6 }, 5, 2);
  add("40,97", 505.6, { dir: 153.2 }, 5, 2);
  add("Total", 470.4, { x: 35.6 }, 5, 2);
  add(f.total.valor, 470.4, { dir: 153.2 }, 5, 2);
  add("100,00", 470.4, { dir: 176 }, 5, 2);
  add(`Medidor: ${f.medidor.numero}`, 80.2, { x: 475.6 }, 5, 2);
  return t;
}

const larguraAproximada = (s: string, tam: number) => s.length * tam * 0.5;
/** Espaço entre palavras quando cada uma é um texto (`palavrasSeparadas`). */
const ESPACO = 1;

/** Os textos (um, ou um por palavra) com x e largura. */
function posicionar(
  t: Texto,
  largura: (s: string, tam: number) => number,
): ItemPdf[] {
  const w = largura(t.str, t.tam);
  const x = t.x ?? (t.dir as number) - w;
  if (!t.palavras) return [{ str: t.str, x, y: t.y, w }];
  const itens: ItemPdf[] = [];
  let cursor = x;
  for (const p of t.str.split(" ")) {
    const wp = largura(p, t.tam);
    itens.push({ str: p, x: cursor, y: t.y, w: wp });
    cursor += wp + ESPACO;
  }
  return itens;
}

/** Os textos com posição, como o pdf.js devolve (duas páginas). */
export function itensDaFatura(f: FaturaSintetica): ItemPdf[][] {
  const todos = textos(f);
  return ([1, 2] as const).map((p) =>
    todos
      .filter((t) => t.pagina === p)
      .flatMap((t) => posicionar(t, larguraAproximada)),
  );
}

/** A mesma fatura num PDF de verdade (A4, Helvetica). */
export async function pdfDaFatura(f: FaturaSintetica): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const paginas = [doc.addPage([595, 842]), doc.addPage([595, 842])];
  // Helvetica padrão (WinAnsi) não tem "−"; os textos aqui só usam ASCII e latim.
  for (const t of textos(f)) {
    const pagina = paginas[t.pagina - 1];
    for (const p of posicionar(t, (s, tam) => fonte.widthOfTextAtSize(s, tam)))
      pagina?.drawText(p.str, { x: p.x, y: p.y, size: t.tam, font: fonte });
  }
  return doc.save();
}
