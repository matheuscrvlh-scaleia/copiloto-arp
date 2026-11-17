import { z } from "zod";
import { INDICADORES_RH } from "../../indicadores";
import { GRUPOS_CLASSIFICAVEIS } from "../rubricas";
import { dadosFinanceiros } from "./custo";
import { departamentoDoRh } from "./parametros";

// Configurações › Cadastros (faturamento, departamentos e rubricas, com
// rh.parametros) e as gravações de Configurações › Parâmetros. Mesmas regras
// e mensagens do antigo; o service põe o rótulo do campo no erro.

/** GET /rh/cadastros */
export const respostaCadastros = z.object({
  financeiros: z.array(dadosFinanceiros),
  departamentos: z.array(departamentoDoRh),
  rubricas: z.array(
    z.object({ codigo: z.number(), descricao: z.string(), grupo: z.string() }),
  ),
});
export type RespostaCadastros = z.infer<typeof respostaCadastros>;

export const entradaDepartamento = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(1, "informe o nome"),
  codigo_folha: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : Number(v)),
    z.number().int().positive().nullable(),
  ),
});

export const entradaGrupoRubrica = z.object({
  codigo: z.coerce.number().int().positive("escolha a rubrica"),
  grupo: z.enum(GRUPOS_CLASSIFICAVEIS, "escolha o grupo"),
});

// ---------------------------------------------------------------------------
// Parâmetros
// ---------------------------------------------------------------------------

/** "1,5" ou "1.5" → 1.5; vazio → undefined. Parâmetros são números pequenos: sem milhar. */
const decimal = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : Number(s.replace(",", "."));
}, z.number().finite().optional());

const obrigatorio = (schema: z.ZodType<number | undefined>) =>
  schema.refine((v) => v !== undefined, "obrigatório");

/** "empresa" ou "departamento:<id>", "cargo:<id>", "colaborador:<id>". */
export const alvoJornada = z.string().transform((v, ctx) => {
  const ids: {
    departamento_id: string | null;
    cargo_id: string | null;
    colaborador_id: string | null;
  } = { departamento_id: null, cargo_id: null, colaborador_id: null };
  if (v === "empresa") return ids;
  const [nivel, id] = v.split(":");
  if (!id || !z.uuid().safeParse(id).success) {
    ctx.addIssue({ code: "custom", message: "escolha para quem vale" });
    return z.NEVER;
  }
  if (nivel === "departamento") return { ...ids, departamento_id: id };
  if (nivel === "cargo") return { ...ids, cargo_id: id };
  if (nivel === "colaborador") return { ...ids, colaborador_id: id };
  ctx.addIssue({ code: "custom", message: "escolha para quem vale" });
  return z.NEVER;
});

export const entradaJornada = z.object({
  alvo: alvoJornada,
  // Teto físico do mês (31 dias × 24 h), não uma regra de negócio.
  horas: obrigatorio(decimal).refine(
    (v) => v === undefined || (v > 0 && v <= 744),
    "entre 0 e 744 horas",
  ),
});

export const entradaRemoverJornada = z.object({ alvo: z.string().max(100) });

const indicadores = Object.keys(INDICADORES_RH) as [
  keyof typeof INDICADORES_RH,
];

export const entradaMeta = z
  .object({
    indicador: z.enum(indicadores),
    meta: obrigatorio(decimal),
    limite_atencao: decimal,
  })
  .refine(
    (m) => {
      if (m.limite_atencao === undefined || m.meta === undefined) return true;
      return INDICADORES_RH[m.indicador].direcao === "menor_melhor"
        ? m.limite_atencao >= m.meta
        : m.limite_atencao <= m.meta;
    },
    {
      message: "a faixa de atenção precisa ficar depois da meta",
      path: ["limite_atencao"],
    },
  );

export const entradaEmpresa = z
  .object({
    regime_tributario: z.string().trim().optional(),
    rat_pct: obrigatorio(decimal).refine(
      (v) => v === undefined || (v >= 0 && v <= 3),
      "entre 0 e 3",
    ),
    fap: obrigatorio(decimal).refine(
      (v) => v === undefined || (v >= 0.5 && v <= 2),
      "entre 0,5 e 2,0",
    ),
    banco_horas_inicio: z.iso.date({ message: "informe o início do ciclo" }),
    banco_horas_fim: z.iso.date({ message: "informe o fim do ciclo" }),
    banco_horas_adicional_pct: obrigatorio(decimal).refine(
      (v) => v === undefined || v >= 0,
      "não pode ser negativo",
    ),
  })
  .refine((e) => e.banco_horas_fim > e.banco_horas_inicio, {
    message: "o fim do ciclo precisa ser depois do início",
    path: ["banco_horas_fim"],
  });

const pct = obrigatorio(decimal).refine(
  (v) => v === undefined || (v >= 0 && v <= 100),
  "entre 0 e 100",
);
const marcado = z.preprocess((v) => v === "on", z.boolean());

const comEncargos = z.object({
  inss_patronal_pct: pct,
  terceiros_pct: pct,
  fgts_pct: pct,
  multa_rescisoria_pct: pct,
  aplica_rat: marcado,
  provisiona_13: marcado,
  provisiona_ferias: marcado,
});

// Estagiário e PJ não têm encargos: a tela só mostra as provisões deles, e
// os campos que sumiram são gravados zerados. Pró-labore não é editável (sócio
// fica fora do custo).
export const entradaEncargos = z.discriminatedUnion("tipo_contrato", [
  comEncargos.extend({ tipo_contrato: z.literal("clt") }),
  comEncargos.extend({ tipo_contrato: z.literal("aprendiz") }),
  z.object({
    tipo_contrato: z.literal("estagiario"),
    provisiona_recesso: marcado,
  }),
  z.object({
    tipo_contrato: z.literal("pj"),
    provisiona_13: marcado,
    provisiona_ferias: marcado,
  }),
]);

/**
 * Corpo de um formulário como a tela manda (texto; campo repetido vira
 * lista). Quem valida é o service, com o schema e a mensagem de antes.
 */
export const corpoDoFormulario = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);
export type CorpoDoFormulario = z.infer<typeof corpoDoFormulario>;
