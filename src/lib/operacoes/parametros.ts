import { z } from "zod";
import { cnpjValido } from "@/lib/documentos";
import { lerValorBr } from "@/lib/formato";
import type { Database } from "@/lib/supabase/database.types";

// Parâmetros de Operações (spec 4.12): todos os campos de
// operacoes.parametros, em grupos que salvam separado. A validação repete os
// checks do banco (para a mensagem sair em português, no campo certo) e os
// rótulos servem também ao histórico de alterações.

export const GRUPOS = {
  agua: "Água",
  termo: "Energia · termo",
  quadros: "Energia · quadros",
  contas: "Energia · contas e solar",
  limpeza: "Limpeza",
  obras: "Obras",
} as const;
export type Grupo = keyof typeof GRUPOS;
export const ehGrupo = (v: unknown): v is Grupo =>
  typeof v === "string" && v in GRUPOS;

/** Rótulo de cada coluna (formulário e histórico). */
export const ROTULOS_PARAMETROS: Record<string, string> = {
  agua_limite_m3: "Limite de consumo para alerta (m³)",
  agua_tolerancia: "Tolerância da conferência com o resumo",
  agua_blocos: "Blocos ativos da água",
  agua_parceiro: "Parceiro de gestão hídrica",
  agua_modelo: "Modelo de importação da planilha",
  agua_variacao_pct: "Variação contra a média que vira alerta (%)",
  agua_variacao_meses: "Meses da média de consumo",
  agua_variacao_min_m3: "Diferença mínima para o alerta de variação (m³)",
  termo_razao_social: "Razão social da ARP no termo",
  termo_cnpj: "CNPJ da ARP no termo",
  termo_endereco: "Endereço da ARP no termo",
  termo_cidade: "Cidade na data do termo",
  termo_qualificacao_cpf: "Qualificação padrão (CPF)",
  termo_qualificacao_cnpj: "Qualificação padrão (CNPJ)",
  termo_nome_arquivo: "Formato do nome do arquivo do termo",
  energia_disjuntores: "Tipos de disjuntor",
  energia_ligacoes: "Tipos de ligação",
  energia_medidor_situacoes: "Situações do medidor",
  energia_alerta_pct: "Alerta de consumo acima da média de 12 meses (%)",
  solar_fonte: "Fonte da geração solar",
  limpeza_empresa: "Empresa contratada da limpeza",
  limpeza_func_base: "Funcionários da base",
  limpeza_func_area_comum: "Funcionários da área comum",
  limpeza_func_rateados: "Funcionários rateados entre os blocos",
  limpeza_blocos: "Blocos no rateio",
  limpeza_dia_util_envio: "Dia útil limite do envio ao Financeiro",
  limpeza_extras_padrao: "Extras padrão da área comum",
  obras_intervalo_min: "Intervalo da consulta ao Diário de Obra",
  obras_dias_relatorio: "Dias que contam para “dia sem relatório”",
  obras_limite_desvio: "Limite do desvio físico × prazo (pontos)",
  obras_limite_orcamento_pct: "Limite de desvio do orçamento (%)",
  atualizado_por: "Alterado por",
};

export const FONTES_SOLAR = {
  a_confirmar: "A confirmar com a Sustentabilidade",
  inversor: "Portal do inversor",
  planilha: "Planilha mensal",
  fatura_geradora: "Fatura da unidade geradora",
} as const;

export const INTERVALOS_DIARIO = {
  30: "30 minutos",
  60: "1 hora",
  240: "4 horas",
} as const;

export const DIAS_DA_SEMANA = [
  [1, "Segunda"],
  [2, "Terça"],
  [3, "Quarta"],
  [4, "Quinta"],
  [5, "Sexta"],
  [6, "Sábado"],
  [7, "Domingo"],
] as const;

// ---------------------------------------------------------------------------
// Peças da validação (o formulário manda texto; listas vão como JSON)
// ---------------------------------------------------------------------------

/** "1.234,56" ou "1234.56" → número, dentro da faixa e com até 2 casas. */
function decimal(min: number, max: number, { minExclusivo = false } = {}) {
  return z.preprocess(
    (v) => (typeof v === "string" ? lerValorBr(v) : v),
    z
      .number("informe um número")
      .refine((n) => (minExclusivo ? n > min : n >= min), {
        message: minExclusivo ? `maior que ${min}` : `a partir de ${min}`,
      })
      .max(max, `até ${max}`)
      .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, {
        message: "até 2 casas decimais",
      }),
  );
}

const inteiro = (min: number, max: number) =>
  z.coerce
    .number("informe um número inteiro")
    .int("número inteiro")
    .min(min, `a partir de ${min}`)
    .max(max, `até ${max}`);

const texto = (max: number) =>
  z.string().trim().min(1, "obrigatório").max(max, `até ${max} caracteres`);

const json = z.string().transform((v, ctx) => {
  try {
    return JSON.parse(v) as unknown;
  } catch {
    ctx.addIssue({ code: "custom", message: "lista inválida" });
    return z.NEVER;
  }
});

/** Lista de textos (JSON do campo oculto): sem vazios nem repetidos. */
const listaDeTextos = (max: number, item: z.ZodString) =>
  json.pipe(
    z
      .array(item)
      .transform((l) => [...new Set(l.map((s) => s.trim()).filter(Boolean))])
      .pipe(z.array(z.string()).min(1, "deixe ao menos um item").max(max)),
  );

const blocos = listaDeTextos(
  40,
  z
    .string()
    .trim()
    .regex(/^\d{2}$/, "bloco com 2 dígitos (ex.: 05)"),
);

// ---------------------------------------------------------------------------
// Um esquema por grupo (só as colunas daquele grupo)
// ---------------------------------------------------------------------------

export const ESQUEMAS = {
  agua: z.object({
    agua_limite_m3: decimal(0, 99_999_999.99, { minExclusivo: true }),
    agua_tolerancia: decimal(0, 99_999_999.99),
    agua_blocos: blocos,
    agua_parceiro: texto(120),
    agua_variacao_pct: decimal(0, 9_999.99, { minExclusivo: true }),
    agua_variacao_meses: inteiro(1, 12),
    agua_variacao_min_m3: decimal(0, 99_999_999.99),
    agua_modelo: json.pipe(
      z
        .record(z.string().max(40), z.string().trim().max(80))
        .transform((m) =>
          Object.fromEntries(Object.entries(m).filter(([, v]) => v !== "")),
        ),
    ),
  }),
  termo: z.object({
    termo_razao_social: texto(200),
    termo_cnpj: texto(18).refine(cnpjValido, "CNPJ inválido"),
    termo_endereco: texto(300),
    termo_cidade: texto(80),
    termo_qualificacao_cpf: texto(200),
    termo_qualificacao_cnpj: texto(200),
    termo_nome_arquivo: texto(200),
  }),
  quadros: z.object({
    energia_disjuntores: listaDeTextos(40, z.string().max(60)),
    energia_ligacoes: listaDeTextos(10, z.string().max(40)),
    energia_medidor_situacoes: listaDeTextos(30, z.string().max(60)),
  }),
  contas: z.object({
    energia_alerta_pct: decimal(0, 9_999.99, { minExclusivo: true }),
    solar_fonte: z.enum(
      ["a_confirmar", "inversor", "planilha", "fatura_geradora"],
      "escolha da lista",
    ),
  }),
  limpeza: z
    .object({
      limpeza_empresa: texto(120),
      limpeza_func_base: inteiro(1, 999),
      limpeza_func_area_comum: inteiro(0, 999),
      limpeza_func_rateados: inteiro(0, 999),
      limpeza_blocos: blocos,
      limpeza_dia_util_envio: inteiro(1, 20),
      limpeza_extras_padrao: json.pipe(
        z
          .array(
            z.object({
              descricao: z.string().trim().min(1, "descreva o extra").max(200),
              valor_dia: z.preprocess(
                (v) => (typeof v === "string" ? lerValorBr(v) : v),
                z
                  .number("valor do extra inválido")
                  .nonnegative("valor do extra não pode ser negativo")
                  .max(99_999_999.99),
              ),
            }),
          )
          .max(40, "até 40 extras"),
      ),
    })
    .refine(
      (l) =>
        l.limpeza_func_area_comum + l.limpeza_func_rateados <=
        l.limpeza_func_base,
      {
        message:
          "área comum + rateados não pode passar dos funcionários da base",
        path: ["limpeza_func_rateados"],
      },
    ),
  obras: z.object({
    obras_intervalo_min: z.coerce
      .number()
      .refine((n) => n in INTERVALOS_DIARIO, "escolha da lista"),
    obras_dias_relatorio: z
      .array(z.coerce.number().int().min(1).max(7))
      .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
    obras_limite_desvio: decimal(-9_999.99, 9_999.99),
    obras_limite_orcamento_pct: decimal(0, 9_999.99),
  }),
} as const;

export type DadosDoGrupo<G extends Grupo> = z.infer<(typeof ESQUEMAS)[G]>;

// Toda coluna de operacoes.parametros tem lugar num grupo: coluna nova (de
// qualquer migration) sem campo aqui quebra o typecheck.
type Colunas = Exclude<
  keyof Database["operacoes"]["Tables"]["parametros"]["Row"],
  "id" | "atualizado_em" | "atualizado_por"
>;
type NosGrupos = { [G in Grupo]: keyof DadosDoGrupo<G> }[Grupo];
export const TODAS_AS_COLUNAS: [Exclude<Colunas, NosGrupos>] extends [never]
  ? true
  : Exclude<Colunas, NosGrupos> = true;

/** Colunas de cada grupo (para saber o que o histórico mostra em cada aba). */
export const COLUNAS_DO_GRUPO: Record<Grupo, string[]> = Object.fromEntries(
  (Object.keys(ESQUEMAS) as Grupo[]).map((g) => {
    return [g, Object.keys(ESQUEMAS[g].shape)];
  }),
) as Record<Grupo, string[]>;

/** Campos do formulário: checkboxes repetidos viram lista. */
export function camposDoForm(form: FormData): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v !== "string" || k.startsWith("$")) continue;
    if (k === "obras_dias_relatorio")
      campos[k] = [...((campos[k] as string[] | undefined) ?? []), v];
    else campos[k] = v;
  }
  if (form.get("grupo") === "obras" && !campos.obras_dias_relatorio)
    campos.obras_dias_relatorio = [];
  return campos;
}

// ---------------------------------------------------------------------------
// Histórico: o que mudou, com o rótulo do campo
// ---------------------------------------------------------------------------

function valorLegivel(campo: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  if (campo === "solar_fonte" && typeof v === "string")
    return FONTES_SOLAR[v as keyof typeof FONTES_SOLAR] ?? v;
  if (campo === "obras_dias_relatorio" && Array.isArray(v))
    return v
      .map((d) => DIAS_DA_SEMANA.find(([n]) => n === d)?.[1] ?? String(d))
      .join(", ");
  if (campo === "obras_intervalo_min")
    return (
      INTERVALOS_DIARIO[Number(v) as keyof typeof INTERVALOS_DIARIO] ??
      String(v)
    );
  if (campo === "limpeza_extras_padrao" && Array.isArray(v))
    return v
      .map((e) =>
        e && typeof e === "object"
          ? `${(e as { descricao?: string }).descricao ?? "?"}: ${String((e as { valor_dia?: unknown }).valor_dia ?? "")}`
          : String(e),
      )
      .join("; ");
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") {
    const pares = Object.entries(v as Record<string, unknown>);
    return pares.length
      ? pares.map(([k, x]) => `${k}: ${String(x)}`).join("; ")
      : "vazio";
  }
  if (typeof v === "boolean") return v ? "sim" : "não";
  return String(v);
}

const NAO_MOSTRAR = new Set(["atualizado_em", "atualizado_por", "id"]);

/** Campos que mudaram entre o antes e o depois, com rótulo e valor legível. */
export function mudancasDosParametros(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): { campo: string; rotulo: string; antes: string; depois: string }[] {
  const campos = [
    ...new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]),
  ].filter((c) => !NAO_MOSTRAR.has(c));
  return campos
    .filter(
      (c) =>
        JSON.stringify(antes?.[c] ?? null) !==
        JSON.stringify(depois?.[c] ?? null),
    )
    .map((c) => ({
      campo: c,
      rotulo: ROTULOS_PARAMETROS[c] ?? c,
      antes: valorLegivel(c, antes?.[c]),
      depois: valorLegivel(c, depois?.[c]),
    }));
}

// ---------------------------------------------------------------------------
// Energia: unidades consumidoras (matrícula, endereço, apelido)
// ---------------------------------------------------------------------------

export const PAPEIS_UNIDADE = {
  consome: "Consome (recebe crédito)",
  gera: "Gera",
  gera_e_consome: "Gera e consome",
} as const;

const opcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max, `até ${max} caracteres`).nullable(),
  );

export const esquemaUnidade = z.object({
  matricula: z
    .string()
    .trim()
    .transform((m) => m.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{6,12}$/, "de 6 a 12 dígitos")),
  endereco: opcional(200),
  apelido: opcional(80),
  papel: z.enum(["consome", "gera", "gera_e_consome"], "escolha da lista"),
  ativa: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const ROTULOS_UNIDADE: Record<string, string> = {
  matricula: "Matrícula",
  endereco: "Endereço",
  apelido: "Apelido",
  papel: "Papel",
};
