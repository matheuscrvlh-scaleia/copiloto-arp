"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { competenciaDe } from "@/lib/formato";
import { INDICADORES_RH } from "@/lib/indicadores";
import { TIPOS_TURNOVER } from "@/lib/rh/turnover";
import { createClient } from "@/lib/supabase/server";
import { pode } from "@/server/auth";
import { recalcularEmAberto, tentarRecalcular } from "@/server/rh/custo";

// Toda alteração passa pelo RLS (rh.parametros) e cai em core.auditoria.
// Parâmetros com vigência gravam a partir do mês atual: meses passados
// continuam calculados com o valor da época.

/** "1,5" ou "1.5" → 1.5; vazio → undefined. Parâmetros são números pequenos: sem milhar. */
const decimal = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : Number(s.replace(",", "."));
}, z.number().finite().optional());

const obrigatorio = (schema: z.ZodType<number | undefined>) =>
  schema.refine((v) => v !== undefined, "obrigatório");

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar parâmetros.",
};

function erroDoBanco(error: { message: string; code?: string }): EstadoAcao {
  if (error.code === "23505")
    return { erro: "Já existe outro registro com esse valor." };
  if (error.code === "23514") return { erro: "Valor fora do permitido." };
  return { erro: "Não foi possível salvar. Tente de novo." };
}

function primeiroErro(e: z.ZodError): EstadoAcao {
  const issue = e.issues[0];
  return {
    erro: `${issue?.path.join(".") || "Campo"}: ${issue?.message ?? "inválido"}`,
  };
}

// ---------------------------------------------------------------------------

const departamento = z.object({
  id: z.uuid(),
  nome: z.string().trim().min(1, "informe o nome"),
  codigo_folha: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : Number(v)),
    z.number().int().positive().nullable(),
  ),
});

export async function salvarDepartamento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.parametros"))) return SEM_PERMISSAO;
  const d = departamento.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const { error } = await (await createClient())
    .schema("rh")
    .from("departamentos")
    .update({ nome: d.data.nome, codigo_folha: d.data.codigo_folha })
    .eq("id", d.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------

const motivo = z.object({
  id: z.uuid(),
  tipo_turnover: z.preprocess(
    (v) => (v === "" ? null : v),
    z.enum(TIPOS_TURNOVER).nullable(),
  ),
});

export async function salvarMotivo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.parametros"))) return SEM_PERMISSAO;
  const m = motivo.safeParse(Object.fromEntries(form));
  if (!m.success) return primeiroErro(m.error);
  const { error } = await (await createClient())
    .schema("rh")
    .from("motivos_desligamento")
    .update({ tipo_turnover: m.data.tipo_turnover })
    .eq("id", m.data.id);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------

const indicadores = Object.keys(INDICADORES_RH) as [
  keyof typeof INDICADORES_RH,
];

const meta = z
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

export async function salvarMeta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.parametros"))) return SEM_PERMISSAO;
  const m = meta.safeParse(Object.fromEntries(form));
  if (!m.success) return primeiroErro(m.error);
  const { error } = await (await createClient())
    .schema("core")
    .from("metas")
    .upsert(
      {
        indicador: m.data.indicador,
        direcao: INDICADORES_RH[m.data.indicador].direcao,
        meta: m.data.meta as number,
        limite_atencao: m.data.limite_atencao ?? null,
        vigente_desde: competenciaDe(new Date()),
      },
      { onConflict: "indicador,vigente_desde" },
    );
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------

const empresa = z
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

export async function salvarEmpresa(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.parametros"))) return SEM_PERMISSAO;
  const e = empresa.safeParse(Object.fromEntries(form));
  if (!e.success) return primeiroErro(e.error);
  const { error } = await (await createClient())
    .schema("rh")
    .from("parametros_empresa")
    .upsert(
      {
        vigente_desde: competenciaDe(new Date()),
        regime_tributario: e.data.regime_tributario || null,
        rat_pct: e.data.rat_pct as number,
        fap: e.data.fap as number,
        banco_horas_inicio: e.data.banco_horas_inicio,
        banco_horas_fim: e.data.banco_horas_fim,
        banco_horas_adicional_pct: e.data.banco_horas_adicional_pct as number,
      },
      { onConflict: "vigente_desde" },
    );
  if (error) return erroDoBanco(error);
  return salvoERecalculado();
}

/** RAT/FAP e encargos mudam o custo: recalcula as folhas em aberto. */
async function salvoERecalculado(): Promise<EstadoAcao> {
  const ok = await tentarRecalcular(recalcularEmAberto);
  refresh();
  return ok
    ? { ok: "Salvo. Custo de pessoal recalculado." }
    : {
        ok: "Salvo, mas o custo não foi recalculado. Use Recalcular em Custo de pessoal.",
      };
}

// ---------------------------------------------------------------------------

const pct = obrigatorio(decimal).refine(
  (v) => v === undefined || (v >= 0 && v <= 100),
  "entre 0 e 100",
);
const marcado = z.preprocess((v) => v === "on", z.boolean());

const encargos = z.object({
  tipo_contrato: z.enum(["clt", "aprendiz", "estagiario", "pj", "pro_labore"]),
  inss_patronal_pct: pct,
  terceiros_pct: pct,
  fgts_pct: pct,
  multa_rescisoria_pct: pct,
  aplica_rat: marcado,
  provisiona_13: marcado,
  provisiona_ferias: marcado,
});

export async function salvarEncargos(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.parametros"))) return SEM_PERMISSAO;
  const e = encargos.safeParse(Object.fromEntries(form));
  if (!e.success) return primeiroErro(e.error);
  const { error } = await (await createClient())
    .schema("rh")
    .from("encargos_por_contrato")
    .upsert(
      {
        tipo_contrato: e.data.tipo_contrato,
        vigente_desde: competenciaDe(new Date()),
        inss_patronal_pct: e.data.inss_patronal_pct as number,
        terceiros_pct: e.data.terceiros_pct as number,
        fgts_pct: e.data.fgts_pct as number,
        multa_rescisoria_pct: e.data.multa_rescisoria_pct as number,
        aplica_rat: e.data.aplica_rat,
        provisiona_13: e.data.provisiona_13,
        provisiona_ferias: e.data.provisiona_ferias,
      },
      { onConflict: "tipo_contrato,vigente_desde" },
    );
  if (error) return erroDoBanco(error);
  return salvoERecalculado();
}
