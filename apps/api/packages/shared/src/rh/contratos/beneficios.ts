import { z } from "zod";
import { lerValorBr } from "../../formato";
import { departamentoDoRh } from "./parametros";

// Benefícios (rh.beneficios): o catálogo, quem recebe (pela pessoa e pelo
// tipo de contrato), os valores do mês, as tabelas do plano e os
// dependentes vindos do Copiloto RH.

export const beneficio = z.object({
  id: z.string(),
  nome: z.string(),
  tipo: z.enum([
    "plano_saude",
    "odonto",
    "alimentacao",
    "transporte",
    "seguro",
    "outro",
  ]),
  valor_padrao: z.number().nullable(),
  valor_por_mes: z.boolean(),
  rubricas_desconto: z.array(z.number()),
  rubricas_desconto_dependente: z.array(z.number()),
  dependente_regra: z.enum(["nao_paga", "percentual", "valor_fixo"]),
  dependente_valor: z.number().nullable(),
  ativo: z.boolean(),
  forma_calculo: z.enum(["por_funcionario", "rateado"]),
  dividir_entre: z.string().nullable(),
  dividir_departamento_id: z.string().nullable(),
});
export type Beneficio = z.infer<typeof beneficio>;

export const vinculo = z.object({
  id: z.string(),
  beneficio_id: z.string(),
  colaborador_id: z.string(),
  nome: z.string(),
  matricula: z.number().nullable(),
  /** Do cadastro (Copiloto RH): a faixa do plano sai da idade. */
  nascimento: z.string().nullable(),
  desde: z.string(),
  ate: z.string().nullable(),
  valor_manual: z.number().nullable(),
});
export type Vinculo = z.infer<typeof vinculo>;

export const vinculoContrato = z.object({
  id: z.string(),
  beneficio_id: z.string(),
  tipo_contrato: z.string(),
  desde: z.string(),
  ate: z.string().nullable(),
});
export type VinculoContrato = z.infer<typeof vinculoContrato>;

const faixa = z.object({
  idade_min: z.number(),
  idade_max: z.number().nullable(),
  mensalidade: z.number(),
});

export const tabelaCadastrada = z.object({
  id: z.string(),
  beneficio_id: z.string(),
  beneficio: z.string(),
  vigente_desde: z.string(),
  reajuste_pct: z.number().nullable(),
  faixas: z.array(faixa),
  regras: z.number(),
});
export type TabelaCadastrada = z.infer<typeof tabelaCadastrada>;

export const dependenteDoCopiloto = z.object({
  colaborador_id: z.string(),
  /** Nome do titular. */
  titular: z.string(),
  /** Do titular: decide se ele recebe o benefício dado ao contrato. */
  tipo_contrato: z.string().nullable(),
  nome: z.string(),
  nascimento: z.string().nullable(),
  parentesco: z.string().nullable(),
  tem_plano: z.boolean(),
  tem_odonto: z.boolean(),
});
export type DependenteDoCopiloto = z.infer<typeof dependenteDoCopiloto>;

/** GET /rh/beneficios: o que a lista e a página de cada benefício leem. */
export const respostaBeneficios = z.object({
  beneficios: z.array(beneficio),
  vinculos: z.array(vinculo),
  contratos: z.array(vinculoContrato),
  /** Quem pode receber: cadastro ainda sem desligamento. */
  colaboradores: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      matricula: z.number().nullable(),
      tipo_contrato: z.string().nullable(),
      admissao: z.string().nullable(),
      departamento_id: z.string().nullable(),
    }),
  ),
  tabelas: z.array(tabelaCadastrada),
  /** Valores lançados mês a mês dos benefícios que variam por mês. */
  lancados: z.array(
    z.object({
      beneficio_id: z.string(),
      colaborador_id: z.string(),
      competencia: z.string(),
      valor: z.number(),
    }),
  ),
  /** Total lançado mês a mês dos rateados que variam por mês. */
  totais: z.array(
    z.object({
      beneficio_id: z.string(),
      competencia: z.string(),
      valor: z.number(),
    }),
  ),
  departamentos: z.array(departamentoDoRh),
  /** Só lidos quando há plano ou odonto cadastrado. */
  dependentes: z.array(dependenteDoCopiloto),
  /** Competência mostrada (aaaa-mm-01): o mês de hoje. */
  mesAtual: z.string(),
  /** Vínculo novo começa no mês da última folha, para entrar no custo dela. */
  desdeSugerido: z.string().nullable(),
});
export type RespostaBeneficios = z.infer<typeof respostaBeneficios>;

// ---------------------------------------------------------------------------
// Entradas (os formulários mandam texto; mesmas regras e mensagens do antigo)
// ---------------------------------------------------------------------------

/** Valor em reais opcional: vazio → null. */
const reais = z.preprocess(
  (v) => lerValorBr(String(v ?? "")),
  z.number("valor inválido").min(0, "não pode ser negativo").nullable(),
);

/** "307, 8111" → [307, 8111]. */
const rubricas = z.preprocess(
  (v) =>
    String(v ?? "")
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map(Number),
  z.array(z.number().int("códigos inteiros").positive("códigos inteiros")),
);

const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "informe o mês");

export const entradaBeneficio = z
  .object({
    id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
    nome: z.string().trim().min(1, "informe o nome"),
    tipo: z.enum([
      "plano_saude",
      "odonto",
      "alimentacao",
      "transporte",
      "seguro",
      "outro",
    ]),
    valor_padrao: reais,
    valor_por_mes: z.preprocess((v) => v === "on", z.boolean()),
    rubricas_desconto: rubricas,
    rubricas_desconto_dependente: rubricas,
    dependente_regra: z.enum(["nao_paga", "percentual", "valor_fixo"]),
    dependente_valor: reais,
    ativo: z.preprocess((v) => v === "on", z.boolean()),
    forma_calculo: z
      .enum(["por_funcionario", "rateado"])
      .catch("por_funcionario"),
    dividir_entre: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.enum(["ativos", "ativos_nao_afastados", "departamento"]).nullable(),
    ),
    dividir_departamento_id: z.preprocess(
      (v) => (v === "" || v === undefined ? null : v),
      z.uuid("escolha o departamento").nullable(),
    ),
  })
  .refine((b) => b.forma_calculo !== "rateado" || b.dividir_entre !== null, {
    message: "escolha entre quem o valor é dividido",
    path: ["dividir_entre"],
  })
  .refine(
    (b) =>
      b.forma_calculo !== "rateado" ||
      b.dividir_entre !== "departamento" ||
      b.dividir_departamento_id !== null,
    { message: "escolha o departamento", path: ["dividir_departamento_id"] },
  )
  .refine(
    (b) => b.dependente_regra === "nao_paga" || b.dependente_valor !== null,
    {
      message: "informe quanto a empresa paga do dependente",
      path: ["dependente_valor"],
    },
  )
  .refine(
    (b) =>
      b.dependente_regra !== "percentual" || (b.dependente_valor ?? 0) <= 100,
    { message: "percentual até 100", path: ["dependente_valor"] },
  )
  .refine(
    (b) =>
      b.valor_padrao !== null ||
      b.valor_por_mes ||
      (b.forma_calculo !== "rateado" &&
        (b.tipo === "plano_saude" || b.tipo === "odonto")),
    {
      message:
        "informe o valor ou marque “Valor varia por mês” (só plano e odonto por funcionário saem da tabela de faixas)",
      path: ["valor_padrao"],
    },
  );

export const ROTULOS_BENEFICIO = {
  nome: "Nome",
  valor_padrao: "Valor mensal",
  rubricas_desconto: "Rubricas do titular",
  rubricas_desconto_dependente: "Rubricas dos dependentes",
  dependente_valor: "Dependentes",
  dividir_entre: "Dividir entre",
  dividir_departamento_id: "Departamento",
};

/** POST /rh/beneficios: o id do benefício criado (a tela abre a página dele). */
export const respostaBeneficioCriado = z.object({ id: z.string() });

export const entradaVinculo = z.object({
  beneficio_id: z.uuid(),
  colaborador_id: z.uuid("escolha o colaborador"),
  desde: z.iso.date({ message: "informe desde quando" }),
  valor_manual: reais,
});

export const entradaVinculoContrato = z.object({
  beneficio_id: z.uuid(),
  tipo_contrato: z.enum(
    ["clt", "aprendiz", "estagiario", "pj"],
    "escolha o tipo de contrato",
  ),
  desde: z.iso.date({ message: "informe desde quando" }),
});

export const entradaValorManual = z.object({
  id: z.uuid(),
  valor_manual: reais,
});

/** Valores do mês (e a planilha): o mês é o do <input type="month">. */
export const entradaValoresDoMes = z.object({
  beneficio_id: z.uuid(),
  competencia: mes,
});

export const entradaTotalDoMes = z.object({
  beneficio_id: z.uuid(),
  competencia: mes,
  valor: reais,
});

export const entradaFinanceiro = z.object({
  competencia: mes,
  faturamento_bruto: reais,
  custo_despesa_total: reais,
  custos_operacionais_sem_pessoal: reais,
  lucro: z.preprocess(
    (v) => lerValorBr(String(v ?? "")),
    z.number("valor inválido").nullable(),
  ),
});
