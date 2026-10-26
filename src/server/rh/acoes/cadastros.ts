"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMes, lerValorBr } from "@/lib/formato";
import { GRUPOS_CLASSIFICAVEIS, GRUPOS_RUBRICA } from "@/lib/rh/rubricas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { pode, podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { recalcularEmAberto, tentarRecalcular } from "@/server/rh/custo";

// Cadastros manuais do RH. Toda gravação passa pelo RLS e cai em
// core.auditoria. O recálculo do custo usa a service role: quem o dispara é
// conferido com podeAgora. Departamentos, rubricas e o catálogo de
// benefícios ficam no cache do módulo (TAG.rh.*).

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar este cadastro.",
};

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
  updateTag(TAG.rh.departamentos);
  refresh();
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------
// Rubricas: trocar o grupo de uma rubrica já classificada.
// ---------------------------------------------------------------------------

const grupoDaRubrica = z.object({
  codigo: z.coerce.number().int().positive("escolha a rubrica"),
  grupo: z.enum(GRUPOS_CLASSIFICAVEIS, "escolha o grupo"),
});

/** Troca o grupo e recalcula as folhas em aberto (fechada não muda). */
export async function trocarGrupoRubrica(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.parametros"))) return SEM_PERMISSAO;
  const r = grupoDaRubrica.safeParse(Object.fromEntries(form));
  if (!r.success)
    return primeiroErro(r.error, { codigo: "Rubrica", grupo: "Grupo" });
  const usuario = await usuarioAtual();
  const { data, error } = await (await createClient())
    .schema("rh")
    .from("rubricas")
    .update({
      grupo: r.data.grupo,
      classificada_por: usuario.id,
      classificada_em: new Date().toISOString(),
    })
    .eq("codigo", r.data.codigo)
    .select("codigo");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { erro: "Rubrica não encontrada." };
  updateTag(TAG.rh.rubricas);
  const calculado = await tentarRecalcular(recalcularEmAberto);
  refresh();
  const ok = `Rubrica ${r.data.codigo} agora em “${GRUPOS_RUBRICA[r.data.grupo]}”.`;
  return calculado
    ? { ok: `${ok} Folhas em aberto recalculadas.` }
    : {
        ok: `${ok} O custo não foi recalculado: use Recalcular em Custo de pessoal.`,
      };
}

// ---------------------------------------------------------------------------
// Benefícios (rh.beneficios). Mudam o custo: recalcula as folhas em aberto.
// ---------------------------------------------------------------------------

const SEM_PERMISSAO_BENEFICIO: EstadoAcao = {
  erro: "Você não tem permissão para cadastrar benefícios.",
};

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

const beneficio = z
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
    rubricas_desconto: rubricas,
    rubricas_desconto_dependente: rubricas,
    dependente_regra: z.enum(["nao_paga", "percentual", "valor_fixo"]),
    dependente_valor: reais,
    ativo: z.preprocess((v) => v === "on", z.boolean()),
  })
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
      b.tipo === "plano_saude" ||
      b.tipo === "odonto",
    {
      message: "informe o valor (só plano e odonto saem da tabela de faixas)",
      path: ["valor_padrao"],
    },
  );

const ROTULOS_BENEFICIO = {
  nome: "Nome",
  valor_padrao: "Valor mensal",
  rubricas_desconto: "Rubricas do titular",
  rubricas_desconto_dependente: "Rubricas dos dependentes",
  dependente_valor: "Dependentes",
};

/** Grava e recalcula o custo; a mensagem diz se o recálculo deu certo. */
async function salvoERecalculado(ok: string): Promise<EstadoAcao> {
  const calculado = await tentarRecalcular(recalcularEmAberto);
  refresh();
  return { ok: calculado ? `${ok} Custo recalculado.` : ok };
}

export async function salvarBeneficio(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const b = beneficio.safeParse(Object.fromEntries(form));
  if (!b.success) return primeiroErro(b.error, ROTULOS_BENEFICIO);
  const { id, ...dados } = b.data;
  const registro = {
    ...dados,
    dependente_valor:
      dados.dependente_regra === "nao_paga" ? null : dados.dependente_valor,
  };
  const rh = (await createClient()).schema("rh");
  const { error } = id
    ? await rh.from("beneficios").update(registro).eq("id", id)
    : await rh.from("beneficios").insert(registro);
  if (error) return erroDoBanco(error);
  updateTag(TAG.rh.beneficios);
  return salvoERecalculado(id ? "Benefício salvo." : "Benefício cadastrado.");
}

const vinculo = z.object({
  beneficio_id: z.uuid(),
  colaborador_id: z.uuid("escolha o colaborador"),
  desde: z.iso.date({ message: "informe desde quando" }),
  valor_manual: reais,
});

export async function vincularBeneficio(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const v = vinculo.safeParse(Object.fromEntries(form));
  if (!v.success)
    return primeiroErro(v.error, {
      colaborador_id: "Colaborador",
      desde: "Desde",
      valor_manual: "Valor manual",
    });
  const rh = (await createClient()).schema("rh");
  const { count } = await rh
    .from("colaborador_beneficios")
    .select("id", { count: "exact", head: true })
    .eq("beneficio_id", v.data.beneficio_id)
    .eq("colaborador_id", v.data.colaborador_id)
    .is("ate", null);
  if (count) return { erro: "Este colaborador já recebe o benefício." };
  const { error } = await rh.from("colaborador_beneficios").insert(v.data);
  if (error) return erroDoBanco(error);
  return salvoERecalculado("Vinculado.");
}

const vinculoContrato = z.object({
  beneficio_id: z.uuid(),
  tipo_contrato: z.enum(
    ["clt", "aprendiz", "estagiario", "pj"],
    "escolha o tipo de contrato",
  ),
  desde: z.iso.date({ message: "informe desde quando" }),
});

/**
 * Todos com o tipo de contrato recebem o benefício, inclusive quem for
 * admitido depois. Quem já tem o benefício vinculado à pessoa fica com o dela.
 */
export async function vincularContrato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const v = vinculoContrato.safeParse(Object.fromEntries(form));
  if (!v.success)
    return primeiroErro(v.error, {
      tipo_contrato: "Tipo de contrato",
      desde: "Desde",
    });
  const rh = (await createClient()).schema("rh");
  const { count } = await rh
    .from("beneficio_contratos")
    .select("id", { count: "exact", head: true })
    .eq("beneficio_id", v.data.beneficio_id)
    .eq("tipo_contrato", v.data.tipo_contrato)
    .is("ate", null);
  if (count) return { erro: "Este tipo de contrato já recebe o benefício." };
  const { error } = await rh.from("beneficio_contratos").insert(v.data);
  if (error) return erroDoBanco(error);
  return salvoERecalculado("Vinculado ao tipo de contrato.");
}

export async function removerVinculoContrato(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Vínculo inválido." };
  const { error } = await (await createClient())
    .schema("rh")
    .from("beneficio_contratos")
    .delete()
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  return salvoERecalculado("Removido.");
}

const valorManual = z.object({ id: z.uuid(), valor_manual: reais });

/** Valor manual de quem já recebe; vazio volta para a faixa (ou o padrão). */
export async function salvarValorManual(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const v = valorManual.safeParse(Object.fromEntries(form));
  if (!v.success)
    return primeiroErro(v.error, { valor_manual: "Valor manual" });
  const { error } = await (await createClient())
    .schema("rh")
    .from("colaborador_beneficios")
    .update({ valor_manual: v.data.valor_manual })
    .eq("id", v.data.id);
  if (error) return erroDoBanco(error);
  return salvoERecalculado(
    v.data.valor_manual === null
      ? "Valor manual removido."
      : "Valor manual salvo.",
  );
}

export async function removerVinculo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Vínculo inválido." };
  const { error } = await (await createClient())
    .schema("rh")
    .from("colaborador_beneficios")
    .delete()
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  return salvoERecalculado("Removido.");
}

/**
 * Vincula quem tem desconto deste benefício na última folha (ex.: 307 do
 * plano), a partir do mês dessa folha. Lê só quem tem a rubrica, nunca o
 * valor; a leitura usa a service role porque a folha individual exige
 * rh.custo_pessoal.individual, e a gravação segue pelo RLS.
 */
export async function vincularPelaFolha(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const id = z.uuid().safeParse(form.get("beneficio_id"));
  if (!id.success) return { erro: "Benefício inválido." };
  const rh = (await createClient()).schema("rh");
  const admin = createAdminClient().schema("rh");
  // O benefício, a última folha e quem já recebe não dependem um do outro.
  const [{ data: b }, { data: folha }, { data: atuais }] = await Promise.all([
    rh
      .from("beneficios")
      .select("rubricas_desconto")
      .eq("id", id.data)
      .maybeSingle(),
    admin
      .from("folhas")
      .select("id, competencia")
      .order("competencia", { ascending: false })
      .limit(1)
      .maybeSingle(),
    rh
      .from("colaborador_beneficios")
      .select("colaborador_id")
      .eq("beneficio_id", id.data)
      .is("ate", null),
  ]);
  if (!b?.rubricas_desconto.length)
    return { erro: "Informe antes as rubricas de desconto do titular." };
  if (!folha) return { erro: "Nenhuma folha importada ainda." };
  const { data: comDesconto, error: erroFolha } = await admin
    .from("folha_rubricas")
    .select("colaborador_id")
    .eq("folha_id", folha.id)
    .in("rubrica_codigo", b.rubricas_desconto);
  if (erroFolha) return { erro: "Não consegui ler a folha. Tente de novo." };

  const jaTem = new Set((atuais ?? []).map((v) => v.colaborador_id));
  const novos = [
    ...new Set((comDesconto ?? []).map((r) => r.colaborador_id)),
  ].filter((c) => !jaTem.has(c));
  if (!novos.length)
    return {
      ok: `Todos com desconto na folha de ${formatarMes(folha.competencia)} já estão vinculados.`,
    };
  const { error } = await rh.from("colaborador_beneficios").insert(
    novos.map((colaborador_id) => ({
      beneficio_id: id.data,
      colaborador_id,
      desde: folha.competencia,
    })),
  );
  if (error) return erroDoBanco(error);
  return salvoERecalculado(
    `${novos.length} ${novos.length > 1 ? "pessoas vinculadas" : "pessoa vinculada"} pela folha de ${formatarMes(folha.competencia)}.`,
  );
}

// ---------------------------------------------------------------------------
// Faturamento e dados financeiros do mês (manual até o ENET).
// ---------------------------------------------------------------------------

const financeiro = z.object({
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "informe o mês"),
  faturamento_bruto: reais,
  custo_despesa_total: reais,
  custos_operacionais_sem_pessoal: reais,
  lucro: z.preprocess(
    (v) => lerValorBr(String(v ?? "")),
    z.number("valor inválido").nullable(),
  ),
  endomarketing: reais,
});

export async function salvarFinanceiro(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await pode("rh.parametros"))) return SEM_PERMISSAO;
  const f = financeiro.safeParse(Object.fromEntries(form));
  if (!f.success)
    return primeiroErro(f.error, {
      competencia: "Mês",
      faturamento_bruto: "Faturamento bruto",
      custo_despesa_total: "Custo + despesa total",
      custos_operacionais_sem_pessoal: "Custos sem pessoal",
      lucro: "Lucro",
      endomarketing: "Endomarketing",
    });
  const { error } = await (await createClient())
    .schema("rh")
    .from("dados_financeiros_mensais")
    .upsert(
      { ...f.data, competencia: `${f.data.competencia}-01`, origem: "manual" },
      { onConflict: "competencia" },
    );
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: `Dados de ${formatarMes(`${f.data.competencia}-01`)} salvos.` };
}
