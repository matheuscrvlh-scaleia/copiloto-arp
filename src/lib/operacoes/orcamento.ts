import { formatarMoeda, lerValorBr } from "@/lib/formato";
import {
  centavosDe,
  type Mes,
  mesValido,
  normalizar,
  numeroDoMes,
  periodoDe,
  rotuloMesLongo,
  somar,
  somarMeses,
  type ValorMes,
} from "./obras";

// Leitura da planilha de orçamento de obra (spec 4.9 e 4.11): o
// cronograma físico-financeiro com uma linha por etapa e uma coluna por mês.
// Sem banco e sem Next: recebe as células já lidas do .xlsx
// (orcamento-planilha.ts) e devolve o que entendeu, com os avisos.
//
// Como a planilha é lida (sem pedir que o usuário edite o arquivo):
//   * Cabeçalho: a linha com mais células de mês (data do Excel, "jul/26",
//     "07/2026", "01/07/2026", "julho/2026").
//   * Coluna de realizado: título com "realizado" ou "real." (ex.: "Real. até
//     06/26"), ou um período ("06/2025 A 06/2026") com "(REALIZADO)" logo
//     abaixo; o mês é o último que aparece no título. Uma faixa "REALIZADO"
//     acima (ou sozinha logo abaixo) de colunas de mês também marca essas
//     colunas como realizado. O
//     realizado entra no previsto da revisão (é parte do orçamento total) e,
//     na primeira importação da obra, também como realizado.
//   * Etapas: a coluna de texto à esquerda dos meses. "Subtotal" confere a
//     soma das etapas de cima; "Total" é o total escrito e encerra as etapas.
//     Se a coluna das etapas está vazia na linha, "Total" (e "Subtotal") é
//     procurado nas outras colunas, com o valor logo à direita do rótulo.
//   * Revisão (R00, R01…), data e título: no texto acima do cabeçalho; a
//     revisão também pode vir do nome do arquivo.
//   * Mês fora de ordem, repetido ou ilegível no cabeçalho: se só um mês cabe
//     entre os vizinhos (o "02/12/2026" entre dez/26 e fev/27 só pode ser
//     jan/27), a coluna é lida com esse mês e avisada; senão fica pendente,
//     com uma sugestão, até a pessoa escolher o mês certo na prévia.

export type Celula = string | number | boolean | Date | null;

export interface Aba {
  nome: string;
  /** Linhas × colunas, a partir de A1 (células vazias = null). */
  linhas: Celula[][];
}

export type NivelAviso = "erro" | "aviso" | "info";

/** Mesmo formato de operacoes.importacoes.avisos. */
export interface AvisoOrcamento {
  nivel: NivelAviso;
  mensagem: string;
  /** Linha da planilha (1 = primeira). */
  linha?: number;
}

export type ProblemaDoMes = "repetido" | "fora_de_ordem" | "ilegivel";

export const ROTULO_PROBLEMA: Record<ProblemaDoMes, string> = {
  repetido: "Mês repetido no cabeçalho",
  fora_de_ordem: "Mês fora de ordem no cabeçalho",
  ilegivel: "Cabeçalho sem mês reconhecível",
};

export interface ColunaDeMes {
  /** Letra da coluna ("H"). */
  coluna: string;
  /** Como está escrito no cabeçalho. */
  texto: string;
  /** Mês lido do cabeçalho (null: ilegível). */
  lido: Mes | null;
  /** Mês que vale: o escolhido na prévia, o lido ou a sugestão (pendente). */
  mes: Mes | null;
  realizado: boolean;
  problema: ProblemaDoMes | null;
  sugestao: Mes | null;
  /** Mês escolhido pela pessoa (na prévia). */
  escolhido: boolean;
  /**
   * Mês deduzido da sequência, sem perguntar: a coluna está entre dois meses
   * certos com exatamente um mês faltando entre eles (vira aviso).
   */
  deduzido: boolean;
  /** Vizinhos, para a pessoa entender o problema ("dez/26 → ? → fev/27"). */
  antes: Mes | null;
  depois: Mes | null;
}

export interface EtapaLida {
  ordem: number;
  /** Linha da planilha (1 = primeira). */
  linha: number;
  nome: string;
  observacao: string | null;
  /** Previsto por mês (inclui o que a planilha já traz como realizado). */
  previsto: ValorMes[];
  /** Só o que a planilha traz como realizado. */
  realizado: ValorMes[];
}

export interface OrcamentoLido {
  aba: string;
  titulo: string | null;
  /** Nome da obra tirado do título (ou de "Obra:"), se houver. */
  obra: string | null;
  /** "R00", "R01"… (da planilha ou do nome do arquivo). */
  revisao: string | null;
  /** Data da revisão, "aaaa-mm-dd". */
  data: string | null;
  colunas: ColunaDeMes[];
  etapas: EtapaLida[];
  /** Total escrito na planilha, em centavos (null: sem linha de total). */
  totalArquivo: number | null;
  /** Soma das etapas (todos os meses), em centavos. */
  totalEtapas: number;
  /** Parte que a planilha traz como realizado, em centavos. */
  totalRealizado: number;
  /** Mês do último realizado da planilha. */
  realizadoAte: Mes | null;
  /** totalArquivo − totalEtapas (null sem total escrito). */
  diferenca: number | null;
  periodo: { de: Mes; ate: Mes } | null;
  /** Colunas com problema que ainda precisam do mês escolhido. */
  pendentes: ColunaDeMes[];
  avisos: AvisoOrcamento[];
}

export type ResultadoOrcamento = { ok: OrcamentoLido } | { erro: string };

const LINHAS_PARA_CABECALHO = 60;
const MAX_ETAPAS = 300;
const MAX_COLUNAS_DE_MES = 240;

const reais = (centavos: number) => formatarMoeda(centavos / 100);

/** Índice (0 = A) → letra da coluna. */
export function letraDaColuna(indice: number): string {
  let n = indice + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function textoDe(c: Celula): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date)
    return Number.isNaN(c.getTime())
      ? ""
      : `${pad2(c.getUTCDate())}/${pad2(c.getUTCMonth() + 1)}/${c.getUTCFullYear()}`;
  return String(c).replace(/\s+/g, " ").trim();
}

function mesCom(ano: number, mes: number): Mes | null {
  if (ano < 100) ano += 2000;
  if (ano < 2000 || ano > 2100 || mes < 1 || mes > 12) return null;
  return `${ano}-${pad2(mes)}-01`;
}

/** Mês de uma célula de cabeçalho, ou null. Só a célula inteira (sem texto em volta). */
export function mesDaCelula(c: Celula): Mes | null {
  if (c instanceof Date)
    return Number.isNaN(c.getTime())
      ? null
      : mesCom(c.getUTCFullYear(), c.getUTCMonth() + 1);
  if (typeof c !== "string") return null;
  const t = normalizar(c);
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (m) return mesCom(Number(m[3]), Number(m[2]));
  m = /^(\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
  if (m) return mesCom(Number(m[2]), Number(m[1]));
  m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(t);
  if (m) return mesCom(Number(m[1]), Number(m[2]));
  m = /^([a-z]{3,9})\.?\s*(?:[/.-]|de\s)?\s*(\d{2}|\d{4})$/.exec(t);
  if (m?.[1]) {
    const n = numeroDoMes(m[1]);
    return n ? mesCom(Number(m[2]), n) : null;
  }
  return null;
}

/** Meses escritos dentro de um texto ("Real. até 06/26", "de jul/2026 a dez/2027"). */
export function mesesNoTexto(texto: string): Mes[] {
  const t = normalizar(texto);
  const meses: Mes[] = [];
  const re =
    /(?:(\d{1,2})\/(\d{1,2})\/(\d{4}))|(?:\b(\d{1,2})\/(\d{2}|\d{4})\b)|(?:\b([a-z]{3,9})\.?\s*\/\s*(\d{2}|\d{4})\b)/g;
  for (const m of t.matchAll(re)) {
    let mes: Mes | null = null;
    if (m[3]) mes = mesCom(Number(m[3]), Number(m[2]));
    else if (m[5]) mes = mesCom(Number(m[5]), Number(m[4]));
    else if (m[6] && m[7]) {
      const n = numeroDoMes(m[6]);
      mes = n ? mesCom(Number(m[7]), n) : null;
    }
    if (mes) meses.push(mes);
  }
  return meses;
}

const ehRealizado = (texto: string) =>
  /\brealiza|\breal\b|\breal\./.test(normalizar(texto));
const ehTotal = (texto: string) =>
  /^(valor )?total\b/.test(normalizar(texto)) &&
  !/^sub/.test(normalizar(texto));
// "Sub-Total", "Subtotal", "Sub total" e o "Sub-Toal" (sic) da planilha real.
const ehSubtotal = (texto: string) => /^sub\s*-?\s*to/.test(normalizar(texto));
const ehObservacao = (texto: string) =>
  /^obs\b|^obs\.|^observa/.test(normalizar(texto));
const ehTituloDeColuna = (texto: string) =>
  /^(etapas?|descricao|item|itens|servicos?|discriminacao)$/.test(
    normalizar(texto),
  );

/** Número de uma célula de valor: número, texto "1.234,56", erro ou texto. */
function valorDa(
  c: Celula,
):
  | { tipo: "vazio" }
  | { tipo: "numero"; centavos: number }
  | { tipo: "erro"; texto: string }
  | { tipo: "texto"; texto: string } {
  if (c === null || c === undefined || c === "") return { tipo: "vazio" };
  if (typeof c === "number")
    return Number.isFinite(c)
      ? { tipo: "numero", centavos: centavosDe(c) }
      : { tipo: "vazio" };
  if (typeof c === "boolean" || c instanceof Date) return { tipo: "vazio" };
  const t = textoDe(c);
  if (!t || /^[-–—]+$/.test(t)) return { tipo: "vazio" };
  if (/^#[A-Z0-9/!?]+/i.test(t)) return { tipo: "erro", texto: t };
  const v = lerValorBr(t);
  if (v !== null && Number.isFinite(v))
    return { tipo: "numero", centavos: centavosDe(v) };
  return { tipo: "texto", texto: t };
}

const ehNumero = (c: Celula) => valorDa(c).tipo === "numero";

interface Cabecalho {
  aba: Aba;
  linha: number;
  meses: number[];
}

function acharCabecalho(abas: Aba[]): Cabecalho | null {
  let melhor: Cabecalho | null = null;
  for (const aba of abas) {
    const ate = Math.min(aba.linhas.length, LINHAS_PARA_CABECALHO);
    for (let r = 0; r < ate; r++) {
      const meses: number[] = [];
      (aba.linhas[r] ?? []).forEach((c, i) => {
        if (mesDaCelula(c)) meses.push(i);
      });
      if (meses.length >= 3 && meses.length > (melhor?.meses.length ?? 0))
        melhor = { aba, linha: r, meses };
    }
  }
  return melhor;
}

/** Revisão ("R00") num texto: "Revisão R01", "Rev. 01", "R00 de 14/07/2026". */
export function revisaoNoTexto(texto: string): string | null {
  const t = normalizar(texto);
  const m =
    /\brev(?:isao|\.)?\s*(?:n[ºo°.]?\s*)?:?\s*r?\s*-?\s*(\d{1,2})\b/.exec(t) ??
    /(?:^|[^a-z0-9])r\s?-?(\d{2})(?:[^0-9]|$)/.exec(t);
  return m?.[1] ? `R${pad2(Number(m[1]))}` : null;
}

function dataNoTexto(texto: string): string | null {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texto);
  if (!m) return null;
  return dataValida(Number(m[3]), Number(m[2]), Number(m[1]));
}

function dataValida(a: number, m: number, d: number): string | null {
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (
    a < 2000 ||
    a > 2100 ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  return `${a}-${pad2(m)}-${pad2(d)}`;
}

const dataDaCelula = (c: Celula): string | null =>
  c instanceof Date && !Number.isNaN(c.getTime())
    ? dataValida(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate())
    : typeof c === "string"
      ? dataNoTexto(c)
      : null;

/** "Estimativa … para execução do edifício garagem – Espaço ARP" → "Edifício garagem". */
export function obraDoTitulo(titulo: string): string | null {
  const m =
    /execu[cç][aã]o\s+d[aoe]s?\s+(.+?)(?:\s+[–—-]\s+.*)?$/i.exec(titulo) ??
    /\bobra:?\s+(.+?)(?:\s+[–—-]\s+.*)?$/i.exec(titulo);
  const nome = m?.[1]?.trim();
  if (!nome) return null;
  return (nome.charAt(0).toUpperCase() + nome.slice(1)).slice(0, 120);
}

interface Metadados {
  titulo: string | null;
  obra: string | null;
  revisao: string | null;
  data: string | null;
  periodo: { de: Mes; ate: Mes } | null;
}

function lerMetadados(linhas: Celula[][], ate: number): Metadados {
  let titulo: string | null = null;
  let obra: string | null = null;
  let revisao: string | null = null;
  let data: string | null = null;
  let periodo: Metadados["periodo"] = null;
  for (let r = 0; r < ate; r++) {
    const linha = linhas[r] ?? [];
    linha.forEach((c, i) => {
      const t = textoDe(c);
      if (!t) return;
      const n = normalizar(t);
      if (!obra && /^obra\s*:/.test(n)) {
        const resto = t.replace(/^obra\s*:\s*/i, "").trim();
        const vizinho = textoDe(linha[i + 1] ?? null);
        obra = (resto || vizinho).slice(0, 120) || null;
      }
      const rev = /rev|^r\s?\d{2}\b|\br\d{2}\b/.test(n)
        ? revisaoNoTexto(t)
        : null;
      if (rev && !revisao) {
        revisao = rev;
        data =
          dataNoTexto(t) ??
          linha
            .slice(i + 1)
            .map(dataDaCelula)
            .find((d) => d !== null) ??
          // A data logo abaixo da revisão ("R00" em F1, 14/07/2026 em F2).
          dataDaCelula(linhas[r + 1]?.[i] ?? null) ??
          data;
      }
      if (!data && /^data\b/.test(n))
        data =
          dataNoTexto(t) ??
          linha
            .slice(i + 1)
            .map(dataDaCelula)
            .find((d) => d !== null) ??
          null;
      if (!periodo && /\bde\b.+\ba\b/.test(n)) {
        const ms = mesesNoTexto(t);
        const de = ms[0];
        const fim = ms.at(-1);
        if (ms.length >= 2 && de && fim && de < fim) periodo = { de, ate: fim };
      }
      if (
        typeof c === "string" &&
        t.length >= 12 &&
        !rev &&
        (!titulo || t.length > titulo.length)
      )
        titulo = t.slice(0, 300);
    });
  }
  return {
    titulo,
    obra: obra ?? (titulo ? obraDoTitulo(titulo) : null),
    revisao,
    data,
    periodo,
  };
}

/** Linhas logo abaixo do cabeçalho sem nenhum número ("(REALIZADO)" sob o período). */
function linhasDeSubcabecalho(linhas: Celula[][], cab: number): number[] {
  const sub: number[] = [];
  for (let r = cab + 1; r <= cab + 2 && r < linhas.length; r++) {
    const l = linhas[r] ?? [];
    if (l.some(ehNumero)) break;
    sub.push(r);
  }
  return sub;
}

/**
 * Rótulo de faixa de uma coluna ("REALIZADO", "PREVISTO"): nas duas linhas
 * acima do cabeçalho (faixa mesclada) ou, sozinho na célula, numa linha de
 * subcabeçalho logo abaixo (o "(REALIZADO)" sob "06/2025 A 06/2026").
 */
function faixaDaColuna(
  linhas: Celula[][],
  cab: number,
  sub: number[],
  col: number,
): "realizado" | "previsto" | null {
  for (let r = cab - 1; r >= Math.max(0, cab - 2); r--) {
    const t = normalizar(textoDe(linhas[r]?.[col] ?? null));
    if (!t) continue;
    if (ehRealizado(t)) return "realizado";
    if (/previs/.test(t)) return "previsto";
  }
  for (const r of sub) {
    const t = normalizar(textoDe(linhas[r]?.[col] ?? null));
    if (/^\(?\s*realizados?\s*\)?$/.test(t)) return "realizado";
    if (/^\(?\s*previstos?\s*\)?$/.test(t)) return "previsto";
  }
  return null;
}

/**
 * Confere a sequência dos meses do cabeçalho: cada coluna deve ser o mês
 * seguinte ao da anterior. Repetido, fora de ordem ou ilegível vira problema,
 * com a sugestão do mês que caberia ali. Se a coluna está entre dois meses
 * certos e só um mês cabe entre eles (o "02/12/2026" entre dez/26 e fev/27),
 * a sugestão é usada sem perguntar e avisada; senão a coluna fica pendente
 * até a pessoa escolher. O que a pessoa escolheu sempre vale.
 */
function conferirSequencia(
  colunas: ColunaDeMes[],
  escolhas: Record<string, Mes>,
  avisos: AvisoOrcamento[],
) {
  const vistos = new Set<Mes>();
  let anterior: Mes | null = null;
  /** A coluna anterior não teve problema (ou teve o mês escolhido). */
  let anteriorCerto = false;
  colunas.forEach((c, i) => {
    const escolhido = escolhas[c.coluna];
    const esperado = anterior ? somarMeses(anterior, 1) : null;
    const proximo = colunas[i + 1]?.lido ?? null;
    let problema: ProblemaDoMes | null = null;
    let sugestao: Mes | null = null;
    if (c.lido === null) {
      problema = "ilegivel";
      sugestao = esperado;
    } else if (anterior && esperado && c.lido !== esperado) {
      if (c.lido <= anterior) {
        problema = vistos.has(c.lido) ? "repetido" : "fora_de_ordem";
        sugestao = esperado;
      } else if (proximo && proximo === somarMeses(esperado, 1)) {
        // Salto isolado: o vizinho da direita continua de onde devia.
        problema = "fora_de_ordem";
        sugestao = esperado;
      } else {
        avisos.push({
          nivel: "aviso",
          mensagem: `Faltam meses no cabeçalho entre ${rotuloMesLongo(anterior)} e ${rotuloMesLongo(c.lido)} (coluna ${c.coluna}).`,
        });
      }
    }
    if (sugestao && colunas.some((o) => o.lido === sugestao && o !== c))
      sugestao = null;
    c.problema = problema;
    c.sugestao = sugestao;
    c.antes = anterior;
    c.depois = proximo;
    if (problema && mesValido(escolhido)) {
      c.mes = escolhido;
      c.escolhido = true;
    } else {
      c.mes = problema ? sugestao : c.lido;
      c.deduzido =
        problema !== null &&
        sugestao !== null &&
        anteriorCerto &&
        proximo !== null &&
        proximo === somarMeses(sugestao, 1);
    }
    anteriorCerto = !problema || c.escolhido;
    const vale = c.mes ?? c.lido;
    if (vale) {
      vistos.add(vale);
      anterior = vale;
    }
  });
}

export interface OpcoesLeitura {
  /** Nome do arquivo (pode trazer a revisão: "…-R01.xlsx"). */
  arquivo?: string;
  /** Mês escolhido na prévia para cada coluna com problema: { "H": "2027-01-01" }. */
  meses?: Record<string, Mes>;
}

export function lerOrcamento(
  abas: Aba[],
  opcoes: OpcoesLeitura = {},
): ResultadoOrcamento {
  const cab = acharCabecalho(abas);
  if (!cab)
    return {
      erro: "Não encontrei a linha dos meses (cabeçalho com jul/26, ago/26…). Confira se é a planilha de orçamento da obra.",
    };
  const { aba, linha: rCab } = cab;
  const linhas = aba.linhas;
  const cabecalho = linhas[rCab] ?? [];
  const avisos: AvisoOrcamento[] = [];
  const sub = linhasDeSubcabecalho(linhas, rCab);
  const faixa = (col: number) => faixaDaColuna(linhas, rCab, sub, col);

  // Colunas: meses (e ilegíveis no meio deles), realizado, total, observação.
  const primeiroMes = cab.meses[0] ?? 0;
  const ultimoMes = cab.meses.at(-1) ?? 0;
  let colRealizado: number | null = null;
  let colTotal: number | null = null;
  let colObs: number | null = null;
  const indicesDeMes: number[] = [];
  for (let i = 0; i < cabecalho.length; i++) {
    const c = cabecalho[i] ?? null;
    const t = textoDe(c);
    if (mesDaCelula(c)) {
      indicesDeMes.push(i);
      continue;
    }
    if (
      colRealizado === null &&
      ((t && ehRealizado(t)) || (i < primeiroMes && faixa(i) === "realizado"))
    )
      colRealizado = i;
    else if (t && ehTotal(t) && (colTotal === null || i > ultimoMes))
      colTotal = i;
    else if (t && ehObservacao(t)) colObs = i;
    else if (i > primeiroMes && i < ultimoMes) {
      // Coluna sem mês no meio dos meses: só conta se tiver valores.
      const temValor = linhas
        .slice(rCab + 1)
        .some((l) => ehNumero(l?.[i] ?? null));
      if (temValor) indicesDeMes.push(i);
    }
  }
  indicesDeMes.sort((a, b) => a - b);
  if (indicesDeMes.length > MAX_COLUNAS_DE_MES)
    return { erro: "A planilha tem meses demais no cabeçalho." };

  const colunas: ColunaDeMes[] = indicesDeMes.map((i) => {
    const c = cabecalho[i] ?? null;
    return {
      coluna: letraDaColuna(i),
      texto: textoDe(c),
      lido: mesDaCelula(c),
      mes: null,
      realizado: faixa(i) === "realizado",
      problema: null,
      sugestao: null,
      escolhido: false,
      deduzido: false,
      antes: null,
      depois: null,
    };
  });
  conferirSequencia(colunas, opcoes.meses ?? {}, avisos);
  const repetidos = new Map<Mes, string[]>();
  for (const c of colunas)
    if (c.mes && (!c.problema || c.escolhido || c.deduzido))
      repetidos.set(c.mes, [...(repetidos.get(c.mes) ?? []), c.coluna]);
  for (const [mes, cols] of repetidos)
    if (cols.length > 1)
      return {
        erro: `O mês ${rotuloMesLongo(mes)} ficou em duas colunas (${cols.join(" e ")}). Escolha meses diferentes.`,
      };

  // Mês da coluna de realizado: o último escrito no título; senão o mês
  // anterior ao primeiro do cabeçalho.
  let mesRealizado: Mes | null = null;
  if (colRealizado !== null) {
    const t = textoDe(cabecalho[colRealizado] ?? null);
    mesRealizado =
      mesesNoTexto(t).at(-1) ??
      (colunas[0]?.mes ? somarMeses(colunas[0].mes, -1) : null);
  }

  // Coluna das etapas: a de mais texto à esquerda do primeiro valor.
  const primeiraDeValor = Math.min(
    indicesDeMes[0] ?? Number.POSITIVE_INFINITY,
    colRealizado ?? Number.POSITIVE_INFINITY,
  );
  let colNome: number | null = null;
  let maisTexto = 0;
  for (let i = 0; i < primeiraDeValor && i < 50; i++) {
    if (i === colObs) continue;
    let n = 0;
    for (let r = rCab + 1; r < linhas.length; r++) {
      const v = valorDa(linhas[r]?.[i] ?? null);
      if (v.tipo === "texto") n++;
    }
    if (n > maisTexto) {
      maisTexto = n;
      colNome = i;
    }
  }
  if (colNome === null)
    return {
      erro: "Não encontrei a coluna das etapas (texto à esquerda dos meses).",
    };

  const meta = lerMetadados(linhas, rCab);
  const daPlanilha = meta.revisao;
  const doArquivo = opcoes.arquivo ? revisaoNoTexto(opcoes.arquivo) : null;
  if (daPlanilha && doArquivo && daPlanilha !== doArquivo)
    avisos.push({
      nivel: "aviso",
      mensagem: `A planilha diz ${daPlanilha} e o nome do arquivo diz ${doArquivo}: vale o que está na planilha.`,
    });

  // Linhas: etapas, subtotais e o total.
  const etapas: EtapaLida[] = [];
  const nomes = new Map<string, number>();
  let totalArquivo: number | null = null;
  let somaDesdeSubtotal = 0;
  let fim = false;
  const valoresDaLinha = (l: Celula[]) => {
    let s = 0;
    for (const i of indicesDeMes) {
      const v = valorDa(l[i] ?? null);
      if (v.tipo === "numero") s += v.centavos;
    }
    if (colRealizado !== null) {
      const v = valorDa(l[colRealizado] ?? null);
      if (v.tipo === "numero") s += v.centavos;
    }
    return s;
  };
  const totalDaColuna = (l: Celula[]) => {
    if (colTotal === null) return null;
    const v = valorDa(l[colTotal] ?? null);
    return v.tipo === "numero" ? v.centavos : null;
  };

  /**
   * Rótulos "Total" e "Subtotal" fora da coluna das etapas (a planilha real
   * põe "Total" em G e o valor em H), com o número logo à direita.
   */
  const rotulosDaLinha = (l: Celula[]) =>
    l.flatMap((c, i) => {
      if (i === colNome || typeof c !== "string") return [];
      const tipo = ehSubtotal(c) ? "subtotal" : ehTotal(c) ? "total" : null;
      if (!tipo) return [];
      const j = l.findIndex((x, k) => k > i && valorDa(x).tipo !== "vazio");
      const v = j > i ? valorDa(l[j] ?? null) : null;
      return [
        {
          tipo,
          texto: textoDe(c),
          coluna: j > i ? j : null,
          centavos: v?.tipo === "numero" ? v.centavos : null,
        },
      ];
    });

  /** Linha sem nome de etapa com "Total" em outra coluna: o total escrito. */
  const lerTotalFora = (l: Celula[], nlinha: number) => {
    const totais = rotulosDaLinha(l).filter(
      (x): x is typeof x & { coluna: number; centavos: number } =>
        x.tipo === "total" && x.centavos !== null && x.coluna !== null,
    );
    const [primeiro, ...outros] = totais;
    if (!primeiro) return false;
    totalArquivo = primeiro.centavos;
    const onde = (col: number) => `${letraDaColuna(col)}${nlinha}`;
    for (const o of outros)
      if (o.centavos !== primeiro.centavos)
        avisos.push({
          nivel: "aviso",
          linha: nlinha,
          mensagem: `A linha do total tem dois valores diferentes: ${reais(primeiro.centavos)} (${onde(primeiro.coluna)}) e ${reais(o.centavos)} (${onde(o.coluna)}). Vale o primeiro.`,
        });
    // Número sem rótulo na mesma linha (ex.: a soma escrita na coluna das etapas).
    const usadas = new Set(totais.map((x) => x.coluna));
    l.forEach((c, i) => {
      const v = valorDa(c);
      if (
        usadas.has(i) ||
        v.tipo !== "numero" ||
        v.centavos === primeiro.centavos
      )
        return;
      avisos.push({
        nivel: "info",
        linha: nlinha,
        mensagem: `A linha do total também traz ${reais(v.centavos)} sem rótulo (${onde(i)}), ${reais(v.centavos - primeiro.centavos)} de diferença para o total ${reais(primeiro.centavos)} (${onde(primeiro.coluna)}). Vale o que está ao lado de “${primeiro.texto}”.`,
      });
    });
    return true;
  };

  for (let r = rCab + 1; r < linhas.length; r++) {
    const l = linhas[r] ?? [];
    const nlinha = r + 1;
    const nome = textoDe(l[colNome] ?? null);
    const temNumero = valoresDaLinha(l) !== 0 || (totalDaColuna(l) ?? 0) !== 0;
    if (!nome || valorDa(l[colNome] ?? null).tipo === "numero") {
      if (!fim && lerTotalFora(l, nlinha)) {
        fim = true;
        continue;
      }
      if (!temNumero) continue;
      const rotulo = l.map((c) => valorDa(c)).find((v) => v.tipo === "texto");
      const qual = rotulo?.tipo === "texto" ? ` (“${rotulo.texto}”)` : "";
      avisos.push({
        nivel: "info",
        linha: nlinha,
        mensagem: fim
          ? `A linha ${nlinha}${qual} vem depois do total e não entrou como etapa.`
          : rotulosDaLinha(l).some((x) => x.tipo === "subtotal")
            ? `A linha ${nlinha} tem subtotais por grupo de meses e não entrou como etapa.`
            : `A linha ${nlinha} tem valores sem nome (${reais(totalDaColuna(l) ?? valoresDaLinha(l))}) e não entrou como etapa.`,
      });
      continue;
    }
    if (ehTituloDeColuna(nome)) continue;
    if (ehSubtotal(nome)) {
      const escrito = totalDaColuna(l) ?? valoresDaLinha(l);
      if (escrito !== somaDesdeSubtotal)
        avisos.push({
          nivel: "info",
          linha: nlinha,
          mensagem: `Subtotal da linha ${nlinha} (${reais(escrito)}) difere da soma das etapas acima (${reais(somaDesdeSubtotal)}) em ${reais(escrito - somaDesdeSubtotal)}.`,
        });
      somaDesdeSubtotal = 0;
      continue;
    }
    if (ehTotal(nome)) {
      if (!fim) {
        totalArquivo = totalDaColuna(l) ?? valoresDaLinha(l);
        fim = true;
      }
      continue;
    }
    if (fim) {
      if (temNumero)
        avisos.push({
          nivel: "info",
          linha: nlinha,
          mensagem: `A linha ${nlinha} (“${nome}”) vem depois do total e não entrou como etapa.`,
        });
      continue;
    }

    // Etapa.
    if (etapas.length >= MAX_ETAPAS)
      return { erro: `A planilha passa de ${MAX_ETAPAS} etapas.` };
    const previsto = new Map<Mes, number>();
    const realizado = new Map<Mes, number>();
    const notas: string[] = [];
    const obs = colObs !== null ? textoDe(l[colObs] ?? null) : "";
    if (obs) notas.push(obs);
    const somarEm = (m: Map<Mes, number>, mes: Mes, c: number) =>
      m.set(mes, (m.get(mes) ?? 0) + c);
    const lerCelula = (
      i: number,
      mes: Mes | null,
      ehReal: boolean,
      onde: string,
    ) => {
      const v = valorDa(l[i] ?? null);
      const celula = `${letraDaColuna(i)}${nlinha}`;
      if (v.tipo === "erro") {
        avisos.push({
          nivel: "aviso",
          linha: nlinha,
          mensagem: `${nome}: a célula ${celula} tem erro (${v.texto}) e ficou sem valor.`,
        });
        return;
      }
      if (v.tipo === "texto") {
        if (!notas.includes(v.texto)) {
          notas.push(v.texto);
          avisos.push({
            nivel: "info",
            linha: nlinha,
            mensagem: `${nome}: “${v.texto}” em ${onde}, sem valor.`,
          });
        }
        return;
      }
      if (v.tipo !== "numero" || v.centavos === 0 || !mes) return;
      if (v.centavos < 0)
        avisos.push({
          nivel: "aviso",
          linha: nlinha,
          mensagem: `${nome}: valor negativo em ${onde} (${reais(v.centavos)}).`,
        });
      somarEm(previsto, mes, v.centavos);
      if (ehReal) somarEm(realizado, mes, v.centavos);
    };
    if (colRealizado !== null)
      lerCelula(
        colRealizado,
        mesRealizado,
        true,
        `realizado${mesRealizado ? ` até ${rotuloMesLongo(mesRealizado)}` : ""}`,
      );
    indicesDeMes.forEach((i, k) => {
      const col = colunas[k];
      if (!col) return;
      lerCelula(
        i,
        col.mes,
        col.realizado,
        col.mes ? rotuloMesLongo(col.mes) : `coluna ${col.coluna}`,
      );
    });

    // Nome repetido: o realizado é casado pelo nome, então ganha um número.
    const k = normalizar(nome);
    const vezes = (nomes.get(k) ?? 0) + 1;
    nomes.set(k, vezes);
    const nomeFinal = vezes > 1 ? `${nome} (${vezes})` : nome;
    if (vezes > 1)
      avisos.push({
        nivel: "aviso",
        linha: nlinha,
        mensagem: `A etapa “${nome}” aparece mais de uma vez: a da linha ${nlinha} entra como “${nomeFinal}”.`,
      });

    const lista = (m: Map<Mes, number>): ValorMes[] =>
      [...m]
        .filter(([, c]) => c !== 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, centavos]) => ({ mes, centavos }));
    const etapa: EtapaLida = {
      ordem: etapas.length + 1,
      linha: nlinha,
      nome: nomeFinal.slice(0, 200),
      observacao: notas.length ? notas.join(" · ").slice(0, 500) : null,
      previsto: lista(previsto),
      realizado: lista(realizado),
    };
    const soma = somar(etapa.previsto);
    const escrito = totalDaColuna(l);
    if (escrito !== null && escrito !== soma)
      avisos.push({
        nivel: "aviso",
        linha: nlinha,
        mensagem: `${nome}: o total da linha (${reais(escrito)}) difere da soma dos meses (${reais(soma)}) em ${reais(escrito - soma)}.`,
      });
    if (soma === 0)
      avisos.push({
        nivel: "aviso",
        linha: nlinha,
        mensagem: `${nome}: etapa sem valor${etapa.observacao ? ` (${etapa.observacao})` : ""}.`,
      });
    somaDesdeSubtotal += soma;
    etapas.push(etapa);
  }

  if (!etapas.length)
    return { erro: "Não encontrei nenhuma etapa abaixo da linha dos meses." };

  const todosPrevistos = etapas.flatMap((e) => e.previsto);
  const todosRealizados = etapas.flatMap((e) => e.realizado);
  const totalEtapas = somar(todosPrevistos);
  const totalRealizado = somar(todosRealizados);
  const diferenca = totalArquivo === null ? null : totalArquivo - totalEtapas;
  if (totalArquivo === null)
    avisos.push({
      nivel: "info",
      mensagem:
        "A planilha não tem linha de total: o orçamento total é a soma das etapas.",
    });
  else if (diferenca !== 0 && diferenca !== null)
    avisos.push({
      nivel: "aviso",
      mensagem: `A soma das etapas (${reais(totalEtapas)}) difere do total da planilha (${reais(totalArquivo)}) em ${reais(diferenca)}.`,
    });

  const revisao = daPlanilha ?? doArquivo;
  if (!revisao)
    avisos.push({
      nivel: "aviso",
      mensagem:
        "Não achei a revisão (R00, R01…) na planilha nem no nome do arquivo: ela será numerada em sequência.",
    });
  if (!meta.data)
    avisos.push({
      nivel: "info",
      mensagem: "A planilha não diz a data da revisão.",
    });

  // Previsto em mês anterior à data da revisão (seria realizado?).
  if (meta.data) {
    const mesDaRevisao = `${meta.data.slice(0, 7)}-01`;
    const antes = colunas.filter(
      (c) =>
        !c.realizado &&
        c.mes &&
        c.mes < mesDaRevisao &&
        etapas.some((e) =>
          e.previsto.some((v) => v.mes === c.mes && v.centavos !== 0),
        ),
    );
    if (antes.length)
      avisos.push({
        nivel: "aviso",
        mensagem: `Há previsto em ${antes.length === 1 ? "mês anterior" : `${antes.length} meses anteriores`} à data da revisão (${antes.map((c) => rotuloMesLongo(c.mes ?? "")).join(", ")}). Se for realizado, lance pela tela.`,
      });
  }

  // Mês fora do intervalo escrito na planilha ("Previsto de jul/2026 a dez/2027").
  if (meta.periodo) {
    const { de, ate } = meta.periodo;
    for (const e of etapas) {
      const fora = e.previsto.filter(
        (v) =>
          !e.realizado.some((r) => r.mes === v.mes) &&
          (v.mes < de || v.mes > ate),
      );
      if (fora.length)
        avisos.push({
          nivel: "aviso",
          linha: e.linha,
          mensagem: `${e.nome}: previsto fora do intervalo da planilha (${rotuloMesLongo(de)} a ${rotuloMesLongo(ate)}) em ${fora.map((v) => rotuloMesLongo(v.mes)).join(", ")}.`,
        });
    }
  }

  for (const c of colunas) {
    if (!c.problema) continue;
    const vizinhos = `${c.antes ? rotuloMesLongo(c.antes) : "início"} e ${c.depois ? rotuloMesLongo(c.depois) : "fim"}`;
    avisos.push({
      nivel: c.escolhido ? "info" : "aviso",
      mensagem: c.deduzido
        ? `Coluna ${c.coluna}: “${c.texto || "vazio"}” entre ${vizinhos} (${ROTULO_PROBLEMA[c.problema].toLowerCase()}) foi lida como ${rotuloMesLongo(c.mes ?? "")}, o único mês que cabe entre os dois. Confira na planilha.`
        : c.escolhido
          ? `Coluna ${c.coluna}: “${c.texto || "vazio"}” (${ROTULO_PROBLEMA[c.problema].toLowerCase()}, entre ${vizinhos}) foi lida como ${rotuloMesLongo(c.mes ?? "")}, escolhido na prévia.`
          : `Coluna ${c.coluna}: “${c.texto || "vazio"}” entre ${vizinhos} (${ROTULO_PROBLEMA[c.problema].toLowerCase()}). Escolha o mês certo.`,
    });
  }

  const realizadoAte =
    todosRealizados
      .map((v) => v.mes)
      .sort()
      .at(-1) ?? null;
  return {
    ok: {
      aba: aba.nome,
      titulo: meta.titulo,
      obra: meta.obra,
      revisao,
      data: meta.data,
      colunas,
      etapas,
      totalArquivo,
      totalEtapas,
      totalRealizado,
      realizadoAte,
      diferenca,
      periodo: periodoDe(todosPrevistos),
      pendentes: colunas.filter(
        (c) => c.problema && !c.escolhido && !c.deduzido,
      ),
      avisos,
    },
  };
}

// ---------------------------------------------------------------------------
// Estado da importação na tela (ações em server/operacoes/acoes/obras.ts)
// ---------------------------------------------------------------------------

/** Falta decidir algo antes de gravar a prévia (obra ou mês do cabeçalho). */
export interface EscolhaOrcamento {
  arquivo: string;
  /** Nome da obra lido da planilha. */
  obraLida: string | null;
  /** Não deu para saber a obra: escolher na lista ou dar o nome. */
  precisaObra: boolean;
  revisao: string | null;
  etapas: number;
  /** Colunas com mês repetido, fora de ordem ou ilegível. */
  colunas: ColunaDeMes[];
}

export interface EtapaDaPrevia {
  nome: string;
  observacao: string | null;
  de: Mes | null;
  ate: Mes | null;
  /** Centavos. */
  previsto: number;
  realizado: number;
}

export interface PreviaOrcamento {
  importacaoId: string;
  obraId: string;
  obraNome: string;
  obraNova: boolean;
  codigo: string;
  /** Revisão vigente hoje (continua guardada). */
  revisaoVigente: string | null;
  data: string | null;
  titulo: string | null;
  arquivo: string;
  etapas: EtapaDaPrevia[];
  totalArquivo: number | null;
  totalEtapas: number;
  diferenca: number | null;
  totalRealizado: number;
  realizadoAte: Mes | null;
  /** O realizado da planilha entrou (primeira importação da obra). */
  realizadoImportado: boolean;
  colunasEscolhidas: { coluna: string; texto: string; mes: Mes }[];
  avisos: AvisoOrcamento[];
}

export interface EstadoOrcamento {
  erro?: string;
  escolher?: EscolhaOrcamento;
  previa?: PreviaOrcamento;
  confirmado?: { obraId: string; obraNome: string; codigo: string };
  descartado?: boolean;
}
