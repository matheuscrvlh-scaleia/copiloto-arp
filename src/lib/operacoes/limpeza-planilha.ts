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
// a regra do Bloco 04 da época e compara com a aba. A planilha não tem os
// funcionários da área comum nem os rateados: os rateados saem da soma dos
// blocos ÷ valor por funcionário e a área comum é o resto da base. Os
// extras (A13:B40) são texto livre; a leitura junta "dias cobrados" ao valor
// da linha de cima e confere a soma com o que a área comum da aba implica.

export const LINHA_PRIMEIRO_BLOCO = 5;
export const LINHA_ULTIMO_BLOCO = 11;
export const LINHAS_EXTRAS = { de: 13, ate: 40 } as const;

export type ValorCelula = number | string | boolean | { erro: string } | null;

export interface AbaDoRateio {
  nome: string;
  /** Valor calculado da célula ("F4"); fórmula vira o resultado. */
  celula: (endereco: string) => ValorCelula;
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
  /^\s*BS\s+(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(\s+REV(?:\s*\d*)?)?\s*$/i;

export interface AbaDeMes {
  referencia: string;
  /** Dia do nome (para escolher entre abas do mesmo mês). */
  dia: number;
  revisada: boolean;
}

/** "BS 25.09.26" → set/2026; "BS 20.12.25 REV" → dez/2025 revisada. */
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
    revisada: Boolean(m[4]),
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
  if (rotuloAc && rotuloDizBl04 !== (regra === "area_comum"))
    avisos.push({
      nivel: "aviso",
      aba: aba.nome,
      mensagem: `O rótulo "${rotuloAc}" não segue a regra da data (${ROTULO_REGRA_BL04[regra]}). A conta usou a regra da data.`,
    });

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
  const funcAreaComum =
    funcBase === null
      ? null
      : funcBase - funcRateados >= 0
        ? funcBase - funcRateados
        : Math.min(opcoes.funcAreaComum, funcBase);

  // Extras que a área comum da aba implica: área comum (sem o Bloco 04, na
  // regra antiga) − funcionários da área comum × valor por funcionário.
  const bl04Lido = linhas.find((l) => l.bloco === BLOCO_04)?.valor ?? null;
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
  const ex = lerExtras(aba, implicito);
  avisos.push(...ex.avisos);

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
