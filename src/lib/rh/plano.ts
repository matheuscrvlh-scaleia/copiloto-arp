// Planilha de faixas do plano de saúde (operadora): aba "Faixas etárias"
// (idade inicial, idade final, mensalidade) e aba "Regras de coparticipação"
// (período em texto, % pago pelo colaborador, observações). Função pura: o
// servidor lê o .xlsx e passa as abas como linhas.

export type Celula = string | number | boolean | Date | null;

export interface AbaDaPlanilha {
  sheet: string;
  data: Celula[][];
}

export interface FaixaDoPlano {
  idade_min: number;
  /** Null: sem limite ("59 ou mais"). */
  idade_max: number | null;
  mensalidade: number;
}

export interface CoparticipacaoDoPlano {
  meses_min: number;
  meses_max: number | null;
  /** Exatamente um dos dois. */
  colaborador_pct: number | null;
  colaborador_valor_fixo: number | null;
  /** Como veio na planilha, para a prévia. */
  periodo: string;
}

export interface TabelaDoPlano {
  faixas: FaixaDoPlano[];
  coparticipacao: CoparticipacaoDoPlano[];
  avisos: string[];
}

export class ErroPlanilha extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroPlanilha";
  }
}

/** Idade final a partir da qual a faixa é "sem limite" (a planilha usa 999). */
const SEM_LIMITE = 120;

const semAcento = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function aba(abas: AbaDaPlanilha[], ...nomes: string[]) {
  return abas.find((a) => nomes.some((n) => semAcento(a.sheet).includes(n)));
}

/** "1.535,58", "R$ 57,50", 256.36 → número. */
export function numeroDaCelula(c: Celula): number | null {
  if (typeof c === "number") return Number.isFinite(c) ? c : null;
  if (typeof c !== "string") return null;
  const t = c.replace(/R\$|\s|%/g, "");
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+([.,]\d+)?$/.test(t)) return null;
  return t.includes(",")
    ? Number(t.replace(/\./g, "").replace(",", "."))
    : Number(t);
}

/** "2 anos e 1 mês" → 25; "3 meses" → 3; "2 anos completos" → 24. */
export function mesesDoTexto(texto: string): number | null {
  const t = semAcento(texto);
  const anos = t.match(/(\d+)\s*anos?/);
  const meses = t.match(/(\d+)\s*m(es|eses)\b/);
  if (!anos && !meses) return null;
  return Number(anos?.[1] ?? 0) * 12 + Number(meses?.[1] ?? 0);
}

/** "De 3 meses até 2 anos completos" → 3 a 24; "A partir de 7 anos e 1 mês" → 85 em diante. */
export function periodoEmMeses(
  texto: string,
): { min: number; max: number | null } | null {
  const t = semAcento(texto);
  const partir = t.match(/a partir de (.+)/);
  if (partir?.[1]) {
    const min = mesesDoTexto(partir[1]);
    return min === null ? null : { min, max: null };
  }
  const entre = t.match(/de (.+?) ate (.+)/);
  if (entre?.[1] && entre[2]) {
    const min = mesesDoTexto(entre[1]);
    const max = mesesDoTexto(entre[2]);
    return min === null || max === null ? null : { min, max };
  }
  return null;
}

function lerFaixas(a: AbaDaPlanilha, avisos: string[]): FaixaDoPlano[] {
  const faixas: FaixaDoPlano[] = [];
  for (const [i, linha] of a.data.entries()) {
    const [ini, fim, valor] = linha.map(numeroDaCelula);
    if (ini === null || ini === undefined) continue; // cabeçalho ou vazia
    if (
      fim === null ||
      fim === undefined ||
      valor === null ||
      valor === undefined
    )
      throw new ErroPlanilha(
        `Aba "${a.sheet}", linha ${i + 1}: falta a idade final ou a mensalidade.`,
      );
    faixas.push({
      idade_min: ini,
      idade_max: fim >= SEM_LIMITE ? null : fim,
      mensalidade: valor,
    });
  }
  if (!faixas.length)
    throw new ErroPlanilha(`A aba "${a.sheet}" não tem nenhuma faixa.`);
  faixas.sort((x, y) => x.idade_min - y.idade_min);
  for (let k = 1; k < faixas.length; k++) {
    const ant = faixas[k - 1] as FaixaDoPlano;
    const atual = faixas[k] as FaixaDoPlano;
    if (ant.idade_max === null || atual.idade_min <= ant.idade_max)
      throw new ErroPlanilha(
        `Faixas sobrepostas: ${ant.idade_min}–${ant.idade_max ?? "…"} e ${atual.idade_min}–${atual.idade_max ?? "…"}.`,
      );
    if (atual.idade_min !== ant.idade_max + 1)
      avisos.push(
        `Nenhuma faixa cobre de ${ant.idade_max + 1} a ${atual.idade_min - 1} anos.`,
      );
  }
  return faixas;
}

function lerCoparticipacao(
  a: AbaDaPlanilha,
  avisos: string[],
): CoparticipacaoDoPlano[] {
  const regras: CoparticipacaoDoPlano[] = [];
  for (const [i, linha] of a.data.entries()) {
    const [periodo, percentual, ...resto] = linha;
    if (typeof periodo !== "string") continue;
    const meses = periodoEmMeses(periodo);
    if (!meses) {
      if (i > 0)
        avisos.push(
          `Linha ${i + 1} ignorada: período "${periodo}" não reconhecido.`,
        );
      continue; // o cabeçalho cai aqui
    }
    // Valor fixo na observação (ex.: "desconto em folha de R$ 57,50") vale
    // no lugar do percentual, como na regra de quem tem mais de 7 anos.
    const observacao = resto.filter((c) => typeof c === "string").join(" ");
    const fixo = observacao.match(/R\$\s*([\d.,]+)/);
    const valorFixo = fixo?.[1] ? numeroDaCelula(fixo[1]) : null;
    const pct = numeroDaCelula(percentual ?? null);
    if (valorFixo === null && pct === null)
      throw new ErroPlanilha(
        `Aba "${a.sheet}", linha ${i + 1}: falta o percentual pago pelo colaborador.`,
      );
    if (valorFixo === null && pct !== null && (pct < 0 || pct > 100))
      throw new ErroPlanilha(
        `Aba "${a.sheet}", linha ${i + 1}: percentual fora de 0 a 100.`,
      );
    if (valorFixo !== null && pct !== null)
      avisos.push(
        `"${periodo}": usado o valor fixo de R$ ${valorFixo.toFixed(2).replace(".", ",")} da observação no lugar de ${pct}%.`,
      );
    regras.push({
      meses_min: meses.min,
      meses_max: meses.max,
      colaborador_pct: valorFixo === null ? pct : null,
      colaborador_valor_fixo: valorFixo,
      periodo,
    });
  }
  regras.sort((x, y) => x.meses_min - y.meses_min);
  return regras;
}

export function lerTabelaDoPlano(abas: AbaDaPlanilha[]): TabelaDoPlano {
  const faixasAba = aba(abas, "faixa");
  if (!faixasAba)
    throw new ErroPlanilha(
      'Não achei a aba "Faixas etárias". Confira se é a planilha da operadora.',
    );
  const avisos: string[] = [];
  const faixas = lerFaixas(faixasAba, avisos);
  const copAba = aba(abas, "copartic");
  if (!copAba)
    avisos.push(
      'Sem a aba "Regras de coparticipação": só as faixas serão gravadas.',
    );
  const coparticipacao = copAba ? lerCoparticipacao(copAba, avisos) : [];
  return { faixas, coparticipacao, avisos };
}
