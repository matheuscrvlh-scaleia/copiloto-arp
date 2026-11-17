import { z } from "zod";
import {
  CAMPOS_AGUA,
  type CampoAgua,
  formatarM3,
  LISTA_CAMPOS,
  MESES_ABREV,
  normalizar,
  ROTULO_TIPO,
  rotuloMes,
  type TipoAgua,
} from "./agua-formato";

// Leitura do faturamento individualizado da água (spec 4.4 e 4.11): a
// planilha mensal do parceiro, um arquivo por bloco, ou a camada de texto do
// PDF quando a planilha não vier. Funções puras (sem banco, sem Next): o
// servidor lê o arquivo e passa as abas ou o texto das páginas.
//
// Regras:
//   * Colunas pelo título (sinônimos abaixo) ou pelo modelo salvo em
//     Parâmetros (operacoes.parametros.agua_modelo: { campo: título ou letra
//     da coluna }), que vale antes dos sinônimos.
//   * Números e datas no formato brasileiro (1.632,060; 24/08/2026), ou já
//     como número e data quando a célula do Excel é numérica.
//   * Contas em inteiros: m³ em milésimos e reais em centavos (o arquivo traz
//     o valor pronto; nada é recalculado, só somado).
//   * Subtotal e cabeçalho repetido no meio do arquivo são ignorados e
//     listados; a linha de total vira o "resumo do arquivo", usado na
//     conferência de linhas e totais.

export type Celula = string | number | boolean | Date | null;

export interface Aba {
  nome: string;
  linhas: Celula[][];
}

export {
  CAMPOS_AGUA,
  type CampoAgua,
  formatarM3,
  formatarVisor,
  LISTA_CAMPOS,
  MESES_ABREV,
  normalizar,
  ROTULO_TIPO,
  rotuloMes,
  TIPOS_AGUA,
  type TipoAgua,
} from "./agua-formato";

const textoModelo = z.string().trim().min(1).max(80);

/**
 * Modelo de importação (operacoes.parametros.agua_modelo): para cada campo,
 * o título da coluna na planilha ou a letra dela ("B"); `rotulo_total` é o
 * texto da linha do resumo (padrão: "Total", "Totais", "Resumo").
 */
export const modeloAgua = z
  .object({
    ...(Object.fromEntries(
      LISTA_CAMPOS.map((c) => [c, textoModelo.optional()]),
    ) as Record<CampoAgua, z.ZodOptional<typeof textoModelo>>),
    rotulo_total: textoModelo.optional(),
  })
  .strip();
export type ModeloAgua = z.infer<typeof modeloAgua>;

// ---------------------------------------------------------------------------
// Texto, números e datas no formato brasileiro
// ---------------------------------------------------------------------------

const textoDe = (c: Celula | undefined): string =>
  c === null || c === undefined
    ? ""
    : c instanceof Date
      ? c.toISOString().slice(0, 10)
      : String(c).trim();

/**
 * Número de uma célula: número do Excel ou texto brasileiro ("1.632,060",
 * "R$ 203,28", "102,943"). Vazio ou "-" → null; texto que não é número →
 * NaN. Ponto sem vírgula com 3 casas é milhar ("1.632" = 1632).
 */
export function numeroBr(c: Celula | undefined): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : Number.NaN;
  if (c === null || c === undefined || typeof c === "boolean") return null;
  if (c instanceof Date) return Number.NaN;
  let t = c.replace(/R\$|m³|m3|\s| /gi, "");
  if (t === "" || /^[-–—]$/.test(t)) return null;
  let sinal = 1;
  if (/^\(.*\)$/.test(t)) {
    sinal = -1;
    t = t.slice(1, -1);
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^-?\d+,\d+$/.test(t))
    return sinal * Number(t.replace(/\./g, "").replace(",", "."));
  if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(t))
    return sinal * Number(t.replace(/,/g, ""));
  if (/^-?\d+(\.\d+)?$/.test(t)) return sinal * Number(t);
  return Number.NaN;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function dataValida(a: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000 || a > 2100) return null;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${a}-${pad2(m)}-${pad2(d)}`;
}

/** Excel conta dias desde 30/12/1899. */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

/**
 * Data de uma célula → "aaaa-mm-dd": data do Excel, "24/08/2026",
 * "24/08/26", "2026-08-24" ou o número de série do Excel. Vazio → null;
 * texto que não é data → "invalida".
 */
export function dataBr(c: Celula | undefined): string | null | "invalida" {
  if (c === null || c === undefined || c === "") return null;
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return "invalida";
    return (
      dataValida(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate()) ??
      "invalida"
    );
  }
  if (typeof c === "number") {
    if (!Number.isInteger(c) || c < 30000 || c > 80000) return "invalida";
    const d = new Date(EPOCA_EXCEL + c * 86_400_000);
    return (
      dataValida(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) ??
      "invalida"
    );
  }
  const t = String(c).trim();
  if (!t) return null;
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const ano = m[3]?.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return dataValida(ano, Number(m[2]), Number(m[1])) ?? "invalida";
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m)
    return dataValida(Number(m[1]), Number(m[2]), Number(m[3])) ?? "invalida";
  return "invalida";
}

/** Dias entre duas datas "aaaa-mm-dd". */
export function diasEntreDatas(de: string, ate: string): number {
  return Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
}

/** m³ → milésimos inteiros (as somas não acumulam erro). */
export const paraMil = (m3: number) => Math.round(m3 * 1000);
/** Reais → centavos inteiros (arredondamento comercial na 2ª casa). */
export const paraCentavos = (reais: number) => Math.round(reais * 100);

// ---------------------------------------------------------------------------
// Mês de referência
// ---------------------------------------------------------------------------

const anoDe = (t: string) => (t.length === 2 ? 2000 + Number(t) : Number(t));

/**
 * Mês de referência num texto: "SET/26", "SET-2026", "set 2026",
 * "09/2026" ou uma data (vale o mês dela). → "aaaa-mm-01" ou null.
 */
export function referenciaDe(c: Celula | undefined): string | null {
  if (c instanceof Date || typeof c === "number") {
    const d = dataBr(c);
    return d && d !== "invalida" ? `${d.slice(0, 7)}-01` : null;
  }
  const t = normalizar(textoDe(c)).toUpperCase();
  if (!t) return null;
  const nome = t.match(
    /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\s*(\d{4}|\d{2})\b/,
  );
  if (nome?.[1] && nome[2]) {
    const mes = MESES_ABREV.indexOf(nome[1] as (typeof MESES_ABREV)[number]);
    const ano = anoDe(nome[2]);
    if (ano >= 2000 && ano <= 2100) return `${ano}-${pad2(mes + 1)}-01`;
  }
  const num = t.match(/^(\d{1,2})\s(\d{4})$/);
  if (num) {
    const mes = Number(num[1]);
    if (mes >= 1 && mes <= 12) return `${num[2]}-${pad2(mes)}-01`;
  }
  return null;
}

/** "Bloco 05", "5", "14 - Cervejaria Pontal", "BL 85" → "05", "14", "85". */
export function blocoDe(c: Celula | undefined): string | null {
  const t = textoDe(c);
  if (!t) return null;
  const m = t.match(/^\s*(?:bl(?:oco)?\.?\s*)?(\d{1,2})(?!\d)/i);
  return m?.[1] ? m[1].padStart(2, "0") : null;
}

/** Bloco no nome do arquivo ("Espaço ARP - Bloco 05 - Faturamento…"). */
export function blocoDoNome(nome: string): string | null {
  const m = nome.match(/\bbl(?:oco)?[\s._-]*(\d{1,2})(?!\d)/i);
  return m?.[1] ? m[1].padStart(2, "0") : null;
}

/** Tipo de faturamento: FATURADO, MÍNIMO, 0 e REFATURADO. */
export function tipoDe(c: Celula | undefined): TipoAgua | null | "invalido" {
  if (c === null || c === undefined) return null;
  if (typeof c === "number") return c === 0 ? "ZERO" : "invalido";
  const t = normalizar(textoDe(c)).toUpperCase();
  if (!t) return null;
  if (t === "0" || t === "ZERO" || t.startsWith("SEM COBRANCA")) return "ZERO";
  if (t.startsWith("REFATURADO")) return "REFATURADO";
  if (t.startsWith("FATURADO")) return "FATURADO";
  if (t === "MIN" || t.startsWith("MINIMO") || t.startsWith("MINIMA"))
    return "MINIMO";
  return "invalido";
}

/** Nº do hidrômetro como chave: maiúsculo, sem espaço. */
export const codigoHidrometro = (t: string) =>
  t.replace(/\s+/g, "").toUpperCase();

// ---------------------------------------------------------------------------
// Colunas: modelo salvo e sinônimos dos títulos
// ---------------------------------------------------------------------------

/**
 * Reconhece o campo pelo título (normalizado). A ordem importa: "data da
 * leitura anterior" é data, não leitura; "volume faturado" não é consumo.
 */
const SINONIMOS: [CampoAgua, (t: string) => boolean][] = [
  ["data_anterior", (t) => /\b(data|dt)\b/.test(t) && /\bant/.test(t)],
  ["data_atual", (t) => /\b(data|dt)\b/.test(t) && /\batu/.test(t)],
  ["leitura_anterior", (t) => /\bleit/.test(t) && /\bant/.test(t)],
  ["leitura_atual", (t) => /\bleit/.test(t) && /\batu/.test(t)],
  ["hidrometro", (t) => /\b(hidrometro|hidr|medidor)\b/.test(t)],
  [
    "volume_faturado",
    (t) =>
      (/\bvol/.test(t) && !/\bvalor\b/.test(t)) ||
      (/\bfaturad/.test(t) && /\bm3\b/.test(t)),
  ],
  ["consumo", (t) => /\bconsumo\b/.test(t)],
  ["valor", (t) => /\bvalor\b/.test(t) || /^total r$/.test(t)],
  ["tipo", (t) => /\btipo\b/.test(t) || t === "faturamento"],
  ["dias", (t) => /^(n |no |qtd |qtde )?dias\b/.test(t)],
  ["bloco", (t) => /^(bloco|bl)$/.test(t)],
  ["sala", (t) => /\b(sala|salas|unidade|unid|loja)\b/.test(t)],
  ["cliente", (t) => /\b(cliente|locatario|nome|usuario|condomino)\b/.test(t)],
  ["referencia", (t) => /\b(referencia|ref|competencia|mes)\b/.test(t)],
];

/** Campo reconhecido pelo título, ou null. */
export function campoDoTitulo(titulo: string): CampoAgua | null {
  const t = normalizar(titulo);
  if (!t || t.length > 60) return null;
  return SINONIMOS.find(([, ok]) => ok(t))?.[0] ?? null;
}

/** "B" → 1, "AA" → 26; null se não for uma letra de coluna. */
export function indiceDaLetra(ref: string): number | null {
  if (!/^[A-Z]{1,3}$/.test(ref)) return null;
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export type Mapa = Partial<Record<CampoAgua, number>>;

/** Campos de uma linha de títulos (modelo primeiro, depois sinônimos). */
export function mapearColunas(
  linha: Celula[],
  modelo: ModeloAgua,
): { mapa: Mapa; reconhecidos: number } {
  const mapa: Mapa = {};
  const usadas = new Set<number>();
  const titulos = linha.map((c) => normalizar(textoDe(c)));
  let reconhecidos = 0;
  for (const campo of LISTA_CAMPOS) {
    const ref = modelo[campo];
    if (!ref) continue;
    const letra = indiceDaLetra(ref.trim());
    const i = letra ?? titulos.indexOf(normalizar(ref));
    if (i >= 0 && !usadas.has(i)) {
      mapa[campo] = i;
      usadas.add(i);
      if (letra === null) reconhecidos++;
    }
  }
  titulos.forEach((t, i) => {
    if (usadas.has(i) || !t) return;
    const campo = campoDoTitulo(t);
    if (campo && mapa[campo] === undefined) {
      mapa[campo] = i;
      usadas.add(i);
      reconhecidos++;
    }
  });
  return { mapa, reconhecidos };
}

const faltando = (mapa: Mapa) =>
  LISTA_CAMPOS.filter(
    (c) => CAMPOS_AGUA[c].obrigatorio && mapa[c] === undefined,
  );

// ---------------------------------------------------------------------------
// Resultado da leitura
// ---------------------------------------------------------------------------

export interface LinhaAgua {
  /** Linha no arquivo (1 = primeira), ou a página no PDF. */
  linha: number;
  bloco: string;
  sala: string;
  cliente: string;
  hidrometro: string;
  dataAnterior: string | null;
  leituraAnterior: number | null;
  dataAtual: string | null;
  leituraAtual: number | null;
  dias: number | null;
  consumo: number;
  volumeFaturado: number;
  valorCentavos: number;
  tipo: TipoAgua;
  /** Linha lida do texto do PDF: pede conferência na prévia. */
  conferir?: boolean;
}

/** O que o arquivo diz de si mesmo (linha de total e quantidades). */
export interface ResumoArquivo {
  hidrometros: number | null;
  faturados: number | null;
  /** m³ em milésimos. */
  consumo: number | null;
  volume: number | null;
  /** Centavos. */
  valor: number | null;
}

export type NivelAviso = "erro" | "aviso" | "info";

export interface AvisoAgua {
  nivel: NivelAviso;
  arquivo?: string;
  bloco?: string;
  linha?: number;
  mensagem: string;
}

export interface ArquivoLido {
  arquivo: string;
  fonte: "planilha" | "pdf";
  referencia: string | null;
  blocos: string[];
  linhas: LinhaAgua[];
  resumo: ResumoArquivo | null;
  ignoradas: { linha: number; motivo: string }[];
  /** Títulos da linha de cabeçalho da primeira aba lida (para guardar o modelo). */
  titulos: string[];
  avisos: AvisoAgua[];
}

export interface ColunasPedidas {
  arquivo: string;
  /** Títulos da linha de cabeçalho (ou as letras, se não houver títulos). */
  titulos: string[];
  faltam: CampoAgua[];
  /** O que já foi reconhecido: campo → título. */
  achadas: Partial<Record<CampoAgua, string>>;
}

export type LeituraArquivo =
  | { ok: ArquivoLido }
  | { colunas: ColunasPedidas }
  | { erro: string };

const RESUMO_VAZIO: ResumoArquivo = {
  hidrometros: null,
  faturados: null,
  consumo: null,
  volume: null,
  valor: null,
};

const temResumo = (r: ResumoArquivo) =>
  Object.values(r).some((v) => v !== null);

const inteiro = (n: number | null) =>
  n !== null && Number.isInteger(n) && n >= 0 && n < 100000 ? n : null;

/**
 * Pares "rótulo: valor" fora das linhas de dados ("Quantidade de
 * hidrômetros | 43", "Valor total | 17.295,42", ou "43 hidrômetros" na
 * mesma célula).
 */
function lerParesDoResumo(linha: Celula[], r: ResumoArquivo): boolean {
  let achou = false;
  const texto = (i: number) => normalizar(textoDe(linha[i]));
  const proximoNumero = (i: number) => {
    for (let j = i + 1; j < linha.length; j++) {
      if (textoDe(linha[j]) === "") continue;
      const n = numeroBr(linha[j] ?? null);
      return n === null || Number.isNaN(n) ? null : n;
    }
    return null;
  };
  for (let i = 0; i < linha.length; i++) {
    const t = texto(i);
    if (!t) continue;
    const embutido = t.match(
      /^(\d+)\s+(hidrometros?|faturad[oa]s?|leituras?)\b/,
    );
    if (embutido?.[1]) {
      const n = Number(embutido[1]);
      if (/^faturad/.test(embutido[2] ?? "")) r.faturados = n;
      else r.hidrometros = n;
      achou = true;
      continue;
    }
    if (/^\d/.test(t)) continue;
    const n = proximoNumero(i);
    if (n === null) continue;
    if (
      /\bhidrometros?\b|\bleituras\b|\bunidades\b|\bmedidores\b/.test(t) &&
      inteiro(n) !== null
    ) {
      r.hidrometros = n;
      achou = true;
    } else if (
      /\bfaturad[oa]s\b/.test(t) &&
      !/\bm3\b|\bvolume\b/.test(t) &&
      inteiro(n) !== null
    ) {
      r.faturados = n;
      achou = true;
    } else if (/\bvolume\b|\bm3 faturad|\bfaturado m3\b/.test(t)) {
      r.volume = paraMil(n);
      achou = true;
    } else if (/\bconsumo\b/.test(t)) {
      r.consumo = paraMil(n);
      achou = true;
    } else if (/\bvalor\b|\btotal r\b/.test(t)) {
      r.valor = paraCentavos(n);
      achou = true;
    }
  }
  return achou;
}

const ROTULO_TOTAL = /^(total|totais|resumo|soma)\b/;
const ROTULO_SUBTOTAL = /^sub ?total/;

export interface OpcoesLeitura {
  modelo: ModeloAgua;
  /** Mapa escolhido na prévia (campo → índice da coluna), vale sobre o resto. */
  mapeamento?: Mapa;
  /** m³ e reais: diferença aceita entre o consumo e atual − anterior. */
  tolerancia: number;
}

/** Linha de títulos: a que reconhece mais campos nas primeiras 40 linhas. */
function acharCabecalho(
  linhas: Celula[][],
  modelo: ModeloAgua,
): { indice: number; mapa: Mapa } | null {
  let melhor: { indice: number; mapa: Mapa; n: number } | null = null;
  linhas.slice(0, 40).forEach((linha, indice) => {
    const { mapa, reconhecidos } = mapearColunas(linha, modelo);
    if (reconhecidos >= 3 && (!melhor || reconhecidos > melhor.n))
      melhor = { indice, mapa, n: reconhecidos };
  });
  const m = melhor as { indice: number; mapa: Mapa; n: number } | null;
  return m ? { indice: m.indice, mapa: m.mapa } : null;
}

/** Referência ou bloco escritos acima do cabeçalho ("Referência: SET/26"). */
function noTopo<T>(
  linhas: Celula[][],
  ate: number,
  ler: (c: Celula) => T | null,
  rotulo: RegExp,
): T | null {
  for (const linha of linhas.slice(0, Math.max(ate, 0))) {
    for (let i = 0; i < linha.length; i++) {
      const t = normalizar(textoDe(linha[i]));
      if (!rotulo.test(t)) continue;
      const mesmo = ler(textoDe(linha[i]).replace(/^[^:]*:/, "") || null);
      if (mesmo !== null) return mesmo;
      for (let j = i + 1; j < linha.length; j++) {
        const v = linha[j];
        if (v === null || v === undefined || textoDe(v) === "") continue;
        const lido = ler(v);
        if (lido !== null) return lido;
        break;
      }
    }
  }
  return null;
}

/** Lê uma planilha do parceiro (todas as abas que tiverem as colunas). */
export function lerPlanilhaAgua(
  arquivo: string,
  abas: Aba[],
  opcoes: OpcoesLeitura,
): LeituraArquivo {
  const lido: ArquivoLido = {
    arquivo,
    fonte: "planilha",
    referencia: null,
    blocos: [],
    linhas: [],
    resumo: null,
    ignoradas: [],
    titulos: [],
    avisos: [],
  };
  const resumo: ResumoArquivo = { ...RESUMO_VAZIO };
  const rotuloTotal = opcoes.modelo.rotulo_total
    ? new RegExp(`^${normalizar(opcoes.modelo.rotulo_total)}\\b`)
    : ROTULO_TOTAL;
  const blocoArquivo = blocoDoNome(arquivo);
  let lidaAlguma = false;
  let pedido: ColunasPedidas | null = null;

  for (const aba of abas) {
    const linhas = aba.linhas;
    if (!linhas.length) continue;
    const cab = acharCabecalho(linhas, opcoes.modelo);
    const mapa: Mapa = { ...(cab?.mapa ?? {}), ...(opcoes.mapeamento ?? {}) };
    const faltam = faltando(mapa);
    if (faltam.length) {
      // Aba sem nada que pareça a tabela (capa, instruções): pula calada.
      if (!cab && !opcoes.mapeamento) continue;
      const titulosLinha = cab ? (linhas[cab.indice] ?? []) : [];
      const largura = Math.max(...linhas.slice(0, 40).map((l) => l.length), 0);
      const titulos = Array.from({ length: largura }, (_, i) => {
        const t = textoDe(titulosLinha[i]);
        return t || letraDaColuna(i);
      });
      pedido ??= {
        arquivo,
        titulos,
        faltam,
        achadas: Object.fromEntries(
          Object.entries(mapa).map(([c, i]) => [c, titulos[i] ?? ""]),
        ),
      };
      continue;
    }
    if (!lidaAlguma && cab)
      lido.titulos = (linhas[cab.indice] ?? []).map((c) => textoDe(c));
    lidaAlguma = true;
    const inicio = cab ? cab.indice + 1 : 0;
    const refTopo =
      noTopo(
        linhas,
        inicio,
        referenciaDe,
        /\b(referencia|ref|competencia|mes)\b/,
      ) ?? referenciaDe(aba.nome);
    const blocoTopo =
      noTopo(linhas, inicio, blocoDe, /^(bloco|bl)\b/) ?? blocoDoNome(aba.nome);
    lerLinhas(linhas, inicio, mapa, {
      lido,
      resumo,
      rotuloTotal,
      tolerancia: opcoes.tolerancia,
      blocoPadrao: blocoTopo ?? blocoArquivo,
      referenciaPadrao: refTopo,
    });
  }

  if (!lidaAlguma) {
    if (pedido) return { colunas: pedido };
    return {
      erro: `Não achei a tabela de leituras em "${arquivo}". Confira se é a planilha de faturamento do parceiro.`,
    };
  }
  if (!lido.linhas.length && !lido.ignoradas.length)
    return { erro: `"${arquivo}" não tem nenhuma leitura.` };
  lido.blocos = [...new Set(lido.linhas.map((l) => l.bloco))].sort();
  lido.resumo = temResumo(resumo) ? resumo : null;
  return { ok: lido };
}

function letraDaColuna(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `Coluna ${s}`;
}

interface Contexto {
  lido: ArquivoLido;
  resumo: ResumoArquivo;
  rotuloTotal: RegExp;
  tolerancia: number;
  blocoPadrao: string | null;
  referenciaPadrao: string | null;
}

function lerLinhas(
  linhas: Celula[][],
  inicio: number,
  mapa: Mapa,
  ctx: Contexto,
) {
  const { lido } = ctx;
  const repetidos = new Map<string, number>();
  const celula = (linha: Celula[], campo: CampoAgua) => {
    const i = mapa[campo];
    return i === undefined ? null : (linha[i] ?? null);
  };
  for (let r = inicio; r < linhas.length; r++) {
    const linha = linhas[r] ?? [];
    const numero = r + 1;
    const preenchidas = linha.filter((c) => textoDe(c) !== "");
    if (!preenchidas.length) continue;
    const primeiro = normalizar(textoDe(preenchidas[0] ?? null));

    if (mapearColunas(linha, {}).reconhecidos >= 3) {
      lido.ignoradas.push({ linha: numero, motivo: "cabeçalho repetido" });
      continue;
    }
    if (ROTULO_SUBTOTAL.test(primeiro)) {
      lido.ignoradas.push({ linha: numero, motivo: "subtotal" });
      continue;
    }
    const hidro = codigoHidrometro(textoDe(celula(linha, "hidrometro")));
    if (ctx.rotuloTotal.test(primeiro)) {
      lerTotal(linha, mapa, ctx.resumo);
      continue;
    }
    if (!hidro) {
      if (!lerParesDoResumo(linha, ctx.resumo))
        lido.ignoradas.push({ linha: numero, motivo: "sem nº do hidrômetro" });
      continue;
    }
    if (hidro.length > 40) {
      lido.ignoradas.push({
        linha: numero,
        motivo: "nº do hidrômetro inválido",
      });
      continue;
    }
    const lidaOuErro = lerLinha(linha, numero, hidro, celula, ctx);
    if (typeof lidaOuErro === "string") {
      lido.ignoradas.push({ linha: numero, motivo: lidaOuErro });
      continue;
    }
    const chave = `${lidaOuErro.bloco}|${lidaOuErro.sala}|${hidro}`;
    const antes = repetidos.get(chave);
    if (antes !== undefined) {
      lido.ignoradas.push({
        linha: numero,
        motivo: `repete o hidrômetro ${hidro} da linha ${antes} (mesma sala)`,
      });
      continue;
    }
    repetidos.set(chave, numero);
    lido.linhas.push(lidaOuErro);
  }
}

function lerTotal(linha: Celula[], mapa: Mapa, r: ResumoArquivo) {
  const n = (campo: CampoAgua) => {
    const i = mapa[campo];
    if (i === undefined) return null;
    const v = numeroBr(linha[i] ?? null);
    return v === null || Number.isNaN(v) ? null : v;
  };
  const consumo = n("consumo");
  const volume = n("volume_faturado");
  const valor = n("valor");
  if (consumo !== null) r.consumo = paraMil(consumo);
  if (volume !== null) r.volume = paraMil(volume);
  if (valor !== null) r.valor = paraCentavos(valor);
  // A quantidade costuma vir na coluna do hidrômetro, da sala ou do cliente.
  for (const campo of ["hidrometro", "sala", "cliente"] as const) {
    const q = inteiro(n(campo));
    if (q !== null) {
      r.hidrometros = q;
      break;
    }
  }
  lerParesDoResumo(linha, r);
}

function lerLinha(
  linha: Celula[],
  numero: number,
  hidrometro: string,
  celula: (l: Celula[], c: CampoAgua) => Celula,
  ctx: Contexto,
): LinhaAgua | string {
  const num = (campo: CampoAgua) => numeroBr(celula(linha, campo));
  const ilegivel = (campo: CampoAgua) =>
    `${CAMPOS_AGUA[campo].rotulo.toLowerCase()} ilegível ("${textoDe(celula(linha, campo))}")`;

  const ref = preenchida(celula(linha, "referencia"))
    ? referenciaDe(celula(linha, "referencia"))
    : ctx.referenciaPadrao;
  if (ref) {
    if (ctx.lido.referencia && ctx.lido.referencia !== ref)
      return `mês de referência diferente (${rotuloMes(ref)}, o arquivo é de ${rotuloMes(ctx.lido.referencia)})`;
    ctx.lido.referencia = ref;
  }
  const bloco = preenchida(celula(linha, "bloco"))
    ? blocoDe(celula(linha, "bloco"))
    : ctx.blocoPadrao;
  if (!bloco)
    return "bloco não identificado (nem na linha, nem no nome do arquivo)";

  const valores: Partial<Record<CampoAgua, number | null>> = {};
  for (const campo of [
    "leitura_anterior",
    "leitura_atual",
    "consumo",
    "volume_faturado",
    "valor",
    "dias",
  ] as const) {
    const v = num(campo);
    if (Number.isNaN(v)) return ilegivel(campo);
    valores[campo] = v;
  }
  const datas: Partial<Record<CampoAgua, string | null>> = {};
  for (const campo of ["data_anterior", "data_atual"] as const) {
    const d = dataBr(celula(linha, campo));
    if (d === "invalida") return ilegivel(campo);
    datas[campo] = d;
  }
  const consumo = valores.consumo ?? null;
  if (consumo === null) return "consumo vazio";
  if (consumo < 0) return "consumo negativo";

  let tipo = tipoDe(celula(linha, "tipo"));
  if (tipo === "invalido") return ilegivel("tipo");
  const valor = valores.valor ?? 0;
  if (tipo === null) {
    tipo = valor === 0 ? "ZERO" : "FATURADO";
    ctx.lido.avisos.push({
      nivel: "aviso",
      arquivo: ctx.lido.arquivo,
      bloco,
      linha: numero,
      mensagem: `Tipo de faturamento vazio no hidrômetro ${hidrometro}: considerado ${ROTULO_TIPO[tipo]}.`,
    });
  }

  const dataAnterior = datas.data_anterior ?? null;
  const dataAtual = datas.data_atual ?? null;
  let dias = valores.dias ?? null;
  if (dias !== null && (!Number.isInteger(dias) || dias < 0))
    return ilegivel("dias");
  if (dias === null && dataAnterior && dataAtual) {
    const d = diasEntreDatas(dataAnterior, dataAtual);
    dias = d >= 0 ? d : null;
  }

  const l: LinhaAgua = {
    linha: numero,
    bloco,
    sala: textoDe(celula(linha, "sala")).slice(0, 120),
    cliente: textoDe(celula(linha, "cliente")).slice(0, 200),
    hidrometro,
    dataAnterior,
    leituraAnterior: valores.leitura_anterior ?? null,
    dataAtual,
    leituraAtual: valores.leitura_atual ?? null,
    dias,
    consumo,
    volumeFaturado: valores.volume_faturado ?? 0,
    valorCentavos: paraCentavos(valor),
    tipo,
  };
  const aviso = conferirConsumo(l, ctx.tolerancia);
  if (aviso)
    ctx.lido.avisos.push({
      nivel: "aviso",
      arquivo: ctx.lido.arquivo,
      bloco,
      linha: numero,
      mensagem: aviso,
    });
  return l;
}

const preenchida = (c: Celula) => textoDe(c) !== "";

/**
 * Consumo diferente de "leitura atual − anterior" (troca de hidrômetro ou
 * erro do arquivo). Leitura que voltou fica para o alerta de regressiva.
 */
export function conferirConsumo(
  l: LinhaAgua,
  tolerancia: number,
): string | null {
  if (l.leituraAnterior === null || l.leituraAtual === null) return null;
  if (l.leituraAtual < l.leituraAnterior) return null;
  const medido = paraMil(l.leituraAtual) - paraMil(l.leituraAnterior);
  if (Math.abs(medido - paraMil(l.consumo)) <= paraMil(tolerancia)) return null;
  return `Hidrômetro ${l.hidrometro}: consumo ${formatarM3(l.consumo)} diferente de leitura atual − anterior (${formatarM3(medido / 1000)}). Troca de hidrômetro ou erro do arquivo?`;
}

// ---------------------------------------------------------------------------
// PDF: só a camada de texto (o PDF do parceiro costuma ser imagem)
// ---------------------------------------------------------------------------

/** Menos que isso de texto nas páginas: o PDF é imagem. */
const MINIMO_DE_TEXTO = 40;

const RE_HIDRO = /\b([A-Z]{1,2}\d{2}[A-Z]{1,3}\d{4,8})\b/;
const RE_DATA = /\b\d{2}\/\d{2}\/\d{4}\b/g;
const RE_NUMERO =
  /(?<![\d/])-?\d{1,3}(?:\.\d{3})*(?:,\d+)?(?![\d/])|(?<![\d/,.])-?\d+(?:,\d+)?(?![\d/])/g;
const RE_TIPO = /\b(REFATURADO|FATURADO|M[ÍI]NIMO)\b/i;

/**
 * Lê a camada de texto do PDF (uma linha por hidrômetro): o nº do
 * hidrômetro, as duas datas, os números que vêm depois (leitura anterior,
 * atual, [dias], consumo, volume faturado, valor) e o tipo. Toda linha lida
 * assim pede conferência na prévia. PDF só com imagem → `imagem`.
 */
export function lerTextoPdf(
  arquivo: string,
  paginas: string[],
  opcoes: { tolerancia: number },
): LeituraArquivo | { imagem: true } {
  const total = paginas.join("").replace(/\s+/g, "").length;
  if (total < MINIMO_DE_TEXTO) return { imagem: true };
  const lido: ArquivoLido = {
    arquivo,
    fonte: "pdf",
    referencia:
      referenciaDe(paginas.join(" ").slice(0, 2000)) ?? referenciaDe(arquivo),
    blocos: [],
    linhas: [],
    resumo: null,
    ignoradas: [],
    titulos: [],
    avisos: [],
  };
  const resumo: ResumoArquivo = { ...RESUMO_VAZIO };
  const bloco = blocoDoNome(arquivo) ?? blocoDoNome(paginas[0] ?? "");
  if (!bloco)
    return {
      erro: `Não achei o bloco em "${arquivo}": o nome do arquivo precisa dizer o bloco (ex.: "Bloco 05").`,
    };
  paginas.forEach((texto, p) => {
    for (const bruta of texto.split(/\r?\n/)) {
      const linha = bruta.replace(/\s+/g, " ").trim();
      if (!linha) continue;
      const h = linha.match(RE_HIDRO);
      if (!h?.[1] || h.index === undefined) {
        if (ROTULO_TOTAL.test(normalizar(linha))) lerTotalPdf(linha, resumo);
        continue;
      }
      const antes = linha.slice(0, h.index).trim();
      const depois = linha.slice(h.index + h[1].length);
      const datas = depois.match(RE_DATA) ?? [];
      const tipoTexto = depois.match(RE_TIPO)?.[1];
      const semDatas = depois.replace(RE_DATA, " ").replace(RE_TIPO, " ");
      const nums = (semDatas.match(RE_NUMERO) ?? []).map(
        (n) => numeroBr(n) ?? Number.NaN,
      );
      // "0" no fim é o tipo "sem cobrança" quando não veio outro tipo.
      let tipo: TipoAgua | null = tipoTexto
        ? (tipoDe(tipoTexto) as TipoAgua)
        : null;
      if (!tipo && nums.length >= 6 && nums.at(-1) === 0) {
        tipo = "ZERO";
        nums.pop();
      }
      if (nums.length < 5 || nums.some((n) => Number.isNaN(n)) || !tipo) {
        lido.ignoradas.push({
          linha: p + 1,
          motivo: `linha do hidrômetro ${h[1]} ilegível no texto do PDF`,
        });
        continue;
      }
      const [leituraAnterior, leituraAtual] = nums as [number, number];
      const resto = nums.slice(2);
      const dias = resto.length >= 4 ? (resto.shift() ?? null) : null;
      const [consumo, volume, valor] = resto as [number, number, number];
      const [d1, d2] = [
        datas[0] ? dataBr(datas[0]) : null,
        datas[1] ? dataBr(datas[1]) : null,
      ];
      const dataAnterior = d1 === "invalida" ? null : d1;
      const dataAtual = d2 === "invalida" ? null : d2;
      const partes = antes.split(" ");
      const sala = partes.shift() ?? "";
      lido.linhas.push({
        linha: p + 1,
        bloco,
        sala,
        cliente: partes.join(" "),
        hidrometro: codigoHidrometro(h[1]),
        dataAnterior,
        leituraAnterior,
        dataAtual,
        leituraAtual,
        dias:
          dias ??
          (dataAnterior && dataAtual
            ? diasEntreDatas(dataAnterior, dataAtual)
            : null),
        consumo,
        volumeFaturado: volume,
        valorCentavos: paraCentavos(valor),
        tipo,
        conferir: true,
      });
    }
  });
  if (!lido.linhas.length)
    return {
      erro: `O texto de "${arquivo}" não tem as linhas no formato esperado. Envie a planilha Excel do mesmo mês.`,
    };
  lido.blocos = [bloco];
  lido.resumo = temResumo(resumo) ? resumo : null;
  for (const l of lido.linhas) {
    const aviso = conferirConsumo(l, opcoes.tolerancia);
    if (aviso)
      lido.avisos.push({
        nivel: "aviso",
        arquivo,
        bloco,
        linha: l.linha,
        mensagem: aviso,
      });
  }
  lido.avisos.push({
    nivel: "aviso",
    arquivo,
    bloco,
    mensagem: `${lido.linhas.length} linhas lidas do texto do PDF: confira cada uma na prévia antes de confirmar (a planilha é a fonte mais segura).`,
  });
  return { ok: lido };
}

function lerTotalPdf(linha: string, r: ResumoArquivo) {
  const nums = (linha.replace(RE_DATA, " ").match(RE_NUMERO) ?? [])
    .map((n) => numeroBr(n))
    .filter((n): n is number => n !== null && !Number.isNaN(n));
  // "TOTAL 43 4.312,91 2.665,74 101.474,50": quantidade, consumo, volume, valor.
  if (nums.length >= 4) {
    r.hidrometros = inteiro(nums[0] ?? null);
    nums.shift();
  }
  if (nums.length >= 3) {
    const [c, v, val] = nums.slice(-3) as [number, number, number];
    r.consumo = paraMil(c);
    r.volume = paraMil(v);
    r.valor = paraCentavos(val);
  }
}

// ---------------------------------------------------------------------------
// Conferência com o resumo do arquivo
// ---------------------------------------------------------------------------

export interface Conciliacao {
  arquivo: string;
  blocos: string[];
  linhas: number;
  consumo: number;
  volume: number;
  valor: number;
  resumo: ResumoArquivo | null;
  bate: boolean;
  /** O que não bateu, em texto (sem reais quando `comValores` é falso). */
  diferencas: string[];
}

/**
 * Linhas e somas do arquivo contra o resumo dele, com a tolerância de
 * Parâmetros (em m³ e em reais). Sem resumo, não dá para conferir: não bate.
 */
export function conciliar(
  a: Pick<ArquivoLido, "arquivo" | "blocos" | "linhas" | "resumo">,
  tolerancia: number,
): Conciliacao {
  const linhas = a.linhas.length;
  const consumo = a.linhas.reduce((s, l) => s + paraMil(l.consumo), 0);
  const volume = a.linhas.reduce((s, l) => s + paraMil(l.volumeFaturado), 0);
  const valor = a.linhas.reduce((s, l) => s + l.valorCentavos, 0);
  const r = a.resumo;
  const diferencas: string[] = [];
  if (!r) {
    diferencas.push("o arquivo não tem resumo (linha de total) para conferir");
  } else {
    const qtd = r.hidrometros ?? r.faturados;
    if (qtd === null)
      diferencas.push("o resumo não diz a quantidade de hidrômetros");
    else if (qtd !== linhas)
      diferencas.push(
        qtd > linhas
          ? `faltam ${qtd - linhas} linha(s): ${linhas} lidas, ${qtd} no resumo`
          : `sobram ${linhas - qtd} linha(s): ${linhas} lidas, ${qtd} no resumo`,
      );
    const tolMil = paraMil(tolerancia);
    const tolCent = paraCentavos(tolerancia);
    if (r.consumo !== null && Math.abs(r.consumo - consumo) > tolMil)
      diferencas.push(
        `consumo: ${formatarM3(consumo / 1000)} nas linhas, ${formatarM3(r.consumo / 1000)} no resumo`,
      );
    if (r.volume !== null && Math.abs(r.volume - volume) > tolMil)
      diferencas.push(
        `volume faturado: ${formatarM3(volume / 1000)} nas linhas, ${formatarM3(r.volume / 1000)} no resumo`,
      );
    if (r.valor !== null && Math.abs(r.valor - valor) > tolCent)
      diferencas.push("valor: a soma das linhas é diferente do resumo");
    if (r.consumo === null && r.volume === null && r.valor === null)
      diferencas.push("o resumo não traz os totais de consumo, volume e valor");
  }
  return {
    arquivo: a.arquivo,
    blocos: a.blocos,
    linhas,
    consumo,
    volume,
    valor,
    resumo: r,
    bate: diferencas.length === 0,
    diferencas,
  };
}

// ---------------------------------------------------------------------------
// Fotos dos visores
// ---------------------------------------------------------------------------

export const EXTENSOES_FOTO = ["jpg", "jpeg", "png", "webp"] as const;

/**
 * Nome da foto: MES_AA_NÚMERO.jpg (ex.: SET_26_A19L036553.jpg; também
 * aceita "SET-2026-…" e espaço). Só o número (A19L036553.jpg) vale para o
 * mês da importação. → mês e hidrômetro, ou null.
 */
export function lerNomeDaFoto(
  nome: string,
): { referencia: string | null; hidrometro: string } | null {
  const base = nome.split(/[\\/]/).pop() ?? nome;
  const m = base.match(/^(.+)\.(jpe?g|png|webp)$/i);
  if (!m?.[1]) return null;
  const corpo = m[1].trim();
  const comMes = corpo.match(
    /^([A-Za-zÇç]{3})[A-Za-zÇç]*[\s_.-]+(\d{2}|\d{4})[\s_.-]+(.+)$/,
  );
  if (comMes?.[1] && comMes[2] && comMes[3]) {
    const ref = referenciaDe(`${comMes[1]} ${comMes[2]}`);
    const h = codigoHidrometro(comMes[3]);
    if (ref && /^[A-Z0-9-]{3,40}$/.test(h))
      return { referencia: ref, hidrometro: h };
  }
  const h = codigoHidrometro(corpo);
  return /^[A-Z0-9-]{3,40}$/.test(h) && /\d/.test(h)
    ? { referencia: null, hidrometro: h }
    : null;
}

export interface FotosLigadas {
  /** hidrômetro → nome do arquivo. */
  ligadas: Map<string, string>;
  /** Foto de hidrômetro que não tem leitura no mês. */
  semLeitura: string[];
  recusadas: { nome: string; motivo: string }[];
}

/** Liga cada foto ao hidrômetro pelo nome do arquivo. */
export function ligarFotos(
  nomes: string[],
  referencia: string,
  hidrometros: Set<string>,
): FotosLigadas {
  const r: FotosLigadas = { ligadas: new Map(), semLeitura: [], recusadas: [] };
  for (const nome of nomes) {
    const lido = lerNomeDaFoto(nome);
    if (!lido) {
      r.recusadas.push({
        nome,
        motivo: "nome fora do padrão MÊS_AA_NÚMERO.jpg",
      });
      continue;
    }
    if (lido.referencia && lido.referencia !== referencia) {
      r.recusadas.push({
        nome,
        motivo: `é de ${rotuloMes(lido.referencia)}, a importação é de ${rotuloMes(referencia)}`,
      });
      continue;
    }
    if (!hidrometros.has(lido.hidrometro)) {
      r.semLeitura.push(nome);
      continue;
    }
    if (r.ligadas.has(lido.hidrometro)) {
      r.recusadas.push({
        nome,
        motivo: `outra foto do hidrômetro ${lido.hidrometro} já foi ligada`,
      });
      continue;
    }
    r.ligadas.set(lido.hidrometro, nome);
  }
  return r;
}
