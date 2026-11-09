import { formatarMoeda, formatarNumero } from "@/lib/formato";
import type { Status } from "@/lib/indicadores";

// Obras: previsto (orçamento) × realizado (spec 4.9). Regras puras, sem banco:
// meses de referência, curva S (acumulados), índice do desembolso
// (realizado ÷ previsto até o mês), situação do orçamento, previsto ×
// realizado por etapa e a comparação entre revisões.
//
// Dinheiro sempre em centavos inteiros. Arredondamento declarado: valor em
// reais vira centavos pelo mais próximo, com o meio centavo para longe do
// zero (0,005 → 1 centavo; −0,005 → −1 centavo).

/** Mês de referência: "aaaa-mm-01". */
export type Mes = string;

export interface ValorMes {
  mes: Mes;
  centavos: number;
}

/** Reais → centavos (mais próximo; meio centavo para longe do zero). */
export function centavosDe(reais: number): number {
  const c = Math.round(Math.abs(reais) * 100 + 1e-7);
  return reais < 0 ? -c : c;
}

/** Centavos → reais (para gravar em numeric(16, 2) e mostrar). */
export const reaisDe = (centavos: number) => centavos / 100;

export const mesValido = (m: unknown): m is Mes =>
  typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])-01$/.test(m);

/** "aaaa-mm-dd" ou "aaaa-mm" → "aaaa-mm-01". */
export const mesDoDia = (dia: string): Mes => `${dia.slice(0, 7)}-01`;

/** Soma n meses (n pode ser negativo). */
export function somarMeses(mes: Mes, n: number): Mes {
  const ano = Number(mes.slice(0, 4));
  const m = Number(mes.slice(5, 7));
  const total = ano * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** Meses de `de` até `ate`, inclusive (vazio se `de` > `ate`). */
export function mesesEntre(de: Mes, ate: Mes, limite = 600): Mes[] {
  const meses: Mes[] = [];
  for (let m = de; m <= ate && meses.length < limite; m = somarMeses(m, 1))
    meses.push(m);
  return meses;
}

const NOMES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2026-07-01" → "jul/26" (cabeçalho de tabela e eixo). */
export function rotuloMes(mes: Mes): string {
  return `${NOMES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
}

/** "2026-07-01" → "jul/2026" (texto corrido). */
export function rotuloMesLongo(mes: Mes): string {
  return `${NOMES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;
}

/** Índice do nome do mês ("jul", "julho", "jul." → 7), ou null. */
export function numeroDoMes(nome: string): number | null {
  const n = normalizar(nome).replace(/\.$/, "");
  if (n.length < 3) return null;
  const i = NOMES.findIndex((m) => n.startsWith(m));
  if (i < 0) return null;
  // "março" e "marco" começam com "mar"; nomes longos têm de bater inteiros.
  const longos = [
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
  if (n.length > 3 && !(longos[i] ?? "").startsWith(n)) return null;
  return i + 1;
}

/** Minúsculas, sem acento e com espaços simples (comparar nomes de etapa). */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Primeiro e último mês com valor (≠ 0), ou null. */
export function periodoDe(valores: ValorMes[]): { de: Mes; ate: Mes } | null {
  const meses = valores
    .filter((v) => v.centavos !== 0)
    .map((v) => v.mes)
    .sort();
  const de = meses[0];
  const ate = meses.at(-1);
  return de && ate ? { de, ate } : null;
}

export function somar(valores: ValorMes[], ate?: Mes): number {
  let s = 0;
  for (const v of valores) if (!ate || v.mes <= ate) s += v.centavos;
  return s;
}

/** Soma por mês (vários lançamentos do mesmo mês viram um). */
export function porMes(valores: ValorMes[]): Map<Mes, number> {
  const m = new Map<Mes, number>();
  for (const v of valores) m.set(v.mes, (m.get(v.mes) ?? 0) + v.centavos);
  return m;
}

// ---------------------------------------------------------------------------
// Curva S: previsto e realizado acumulados mês a mês
// ---------------------------------------------------------------------------

export interface PontoCurva {
  mes: Mes;
  previsto: number;
  realizado: number;
  previstoAcum: number;
  /** null depois do último mês que já pode ter realizado (o mês atual). */
  realizadoAcum: number | null;
}

/**
 * Pontos da curva, do primeiro ao último mês com previsto ou realizado. O
 * acumulado sempre conta desde o início, mesmo quando o período mostrado
 * (`de`/`ate`) corta o começo. O realizado para no mês `atual`.
 */
export function curvaS(
  previsto: ValorMes[],
  realizado: ValorMes[],
  opcoes: { atual: Mes; de?: Mes | null; ate?: Mes | null },
): PontoCurva[] {
  const todos = [...previsto, ...realizado].map((v) => v.mes).sort();
  const inicio = todos[0];
  const fim = todos.at(-1);
  if (!inicio || !fim) return [];
  const p = porMes(previsto);
  const r = porMes(realizado);
  let ap = 0;
  let ar = 0;
  const pontos: PontoCurva[] = [];
  for (const mes of mesesEntre(inicio, fim)) {
    const pm = p.get(mes) ?? 0;
    const rm = r.get(mes) ?? 0;
    ap += pm;
    ar += rm;
    if (opcoes.de && mes < opcoes.de) continue;
    if (opcoes.ate && mes > opcoes.ate) continue;
    pontos.push({
      mes,
      previsto: pm,
      realizado: rm,
      previstoAcum: ap,
      realizadoAcum: mes <= opcoes.atual ? ar : null,
    });
  }
  return pontos;
}

// ---------------------------------------------------------------------------
// Indicadores da obra
// ---------------------------------------------------------------------------

/** Limites de operacoes.parametros. */
export interface Limites {
  /** obras_limite_desvio: pontos abaixo do previsto que viram alerta (ex.: −10). */
  desvioPontos: number;
  /** obras_limite_orcamento_pct: quanto o realizado pode passar do orçado (ex.: 10%). */
  orcamentoPct: number;
}

export interface Situacao {
  status: Status;
  rotulo: string;
  /** Explicação curta, com os números e o limite usado. */
  detalhe: string;
}

export interface Indicadores {
  orcado: number;
  realizado: number;
  saldo: number;
  /** Realizado ÷ orçado, em %; null sem orçado. */
  pctExecutado: number | null;
  mesRef: Mes;
  previstoAteMes: number;
  realizadoAteMes: number;
  previstoNoMes: number;
  realizadoNoMes: number;
  /** Realizado − previsto no mês de referência. */
  desvioNoMes: number;
  /** Índice do desembolso: realizado acumulado ÷ previsto acumulado até o mês. */
  indice: number | null;
  /** (índice − 1) × 100, em pontos. */
  desvioPontos: number | null;
  ritmo: Situacao;
  orcamento: Situacao;
}

const fmtCent = (c: number) => formatarMoeda(c / 100);
const fmtNum = (n: number, casas = 1) => formatarNumero(n, casas);

/** Ritmo do desembolso: o realizado acompanha o previsto até o mês? */
export function situacaoDoRitmo(
  previstoAteMes: number,
  realizadoAteMes: number,
  mesRef: Mes,
  limites: Limites,
): Situacao {
  const ate = rotuloMes(mesRef);
  if (previstoAteMes <= 0) {
    return realizadoAteMes > 0
      ? {
          status: "atencao",
          rotulo: "Realizado sem previsto",
          detalhe: `Há ${fmtCent(realizadoAteMes)} realizados e nada previsto até ${ate}.`,
        }
      : {
          status: "sem_dado",
          rotulo: "Nada previsto ainda",
          detalhe: `O orçamento não prevê desembolso até ${ate}.`,
        };
  }
  const desvio = (realizadoAteMes / previstoAteMes - 1) * 100;
  const base = `Realizado ${fmtCent(realizadoAteMes)} de ${fmtCent(previstoAteMes)} previstos até ${ate} (${desvio > 0 ? "+" : ""}${fmtNum(desvio)} pontos`;
  if (desvio < limites.desvioPontos)
    return {
      status: "fora",
      rotulo: "Abaixo do previsto",
      detalhe: `${base}; limite ${fmtNum(limites.desvioPontos, 0)} pontos).`,
    };
  if (desvio > limites.orcamentoPct)
    return {
      status: "atencao",
      rotulo: "Acima do previsto",
      detalhe: `${base}; acima de +${fmtNum(limites.orcamentoPct, 0)} pontos).`,
    };
  return {
    status: "ok",
    rotulo: "No ritmo do previsto",
    detalhe: `${base}).`,
  };
}

/** Orçamento: o realizado passou do orçado? Tolerância em %. */
export function situacaoDoOrcamento(
  orcado: number,
  realizado: number,
  limites: Limites,
): Situacao {
  if (orcado <= 0)
    return realizado > 0
      ? {
          status: "fora",
          rotulo: "Realizado sem orçamento",
          detalhe: `${fmtCent(realizado)} realizados sem valor orçado.`,
        }
      : {
          status: "sem_dado",
          rotulo: "Sem orçamento",
          detalhe: "Nenhum valor orçado.",
        };
  const pct = (realizado / orcado) * 100;
  const teto = Math.round(orcado * (1 + limites.orcamentoPct / 100));
  const base = `${fmtNum(pct)}% do orçado`;
  if (realizado > teto)
    return {
      status: "fora",
      rotulo: "Estouro do orçamento",
      detalhe: `${base}: passou ${fmtCent(realizado - orcado)} do orçado (tolerância ${fmtNum(limites.orcamentoPct, 0)}%).`,
    };
  if (realizado > orcado)
    return {
      status: "atencao",
      rotulo: "Acima do orçado",
      detalhe: `${base}: ${fmtCent(realizado - orcado)} acima, dentro da tolerância de ${fmtNum(limites.orcamentoPct, 0)}%.`,
    };
  return { status: "ok", rotulo: "Dentro do orçado", detalhe: `${base}.` };
}

export function indicadoresDaObra(e: {
  orcado: number;
  previsto: ValorMes[];
  realizado: ValorMes[];
  mesRef: Mes;
  limites: Limites;
}): Indicadores {
  const realizado = somar(e.realizado);
  const previstoAteMes = somar(e.previsto, e.mesRef);
  const realizadoAteMes = somar(e.realizado, e.mesRef);
  const previstoNoMes = porMes(e.previsto).get(e.mesRef) ?? 0;
  const realizadoNoMes = porMes(e.realizado).get(e.mesRef) ?? 0;
  const indice = previstoAteMes > 0 ? realizadoAteMes / previstoAteMes : null;
  return {
    orcado: e.orcado,
    realizado,
    saldo: e.orcado - realizado,
    pctExecutado: e.orcado > 0 ? (realizado / e.orcado) * 100 : null,
    mesRef: e.mesRef,
    previstoAteMes,
    realizadoAteMes,
    previstoNoMes,
    realizadoNoMes,
    desvioNoMes: realizadoNoMes - previstoNoMes,
    indice,
    desvioPontos: indice === null ? null : (indice - 1) * 100,
    ritmo: situacaoDoRitmo(
      previstoAteMes,
      realizadoAteMes,
      e.mesRef,
      e.limites,
    ),
    orcamento: situacaoDoOrcamento(e.orcado, realizado, e.limites),
  };
}

// ---------------------------------------------------------------------------
// Por etapa
// ---------------------------------------------------------------------------

export interface EtapaPrevista {
  nome: string;
  ordem: number;
  observacao: string | null;
  previsto: ValorMes[];
}

export interface Lancado extends ValorMes {
  etapa: string;
}

export interface LinhaEtapa {
  nome: string;
  observacao: string | null;
  /** false: etapa só do realizado (não existe nesta revisão). */
  naRevisao: boolean;
  previsto: number;
  previstoAteMes: number;
  realizado: number;
  pctExecutado: number | null;
  saldo: number;
  orcamento: Situacao;
}

/**
 * Previsto × realizado por etapa. O realizado é casado pelo nome da etapa
 * (sem acento e caixa); o que não casa com nenhuma etapa da revisão vira
 * linha própria, marcada "fora desta revisão".
 */
export function linhasPorEtapa(
  etapas: EtapaPrevista[],
  realizado: Lancado[],
  mesRef: Mes,
  limites: Limites,
): LinhaEtapa[] {
  const real = new Map<string, number>();
  const nomeReal = new Map<string, string>();
  for (const r of realizado) {
    const k = normalizar(r.etapa);
    real.set(k, (real.get(k) ?? 0) + r.centavos);
    if (!nomeReal.has(k)) nomeReal.set(k, r.etapa);
  }
  const linha = (
    nome: string,
    observacao: string | null,
    naRevisao: boolean,
    previsto: number,
    previstoAteMes: number,
    realizadoEtapa: number,
  ): LinhaEtapa => ({
    nome,
    observacao,
    naRevisao,
    previsto,
    previstoAteMes,
    realizado: realizadoEtapa,
    pctExecutado: previsto > 0 ? (realizadoEtapa / previsto) * 100 : null,
    saldo: previsto - realizadoEtapa,
    orcamento: situacaoDoOrcamento(previsto, realizadoEtapa, limites),
  });
  const vistas = new Set<string>();
  const linhas = [...etapas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((e) => {
      const k = normalizar(e.nome);
      vistas.add(k);
      return linha(
        e.nome,
        e.observacao,
        true,
        somar(e.previsto),
        somar(e.previsto, mesRef),
        real.get(k) ?? 0,
      );
    });
  for (const [k, v] of real) {
    if (vistas.has(k) || v === 0) continue;
    linhas.push(linha(nomeReal.get(k) ?? k, null, false, 0, 0, v));
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Comparação entre revisões (ex.: R00 × R01)
// ---------------------------------------------------------------------------

export type Mudanca =
  | "nova"
  | "removida"
  | "valor"
  | "periodo"
  | "valor_e_periodo"
  | "igual";

export const ROTULO_MUDANCA: Record<Mudanca, string> = {
  nova: "Etapa nova",
  removida: "Saiu da revisão",
  valor: "Valor mudou",
  periodo: "Meses mudaram",
  valor_e_periodo: "Valor e meses mudaram",
  igual: "Sem mudança",
};

export interface LinhaComparacao {
  nome: string;
  antes: number | null;
  depois: number | null;
  /** depois − antes (etapa nova ou removida conta como 0 do outro lado). */
  diferenca: number;
  periodoAntes: { de: Mes; ate: Mes } | null;
  periodoDepois: { de: Mes; ate: Mes } | null;
  /** Meses em que o valor previsto mudou. */
  mesesAlterados: number;
  mudanca: Mudanca;
}

export function compararRevisoes(
  antes: EtapaPrevista[],
  depois: EtapaPrevista[],
): LinhaComparacao[] {
  const mapaAntes = new Map(antes.map((e) => [normalizar(e.nome), e]));
  const mapaDepois = new Map(depois.map((e) => [normalizar(e.nome), e]));
  const ordem = [
    ...[...depois].sort((a, b) => a.ordem - b.ordem),
    ...[...antes]
      .sort((a, b) => a.ordem - b.ordem)
      .filter((e) => !mapaDepois.has(normalizar(e.nome))),
  ];
  return ordem.map((e) => {
    const k = normalizar(e.nome);
    const a = mapaAntes.get(k);
    const d = mapaDepois.get(k);
    const va = a ? somar(a.previsto) : null;
    const vd = d ? somar(d.previsto) : null;
    const pa = a ? periodoDe(a.previsto) : null;
    const pd = d ? periodoDe(d.previsto) : null;
    const ma = porMes(a?.previsto ?? []);
    const md = porMes(d?.previsto ?? []);
    let mesesAlterados = 0;
    for (const m of new Set([...ma.keys(), ...md.keys()]))
      if ((ma.get(m) ?? 0) !== (md.get(m) ?? 0)) mesesAlterados++;
    const mudouValor = va !== vd;
    const mudouPeriodo = pa?.de !== pd?.de || pa?.ate !== pd?.ate;
    const mudanca: Mudanca = !a
      ? "nova"
      : !d
        ? "removida"
        : mudouValor && mudouPeriodo
          ? "valor_e_periodo"
          : mudouValor
            ? "valor"
            : mudouPeriodo || mesesAlterados > 0
              ? "periodo"
              : "igual";
    return {
      nome: d?.nome ?? a?.nome ?? e.nome,
      antes: va,
      depois: vd,
      diferenca: (vd ?? 0) - (va ?? 0),
      periodoAntes: pa,
      periodoDepois: pd,
      mesesAlterados,
      mudanca,
    };
  });
}

// ---------------------------------------------------------------------------
// Revisões: código da próxima
// ---------------------------------------------------------------------------

const numeroDaRevisao = (codigo: string) =>
  /^R(\d{2})$/.test(codigo) ? Number(codigo.slice(1)) : null;

export const codigoDaRevisao = (n: number) => `R${String(n).padStart(2, "0")}`;

/**
 * Código da revisão que entra: o da planilha, se ainda não existe na obra;
 * senão o seguinte ao maior (R00, R01…). Nunca apaga nem reaproveita uma
 * revisão que já existe. null: passou de R99.
 */
export function proximaRevisao(
  existentes: string[],
  daPlanilha: string | null,
): { codigo: string; aviso: string | null } | null {
  const usados = existentes
    .map(numeroDaRevisao)
    .filter((n): n is number => n !== null);
  if (daPlanilha && numeroDaRevisao(daPlanilha) !== null) {
    if (!existentes.includes(daPlanilha))
      return { codigo: daPlanilha, aviso: null };
  }
  const n = usados.length ? Math.max(...usados) + 1 : 0;
  if (n > 99) return null;
  const codigo = codigoDaRevisao(n);
  return {
    codigo,
    aviso: daPlanilha
      ? `A revisão ${daPlanilha} já existe nesta obra: esta planilha entra como ${codigo}, e a anterior continua guardada.`
      : `A planilha não diz a revisão: ela entra como ${codigo}.`,
  };
}
