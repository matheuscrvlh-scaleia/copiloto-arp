import ExcelJS from "exceljs";
import type { Celula } from "../comum";

// Planilhas FICTÍCIAS na estrutura descrita no spec 4.10 (as reais têm dados
// de clientes e não entram no repo). Nomes, LUCs, valores e perguntas são
// inventados; só o desenho (abas, blocos, cabeçalhos, totais) imita o real.

export interface AbaFicticia {
  nome: string;
  linhas: Celula[][];
  /** Mesclas no formato do Excel ("A3:A5"). */
  mesclas?: string[];
}

export async function planilha(abas: AbaFicticia[]): Promise<ArrayBuffer> {
  const livro = new ExcelJS.Workbook();
  for (const a of abas) {
    const ws = livro.addWorksheet(a.nome);
    a.linhas.forEach((l, i) => {
      l.forEach((v, j) => {
        if (v !== null) ws.getCell(i + 1, j + 1).value = v;
      });
    });
    for (const m of a.mesclas ?? []) ws.mergeCells(m);
  }
  const buf = await livro.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export const dia = (a: number, m: number, d: number) =>
  new Date(Date.UTC(a, m - 1, d));

// ---------------------------------------------------------------------------
// Questionário RSU (respostas do Forms)
// ---------------------------------------------------------------------------

export const ITENS_GRADE = ["Orgânico", "Plástico", "Papel"];

/** Cabeçalho: carimbo + 46 perguntas; a 20 é uma grade (3 colunas). */
export function cabecalhoForms(comNumero = true): string[] {
  const titulos: Record<number, string> = {
    1: "Nome da empresa",
    2: "LUC",
    3: "Setor econômico",
    4: "Situação",
    5: "Data",
    7: "Grau de conhecimento sobre resíduos",
    16: "Possui PGRS?",
  };
  const cab = ["Carimbo de data/hora"];
  for (let n = 1; n <= 46; n++) {
    const t = titulos[n] ?? `Pergunta fictícia ${n}`;
    const titulo = comNumero ? `${n}. ${t}` : t;
    if (n === 20)
      for (const item of ITENS_GRADE) cab.push(`${titulo} [${item}]`);
    else cab.push(titulo);
  }
  return cab;
}

export const CONTRATOS_FICTICIOS = [
  { id: "c-01", lucs: ["00H_39"], cliente_nome: "Loja Fictícia Alfa" },
  { id: "c-02", lucs: ["00H_42"], cliente_nome: "Café Inventado Beta" },
  { id: "c-03", lucs: ["112_105"], cliente_nome: "Ateliê Gama de Teste" },
  {
    id: "c-04",
    lucs: ["11_129", "11_130", "11_202"],
    cliente_nome: "Mercearia Delta Exemplo",
  },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `c-${String(i + 5).padStart(2, "0")}`,
    lucs: [`20_${String(i + 1).padStart(3, "0")}`],
    cliente_nome: `Negócio Fictício ${i + 5}`,
  })),
  {
    id: "c-90",
    lucs: ["30_001"],
    cliente_nome: "Sem Entrevista Ltda Fictícia",
  },
];

const GRAUS = [
  ...Array(8).fill("Pouco"),
  ...Array(6).fill("Mediano"),
  ...Array(5).fill("Nenhum"),
  "Muito",
];
const PGRS = [...Array(2).fill("Sim"), ...Array(17).fill("Não"), null];

/**
 * 20 entrevistas: 16 de 1ª vez e 4 de atualização; 4 sem LUC; LUCs em
 * formatos variados ("00H39", "00H_42", "112_105", "11_129/130/202").
 */
export function linhasForms(): Celula[][] {
  const lucs: (string | null)[] = [
    "00H39",
    "00H_42",
    "112_105",
    "11_129/130/202",
    ...Array.from(
      { length: 12 },
      (_, i) => `20_${String(i + 1).padStart(3, "0")}`,
    ),
    null,
    null,
    null,
    "",
  ];
  return lucs.map((luc, i) => {
    const l: Celula[] = [dia(2026, 4 + Math.floor(i / 4), 1 + i)];
    for (let n = 1; n <= 46; n++) {
      if (n === 1)
        l.push(i >= 16 ? `Empresa sem LUC ${i}` : `Empresa fictícia ${i + 1}`);
      else if (n === 2) l.push(luc);
      else if (n === 3) l.push("Lojas e serviços gerais");
      else if (n === 4) l.push(i % 5 === 4 ? "Atualização" : "1ª vez");
      else if (n === 5) l.push(dia(2026, 4 + Math.floor(i / 4), 28 - i));
      else if (n === 7) l.push(GRAUS[i] ?? null);
      else if (n === 16) l.push(PGRS[i] ?? null);
      else if (n === 20) l.push("Pouco", "Muito", "Não gera");
      else l.push(n % 3 === 0 ? `resposta inventada ${n}` : null);
    }
    return l;
  });
}

// ---------------------------------------------------------------------------
// Mercado Local
// ---------------------------------------------------------------------------

const TIPOS_ATRACAO = ["Oficina", "DJ", "Degustação", "Contação de história"];

/** Bloco de atrações: título, cabeçalho, `lidas` linhas e o total escrito. */
export function blocoAtracoes(
  titulo: string,
  lidas: number,
  escritas: number,
  total: "texto" | "duas" = "texto",
): Celula[][] {
  const linhas: Celula[][] = [
    [titulo],
    ["Data", "Horário", "Tipo", "Tema", "Local", "Horas de experiência"],
  ];
  for (let i = 0; i < lidas; i++)
    linhas.push([
      // A cada 5 linhas, a data fica vazia (mesmo dia da de cima).
      i % 5 === 4 ? null : (i % 28) + 1,
      "10:00",
      TIPOS_ATRACAO[i % TIPOS_ATRACAO.length] ?? null,
      `Tema inventado ${i + 1}`,
      "Corredor fictício",
      2,
    ]);
  linhas.push(
    total === "texto" ? [`${escritas} ativações`] : ["Total", null, escritas],
  );
  linhas.push([], []);
  return linhas;
}

export const ATRACOES_2026: [string, number, number][] = [
  ["Janeiro 2026", 12, 12],
  ["Fevereiro 2026", 29, 29],
  ["Março 2026", 35, 35],
  ["Abril 2026", 34, 34],
  ["Maio 2026", 56, 57],
  ["Junho 2026", 47, 47],
  ["Julho 2026", 12, 12],
  ["Agosto 2026", 26, 27],
  ["Setembro 2026", 36, 36],
];

export function abaAtracoes2026(): AbaFicticia {
  return {
    nome: "Atração 2026",
    linhas: ATRACOES_2026.flatMap(([t, l, e], i) =>
      blocoAtracoes(t, l, e, i === 2 ? "duas" : "texto"),
    ),
  };
}

export function abaAtracoes2025(): AbaFicticia {
  const linhas = [
    ...blocoAtracoes("Novembro", 20, 20),
    ...blocoAtracoes("Dezembro", 25, 25),
  ];
  // Total do ano logo abaixo do total de dezembro.
  linhas.splice(linhas.length - 2, 0, ["Total 2025", null, 45]);
  return { nome: "Atração 2025", linhas };
}

/**
 * Produtores, desenho A (Data | qtda | Produtores), dois meses lado a lado.
 * Janeiro: a mesma produtora em 4 feiras + 3 outras em 1 feira = 7
 * participações e 4 produtores únicos; a feira do dia 18 diz qtda 3 com 2
 * na lista. Fevereiro traz a grafia errada da produtora.
 */
export function abaProdutores26(): AbaFicticia {
  const jan: [number, number, string[]][] = [
    [4, 2, ["Quitutes da Dona Zuza", "Horta Imaginária"]],
    [11, 2, ["Quitutes da Dona Zuza", "Pães do Exemplo"]],
    [18, 3, ["Quitutes da Dona Zuza", "Mel Inventado"]],
    [25, 1, ["Quitutes da Dona Zuza"]],
  ];
  const fev: [number, number, string[]][] = [
    [1, 2, ["Quitutess da Dona Zuza", "Horta Imaginária"]],
    [8, 1, ["queijos do teste"]],
  ];
  const linhas: Celula[][] = [
    ["Janeiro", null, null, null, "Fevereiro"],
    ["Data", "qtda", "Produtores", null, "Data", "qtda", "Produtores"],
  ];
  const coluna = (feiras: [number, number, string[]][]) =>
    feiras.flatMap(([d, q, ps]) =>
      ps.map((p, i) => [i === 0 ? d : null, i === 0 ? q : null, p] as Celula[]),
    );
  const a = coluna(jan);
  const b = coluna(fev);
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    linhas.push([...(a[i] ?? [null, null, null]), null, ...(b[i] ?? [])]);
  return { nome: "Produtores Feira -26", linhas };
}

/** Produtores, desenho B: rótulos na coluna A, uma feira por coluna. */
export function abaProdutores25(): AbaFicticia {
  return {
    nome: "Produtores Feira -25",
    linhas: [
      ["Dezembro"],
      ["Data", 6, 13],
      ["qtda", 2, 2],
      ["Produtores", "Horta Imaginária", "Mel Inventado"],
      [null, "Pães do Exemplo", "Horta Imaginaria"],
    ],
  };
}

export function abaEcocopos(): AbaFicticia {
  return {
    nome: "Souvenir – ARP",
    linhas: [
      ["Janeiro 2025"],
      ["Data", "Tipo", "Quantidade", "Valor"],
      [dia(2025, 1, 10), "Ecocopo fictício", 10, "4,25"],
      [dia(2025, 1, 24), "Ecocopo fictício", 4, "4,25"],
      ["Total", null, 14, "8,50"],
      [],
      ["Fevereiro 2025"],
      ["Data", "Tipo", "Quantidade", "Valor"],
      [7, "Caneca inventada", 3, "1.234,56"],
      [".", ".", ".", "."],
      [15, "Ecocopo fictício", "dois", "4,25"],
    ],
  };
}

// ---------------------------------------------------------------------------
// Tour Guiado ARP: quiosque, tours e Gestão
// ---------------------------------------------------------------------------

/** Nov/2025, sem pessoas e dificuldade. */
export function abaQuiosqueNov25(): AbaFicticia {
  return {
    nome: "Quiosque_Nov25",
    linhas: [
      [
        "Data",
        "Dia da semana",
        "Horário",
        "Pergunta",
        "Público",
        "Cidade de origem",
      ],
      [
        dia(2025, 11, 3),
        "segunda",
        "10:15",
        "Onde fica o banheiro fictício?",
        "Turista",
        "Cidade Inventada",
      ],
      // Excel leu 05/11 como 11 de maio: dia e mês trocados.
      [
        dia(2025, 5, 11),
        "quarta",
        "11:00",
        "Pergunta inventada 2",
        "Friiburguense",
        null,
      ],
      [
        "13/12/2025",
        "sábado",
        "15:00",
        "Pergunta inventada 3",
        "Entregador",
        null,
      ],
      [".", ".", ".", ".", ".", "."],
      [],
      [
        dia(2025, 11, 20),
        "quinta",
        null,
        "Pergunta inventada 4",
        "Trabalhador",
        null,
      ],
      [dia(2025, 11, 21), null, null, ".", null, null],
      [
        dia(2025, 11, 22),
        "sábado",
        "09:30",
        "Pergunta inventada 5",
        null,
        null,
      ],
      [
        dia(2025, 11, 23),
        "domingo",
        "09:45",
        "Pergunta inventada 6",
        "Astronauta",
        null,
      ],
    ],
  };
}

/** Jul/2026: ordem diferente, com pessoas e dificuldade. */
export function abaQuiosqueJul26(): AbaFicticia {
  return {
    nome: "Quiosque_Jul26",
    linhas: [
      [
        "Pergunta",
        "Data",
        "Horário",
        "Público",
        "Cidade",
        "Nº de pessoas",
        "Dificuldade na resposta",
      ],
      [
        "Pergunta inventada A",
        "02/07/2026",
        "14h",
        "turistas",
        "Vila Fictícia",
        3,
        "Nenhuma",
      ],
      [
        "Pergunta inventada B",
        "07/02/2026",
        "14h30",
        "Friburguense",
        null,
        "2",
        "Alguma",
      ],
      [
        "Pergunta inventada C",
        dia(2026, 7, 9),
        null,
        "Turista",
        "Vila Fictícia",
        null,
        null,
      ],
    ],
  };
}

export const CAB_TOUR = [
  "Data",
  "Ano",
  "Grupo",
  "Tipo",
  "Participantes",
  "Receita parceiro",
  "Receita ARP",
  "Custo parceiro",
  "Custo álbum",
  "Custo copo",
  "Outros custos",
  "Resultado",
];

export function abaTour(): AbaFicticia {
  const t = (
    d: Date,
    ano: number,
    grupo: string,
    tipo: string,
    p: number,
    res: number,
  ): Celula[] => [
    d,
    ano,
    grupo,
    tipo,
    p,
    100,
    50,
    120,
    p * 2.48,
    p * 2.92,
    0,
    res,
  ];
  return {
    nome: "Tour Guiado",
    linhas: [
      ["Controle de tours (fictício)"],
      CAB_TOUR,
      t(dia(2023, 2, 10), 2023, "Grupo inventado 1", "Mensal", 30, -100.5),
      t(dia(2023, 3, 10), 2023, "Escola fictícia", "Escolar", 40, -200),
      t(dia(2024, 5, 4), 2024, "Grupo inventado 2", "Mensal", 25, -150.25),
      // Ano calculado errado.
      t(dia(2025, 6, 21), 2024, "Grupo inventado 3", "Mensal", 20, -80),
      ["Total", null, null, null, 115],
    ],
  };
}

export function abaTourCervejeiro(): AbaFicticia {
  return {
    nome: "Tour Cervejeiro",
    linhas: [
      [
        "Data",
        "Grupo",
        "Participantes",
        "Receita ARP",
        "Custo parceiro",
        "Outros custos",
      ],
      [dia(2025, 9, 13), "Confraria fictícia", 12, "300,00", "250,50", "10"],
    ],
  };
}

/** Resumo Gestão: anos nas linhas, meses abaixo de cada ano. 2024 difere. */
export function abaGestao(): AbaFicticia {
  return {
    nome: "Gestão",
    linhas: [
      ["Resumo fictício"],
      ["Ano", "Participantes", "Resultado"],
      [2023, 70, -300.5],
      ["Fevereiro", 30, -100.5],
      ["Março", 40, -200],
      [2024, 27, -150.25],
      [2025, null, null],
      ["Junho", 20, -80],
      ["Setembro", 12, 39.5],
    ],
  };
}
