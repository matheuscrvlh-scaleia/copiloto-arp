// Leitor do "Extrato Mensal" da Sousa e Couto (PDF). Recebe os textos de cada
// página com a posição (x, y, largura) e devolve a folha estruturada.
// O layout foi mapeado na folha de 07/2026: rubricas em duas colunas, cada
// uma com código e descrição, referência, valor e P (provento) / D (desconto).

export interface ItemTexto {
  str: string;
  x: number;
  y: number;
  /** Largura do texto: x + w é a borda direita (números são alinhados à direita). */
  w: number;
}

export type Natureza = "provento" | "desconto" | "informativa";
export type Situacao =
  | "trabalhando"
  | "ferias"
  | "doenca"
  | "acidente"
  | "aposentadoria"
  | "demitido";
export type TipoContrato =
  | "clt"
  | "aprendiz"
  | "estagiario"
  | "pj"
  | "pro_labore";

export interface RubricaExtrato {
  codigo: number;
  descricao: string;
  natureza: Natureza;
  referencia: number | null;
  valor: number;
}

export interface ColaboradorExtrato {
  matricula: number;
  nome: string;
  situacao: Situacao;
  tipo_contrato: TipoContrato;
  departamento_codigo: number | null;
  cargo_codigo: number | null;
  cargo_nome: string | null;
  cbo: string | null;
  /** aaaa-mm-dd */
  admissao: string | null;
  /** Horas por mês ("Horas Mês"), quando vier. */
  horas_mes: number | null;
  salario: number | null;
  proventos: number | null;
  descontos: number | null;
  liquido: number | null;
  base_inss: number | null;
  base_fgts: number | null;
  valor_fgts: number | null;
  rubricas: RubricaExtrato[];
}

export interface ExtratoMensal {
  empresa: string | null;
  /** aaaa-mm-01 */
  competencia: string;
  colaboradores: ColaboradorExtrato[];
  /** Resumo da empresa no fim do extrato (INSS, RAT, Terceiros, FGTS, IRRF…). */
  resumo: Record<string, number>;
  liquido_geral: number | null;
}

export class ErroExtrato extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErroExtrato";
  }
}

// ---------------------------------------------------------------------------
// Números e textos
// ---------------------------------------------------------------------------

const NUMERO = /^-?\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^-?\d+(?:,\d+)?$/;
const HORAS = /^\d+:\d{2}$/;

/** "1.234,56" → 1234.56; "220:00" → 220 (horas); outro texto → null. */
export function numeroBr(texto: string): number | null {
  const t = texto.trim();
  if (HORAS.test(t)) {
    const [h, m] = t.split(":").map(Number) as [number, number];
    return h + m / 60;
  }
  if (!NUMERO.test(t)) return null;
  return Number(t.replace(/\./g, "").replace(",", "."));
}

/** "11/05/1994" → "1994-05-11". */
function dataBr(texto: string | undefined): string | null {
  const m = texto?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

const SITUACOES: [RegExp, Situacao][] = [
  [/^trab/i, "trabalhando"],
  [/^f[ée]rias/i, "ferias"],
  [/^doen/i, "doenca"],
  [/^acid/i, "acidente"],
  [/^aposent/i, "aposentadoria"],
  [/^demit/i, "demitido"],
];

const VINCULOS: [RegExp, TipoContrato][] = [
  [/^celetista/i, "clt"],
  [/^aprendiz/i, "aprendiz"],
  [/^estag/i, "estagiario"],
  [/^(diretor|pr[óo].?labore|contribuinte)/i, "pro_labore"],
];

function mapear<T>(
  tabela: [RegExp, T][],
  valor: string,
  campo: string,
  quem: string,
): T {
  const achou = tabela.find(([re]) => re.test(valor.trim()));
  if (!achou) {
    throw new ErroExtrato(
      `Não reconheço o valor "${valor}" em ${campo} (${quem}). Avise a equipe técnica para incluir.`,
    );
  }
  return achou[1];
}

// ---------------------------------------------------------------------------
// Linhas
// ---------------------------------------------------------------------------

interface Linha {
  y: number;
  itens: ItemTexto[];
}

/** Agrupa os textos da página em linhas (mesmo y, tolerância 3) da esquerda para a direita. */
export function linhasDaPagina(itens: ItemTexto[]): Linha[] {
  const linhas: Linha[] = [];
  const ordenados = itens
    .map((i) => ({ ...i, str: i.str.trim() }))
    .filter((i) => i.str)
    .sort((a, b) => b.y - a.y || a.x - b.x);
  for (const item of ordenados) {
    const linha = linhas.find((l) => Math.abs(l.y - item.y) <= 3);
    if (linha) linha.itens.push(item);
    else linhas.push({ y: item.y, itens: [item] });
  }
  for (const l of linhas) l.itens.sort((a, b) => a.x - b.x);
  return linhas;
}

/** Texto logo depois do rótulo, na mesma linha. */
function depois(linha: Linha, rotulo: string): string | undefined {
  const i = linha.itens.findIndex((it) => it.str === rotulo);
  if (i < 0) return undefined;
  const proximo = linha.itens[i + 1];
  return proximo && !proximo.str.endsWith(":") ? proximo.str : undefined;
}

function numeroDepois(linha: Linha, rotulo: string): number | null {
  const v = depois(linha, rotulo);
  return v === undefined ? null : numeroBr(v);
}

const tem = (linha: Linha, rotulo: string) =>
  linha.itens.some((i) => i.str === rotulo);

// ---------------------------------------------------------------------------
// Rubricas (duas colunas)
// ---------------------------------------------------------------------------

/** Onde começa a coluna da direita e a borda que separa referência de valor. */
const COLUNA_DIREITA_X = 285;
const LIMITE_REF_ESQUERDA = 222;
const LIMITE_REF_DIREITA = 497;

function rubricaDaColuna(
  itens: ItemTexto[],
  limiteRef: number,
): RubricaExtrato | null {
  const textos: string[] = [];
  let referencia: number | null = null;
  let valor: number | null = null;
  let marca: string | null = null;

  for (const it of itens) {
    const comMarca = it.str.match(/^(.+?)\s+([PDI])$/);
    const numeroTexto =
      comMarca && numeroBr(comMarca[1] as string) !== null
        ? (comMarca[1] as string)
        : it.str;
    if (comMarca && numeroTexto !== it.str) marca = comMarca[2] as string;
    if (/^[PDI*]$/.test(it.str)) {
      // "*" marca informativa (ex.: FGTS da rescisão).
      marca = it.str;
      continue;
    }
    const n = numeroBr(numeroTexto);
    if (n !== null && textos.length > 0) {
      if (it.x + it.w < limiteRef) referencia = n;
      else valor = n;
    } else {
      textos.push(it.str);
    }
  }

  // Linha com um número só (ex.: "23 FGTS DE RESCISAO … *"): ele é o valor.
  if (valor === null && referencia !== null) {
    valor = referencia;
    referencia = null;
  }

  const texto = textos.join(" ");
  const m = texto.match(/^(\d+)\s+(.+)$/);
  if (!m || valor === null) return null;
  return {
    codigo: Number(m[1]),
    descricao: (m[2] as string).trim(),
    natureza:
      marca === "P" ? "provento" : marca === "D" ? "desconto" : "informativa",
    referencia,
    valor,
  };
}

function rubricasDaLinha(linha: Linha): RubricaExtrato[] {
  const esquerda = linha.itens.filter((i) => i.x < COLUNA_DIREITA_X);
  const direita = linha.itens.filter((i) => i.x >= COLUNA_DIREITA_X);
  return [
    rubricaDaColuna(esquerda, LIMITE_REF_ESQUERDA),
    rubricaDaColuna(direita, LIMITE_REF_DIREITA),
  ].filter((r): r is RubricaExtrato => r !== null);
}

// ---------------------------------------------------------------------------
// Resumo da empresa (última página)
// ---------------------------------------------------------------------------

const ROTULOS_RESUMO: Record<string, string> = {
  "Salário contribuição empregados:": "base_inss_empregados",
  "Salário contribuição contribuintes:": "base_inss_contribuintes",
  "Base total:": "base_inss_total",
  "Segurados:": "inss_segurados",
  "Empresa:": "inss_empresa",
  "RAT:": "rat",
  "Contribuintes:": "inss_contribuintes",
  "Terceiros:": "terceiros",
  "Total INSS:": "total_inss",
  "(-) Salário Família:": "salario_familia",
  "(-) Salário Maternidade:": "salario_maternidade",
  "Base do FGTS:": "base_fgts",
  "Valor do FGTS:": "valor_fgts",
  "Base do FGTS Aprendiz:": "base_fgts_aprendiz",
  "Valor do FGTS Aprendiz:": "valor_fgts_aprendiz",
  "Base FGTS Rescisório:": "base_fgts_rescisorio",
  "Valor FGTS Rescisório:": "valor_fgts_rescisorio",
  "Valor Total do IRRF:": "irrf_total",
};

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export function lerExtrato(paginas: ItemTexto[][]): ExtratoMensal {
  let empresa: string | null = null;
  let competencia: string | null = null;
  let liquidoGeral: number | null = null;
  const resumo: Record<string, number> = {};
  const colaboradores: ColaboradorExtrato[] = [];

  let atual: ColaboradorExtrato | null = null;
  let emRubricas = false;
  let noResumo = false;

  for (const itens of paginas) {
    for (const linha of linhasDaPagina(itens)) {
      const primeiro = linha.itens[0]?.str ?? "";

      // Cabeçalho repetido em toda página.
      if (
        primeiro === "Empresa:" &&
        linha.itens.some((i) => i.str === "Página:")
      ) {
        empresa ??= depois(linha, "Empresa:") ?? null;
        continue;
      }
      if (primeiro === "Competência:") {
        const m = depois(linha, "Competência:")?.match(/^(\d{2})\/(\d{4})$/);
        if (m) competencia ??= `${m[2]}-${m[1]}-01`;
        continue;
      }
      if (
        ["CNPJ:", "Cálculo:"].includes(primeiro) ||
        primeiro === "EXTRATO MENSAL"
      )
        continue;

      if (primeiro === "Resumo por Rubrica") {
        atual = null;
        emRubricas = false;
        noResumo = true;
        continue;
      }
      if (noResumo) {
        if (tem(linha, "Líquido Geral:"))
          liquidoGeral = numeroDepois(linha, "Líquido Geral:");
        for (const [rotulo, chave] of Object.entries(ROTULOS_RESUMO)) {
          if (!tem(linha, rotulo) || chave in resumo) continue;
          const v = numeroDepois(linha, rotulo);
          if (v !== null) resumo[chave] = v;
        }
        continue;
      }

      // Início de um colaborador: "Empr.:" (empregado) ou "Contr:" (contribuinte).
      if (primeiro === "Empr.:" || primeiro === "Contr:") {
        const ident = depois(linha, primeiro) ?? "";
        const m = ident.match(/^(\d+)\s+(.+)$/);
        if (!m)
          throw new ErroExtrato(
            `Não consegui ler matrícula e nome em "${ident}".`,
          );
        const nome = (m[2] as string).trim();
        const situacao = depois(linha, "Situação:");
        if (!situacao)
          throw new ErroExtrato(`Situação não encontrada para ${nome}.`);
        atual = {
          matricula: Number(m[1]),
          nome,
          situacao: mapear(SITUACOES, situacao, "Situação", nome),
          tipo_contrato: primeiro === "Contr:" ? "pro_labore" : "clt",
          departamento_codigo: null,
          cargo_codigo: null,
          cargo_nome: null,
          cbo: null,
          admissao: dataBr(depois(linha, "Adm:")),
          horas_mes: null,
          salario: null,
          proventos: null,
          descontos: null,
          liquido: null,
          base_inss: null,
          base_fgts: null,
          valor_fgts: null,
          rubricas: [],
        };
        colaboradores.push(atual);
        emRubricas = false;
        continue;
      }
      if (!atual) continue;

      if (primeiro === "Vínculo:") {
        const vinculo = depois(linha, "Vínculo:");
        if (vinculo)
          atual.tipo_contrato = mapear(
            VINCULOS,
            vinculo,
            "Vínculo",
            atual.nome,
          );
        const depto = numeroDepois(linha, "Depto:");
        atual.departamento_codigo = depto === null ? null : Math.trunc(depto);
        atual.horas_mes = numeroDepois(linha, "Horas Mês:");
        continue;
      }
      if (primeiro === "Cargo:") {
        const cargo = depois(linha, "Cargo:")?.match(/^(\d+)\s+(.+)$/);
        if (cargo) {
          atual.cargo_codigo = Number(cargo[1]);
          atual.cargo_nome = (cargo[2] as string).trim();
        }
        atual.cbo = depois(linha, "C.B.O:") ?? null;
        atual.salario = numeroDepois(linha, "Salário:");
        emRubricas = true;
        continue;
      }
      if (primeiro === "ND:" || tem(linha, "Proventos:")) {
        emRubricas = false;
        atual.proventos = numeroDepois(linha, "Proventos:");
        atual.descontos = numeroDepois(linha, "Descontos:");
        atual.liquido = numeroDepois(linha, "Líquido:");
        continue;
      }
      if (primeiro === "NF:" || tem(linha, "Base INSS:")) {
        atual.base_inss = numeroDepois(linha, "Base INSS:");
        atual.base_fgts = numeroDepois(linha, "Base FGTS:");
        atual.valor_fgts = numeroDepois(linha, "Valor FGTS:");
        continue;
      }
      if (emRubricas) atual.rubricas.push(...rubricasDaLinha(linha));
    }
  }

  if (!competencia) {
    throw new ErroExtrato(
      "Não encontrei a competência. O arquivo é o Extrato Mensal da Sousa e Couto?",
    );
  }
  if (colaboradores.length === 0) {
    throw new ErroExtrato("Nenhum colaborador encontrado no arquivo.");
  }
  const repetidas = colaboradores
    .map((c) => c.matricula)
    .filter((m, i, todas) => todas.indexOf(m) !== i);
  if (repetidas.length) {
    throw new ErroExtrato(
      `Matrícula repetida no arquivo: ${[...new Set(repetidas)].join(", ")}.`,
    );
  }

  return {
    empresa,
    competencia,
    colaboradores,
    resumo,
    liquido_geral: liquidoGeral,
  };
}
