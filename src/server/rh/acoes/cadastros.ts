"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { rotaDoBeneficio } from "@/config/navigation";
import {
  fimDoMes,
  formatarMes,
  formatarNumero,
  lerValorBr,
} from "@/lib/formato";
import { ErroPlanilha } from "@/lib/rh/plano";
import { GRUPOS_CLASSIFICAVEIS, GRUPOS_RUBRICA } from "@/lib/rh/rubricas";
import { casarPorNome } from "@/lib/rh/valores-mensais";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { pode, podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { ehXlsx, lerPlanilhaDeValores } from "@/server/rh/beneficios";
import { recalcularEmAberto, tentarRecalcular } from "@/server/rh/custo";
import { TAMANHO_MAXIMO } from "@/server/rh/folha";
import { lerTudo } from "@/server/supabase-paginas";

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
    valor_por_mes: z.preprocess((v) => v === "on", z.boolean()),
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
      b.valor_por_mes ||
      b.tipo === "plano_saude" ||
      b.tipo === "odonto",
    {
      message:
        "informe o valor ou marque “Valor varia por mês” (só plano e odonto saem da tabela de faixas)",
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
    // Valor por mês: o valor sai dos lançamentos, não de um padrão.
    valor_padrao: dados.valor_por_mes ? null : dados.valor_padrao,
    dependente_valor:
      dados.dependente_regra === "nao_paga" ? null : dados.dependente_valor,
  };
  const rh = (await createClient()).schema("rh");
  if (id) {
    const { error } = await rh.from("beneficios").update(registro).eq("id", id);
    if (error) return erroDoBanco(error);
    updateTag(TAG.rh.beneficios);
    return salvoERecalculado("Benefício salvo.");
  }
  // Novo: abre a página dele, para vincular quem recebe.
  const { data, error } = await rh
    .from("beneficios")
    .insert(registro)
    .select("id")
    .single();
  if (error) return erroDoBanco(error);
  updateTag(TAG.rh.beneficios);
  redirect(rotaDoBeneficio(data.id));
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
  const [{ data: b }, { data: folha }, atuais] = await Promise.all([
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
    // Quem já recebe e quem tem o desconto crescem com o quadro: de mil em mil.
    lerTudo(() =>
      rh
        .from("colaborador_beneficios")
        .select("colaborador_id")
        .eq("beneficio_id", id.data)
        .is("ate", null)
        .order("id"),
    ).catch(() => null),
  ]);
  if (!atuais) return { erro: "Não consegui ler os vínculos. Tente de novo." };
  if (!b?.rubricas_desconto.length)
    return { erro: "Informe antes as rubricas de desconto do titular." };
  if (!folha) return { erro: "Nenhuma folha importada ainda." };
  const comDesconto = await lerTudo(() =>
    admin
      .from("folha_rubricas")
      .select("colaborador_id")
      .eq("folha_id", folha.id)
      .in("rubrica_codigo", b.rubricas_desconto)
      .order("id"),
  ).catch(() => null);
  if (!comDesconto) return { erro: "Não consegui ler a folha. Tente de novo." };

  const jaTem = new Set(atuais.map((v) => v.colaborador_id));
  const novos = [...new Set(comDesconto.map((r) => r.colaborador_id))].filter(
    (c) => !jaTem.has(c),
  );
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
// Valores do mês dos benefícios que variam por mês
// (rh.beneficio_valores_mensais). Cada competência é um lançamento à parte:
// gravar um mês não mexe nos anteriores, e só o custo daquele mês em diante
// é recalculado. Valor de cada pessoa: lido com a sessão, sem cache.
// ---------------------------------------------------------------------------

const valoresDoMes = z.object({
  beneficio_id: z.uuid(),
  // <input type="month">: "2026-07"
  competencia: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "informe o mês"),
});

/**
 * Benefício que varia por mês e quem o recebe na competência: os vinculados
 * à pessoa e quem tem um tipo de contrato vinculado (como o custo calcula).
 * Null se o benefício não varia por mês.
 */
async function quemRecebeNoMes(beneficioId: string, competencia: string) {
  const rh = (await createClient()).schema("rh");
  const fim = fimDoMes(competencia);
  const noMes = `ate.is.null,ate.gte.${competencia}`;
  const [beneficio, pessoais, contratos] = await Promise.all([
    rh
      .from("beneficios")
      .select("nome, valor_por_mes")
      .eq("id", beneficioId)
      .maybeSingle(),
    lerTudo(() =>
      rh
        .from("colaborador_beneficios")
        .select("colaborador_id, colaborador:colaboradores(nome)")
        .eq("beneficio_id", beneficioId)
        .lte("desde", fim)
        .or(noMes)
        .order("id"),
    ),
    rh
      .from("beneficio_contratos")
      .select("tipo_contrato")
      .eq("beneficio_id", beneficioId)
      .lte("desde", fim)
      .or(noMes),
  ]);
  if (beneficio.error || contratos.error)
    throw new Error("Falha ao ler o benefício");
  if (!beneficio.data?.valor_por_mes) return null;
  const tipos = [
    ...new Set((contratos.data ?? []).map((c) => c.tipo_contrato)),
  ];
  const doContrato = tipos.length
    ? (
        await lerTudo(() =>
          rh
            .from("colaboradores")
            .select("id, nome, admissao, desligamento")
            .in("tipo_contrato", tipos)
            .order("id"),
        )
      ).filter(
        (c) =>
          (!c.admissao || c.admissao <= fim) &&
          (!c.desligamento || c.desligamento >= competencia),
      )
    : [];
  const pessoas = new Map<string, string>();
  for (const c of doContrato) pessoas.set(c.id, c.nome);
  for (const v of pessoais)
    pessoas.set(v.colaborador_id, v.colaborador?.nome ?? "");
  return {
    nome: beneficio.data.nome,
    pessoas: [...pessoas].map(([colaborador_id, nome]) => ({
      colaborador_id,
      nome,
    })),
  };
}

async function gravadoERecalculado(
  ok: string,
  competencia: string,
): Promise<EstadoAcao> {
  const calculado = await tentarRecalcular(() =>
    recalcularEmAberto(competencia),
  );
  refresh();
  return { ok: calculado ? `${ok} Custo recalculado.` : ok };
}

const SEM_LEITURA: EstadoAcao = {
  erro: "Não consegui ler quem recebe o benefício. Tente de novo.",
};

/** Grava os valores digitados do mês; campo vazio apaga o lançamento. */
export async function salvarValoresDoMes(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const d = valoresDoMes.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { competencia: "Mês" });
  const competencia = `${d.data.competencia}-01`;
  const recebem = await quemRecebeNoMes(d.data.beneficio_id, competencia).catch(
    () => undefined,
  );
  if (recebem === undefined) return SEM_LEITURA;
  if (!recebem) return { erro: "Este benefício não varia por mês." };
  const nomes = new Map(recebem.pessoas.map((p) => [p.colaborador_id, p.nome]));

  const ids = form.getAll("colaborador_id").map(String);
  const textos = form.getAll("valor").map(String);
  const gravar: { colaborador_id: string; valor: number }[] = [];
  const apagar: string[] = [];
  for (const [i, id] of ids.entries()) {
    if (!nomes.has(id)) continue;
    const valor = lerValorBr(textos[i] ?? "");
    if (valor === null) apagar.push(id);
    else if (Number.isNaN(valor) || valor < 0)
      return { erro: `Valor inválido para ${nomes.get(id)}.` };
    else gravar.push({ colaborador_id: id, valor });
  }

  const rh = (await createClient()).schema("rh");
  if (gravar.length) {
    const { error } = await rh.from("beneficio_valores_mensais").upsert(
      gravar.map((g) => ({
        ...g,
        beneficio_id: d.data.beneficio_id,
        competencia,
      })),
      { onConflict: "beneficio_id,colaborador_id,competencia" },
    );
    if (error) return erroDoBanco(error);
  }
  if (apagar.length) {
    const { error } = await rh
      .from("beneficio_valores_mensais")
      .delete()
      .eq("beneficio_id", d.data.beneficio_id)
      .eq("competencia", competencia)
      .in("colaborador_id", apagar);
    if (error) return erroDoBanco(error);
  }
  return gravadoERecalculado(
    `Valores de ${formatarMes(competencia)} salvos (${gravar.length} ${gravar.length === 1 ? "pessoa" : "pessoas"}).`,
    competencia,
  );
}

/**
 * Planilha com CPF, nome e valor → valores do mês. O CPF não é gravado nem
 * usado (o banco não tem CPF): cada linha vale pela pessoa de mesmo nome
 * entre quem recebe o benefício no mês. O arquivo não é guardado.
 */
export async function importarValoresDoMes(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.beneficios"))) return SEM_PERMISSAO_BENEFICIO;
  const d = valoresDoMes.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { competencia: "Mês" });
  const competencia = `${d.data.competencia}-01`;

  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha a planilha (.xlsx) com CPF, nome e valor." };
  if (arquivo.size > TAMANHO_MAXIMO)
    return { erro: "O arquivo passa de 10 MB." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!ehXlsx(bytes))
    return { erro: "O arquivo não é uma planilha .xlsx do Excel." };

  let planilha: Awaited<ReturnType<typeof lerPlanilhaDeValores>>;
  try {
    planilha = await lerPlanilhaDeValores(bytes);
  } catch (e) {
    if (e instanceof ErroPlanilha) return { erro: e.message };
    console.error("leitura dos valores do mês", e);
    return { erro: "Não consegui ler a planilha. Confira o arquivo." };
  }

  const recebem = await quemRecebeNoMes(d.data.beneficio_id, competencia).catch(
    () => undefined,
  );
  if (recebem === undefined) return SEM_LEITURA;
  if (!recebem) return { erro: "Este benefício não varia por mês." };
  const casados = casarPorNome(planilha.linhas, recebem.pessoas);
  if (casados.valores.size === 0)
    return {
      erro: `Nenhum nome da planilha é de quem recebe ${recebem.nome} em ${formatarMes(competencia)}.`,
    };

  const { error } = await (await createClient())
    .schema("rh")
    .from("beneficio_valores_mensais")
    .upsert(
      [...casados.valores].map(([colaborador_id, valor]) => ({
        beneficio_id: d.data.beneficio_id,
        colaborador_id,
        competencia,
        valor,
      })),
      { onConflict: "beneficio_id,colaborador_id,competencia" },
    );
  if (error) return erroDoBanco(error);

  const total = [...casados.valores.values()].reduce((s, v) => s + v, 0);
  return gravadoERecalculado(
    [
      `${casados.valores.size} ${casados.valores.size === 1 ? "valor importado" : "valores importados"} em ${formatarMes(competencia)} (total R$ ${formatarNumero(total, 2)}).`,
      casados.naoEncontrados.length
        ? `Fora de quem recebe o benefício no mês: ${casados.naoEncontrados.join(", ")}.`
        : "",
      ...planilha.avisos,
      ...casados.avisos,
    ]
      .filter(Boolean)
      .join(" "),
    competencia,
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
