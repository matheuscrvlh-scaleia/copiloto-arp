import { z } from "zod";
import { formatarNumero, lerValorBr } from "@/lib/formato";
import {
  centavos,
  type EntradaRateio,
  type RegraBl04,
  valorDoExtra,
} from "./limpeza";

// Lançamento do mês na tela do rateio: o que o formulário guarda (textos
// como a pessoa digitou, "35.323,94"), a validação (Zod, a mesma no
// navegador e na Server Action) e a conversão para o cálculo e para o banco
// (operacoes.limpeza_salvar).

export const GRUPOS_EQUIPE = {
  blocos: "Blocos (rateados)",
  area_comum: "Área comum",
  banheiros: "Banheiros (extra da área comum)",
  externo: "Áreas externas",
} as const;
export type GrupoEquipe = keyof typeof GRUPOS_EQUIPE;

export interface ExtraLancado {
  descricao: string;
  quantidade: string;
  valorUnitario: string;
  /** Usado quando não há quantidade × valor por unidade. */
  valor: string;
}

export interface MinutosLancados {
  bloco: string;
  limpeza: string;
  manutencao: string;
}

export interface ItemContratoLancado {
  descricao: string;
  valor: string;
  entraConferencia: boolean;
}

export interface MembroLancado {
  nome: string;
  funcao: string;
  grupo: GrupoEquipe;
  blocos: string[];
  turno: string;
  minutosDia: string;
}

export interface Lancamento {
  referencia: string;
  apontamento: string;
  valorBase: string;
  composicao: string;
  funcBase: string;
  funcAreaComum: string;
  funcRateados: string;
  extras: ExtraLancado[];
  minutos: MinutosLancados[];
  contrato: ItemContratoLancado[];
  equipe: MembroLancado[];
}

// ---------------------------------------------------------------------------
// Texto → número (tolerante, para a conta ao vivo)
// ---------------------------------------------------------------------------

/** "35.323,94" → 3532394; vazio ou inválido → null. */
export function centavosDoTexto(t: string): number | null {
  const n = lerValorBr(t ?? "");
  return n === null || Number.isNaN(n) ? null : Math.round(n * 100);
}

/** "8" ou "1,5" → número; vazio ou inválido → null. */
export function numeroDoTexto(t: string): number | null {
  const n = lerValorBr(t ?? "");
  return n === null || Number.isNaN(n) ? null : n;
}

function inteiroDoTexto(t: string): number | null {
  const s = (t ?? "").trim();
  return /^\d+$/.test(s) ? Number(s) : null;
}

/** Centavos → "35.323,94" (para os campos). */
export const textoDeCentavos = (c: number | null) =>
  c === null ? "" : formatarNumero(c / 100, 2);

/** Valor do extra como a conta usa (quantidade × unidade, ou o valor). */
export function valorDoExtraLancado(x: ExtraLancado): number {
  const q = numeroDoTexto(x.quantidade);
  const u = centavosDoTexto(x.valorUnitario);
  if (q !== null && u !== null) return valorDoExtra(q, u, 0);
  return centavosDoTexto(x.valor) ?? 0;
}

/** O lançamento como entrada do cálculo (campos inválidos contam como vazios). */
export function entradaDoLancamento(
  l: Lancamento,
  regraBl04: RegraBl04,
  blocos: string[],
): EntradaRateio {
  return {
    valorBase: centavosDoTexto(l.valorBase),
    composicao: l.composicao,
    funcBase: inteiroDoTexto(l.funcBase),
    funcAreaComum: inteiroDoTexto(l.funcAreaComum),
    funcRateados: inteiroDoTexto(l.funcRateados),
    extras: l.extras
      .filter((x) => x.descricao.trim())
      .map((x) => {
        const q = numeroDoTexto(x.quantidade);
        const u = centavosDoTexto(x.valorUnitario);
        const comConta = q !== null && u !== null;
        return {
          descricao: x.descricao.trim(),
          quantidade: comConta ? q : null,
          valorUnitario: comConta ? u : null,
          valor: valorDoExtraLancado(x),
        };
      }),
    blocos,
    minutos: l.minutos.map((m) => ({
      bloco: m.bloco,
      limpeza: inteiroDoTexto(m.limpeza) ?? 0,
      manutencao: inteiroDoTexto(m.manutencao) ?? 0,
    })),
    contrato: l.contrato
      .filter((c) => c.descricao.trim())
      .map((c) => ({
        descricao: c.descricao.trim(),
        valor: centavosDoTexto(c.valor) ?? 0,
        entraConferencia: c.entraConferencia,
      })),
    regraBl04,
  };
}

// ---------------------------------------------------------------------------
// Validação (Server Action) e o que vai ao banco
// ---------------------------------------------------------------------------

const texto = (max: number, rotulo: string) =>
  z.string().trim().max(max, `${rotulo}: máximo de ${max} caracteres`);

const reaisOpcional = (rotulo: string) =>
  z
    .string()
    .trim()
    .max(30)
    .refine((t) => t === "" || centavosDoTexto(t) !== null, {
      message: `${rotulo}: valor inválido (use 1.234,56)`,
    });

const inteiroOpcional = (rotulo: string, max: number) =>
  z
    .string()
    .trim()
    .refine((t) => t === "" || (/^\d+$/.test(t) && Number(t) <= max), {
      message: `${rotulo}: número inteiro de 0 a ${max}`,
    });

export const lancamentoSchema = z.object({
  referencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "Mês inválido"),
  apontamento: texto(200, "Apontamento"),
  valorBase: reaisOpcional("Valor base").refine(
    (t) => (centavosDoTexto(t) ?? 0) >= 0,
    { message: "Valor base: não pode ser negativo" },
  ),
  composicao: texto(500, "Composição"),
  funcBase: inteiroOpcional("Funcionários da base", 500),
  funcAreaComum: inteiroOpcional("Funcionários da área comum", 500),
  funcRateados: inteiroOpcional("Funcionários rateados", 500),
  extras: z
    .array(
      z.object({
        descricao: texto(200, "Extra"),
        quantidade: z
          .string()
          .trim()
          .max(12)
          .refine(
            (t) => t === "" || (numeroDoTexto(t) ?? -1) >= 0,
            "Extra: quantidade inválida",
          ),
        valorUnitario: reaisOpcional("Extra: valor por dia"),
        valor: reaisOpcional("Extra: valor"),
      }),
    )
    .max(40, "No máximo 40 extras"),
  minutos: z
    .array(
      z.object({
        bloco: z.string().regex(/^\d{2}$/, "Bloco inválido"),
        limpeza: inteiroOpcional("Minutos de limpeza", 100_000),
        manutencao: inteiroOpcional("Minutos de manutenção", 100_000),
      }),
    )
    .max(40),
  contrato: z
    .array(
      z.object({
        descricao: texto(200, "Item do contrato"),
        valor: reaisOpcional("Item do contrato: valor"),
        entraConferencia: z.boolean(),
      }),
    )
    .max(30, "No máximo 30 itens no contrato"),
  equipe: z
    .array(
      z.object({
        nome: texto(120, "Funcionário"),
        funcao: texto(120, "Função"),
        grupo: z.enum(
          Object.keys(GRUPOS_EQUIPE) as [GrupoEquipe, ...GrupoEquipe[]],
          "Funcionário: escolha onde trabalha",
        ),
        blocos: z.array(z.string().regex(/^\d{2}$/)).max(20),
        turno: texto(80, "Turno"),
        minutosDia: inteiroOpcional("Minutos por dia", 1440),
      }),
    )
    .max(60, "No máximo 60 funcionários"),
});

/** O que operacoes.limpeza_salvar recebe (reais, como o numeric do banco). */
export interface DadosParaSalvar {
  apontamento: string | null;
  valor_base: number | null;
  base_composicao: string | null;
  func_base: number | null;
  func_area_comum: number | null;
  func_rateados: number | null;
  regra_bl04: RegraBl04;
  extras: {
    descricao: string;
    quantidade: number | null;
    valor_unitario: number | null;
    valor: number;
  }[];
  minutos: { bloco: string; limpeza: number; manutencao: number }[];
  contrato: { descricao: string; valor: number; entra_conferencia: boolean }[];
  equipe: {
    nome: string;
    funcao: string | null;
    grupo: GrupoEquipe;
    blocos: string[];
    turno: string | null;
    minutos_dia: number | null;
  }[];
}

const reais = (c: number) => c / 100;
const ouNulo = (t: string) => (t.trim() ? t.trim() : null);

/**
 * Valida e converte. Linhas sem descrição (extras, contrato) ou sem nome
 * (equipe) são descartadas; um valor digitado errado é erro.
 */
export function dadosParaSalvar(
  entrada: unknown,
  regraBl04: RegraBl04,
):
  | { ok: true; referencia: string; dados: DadosParaSalvar }
  | { ok: false; erro: string } {
  const p = lancamentoSchema.safeParse(entrada);
  if (!p.success)
    return {
      ok: false,
      erro: p.error.issues[0]?.message ?? "Dados inválidos.",
    };
  const l = p.data;
  const fb = inteiroDoTexto(l.funcBase);
  const fac = inteiroDoTexto(l.funcAreaComum);
  const frat = inteiroDoTexto(l.funcRateados);
  if (fb === 0)
    return {
      ok: false,
      erro: "Funcionários da base: precisa ser maior que zero.",
    };
  if (fb !== null && fac !== null && frat !== null && fac + frat > fb)
    return {
      ok: false,
      erro: "Funcionários: área comum mais rateados passam dos funcionários da base.",
    };
  const blocos = l.minutos.map((m) => m.bloco);
  if (new Set(blocos).size !== blocos.length)
    return { ok: false, erro: "Minutos: bloco repetido." };
  const extras = l.extras.filter((x) => x.descricao);
  for (const x of extras) {
    const q = numeroDoTexto(x.quantidade);
    const u = centavosDoTexto(x.valorUnitario);
    if ((q === null || u === null) && centavosDoTexto(x.valor) === null)
      return {
        ok: false,
        erro: `Extra "${x.descricao}": informe quantidade e valor por dia, ou o valor.`,
      };
  }
  const base = centavosDoTexto(l.valorBase);
  return {
    ok: true,
    referencia: l.referencia,
    dados: {
      apontamento: ouNulo(l.apontamento),
      valor_base: base === null ? null : reais(base),
      base_composicao: ouNulo(l.composicao),
      func_base: fb,
      func_area_comum: fac,
      func_rateados: frat,
      regra_bl04: regraBl04,
      extras: extras.map((x) => {
        const q = numeroDoTexto(x.quantidade);
        const u = centavosDoTexto(x.valorUnitario);
        const comConta = q !== null && u !== null;
        return {
          descricao: x.descricao,
          quantidade: comConta ? q : null,
          valor_unitario: comConta ? reais(u) : null,
          valor: reais(valorDoExtraLancado(x)),
        };
      }),
      minutos: l.minutos.map((m) => ({
        bloco: m.bloco,
        limpeza: inteiroDoTexto(m.limpeza) ?? 0,
        manutencao: inteiroDoTexto(m.manutencao) ?? 0,
      })),
      contrato: l.contrato
        .filter((c) => c.descricao)
        .map((c) => ({
          descricao: c.descricao,
          valor: reais(centavosDoTexto(c.valor) ?? 0),
          entra_conferencia: c.entraConferencia,
        })),
      equipe: l.equipe
        .filter((m) => m.nome)
        .map((m) => ({
          nome: m.nome,
          funcao: ouNulo(m.funcao),
          grupo: m.grupo,
          blocos: m.grupo === "blocos" ? m.blocos : [],
          turno: ouNulo(m.turno),
          minutos_dia: inteiroDoTexto(m.minutosDia),
        })),
    },
  };
}

// ---------------------------------------------------------------------------
// Banco → formulário
// ---------------------------------------------------------------------------

type Numero = number | string | null;

export function lancamentoDasLinhas(
  referencia: string,
  m: {
    apontamento: string | null;
    valor_base: Numero;
    base_composicao: string | null;
    func_base: number | null;
    func_area_comum: number | null;
    func_rateados: number | null;
  },
  extras: {
    descricao: string;
    quantidade: Numero;
    valor_unitario: Numero;
    valor: Numero;
  }[],
  minutos: { bloco: string; limpeza: number; manutencao: number }[],
  contrato: { descricao: string; valor: Numero; entra_conferencia: boolean }[],
  equipe: {
    nome: string;
    funcao: string | null;
    grupo: string;
    blocos: string[];
    turno: string | null;
    minutos_dia: number | null;
  }[],
  blocos: string[],
): Lancamento {
  const doMes = new Map(minutos.map((x) => [x.bloco, x]));
  const reaisTexto = (v: Numero) =>
    v === null ? "" : textoDeCentavos(centavos(v));
  return {
    referencia,
    apontamento: m.apontamento ?? "",
    valorBase: reaisTexto(m.valor_base),
    composicao: m.base_composicao ?? "",
    funcBase: m.func_base === null ? "" : String(m.func_base),
    funcAreaComum: m.func_area_comum === null ? "" : String(m.func_area_comum),
    funcRateados: m.func_rateados === null ? "" : String(m.func_rateados),
    extras: extras.map((x) => ({
      descricao: x.descricao,
      quantidade:
        x.quantidade === null
          ? ""
          : formatarNumero(
              Number(x.quantidade),
              Number.isInteger(Number(x.quantidade)) ? 0 : 2,
            ),
      valorUnitario: reaisTexto(x.valor_unitario),
      valor: reaisTexto(x.valor),
    })),
    minutos: blocos.map((bloco) => ({
      bloco,
      limpeza: String(doMes.get(bloco)?.limpeza ?? 0),
      manutencao: String(doMes.get(bloco)?.manutencao ?? 0),
    })),
    contrato: contrato.map((c) => ({
      descricao: c.descricao,
      valor: reaisTexto(c.valor),
      entraConferencia: c.entra_conferencia,
    })),
    equipe: equipe.map((x) => ({
      nome: x.nome,
      funcao: x.funcao ?? "",
      grupo: (x.grupo in GRUPOS_EQUIPE ? x.grupo : "area_comum") as GrupoEquipe,
      blocos: x.blocos,
      turno: x.turno ?? "",
      minutosDia: x.minutos_dia === null ? "" : String(x.minutos_dia),
    })),
  };
}
