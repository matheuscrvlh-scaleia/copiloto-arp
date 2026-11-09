import { formatarMes, formatarNumero } from "@/lib/formato";
import { diaDaSemana, somarDias } from "@/lib/os/tempo";

// Rateio da limpeza (spec 4.8): o custo da limpeza contratada dividido entre
// a área comum e os blocos, igual à aba mensal da planilha "RATEIO BS E
// MANUTENÇÃO". Regras puras, sem banco, com testes ao lado.
//
// Conta (fórmulas da planilha):
//   valor por funcionário = valor base ÷ funcionários da base
//   área comum            = funcionários da área comum × valor por funcionário + Σ extras
//   minutos do bloco      = minutos de limpeza + minutos de manutenção
//   participação do bloco = minutos do bloco ÷ minutos de todos os blocos
//   valor do bloco        = participação × funcionários rateados × valor por funcionário
//   total                 = área comum + Σ blocos
//
// Arredondamento: tudo em centavos inteiros. Cada parte (área comum e cada
// bloco) é calculada como fração exata (BigInt, sem ponto flutuante), sem
// arredondar o valor por funcionário no meio da conta, como a planilha. O
// total é a soma exata arredondada ao centavo (meio centavo para cima). As
// partes ficam com os centavos inteiros e os centavos que faltam para o
// total vão, um a um, às partes de maior resto (método do maior resto, ou
// de Hamilton). Desempate fixo: área comum primeiro, depois os blocos na
// ordem da lista. Assim a soma das partes fecha sempre no total. Setembro
// de 2026 dá exatamente os valores da planilha (teste ao lado).

export type RegraBl04 = "separado" | "area_comum";

/** Bloco que, até nov/2025, a planilha somava à área comum. */
export const BLOCO_04 = "04";
/** Primeiro mês com o Bloco 04 separado (aba "BS 20.12.25 REV"). */
export const INICIO_BL04_SEPARADO = "2025-12-01";

/** Regra do Bloco 04 da época do mês (aaaa-mm-01). */
export function regraBl04Do(referencia: string): RegraBl04 {
  return referencia < INICIO_BL04_SEPARADO ? "area_comum" : "separado";
}

export const ROTULO_REGRA_BL04: Record<RegraBl04, string> = {
  separado: "Bloco 04 separado",
  area_comum: "Bloco 04 dentro da área comum",
};

export interface ExtraRateio {
  descricao: string;
  /** Quantidade (dias, auxiliares); null quando o valor é lançado direto. */
  quantidade: number | null;
  /** Valor por unidade, em centavos. */
  valorUnitario: number | null;
  /** Valor do extra, em centavos. */
  valor: number;
}

export interface MinutosBloco {
  bloco: string;
  limpeza: number;
  manutencao: number;
}

export interface ItemContrato {
  descricao: string;
  /** Centavos. */
  valor: number;
  /** Entra na conferência (parte de limpeza do contrato). */
  entraConferencia: boolean;
}

export interface EntradaRateio {
  /** Centavos; null enquanto não lançado. */
  valorBase: number | null;
  /** Texto da composição (ex.: "38.509,83 − 8.072,68 + …"). */
  composicao?: string | null;
  funcBase: number | null;
  funcAreaComum: number | null;
  funcRateados: number | null;
  extras: ExtraRateio[];
  /** Blocos que entram, na ordem da tela (parametros.limpeza_blocos). */
  blocos: string[];
  minutos: MinutosBloco[];
  contrato: ItemContrato[];
  regraBl04: RegraBl04;
}

export interface BlocoRateio {
  bloco: string;
  limpeza: number;
  manutencao: number;
  minutos: number;
  /** De 0 a 1 (null sem minutos). */
  participacao: number | null;
  /** Centavos (null sem minutos ou sem valor base). */
  valor: number | null;
}

export type ChaveMemoria =
  | "valor_base"
  | "valor_funcionario"
  | "extras"
  | "area_comum"
  | "rateado"
  | "minutos"
  | "total"
  | "conferencia"
  | `bloco:${string}`;

export interface PassoMemoria {
  chave: ChaveMemoria;
  rotulo: string;
  /** A conta escrita, com os números do mês. */
  formula: string;
  /** Resultado formatado. */
  valor: string;
  /** Observação (arredondamento, regra do Bloco 04). */
  nota?: string;
}

export type SituacaoConferencia = "bate" | "nao_bate" | "sem_contrato";

export interface Conferencia {
  situacao: SituacaoConferencia;
  /** Soma dos itens do contrato que entram (centavos). */
  contrato: number;
  /** Total do rateio − contrato (centavos; null sem total). */
  diferenca: number | null;
  itens: ItemContrato[];
}

export interface ResultadoRateio {
  /** Dá para fechar: valor base, funcionários e minutos lançados. */
  completo: boolean;
  /** O que falta para a conta sair inteira. */
  pendencias: string[];
  valorPorFuncionario: number | null;
  /** Funcionários rateados × valor por funcionário (centavos). */
  rateado: number | null;
  extras: number;
  /** Área comum sem o Bloco 04 (regra atual), em centavos. */
  areaComum: number | null;
  /** Área comum como a planilha da época mostrava (com o Bloco 04 até nov/2025). */
  areaComumExibida: number | null;
  blocos: BlocoRateio[];
  /** Soma dos blocos (centavos). */
  somaBlocos: number | null;
  minutosTotal: number;
  total: number | null;
  conferencia: Conferencia;
  composicao: ComposicaoLida | null;
  memoria: PassoMemoria[];
  /** Parte que ganhou 1 centavo no maior resto (chave → resto exato). */
  ajustes: { chave: string; resto: string }[];
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/** Reais (número do banco, ex.: 35323.94) → centavos inteiros. */
export function centavos(reais: number | string | null | undefined): number {
  const n = typeof reais === "string" ? Number(reais) : (reais ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Centavos → reais (para gravar em numeric). */
export const paraReais = (c: number) => c / 100;

/** 151142 → "1.511,42". */
export function reais(c: number | null): string {
  return c === null ? "—" : formatarNumero(c / 100, 2);
}

/** 0,09627 → "9,63%". */
export function pct(p: number | null): string {
  return p === null ? "—" : `${formatarNumero(p * 100, 2)}%`;
}

const inteiro = (n: number) => formatarNumero(n);

/** Divisão inteira com piso (BigInt trunca para zero). */
function piso(num: bigint, den: bigint): bigint {
  const q = num / den;
  return num % den !== 0n && num < 0n !== den < 0n ? q - 1n : q;
}

/** num/den arredondado ao inteiro, meio para cima (den > 0). */
function arredondar(num: bigint, den: bigint): bigint {
  return piso(2n * num + den, 2n * den);
}

/** num/den (em centavos) escrito com `casas` casas de reais: "3.924,882222". */
function exato(num: bigint, den: bigint, casas = 6): string {
  const escala = 10n ** BigInt(casas);
  const v = arredondar(num * escala, den * 100n);
  const neg = v < 0n;
  const a = neg ? -v : v;
  const int = a / escala;
  const frac = (a % escala).toString().padStart(casas, "0");
  return `${neg ? "-" : ""}${formatarNumero(Number(int))},${frac}`;
}

/**
 * Método do maior resto: cada parte (num/den, em centavos) fica com o piso;
 * os centavos que faltam para `alvo` vão às partes de maior resto. Empate:
 * a que vem antes na lista. Devolve as partes e quem ganhou 1 centavo.
 */
export function maiorResto(
  nums: bigint[],
  den: bigint,
  alvo: bigint,
): { partes: bigint[]; ganharam: number[] } {
  const pisos = nums.map((n) => piso(n, den));
  const restos = nums.map((n, i) => n - (pisos[i] as bigint) * den);
  let falta = alvo - pisos.reduce((s, v) => s + v, 0n);
  const ordem = nums
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = restos[a] as bigint;
      const rb = restos[b] as bigint;
      return ra === rb ? a - b : ra > rb ? -1 : 1;
    });
  const ganharam: number[] = [];
  const partes = [...pisos];
  // `falta` fica entre 0 e o número de partes (o alvo é a soma exata
  // arredondada); o laço também cobre o caso de sobrar (tira dos menores).
  for (let k = 0; falta > 0n && k < ordem.length; k++, falta--) {
    const i = ordem[k] as number;
    partes[i] = (partes[i] as bigint) + 1n;
    ganharam.push(i);
  }
  for (let k = ordem.length - 1; falta < 0n && k >= 0; k--, falta++) {
    const i = ordem[k] as number;
    partes[i] = (partes[i] as bigint) - 1n;
  }
  return { partes, ganharam };
}

/** Valor do extra: quantidade × valor por unidade, ao centavo (meio para cima). */
export function valorDoExtra(
  quantidade: number | null,
  valorUnitario: number | null,
  valor: number,
): number {
  if (quantidade === null || valorUnitario === null) return valor;
  // Quantidade com até 2 casas (numeric(10,2)).
  const q = BigInt(Math.round(quantidade * 100));
  return Number(arredondar(q * BigInt(valorUnitario), 100n));
}

// ---------------------------------------------------------------------------
// Composição do valor base ("38.509,83 − 8.072,68 + 1.736,79 + …")
// ---------------------------------------------------------------------------

export interface ComposicaoLida {
  /** Soma das parcelas (centavos), ou null se o texto não é só uma conta. */
  valor: number | null;
  /** A soma bate com o valor base lançado. */
  confere: boolean | null;
}

/** Lê "38.509,83 − 8.072,68 + 630,00" como conta; null se não for só isso. */
export function somarComposicao(texto: string): number | null {
  const t = texto.replace(/[−–—]/g, "-").replace(/R\$/g, "").trim();
  if (!t) return null;
  const termos = t.match(/[+-]?\s*[\d.,]+/g);
  if (!termos || termos.join("").replace(/\s/g, "") !== t.replace(/\s/g, ""))
    return null;
  let soma = 0;
  for (const termo of termos) {
    const s = termo.replace(/\s/g, "");
    const sinal = s.startsWith("-") ? -1 : 1;
    const num = s.replace(/^[+-]/, "");
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(num))
      return null;
    const [int, dec = ""] = num.replace(/\./g, "").split(",");
    soma += sinal * (Number(int) * 100 + Number(dec.padEnd(2, "0")));
  }
  return soma;
}

// ---------------------------------------------------------------------------
// Cálculo
// ---------------------------------------------------------------------------

const rotuloBloco = (b: string) => `Bloco ${b}`;

/** Conferência com o contrato: o total tem de ser a parte de limpeza dele. */
export function conferirContrato(
  total: number | null,
  contrato: ItemContrato[],
): Conferencia {
  const itens = contrato.filter((c) => c.entraConferencia);
  const soma = itens.reduce((s, c) => s + c.valor, 0);
  if (!itens.length)
    return { situacao: "sem_contrato", contrato: 0, diferenca: null, itens };
  const diferenca = total === null ? null : total - soma;
  return {
    situacao: diferenca === 0 ? "bate" : "nao_bate",
    contrato: soma,
    diferenca,
    itens,
  };
}

export function calcularRateio(e: EntradaRateio): ResultadoRateio {
  const extras = e.extras.reduce((s, x) => s + x.valor, 0);
  const porBloco = new Map(e.minutos.map((m) => [m.bloco, m]));
  const blocosBase = e.blocos.map((bloco) => {
    const m = porBloco.get(bloco);
    const limpeza = m?.limpeza ?? 0;
    const manutencao = m?.manutencao ?? 0;
    return { bloco, limpeza, manutencao, minutos: limpeza + manutencao };
  });
  const minutosTotal = blocosBase.reduce((s, b) => s + b.minutos, 0);
  const composicao = lerComposicao(e.composicao, e.valorBase);

  const { valorBase, funcBase, funcAreaComum, funcRateados } = e;
  const pendencias: string[] = [];
  if (valorBase === null) pendencias.push("Lance o valor base do contrato.");
  const funcOk =
    !!funcBase &&
    funcAreaComum !== null &&
    funcRateados !== null &&
    funcAreaComum + funcRateados <= funcBase;
  if (!funcBase || funcAreaComum === null || funcRateados === null)
    pendencias.push("Lance os funcionários da base, da área comum e rateados.");
  else if (!funcOk)
    pendencias.push(
      "Funcionários da área comum mais rateados passam dos funcionários da base.",
    );
  if (minutosTotal <= 0) pendencias.push("Lance os minutos dos blocos.");

  // Passos da memória, montados na ordem da conta.
  const passo = {
    extras: {
      chave: "extras",
      rotulo: "Extras da área comum",
      formula: e.extras.length
        ? `Σ extras = ${e.extras.map(textoDoExtra).join(" + ")}`
        : "Nenhum extra no mês",
      valor: reais(extras),
    } satisfies PassoMemoria,
  };

  const resultado: ResultadoRateio = {
    completo: false,
    pendencias,
    valorPorFuncionario: null,
    rateado: null,
    extras,
    areaComum: null,
    areaComumExibida: null,
    blocos: blocosBase.map((b) => ({
      ...b,
      participacao: minutosTotal > 0 ? b.minutos / minutosTotal : null,
      valor: null,
    })),
    somaBlocos: null,
    minutosTotal,
    total: null,
    conferencia: conferirContrato(null, e.contrato),
    composicao,
    memoria: [passo.extras],
    ajustes: [],
  };
  if (valorBase === null || !funcOk) return resultado;

  const base = BigInt(valorBase);
  const fb = BigInt(funcBase as number);
  const fac = BigInt(funcAreaComum as number);
  const frat = BigInt(funcRateados as number);
  const vf = Number(arredondar(base, fb));
  const rateado = Number(arredondar(frat * base, fb));
  // Área comum = (fac × base + fb × extras) ÷ fb, sem arredondar no meio.
  const numAc = fac * base + fb * BigInt(extras);

  const passoBase: PassoMemoria = {
    chave: "valor_base",
    rotulo: "Valor base do contrato",
    formula: e.composicao?.trim()
      ? `Composição: ${e.composicao.trim()}`
      : "Lançado no mês",
    valor: reais(valorBase),
    nota:
      composicao?.confere === false
        ? `A composição soma ${reais(composicao.valor)}, diferente do valor base.`
        : undefined,
  };
  const passoVf: PassoMemoria = {
    chave: "valor_funcionario",
    rotulo: "Valor por funcionário",
    formula: `valor base ÷ funcionários da base = ${reais(valorBase)} ÷ ${funcBase}`,
    valor: reais(vf),
    nota: `A conta usa o valor sem arredondar: ${exato(base, fb)}.`,
  };
  const passoRateado: PassoMemoria = {
    chave: "rateado",
    rotulo: "Valor rateado entre os blocos",
    formula: `funcionários rateados × valor por funcionário = ${funcRateados} × ${reais(vf)}`,
    valor: reais(rateado),
  };
  const formulaAc = `funcionários da área comum × valor por funcionário + extras = ${funcAreaComum} × ${reais(vf)} + ${reais(extras)}`;

  if (minutosTotal <= 0) {
    const ac = Number(arredondar(numAc, fb));
    return {
      ...resultado,
      valorPorFuncionario: vf,
      rateado,
      areaComum: ac,
      areaComumExibida: ac,
      memoria: [
        passoBase,
        passoVf,
        passo.extras,
        {
          chave: "area_comum",
          rotulo: "Área comum",
          formula: formulaAc,
          valor: reais(ac),
        },
        passoRateado,
        {
          chave: "minutos",
          rotulo: "Minutos de todos os blocos",
          formula: "Nenhum minuto lançado: os blocos e o total ficam sem valor",
          valor: "0 min/dia",
        },
      ],
    };
  }

  // Partes sobre o mesmo denominador (fb × minutos de todos os blocos).
  const M = BigInt(minutosTotal);
  const den = fb * M;
  const nums = [
    numAc * M,
    ...blocosBase.map((b) => frat * base * BigInt(b.minutos)),
  ];
  const alvo = arredondar(
    nums.reduce((s, n) => s + n, 0n),
    den,
  );
  const { partes, ganharam } = maiorResto(nums, den, alvo);
  const ac = Number(partes[0]);
  const blocos: BlocoRateio[] = blocosBase.map((b, i) => ({
    ...b,
    participacao: b.minutos / minutosTotal,
    valor: Number(partes[i + 1]),
  }));
  const somaBlocos = blocos.reduce((s, b) => s + (b.valor ?? 0), 0);
  const total = Number(alvo);
  const ajustes = ganharam.map((i) => ({
    chave: i === 0 ? "area_comum" : (blocosBase[i - 1]?.bloco as string),
    resto: exato(nums[i] as bigint, den, 4),
  }));
  const ganhou = new Set(ajustes.map((a) => a.chave));
  const nota = (chave: string, n: bigint) =>
    `Conta exata ${exato(n, den, 4)}${ganhou.has(chave) ? "; ganhou 1 centavo no maior resto" : ""}.`;

  const bl04 = blocos.find((b) => b.bloco === BLOCO_04);
  const antiga = e.regraBl04 === "area_comum" && bl04 !== undefined;
  const areaComumExibida = antiga ? ac + (bl04.valor ?? 0) : ac;
  const conferencia = conferirContrato(total, e.contrato);

  const memoria: PassoMemoria[] = [
    passoBase,
    passoVf,
    passo.extras,
    {
      chave: "area_comum",
      rotulo: "Área comum",
      formula: formulaAc,
      valor: reais(ac),
      nota: antiga
        ? `${nota("area_comum", nums[0] as bigint)} Na regra da época a planilha mostrava a área comum com o Bloco 04: ${reais(ac)} + ${reais(bl04.valor)} = ${reais(areaComumExibida)}.`
        : nota("area_comum", nums[0] as bigint),
    },
    passoRateado,
    {
      chave: "minutos",
      rotulo: "Minutos de todos os blocos",
      formula: `Σ (limpeza + manutenção) = ${blocos.map((b) => inteiro(b.minutos)).join(" + ")}`,
      valor: `${inteiro(minutosTotal)} min/dia`,
    },
    ...blocos.map(
      (b, i): PassoMemoria => ({
        chave: `bloco:${b.bloco}`,
        rotulo: rotuloBloco(b.bloco),
        formula: `participação × valor rateado = (${inteiro(b.limpeza)} + ${inteiro(b.manutencao)}) ÷ ${inteiro(minutosTotal)} × ${reais(rateado)} = ${pct(b.participacao)} × ${reais(rateado)}`,
        valor: reais(b.valor),
        nota: nota(b.bloco, nums[i + 1] as bigint),
      }),
    ),
    {
      chave: "total",
      rotulo: "Total do rateio",
      formula: `área comum + soma dos blocos = ${reais(ac)} + ${reais(somaBlocos)}`,
      valor: reais(total),
      nota: antiga
        ? "Até nov/2025 a planilha somava o Bloco 04 à área comum e o tirava do total: o total é o mesmo."
        : "Centavos pelo maior resto: cada parte fica com os centavos inteiros e os que faltam para o total vão às de maior resto (empate: área comum, depois a ordem dos blocos).",
    },
    {
      chave: "conferencia",
      rotulo: "Conferência com o contrato",
      formula:
        conferencia.situacao === "sem_contrato"
          ? "Nenhum item do contrato marcado para a conferência"
          : `${conferencia.itens.map((c) => `${c.descricao} ${reais(c.valor)}`).join(" + ")} = ${reais(conferencia.contrato)}`,
      valor:
        conferencia.situacao === "bate"
          ? "Bate com o total"
          : conferencia.situacao === "nao_bate"
            ? `Não bate (diferença ${reais(conferencia.diferenca)})`
            : "Sem conferência",
    },
  ];

  return {
    completo: pendencias.length === 0,
    pendencias,
    valorPorFuncionario: vf,
    rateado,
    extras,
    areaComum: ac,
    areaComumExibida,
    blocos,
    somaBlocos,
    minutosTotal,
    total,
    conferencia,
    composicao,
    memoria,
    ajustes,
  };
}

function textoDoExtra(x: ExtraRateio): string {
  return x.quantidade !== null && x.valorUnitario !== null
    ? `${x.descricao} (${formatarNumero(x.quantidade, Number.isInteger(x.quantidade) ? 0 : 2)} × ${reais(x.valorUnitario)} = ${reais(x.valor)})`
    : `${x.descricao} ${reais(x.valor)}`;
}

function lerComposicao(
  texto: string | null | undefined,
  valorBase: number | null,
): ComposicaoLida | null {
  if (!texto?.trim()) return null;
  const valor = somarComposicao(texto);
  return {
    valor,
    confere: valor === null || valorBase === null ? null : valor === valorBase,
  };
}

/** Valor de cada local (chave "area_comum" ou o bloco), para comparar. */
export function valoresPorLocal(
  r: ResultadoRateio,
  regra: RegraBl04,
): Record<string, number | null> {
  const v: Record<string, number | null> = {
    area_comum: regra === "area_comum" ? r.areaComumExibida : r.areaComum,
  };
  for (const b of r.blocos) v[b.bloco] = b.valor;
  v.total = r.total;
  return v;
}

// ---------------------------------------------------------------------------
// Prazo do envio ao Financeiro
// ---------------------------------------------------------------------------

export interface CalendarioEnvio {
  /** 0 = domingo … 6 = sábado. */
  diasUteis: number[];
  feriados: Set<string>;
}

/** O n-ésimo dia útil do mês seguinte à referência (aaaa-mm-dd). */
export function prazoDoEnvio(
  referencia: string,
  diaUtil: number,
  cal: CalendarioEnvio,
): string {
  if (!cal.diasUteis.length) throw new Error("Calendário sem dias úteis");
  const [a, m] = referencia.split("-").map(Number) as [number, number];
  let d = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  let conta = 0;
  for (;;) {
    if (cal.diasUteis.includes(diaDaSemana(d)) && !cal.feriados.has(d)) {
      conta++;
      if (conta >= diaUtil) return d;
    }
    d = somarDias(d, 1);
  }
}

export type SituacaoEnvio =
  | "enviado"
  | "enviado_atrasado"
  | "no_prazo"
  | "atrasado"
  | "historico";

export const ROTULO_ENVIO: Record<SituacaoEnvio, string> = {
  enviado: "Enviado ao Financeiro",
  enviado_atrasado: "Enviado depois do prazo",
  no_prazo: "Aguardando envio",
  atrasado: "Envio atrasado",
  historico: "Histórico importado",
};

/**
 * Situação do envio ao Financeiro. Mês importado da planilha e não enviado
 * pelo sistema é histórico (foi repassado fora dele): não gera alerta.
 */
export function situacaoDoEnvio(
  mes: { origem: string; enviadoEm: string | null },
  prazo: string,
  hoje: string,
): SituacaoEnvio {
  if (mes.enviadoEm)
    return dataEmBrasilia(mes.enviadoEm) > prazo
      ? "enviado_atrasado"
      : "enviado";
  if (mes.origem === "importacao") return "historico";
  return hoje > prazo ? "atrasado" : "no_prazo";
}

const diaBrasilia = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Timestamp → "aaaa-mm-dd" em Brasília. */
export function dataEmBrasilia(iso: string): string {
  return diaBrasilia.format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Meses
// ---------------------------------------------------------------------------

/** "2026-09-01" → "2026-10-01". */
export function mesSeguinte(referencia: string): string {
  const [a, m] = referencia.split("-").map(Number) as [number, number];
  return m === 12
    ? `${a + 1}-01-01`
    : `${a}-${String(m + 1).padStart(2, "0")}-01`;
}

/** "2026-09-01" → "2026-08-01". */
export function mesAnterior(referencia: string): string {
  const [a, m] = referencia.split("-").map(Number) as [number, number];
  return m === 1
    ? `${a - 1}-12-01`
    : `${a}-${String(m - 1).padStart(2, "0")}-01`;
}

/** "2026-09-01" → "set/2026". */
export const nomeDoMes = (referencia: string) => formatarMes(referencia);

/** Mês da URL ("2026-09") ou da referência → "aaaa-mm-01"; null se inválido. */
export function lerMes(valor: string | null | undefined): string | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])(?:-01)?$/.exec(valor ?? "");
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/**
 * Blocos do mês: os dos parâmetros, na ordem deles, e depois os que o mês
 * já tem lançados fora dessa lista (mês antigo com outro conjunto).
 */
export function blocosDoMes(parametros: string[], doMes: string[]): string[] {
  const fora = doMes.filter((b) => !parametros.includes(b)).sort();
  return [...new Set([...parametros, ...fora])];
}
