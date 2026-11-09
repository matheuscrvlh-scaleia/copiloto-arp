import { z } from "zod";
import { formatarMes, lerValorBr } from "@/lib/formato";
import {
  BLOCO_04,
  calcularRateio,
  centavos,
  type ExtraRateio,
  type MinutosBloco,
  type RegraBl04,
  ROTULO_REGRA_BL04,
  reais,
  regraBl04Do,
  valorDoExtra,
  valoresPorLocal,
} from "./limpeza";
import {
  avaliar,
  endereco,
  lerFormula,
  type NoFormula,
  type Ref,
  refsDe,
} from "./limpeza-formula";

// Importação do histórico do rateio (spec 4.8 e 4.11): a planilha "RATEIO BS
// E MANUTENÇÃO", uma aba por mês ("BS dd.mm.aa", "BS dd.mm.aaaa", às vezes
// com " REV"), lida por células fixas, iguais em todas as abas:
//
//   E2 texto do apontamento        E3 funcionários da base
//   F3 valor por funcionário       G3 valor base
//   E4..E11 rótulos (área comum, BL1, BL2, BL4, BL5, BL09, BL10, BL11)
//   F4 área comum                  F5..F11 valor de cada bloco
//   H5..H11 minutos de limpeza     I5..I11 minutos de manutenção
//   F12 total do mês               A13:B40 extras em texto livre
//
// Lê os valores já calculados (o resultado das fórmulas), refaz a conta com
// a regra do Bloco 04 da época e compara com a aba. Os rateados saem da soma
// dos blocos ÷ valor por funcionário.
//
// A área comum é a fórmula de F4 ("5*F3+B23+B28+B31+B37"; na regra antiga
// "5*F3+F7+B23"; de mai/2022 a jan/2024 com os extras como números dentro
// dela, "5*F3+F7+278.68+3897*2"): k*F3 dá os funcionários da área comum, F7
// é o Bloco 04, cada Bnn é um extra (ou um subtotal, aberto nas parcelas) e
// cada número solto é um extra lançado na fórmula. O que está em A13:B40 e
// a fórmula não usa (reajuste da base, vigia do caixa) fica fora da soma. O
// resultado guardado de F4 confere a leitura. Sem fórmula em F4 (arquivo
// salvo só com valores), os extras são todos os pares A13:B40: "dias
// cobrados" junta-se ao valor da linha de cima e a soma é conferida com o
// que a área comum da aba implica.

export const LINHA_PRIMEIRO_BLOCO = 5;
export const LINHA_ULTIMO_BLOCO = 11;
export const LINHAS_EXTRAS = { de: 13, ate: 40 } as const;

export type ValorCelula = number | string | boolean | { erro: string } | null;

export interface AbaDoRateio {
  nome: string;
  /** Valor calculado da célula ("F4"); fórmula vira o resultado. */
  celula: (endereco: string) => ValorCelula;
  /** Fórmula da célula, sem o "=" (null se é valor). Ausente: só valores. */
  formula?: (endereco: string) => string | null;
}

export type NivelAviso = "erro" | "aviso" | "info";

export interface AvisoImportacao {
  nivel: NivelAviso;
  /** Aba de onde veio (vazio: o arquivo todo). */
  aba?: string;
  mensagem: string;
}

/** Valores da aba (em reais, como estavam), para conferir e guardar. */
export interface ValoresPlanilha {
  aba: string;
  apontamento: string | null;
  regra_bl04: RegraBl04;
  func_base: number | null;
  valor_funcionario: number | null;
  valor_base: number | null;
  area_comum: number | null;
  total: number | null;
  /** Valor de cada bloco ("01": 1511.42). */
  blocos: Record<string, number | null>;
  extras_lidos: { descricao: string; valor: number }[];
  fora_da_soma: { descricao: string; valor: number }[];
  erros: string[];
}

export interface DiferencaLocal {
  local: string;
  planilha: number | null;
  conta: number | null;
}

export interface MesLido {
  aba: string;
  referencia: string;
  regraBl04: RegraBl04;
  apontamento: string | null;
  /** Centavos. */
  valorBase: number | null;
  funcBase: number | null;
  funcAreaComum: number | null;
  funcRateados: number | null;
  extras: ExtraRateio[];
  minutos: MinutosBloco[];
  incompleto: boolean;
  motivoIncompleto: string | null;
  planilha: ValoresPlanilha;
  /** Total da aba e da conta refeita (centavos). */
  totalPlanilha: number | null;
  totalConta: number | null;
  /** Diferenças acima de 1 centavo entre a aba e a conta refeita. */
  diferencas: DiferencaLocal[];
  avisos: AvisoImportacao[];
}

export interface LeituraHistorico {
  meses: MesLido[];
  /** Abas que não são de mês (ou repetidas) e o motivo. */
  ignoradas: { aba: string; motivo: string }[];
  avisos: AvisoImportacao[];
}

export interface OpcoesLeitura {
  /** Blocos na ordem dos parâmetros (se o rótulo da aba não disser o número). */
  blocos: string[];
  /** Quando a aba não deixa deduzir (blocos em erro): parâmetros atuais. */
  funcAreaComum: number;
  funcRateados: number;
}

// ---------------------------------------------------------------------------
// Nome da aba → mês
// ---------------------------------------------------------------------------

const NOME_ABA =
  /^\s*BS\s+(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(\s+REV(?:\s*\d*)?)?(\s*\([^()]*\))?\s*$/i;

export interface AbaDeMes {
  referencia: string;
  /** Dia do nome (para escolher entre abas do mesmo mês). */
  dia: number;
  /** "REV" ou anotação entre parênteses ("(reaj)", "(alter)") no nome. */
  revisada: boolean;
}

/**
 * "BS 25.09.26" → set/2026; "BS 20.12.25 REV" → dez/2025 revisada;
 * "BS 20.02.2024 (reaj)" → fev/2024: mesmo layout, nome anotado (vale como
 * revisada se houver outra aba do mesmo mês).
 */
export function mesDaAba(nome: string): AbaDeMes | null {
  const m = NOME_ABA.exec(nome);
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano =
    (m[3] as string).length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 2000) return null;
  return {
    referencia: `${ano}-${String(mes).padStart(2, "0")}-01`,
    dia,
    revisada: Boolean(m[4] || m[5]),
  };
}

// ---------------------------------------------------------------------------
// Células
// ---------------------------------------------------------------------------

const ehErro = (v: ValorCelula): v is { erro: string } =>
  typeof v === "object" && v !== null && "erro" in v;

/** Número da célula (aceita "1.234,56" em texto); erro e vazio → null. */
function numero(v: ValorCelula): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = lerValorBr(v.trim());
    return n === null || Number.isNaN(n) ? null : n;
  }
  return null;
}

function texto(v: ValorCelula): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  return null;
}

/** "BL09", "BL 1", "Bloco 05" → "09", "01", "05". */
function blocoDoRotulo(rotulo: string | null): string | null {
  const m = rotulo ? /(\d{1,2})/.exec(rotulo) : null;
  return m ? (m[1] as string).padStart(2, "0") : null;
}

const arred2 = (n: number | null) =>
  n === null ? null : Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Extras (A13:B40)
// ---------------------------------------------------------------------------

const QUANTIDADE = /\b(dias?|qtd\.?|qtde\.?|quantidade|vezes)\b/i;
const SOMA = /^\s*(sub\s*)?(total|soma)\b/i;

interface ExtrasLidos {
  extras: ExtraRateio[];
  lidos: { descricao: string; valor: number }[];
  fora: { descricao: string; valor: number }[];
  avisos: AvisoImportacao[];
}

/**
 * Pares descrição e valor das linhas 13 a 40. "dias cobrados 8" logo depois
 * de "Vigia diária 315,00" vira 8 × 315,00. Linhas de total saem da soma. Se
 * a soma não bate com o que a área comum da aba implica (`implicito`), e
 * tirar uma única linha faz bater, essa linha fica de fora (anotação escrita
 * na aba, fora da conta, como o vigia do caixa do estacionamento).
 */
export function lerExtras(
  aba: AbaDoRateio,
  implicito: number | null,
): ExtrasLidos {
  const avisos: AvisoImportacao[] = [];
  const lidos: { descricao: string; valor: number }[] = [];
  const fora: { descricao: string; valor: number }[] = [];
  let extras: ExtraRateio[] = [];

  for (let l = LINHAS_EXTRAS.de; l <= LINHAS_EXTRAS.ate; l++) {
    const a = aba.celula(`A${l}`);
    const b = aba.celula(`B${l}`);
    const descricao = texto(a)?.replace(/\s+/g, " ") ?? null;
    if (ehErro(b)) {
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        mensagem: `Extra da linha ${l} (${descricao ?? "sem descrição"}) com erro ${b.erro}: ficou de fora.`,
      });
      continue;
    }
    const valor = numero(b);
    if (valor === null) continue;
    const nome = descricao ?? `Extra da linha ${l}`;
    lidos.push({ descricao: nome, valor: arred2(valor) as number });

    const anterior = extras.at(-1);
    if (
      descricao &&
      QUANTIDADE.test(descricao) &&
      Number.isInteger(valor) &&
      valor > 0 &&
      valor <= 31 &&
      anterior &&
      anterior.quantidade === null
    ) {
      anterior.quantidade = valor;
      anterior.valorUnitario = anterior.valor;
      anterior.valor = valorDoExtra(valor, anterior.valor, anterior.valor);
      continue;
    }
    if (descricao && SOMA.test(descricao)) {
      fora.push({ descricao: nome, valor: arred2(valor) as number });
      continue;
    }
    extras.push({
      descricao: nome.slice(0, 200),
      quantidade: null,
      valorUnitario: null,
      valor: centavos(valor),
    });
  }

  const soma = (xs: ExtraRateio[]) => xs.reduce((s, x) => s + x.valor, 0);
  if (implicito !== null && soma(extras) !== implicito) {
    // Uma linha fora da conta? Procura de baixo para cima.
    const i = extras.findLastIndex((x) => soma(extras) - x.valor === implicito);
    if (i >= 0) {
      const x = extras[i] as ExtraRateio;
      fora.push({ descricao: x.descricao, valor: x.valor / 100 });
      extras = extras.filter((_, k) => k !== i);
      avisos.push({
        nivel: "info",
        aba: aba.nome,
        mensagem: `"${x.descricao}" (${reais(x.valor)}) está escrito na aba mas fora da soma da área comum: não entrou nos extras.`,
      });
    } else {
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        mensagem: `Os extras lidos somam ${reais(soma(extras))}, mas a área comum da aba implica ${reais(implicito)} de extras. Confira as linhas 13 a 40.`,
      });
    }
  }
  if (fora.some((f) => SOMA.test(f.descricao)))
    avisos.push({
      nivel: "info",
      aba: aba.nome,
      mensagem: "Linhas de total entre os extras ficaram fora da soma.",
    });
  return { extras, lidos, fora, avisos };
}

// ---------------------------------------------------------------------------
// Área comum pela fórmula de F4
// ---------------------------------------------------------------------------

/** Número solto na fórmula de F4, sem descrição na aba. */
export const ROTULO_NA_FORMULA = "Lançado na fórmula da área comum (F4)";
/** Rótulo que só diz "valor": a descrição vem do título do grupo. */
const GENERICO = /^\s*(valor|pre[cç]o)\b/i;
/** Quantidade de um extra: dias no mês, auxiliares. */
const MAX_QUANTIDADE = 31;
/** Subtotal dentro de subtotal: limite contra referência circular. */
const MAX_PROFUNDIDADE = 8;

const ehLinhaDeExtra = (r: Ref) =>
  r.coluna === "B" &&
  r.linha >= LINHAS_EXTRAS.de &&
  r.linha <= LINHAS_EXTRAS.ate;
const emCentavos = (v: number) =>
  Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;

export interface AreaComumDaFormula {
  /** k de "k*F3". */
  funcAreaComum: number;
  /** A fórmula soma o valor do Bloco 04 (regra antiga). */
  comBl04: boolean;
  extras: ExtraRateio[];
  /** Linhas de A13:B40 que a fórmula usa (direto ou por subtotal). */
  linhasUsadas: Set<number>;
}

/**
 * Lê a fórmula de F4. Devolve o motivo (texto) se ela foge do padrão
 * "k*F3 + [F do Bloco 04] + Bnn… + números": aí a importação segue pelos
 * valores de A13:B40.
 */
export function lerAreaComumDaFormula(
  aba: AbaDoRateio,
  formula: string,
  linhaBl04: number | null,
): AreaComumDaFormula | string {
  const raiz = lerFormula(formula);
  if (!raiz) return "usa função ou referência que a importação não lê";

  const linhasUsadas = new Set<number>();
  const rotulo = (l: number) =>
    texto(aba.celula(`A${l}`))?.replace(/\s+/g, " ") ?? null;
  /** Título do grupo: descrição sem valor logo acima ("Inclusão …"). */
  const titulo = (l: number) => {
    for (let k = l - 1; k >= LINHAS_EXTRAS.de; k--) {
      if (numero(aba.celula(`B${k}`)) !== null) return null;
      const r = rotulo(k);
      if (r) return r;
    }
    return null;
  };
  const descricao = (l: number) =>
    rotulo(l) ?? titulo(l) ?? `Extra da linha ${l}`;
  const descricaoDoUnitario = (l: number) => {
    const r = rotulo(l);
    return r && !GENERICO.test(r) ? r : (titulo(l) ?? descricao(l));
  };

  /** Valor da célula: o calculado; sem ele, a fórmula; vazia conta 0. */
  const valorDe = (r: Ref, prof = 0): number | null => {
    const v = aba.celula(endereco(r));
    if (ehErro(v)) return null;
    const n = numero(v);
    if (n !== null) return n;
    const f = aba.formula?.(endereco(r));
    if (f) {
      const no = prof < MAX_PROFUNDIDADE ? lerFormula(f) : null;
      return no ? avaliar(no, (x) => valorDe(x, prof + 1)) : null;
    }
    return v === null ? 0 : null;
  };

  const extra = (desc: string, valor: number, sinal: 1 | -1): ExtraRateio[] => {
    const c = sinal * centavos(valor);
    return c === 0
      ? []
      : [
          {
            descricao: desc.slice(0, 200),
            quantidade: null,
            valorUnitario: null,
            valor: c,
          },
        ];
  };

  /** Dois fatores: qual é a quantidade (dias, auxiliares) e qual o valor. */
  const quantidadeEUnitario = (
    lados: { v: number; linha: number | null }[],
  ) => {
    const ehQtd = (x: { v: number }) =>
      Number.isInteger(x.v) && x.v >= 0 && x.v <= MAX_QUANTIDADE;
    const pelaDescricao = lados.findIndex(
      (x) => x.linha !== null && QUANTIDADE.test(rotulo(x.linha) ?? ""),
    );
    const inteiros = lados.flatMap((x, i) => (ehQtd(x) ? [i] : []));
    const iq =
      pelaDescricao >= 0 && ehQtd(lados[pelaDescricao] as { v: number })
        ? pelaDescricao
        : inteiros.length === 2
          ? (lados[0] as { v: number }).v < (lados[1] as { v: number }).v
            ? 0
            : 1
          : (inteiros[0] ?? -1);
    const q = lados[iq];
    const u = lados[1 - iq];
    return q && u && emCentavos(u.v) ? { q, u } : null;
  };

  function doNo(
    no: NoFormula,
    sinal: 1 | -1,
    linha: number | null,
    prof: number,
  ): ExtraRateio[] | string {
    if (prof > MAX_PROFUNDIDADE) return "subtotais encadeados demais";
    const fora = refsDe(no).find((r) => !ehLinhaDeExtra(r));
    if (fora) return `soma ${endereco(fora)}, fora dos extras (B13 a B40)`;
    const desc = linha === null ? ROTULO_NA_FORMULA : descricao(linha);
    if (no.t === "ref") return daCelula(no.ref.linha, sinal, prof + 1);
    if (no.t === "soma") {
      const out: ExtraRateio[] = [];
      for (const p of no.parcelas) {
        const r = doNo(p.no, (sinal * p.sinal) as 1 | -1, linha, prof + 1);
        if (typeof r === "string") return r;
        out.push(...r);
      }
      return out;
    }
    const valor = avaliar(no, valorDe);
    if (valor === null) return "tem célula sem valor numérico";
    for (const r of refsDe(no)) linhasUsadas.add(r.linha);
    // Quantidade × valor por unidade ("3897*4", "B26*B27").
    if (
      no.t === "prod" &&
      no.fatores.length === 2 &&
      no.fatores.every((f) => f.op === "*")
    ) {
      const lados = no.fatores.map((f) => ({
        v: avaliar(f.no, valorDe),
        linha: f.no.t === "ref" ? f.no.ref.linha : null,
      }));
      const qu = lados.every((x) => x.v !== null)
        ? quantidadeEUnitario(lados as { v: number; linha: number | null }[])
        : null;
      if (qu) {
        const unitario = sinal * centavos(qu.u.v);
        const v = valorDoExtra(qu.q.v, unitario, 0);
        if (v === 0) return [];
        return [
          {
            descricao: (qu.u.linha === null
              ? desc
              : descricaoDoUnitario(qu.u.linha)
            ).slice(0, 200),
            quantidade: qu.q.v,
            valorUnitario: unitario,
            valor: v,
          },
        ];
      }
    }
    return extra(desc, valor, sinal);
  }

  function daCelula(
    l: number,
    sinal: 1 | -1,
    prof: number,
  ): ExtraRateio[] | string {
    linhasUsadas.add(l);
    const f = aba.formula?.(`B${l}`);
    const no = f ? lerFormula(f) : null;
    if (no) return doNo(no, sinal, l, prof);
    const v = valorDe({ coluna: "B", linha: l });
    return v === null
      ? `B${l} sem valor numérico`
      : extra(descricao(l), v, sinal);
  }

  let funcAreaComum: number | null = null;
  let comBl04 = false;
  const extras: ExtraRateio[] = [];
  const parcelas =
    raiz.t === "soma" ? raiz.parcelas : [{ sinal: 1 as const, no: raiz }];
  for (const { sinal, no } of parcelas) {
    const refs = refsDe(no);
    if (refs.some((r) => r.coluna === "F" && r.linha === 3)) {
      const k = fatorDoValorPorFuncionario(no);
      if (k === null || sinal < 0 || funcAreaComum !== null)
        return "o termo do valor por funcionário (F3) não é k*F3";
      funcAreaComum = k;
      continue;
    }
    if (
      no.t === "ref" &&
      no.ref.coluna === "F" &&
      no.ref.linha >= LINHA_PRIMEIRO_BLOCO &&
      no.ref.linha <= LINHA_ULTIMO_BLOCO
    ) {
      if (no.ref.linha !== linhaBl04 || sinal < 0 || comBl04)
        return `soma ${endereco(no.ref)}, que não é o Bloco 04`;
      comBl04 = true;
      continue;
    }
    const r = doNo(no, sinal, null, 0);
    if (typeof r === "string") return r;
    extras.push(...r);
  }
  if (funcAreaComum === null)
    return "não tem funcionários × valor por funcionário (k*F3)";
  return { funcAreaComum, comBl04, extras, linhasUsadas };
}

/** k de "k*F3" ou "F3*k" (k inteiro ≥ 0); null se for outra conta. */
function fatorDoValorPorFuncionario(no: NoFormula): number | null {
  const fatores = no.t === "prod" ? no.fatores : [{ op: "*" as const, no }];
  let k = 1;
  let f3 = 0;
  for (const f of fatores) {
    if (f.op !== "*") return null;
    if (f.no.t === "ref" && f.no.ref.coluna === "F" && f.no.ref.linha === 3)
      f3++;
    else if (f.no.t === "num") k *= f.no.v;
    else return null;
  }
  return f3 === 1 && Number.isInteger(k) && k >= 0 ? k : null;
}

/** Pares de A13:B40 com valor numérico (para guardar e mostrar). */
function paresLidos(aba: AbaDoRateio) {
  const pares: { linha: number; descricao: string; valor: number }[] = [];
  let titulo: string | null = null;
  for (let l = LINHAS_EXTRAS.de; l <= LINHAS_EXTRAS.ate; l++) {
    const a = texto(aba.celula(`A${l}`))?.replace(/\s+/g, " ") ?? null;
    const b = aba.celula(`B${l}`);
    const valor = ehErro(b) ? null : numero(b);
    if (valor === null) {
      if (a) titulo = a;
      continue;
    }
    pares.push({
      linha: l,
      descricao: a ?? titulo ?? `Extra da linha ${l}`,
      valor: arred2(valor) as number,
    });
    titulo = null;
  }
  return pares;
}

/** Extras da fórmula de F4; o resto de A13:B40 fica fora da soma. */
function extrasDaFormula(
  aba: AbaDoRateio,
  f: AreaComumDaFormula,
  regra: RegraBl04,
  avisos: AvisoImportacao[],
): Omit<ExtrasLidos, "avisos"> {
  if (f.comBl04 !== (regra === "area_comum"))
    avisos.push({
      nivel: "aviso",
      aba: aba.nome,
      mensagem: `A fórmula da área comum (F4) ${f.comBl04 ? "soma" : "não soma"} o Bloco 04, diferente da regra da data (${ROTULO_REGRA_BL04[regra]}). A conta usou a regra da data.`,
    });
  const pares = paresLidos(aba);
  const fora = pares
    .filter((p) => !f.linhasUsadas.has(p.linha))
    .map(({ descricao, valor }) => ({ descricao, valor }));
  if (fora.length)
    avisos.push({
      nivel: "info",
      aba: aba.nome,
      mensagem: `${fora.map((x) => `"${x.descricao}" (${reais(centavos(x.valor))})`).join(", ")}: na aba, mas fora da soma da área comum (fórmula de F4). Não entra nos extras.`,
    });
  if (f.extras.some((x) => x.descricao === ROTULO_NA_FORMULA))
    avisos.push({
      nivel: "info",
      aba: aba.nome,
      mensagem: `Extras lançados como número na fórmula da área comum (F4), sem descrição na aba: entram como "${ROTULO_NA_FORMULA}". Descreva-os na tela do rateio, se quiser.`,
    });
  return {
    extras: f.extras,
    lidos: pares.map(({ descricao, valor }) => ({ descricao, valor })),
    fora,
  };
}

// ---------------------------------------------------------------------------
// Uma aba
// ---------------------------------------------------------------------------

export function lerAbaDoRateio(
  aba: AbaDoRateio,
  referencia: string,
  opcoes: OpcoesLeitura,
): MesLido {
  const avisos: AvisoImportacao[] = [];
  const erros: string[] = [];
  const regra = regraBl04Do(referencia);
  const rotuloAc = texto(aba.celula("E4"));
  const rotuloDizBl04 = rotuloAc ? /BL\s*0?4\b/i.test(rotuloAc) : false;

  const celulaNum = (end: string) => {
    const v = aba.celula(end);
    if (ehErro(v)) {
      erros.push(`${end}: ${v.erro}`);
      return null;
    }
    return numero(v);
  };

  const apontamento = texto(aba.celula("E2"));
  const funcBaseLido = celulaNum("E3");
  const vfLido = celulaNum("F3");
  const baseLida = celulaNum("G3");
  const acLido = celulaNum("F4");
  const totalLido = celulaNum("F12");

  const linhas = [];
  for (let l = LINHA_PRIMEIRO_BLOCO; l <= LINHA_ULTIMO_BLOCO; l++) {
    const i = l - LINHA_PRIMEIRO_BLOCO;
    const bloco =
      blocoDoRotulo(texto(aba.celula(`E${l}`))) ?? opcoes.blocos[i] ?? null;
    if (!bloco) continue;
    linhas.push({
      bloco,
      linha: l,
      valor: celulaNum(`F${l}`),
      limpeza: Math.max(0, Math.round(celulaNum(`H${l}`) ?? 0)),
      manutencao: Math.max(0, Math.round(celulaNum(`I${l}`) ?? 0)),
    });
  }
  const minutos: MinutosBloco[] = linhas.map(
    ({ bloco, limpeza, manutencao }) => ({
      bloco,
      limpeza,
      manutencao,
    }),
  );
  const minutosTotal = minutos.reduce(
    (s, m) => s + m.limpeza + m.manutencao,
    0,
  );

  // Funcionários: base em E3; rateados = Σ blocos ÷ valor por funcionário.
  const funcBase =
    funcBaseLido !== null && Number.isInteger(funcBaseLido) && funcBaseLido > 0
      ? funcBaseLido
      : null;
  const somaBlocosLida = linhas.every((l) => l.valor !== null)
    ? linhas.reduce((s, l) => s + (l.valor ?? 0), 0)
    : null;
  let funcRateados: number | null = null;
  if (somaBlocosLida !== null && vfLido && minutosTotal > 0) {
    const r = somaBlocosLida / vfLido;
    if (Math.abs(r - Math.round(r)) < 0.01) funcRateados = Math.round(r);
  }
  if (funcRateados === null) {
    funcRateados = opcoes.funcRateados;
    if (funcBase !== null)
      avisos.push({
        nivel: "info",
        aba: aba.nome,
        mensagem: `Funcionários rateados não deduzidos da aba: usei ${funcRateados} (parâmetros).`,
      });
  }
  let funcAreaComum =
    funcBase === null
      ? null
      : funcBase - funcRateados >= 0
        ? funcBase - funcRateados
        : Math.min(opcoes.funcAreaComum, funcBase);

  const bl04 = linhas.find((l) => l.bloco === BLOCO_04);
  const bl04Lido = bl04?.valor ?? null;
  const formulaAc = aba.formula?.("F4") ?? null;
  const pelaFormula = formulaAc
    ? lerAreaComumDaFormula(aba, formulaAc, bl04?.linha ?? null)
    : null;
  let ex: Omit<ExtrasLidos, "avisos">;
  if (pelaFormula && typeof pelaFormula !== "string") {
    ex = extrasDaFormula(aba, pelaFormula, regra, avisos);
    if (
      funcBase !== null &&
      pelaFormula.funcAreaComum + funcRateados > funcBase
    )
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        mensagem: `A área comum (F4) usa ${pelaFormula.funcAreaComum} funcionários e os blocos ${funcRateados}, mais que os ${funcBase} da base (E3).`,
      });
    funcAreaComum = pelaFormula.funcAreaComum;
    // Conferência: a fórmula refeita com os extras lidos (ao centavo) tem de
    // dar o resultado guardado de F4; tolera meio centavo por parcela.
    if (acLido !== null && vfLido !== null) {
      const refeita =
        pelaFormula.funcAreaComum * vfLido +
        (pelaFormula.comBl04 ? (bl04Lido ?? 0) : 0) +
        ex.extras.reduce((s, x) => s + x.valor, 0) / 100;
      if (Math.abs(refeita - acLido) > 0.005 * (pelaFormula.extras.length + 1))
        avisos.push({
          nivel: "aviso",
          aba: aba.nome,
          mensagem: `A fórmula da área comum (F4) refeita com os extras lidos dá ${reais(centavos(refeita))}, mas a aba mostra ${reais(centavos(acLido))}. Confira os extras.`,
        });
    }
  } else {
    if (typeof pelaFormula === "string")
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        mensagem: `A fórmula da área comum (F4: =${formulaAc}) ${pelaFormula}: os extras saíram dos valores de A13:B40.`,
      });
    // Extras que a área comum da aba implica: área comum (sem o Bloco 04,
    // na regra antiga) − funcionários da área comum × valor por funcionário.
    const acSemBl04 =
      acLido === null
        ? null
        : regra === "area_comum"
          ? bl04Lido === null
            ? null
            : acLido - bl04Lido
          : acLido;
    const implicito =
      acSemBl04 !== null && vfLido !== null && funcAreaComum !== null
        ? centavos(acSemBl04 - funcAreaComum * vfLido)
        : null;
    const lidos = lerExtras(aba, implicito);
    avisos.push(...lidos.avisos);
    ex = lidos;
  }
  // Rótulo de E4 × regra da data. Se a fórmula de F4 segue a regra, o
  // rótulo é só um texto que ficou de outra época.
  if (rotuloAc && rotuloDizBl04 !== (regra === "area_comum")) {
    const formulaSegue =
      typeof pelaFormula === "object" &&
      pelaFormula !== null &&
      pelaFormula.comBl04 === (regra === "area_comum");
    avisos.push({
      nivel: formulaSegue ? "info" : "aviso",
      aba: aba.nome,
      mensagem: formulaSegue
        ? `O rótulo "${rotuloAc}" não segue a regra da data (${ROTULO_REGRA_BL04[regra]}), mas a fórmula da área comum (F4) segue: valeu a fórmula.`
        : `O rótulo "${rotuloAc}" não segue a regra da data (${ROTULO_REGRA_BL04[regra]}). A conta usou a regra da data.`,
    });
  }

  const valorBase = baseLida === null ? null : centavos(baseLida);
  const motivos: string[] = [];
  if (valorBase === null) motivos.push("valor base (G3) vazio");
  if (funcBase === null) motivos.push("funcionários da base (E3) vazio");
  if (minutosTotal === 0) motivos.push("minutos vazios");
  if (erros.length) motivos.push(`erro na aba (${erros.join(", ")})`);
  const incompleto = motivos.length > 0;

  const blocosPlanilha: Record<string, number | null> = {};
  for (const l of linhas) blocosPlanilha[l.bloco] = arred2(l.valor);
  const planilha: ValoresPlanilha = {
    aba: aba.nome,
    apontamento,
    regra_bl04: regra,
    func_base: funcBaseLido,
    valor_funcionario: arred2(vfLido),
    valor_base: arred2(baseLida),
    area_comum: arred2(acLido),
    total: arred2(totalLido),
    blocos: blocosPlanilha,
    extras_lidos: ex.lidos,
    fora_da_soma: ex.fora,
    erros,
  };

  const r = calcularRateio({
    valorBase,
    funcBase,
    funcAreaComum,
    funcRateados,
    extras: ex.extras,
    blocos: minutos.map((m) => m.bloco),
    minutos,
    contrato: [],
    regraBl04: regra,
  });
  const conta = valoresPorLocal(r, regra);
  const doPlanilha: Record<string, number | null> = {
    area_comum: acLido === null ? null : centavos(acLido),
    total: totalLido === null ? null : centavos(totalLido),
  };
  for (const l of linhas)
    doPlanilha[l.bloco] = l.valor === null ? null : centavos(l.valor);

  const diferencas: DiferencaLocal[] = [];
  if (!incompleto) {
    diferencas.push(...compararLocais(doPlanilha, conta));
    if (
      vfLido !== null &&
      Math.abs(centavos(vfLido) - (r.valorPorFuncionario ?? 0)) > 1
    )
      diferencas.push({
        local: "valor_funcionario",
        planilha: centavos(vfLido),
        conta: r.valorPorFuncionario,
      });
    for (const d of diferencas)
      avisos.push({
        nivel: "aviso",
        aba: aba.nome,
        mensagem: `${rotuloDoLocal(d.local)}: aba ${reais(d.planilha)}, conta refeita ${reais(d.conta)}.`,
      });
  } else {
    avisos.push({
      nivel: "aviso",
      aba: aba.nome,
      mensagem: `Entra como incompleto: ${motivos.join("; ")}. Lance o que falta na tela do rateio.`,
    });
  }

  return {
    aba: aba.nome,
    referencia,
    regraBl04: regra,
    apontamento,
    valorBase,
    funcBase,
    funcAreaComum,
    funcRateados,
    extras: ex.extras,
    minutos,
    incompleto,
    motivoIncompleto: incompleto ? motivos.join("; ") : null,
    planilha,
    totalPlanilha: doPlanilha.total ?? null,
    totalConta: r.total,
    diferencas,
    avisos,
  };
}

/**
 * Locais em que a aba e a conta refeita diferem: o total ao centavo; as
 * partes aceitam 1 centavo (a planilha arredonda cada célula; a conta fecha
 * as partes no total pelo maior resto).
 */
export function compararLocais(
  planilha: Record<string, number | null>,
  conta: Record<string, number | null>,
): DiferencaLocal[] {
  const diferencas: DiferencaLocal[] = [];
  for (const [local, p] of Object.entries(planilha)) {
    const c = conta[local] ?? null;
    if (p === null || c === null) continue;
    if (local === "total" ? p !== c : Math.abs(p - c) > 1)
      diferencas.push({ local, planilha: p, conta: c });
  }
  return diferencas;
}

const numeroOuNulo = z.number().nullable().catch(null);
const planilhaGuardada = z.object({
  area_comum: numeroOuNulo,
  total: numeroOuNulo,
  blocos: z.record(z.string(), numeroOuNulo).catch({}),
});

/**
 * Mês importado: onde a conta refeita (como está hoje no banco) difere dos
 * valores da aba guardados em valores_planilha. Vazio se não há o que
 * comparar (mês da tela ou incompleto).
 */
export function diferencasComPlanilha(
  valoresPlanilha: unknown,
  conta: Record<string, number | null>,
): DiferencaLocal[] {
  const p = planilhaGuardada.safeParse(valoresPlanilha);
  if (!p.success) return [];
  const c = (v: number | null) => (v === null ? null : centavos(v));
  const planilha: Record<string, number | null> = {
    area_comum: c(p.data.area_comum),
    total: c(p.data.total),
  };
  for (const [b, v] of Object.entries(p.data.blocos)) planilha[b] = c(v);
  return compararLocais(planilha, conta);
}

export function rotuloDoLocal(local: string): string {
  if (local === "area_comum") return "Área comum";
  if (local === "total") return "Total";
  if (local === "valor_funcionario") return "Valor por funcionário";
  return `Bloco ${local}`;
}

// ---------------------------------------------------------------------------
// O arquivo todo
// ---------------------------------------------------------------------------

const ABAS_CONHECIDAS: { nome: RegExp; motivo: string }[] = [
  {
    nome: /^\s*BS\s+Principal\s*$/i,
    motivo: "Estimativa inicial (sem mês de referência): não é importada.",
  },
  {
    nome: /^\s*BS\s+Evolutivo\s*$/i,
    motivo:
      "Resumo mês a mês, para conferência: não é importada (o layout das colunas não está descrito; fica para quando houver a planilha real).",
  },
  {
    nome: /^\s*Programa[cç][aã]o\s+BS\s*$/i,
    motivo:
      "Programação da equipe: a carga do cadastro de funcionários fica para quando houver a planilha real (o layout não está descrito).",
  },
];

/** Lê todas as abas de mês, escolhe uma por mês e confere cada uma. */
export function lerHistoricoDoRateio(
  abas: AbaDoRateio[],
  opcoes: OpcoesLeitura,
): LeituraHistorico {
  const ignoradas: { aba: string; motivo: string }[] = [];
  const porMes = new Map<string, { aba: AbaDoRateio; mes: AbaDeMes }>();
  for (const aba of abas) {
    const mes = mesDaAba(aba.nome);
    if (!mes) {
      ignoradas.push({
        aba: aba.nome,
        motivo:
          ABAS_CONHECIDAS.find((c) => c.nome.test(aba.nome))?.motivo ??
          'Nome fora do padrão "BS dd.mm.aa": não é aba de mês.',
      });
      continue;
    }
    const atual = porMes.get(mes.referencia);
    // Mesmo mês em duas abas: vale a revisada; senão a de dia maior.
    const melhor =
      !atual ||
      (mes.revisada && !atual.mes.revisada) ||
      (mes.revisada === atual.mes.revisada && mes.dia > atual.mes.dia);
    if (atual && melhor)
      ignoradas.push({
        aba: atual.aba.nome,
        motivo: `Mesmo mês da aba "${aba.nome}", que vale no lugar dela.`,
      });
    else if (atual)
      ignoradas.push({
        aba: aba.nome,
        motivo: `Mesmo mês da aba "${atual.aba.nome}", que vale no lugar dela.`,
      });
    if (melhor) porMes.set(mes.referencia, { aba, mes });
  }
  const meses = [...porMes.values()]
    .sort((a, b) => a.mes.referencia.localeCompare(b.mes.referencia))
    .map(({ aba, mes }) => lerAbaDoRateio(aba, mes.referencia, opcoes));
  const avisos: AvisoImportacao[] = [];
  if (!meses.length)
    avisos.push({
      nivel: "erro",
      mensagem:
        'Nenhuma aba de mês ("BS dd.mm.aa") no arquivo. Confira se é a planilha "RATEIO BS E MANUTENÇÃO".',
    });
  for (const i of ignoradas)
    avisos.push({ nivel: "info", aba: i.aba, mensagem: i.motivo });
  for (const m of meses) avisos.push(...m.avisos);
  return { meses, ignoradas, avisos };
}

/** Resumo da prévia (vai em importacoes.resumo). */
export function resumoDaLeitura(
  l: LeituraHistorico,
  meses: MesLido[] = l.meses,
  jaExistiam: string[] = [],
): ResumoLeitura {
  const primeiro = meses[0]?.referencia;
  const ultimo = meses.at(-1)?.referencia;
  return {
    abas: l.meses.length + l.ignoradas.length,
    meses: meses.length,
    incompletos: meses.filter((m) => m.incompleto).map((m) => m.referencia),
    total_diferente: meses
      .filter((m) => m.diferencas.some((d) => d.local === "total"))
      .map((m) => m.referencia),
    periodo:
      primeiro && ultimo
        ? `${formatarMes(primeiro)} a ${formatarMes(ultimo)}`
        : null,
    ignoradas: l.ignoradas.map((i) => i.aba),
    ja_existiam: jaExistiam,
    soma_total: meses.reduce((s, m) => s + (m.totalConta ?? 0), 0) / 100,
    lista: meses.map((m) => ({
      referencia: m.referencia,
      aba: m.aba,
      regra: m.regraBl04,
      total_planilha: m.totalPlanilha === null ? null : m.totalPlanilha / 100,
      total_conta: m.totalConta === null ? null : m.totalConta / 100,
      incompleto: m.incompleto,
      motivo: m.motivoIncompleto,
      diferencas: m.diferencas.length,
      extras: m.extras.length,
      fora_da_soma: m.planilha.fora_da_soma.length,
    })),
  };
}

const LIMITE_AVISOS = 500;

/**
 * A prévia que a tela mostra e a importação guarda: os meses que entram, os
 * que já existiam (ficam de fora) e os avisos. Bate quando nenhum total de
 * aba difere da conta refeita.
 */
export function paraPrevia(
  l: LeituraHistorico,
  entram: MesLido[],
  jaExistiam: string[],
  arquivo: string,
): Omit<PreviaHistorico, "id"> {
  const resumo = resumoDaLeitura(l, entram, jaExistiam);
  const fora = new Set(jaExistiam);
  const avisos: AvisoImportacao[] = [
    ...jaExistiam.map(
      (r): AvisoImportacao => ({
        nivel: "aviso",
        mensagem: `${formatarMes(r)} já está no rateio (lançado na tela ou importado antes): fica de fora.`,
      }),
    ),
    ...l.avisos.filter(
      (a) =>
        !a.aba ||
        !l.meses.some((m) => m.aba === a.aba && fora.has(m.referencia)),
    ),
  ].slice(0, LIMITE_AVISOS);
  return {
    arquivo,
    resumo,
    avisos,
    bate: resumo.total_diferente.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Excel → abas (exceljs; só no servidor ou nos testes)
// ---------------------------------------------------------------------------

/** Resultado de fórmula, texto rico e erro do exceljs → valor simples. */
export function valorDaCelula(v: unknown): ValorCelula {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean")
    return v;
  if (v instanceof Date) return null;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.error === "string") return { erro: o.error };
    if ("formula" in o || "sharedFormula" in o) return valorDaCelula(o.result);
    if (Array.isArray(o.richText))
      return (o.richText as { text?: string }[])
        .map((p) => p.text ?? "")
        .join("");
    if (typeof o.text === "string") return o.text;
  }
  return null;
}

/** Abas de um .xlsx, com leitura por endereço (valores calculados). */
export async function abasDoExcel(bytes: Uint8Array): Promise<AbaDoRateio[]> {
  const { default: ExcelJS } = await import("exceljs");
  const livro = new ExcelJS.Workbook();
  // atalho: exceljs tipa o load com o Buffer antigo do Node.
  await livro.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
  return livro.worksheets.map((ws) => ({
    nome: ws.name,
    celula: (endereco: string) => valorDaCelula(ws.getCell(endereco).value),
    // Fórmula compartilhada vem traduzida para a célula pelo exceljs.
    formula: (endereco: string) => {
      const f: unknown = ws.getCell(endereco).formula;
      return typeof f === "string" && f.trim() ? f.trim() : null;
    },
  }));
}

// ---------------------------------------------------------------------------
// O que vai do servidor para a prévia (validado com Zod ao confirmar)
// ---------------------------------------------------------------------------

export const avisoSchema = z.object({
  nivel: z.enum(["erro", "aviso", "info"]),
  aba: z.string().optional(),
  mensagem: z.string(),
});

export const resumoSchema = z.object({
  abas: z.number(),
  meses: z.number(),
  incompletos: z.array(z.string()),
  total_diferente: z.array(z.string()),
  periodo: z.string().nullable(),
  ignoradas: z.array(z.string()),
  ja_existiam: z.array(z.string()),
  soma_total: z.number(),
  lista: z.array(
    z.object({
      referencia: z.string(),
      aba: z.string(),
      regra: z.enum(["separado", "area_comum"]),
      total_planilha: z.number().nullable(),
      total_conta: z.number().nullable(),
      incompleto: z.boolean(),
      motivo: z.string().nullable(),
      diferencas: z.number(),
      extras: z.number(),
      fora_da_soma: z.number(),
    }),
  ),
});
export type ResumoLeitura = z.infer<typeof resumoSchema>;

export const previaSchema = z.object({
  id: z.string(),
  arquivo: z.string(),
  resumo: resumoSchema,
  avisos: z.array(avisoSchema),
  bate: z.boolean(),
});
export type PreviaHistorico = z.infer<typeof previaSchema>;
