"use server";

import { refresh, updateTag } from "next/cache";
import type { EstadoAcao } from "@/components/form-acao";
import { createClient } from "@/lib/supabase/server";
import {
  CHAVES_COM_META,
  INDICADORES_DO_PAINEL,
  indicadorDaMeta,
  infoDoIndicador,
  MARCOS_DO_PAINEL,
} from "@/lib/sustentabilidade/painel-indicadores";
import {
  camposDoForm,
  diferencaDeLinhas,
  ESQUEMAS,
  ehGrupo,
  esquemaChamadoFixo,
  esquemaCustosDoTour,
  esquemaEquivalencias,
  esquemaMarcos,
  esquemaPrecosRcc,
  esquemaSetores,
  esquemaVigenciaRcc,
  GRUPOS,
  lerMetasDoForm,
  ROTULOS_PARAMETROS,
  temColunas,
} from "@/lib/sustentabilidade/painel-parametros";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { contextoSu, su } from "../base";
import { criarChamadoFixo } from "../chamados-fixos";
import { logarSustentabilidade } from "../parametros";

// Configurações › Parâmetros do Sustentabilidade (spec 4.11): cada aba salva
// só os campos dela, pelo RLS (sustentabilidade.parametros edita). Os gatilhos
// de auditoria guardam quem mudou, quando, o antes e o depois (o histórico da
// tela lê de lá). Toda gravação invalida a tag dos parâmetros.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar os parâmetros de Sustentabilidade.",
};

const ROTULOS_TABELAS: Record<string, string> = {
  setores: "Validade por setor",
  marcos: "Marcos",
  equivalencias: "Equivalências",
  vigencia: "Vigência",
  preco_a: "Preço da caçamba classe A",
  preco_b: "Preço da caçamba classe B",
  vigente_desde: "Vigente desde",
  toneladas_por_cacamba: "Toneladas por caçamba",
  volume_m3: "Volume da caçamba (m³)",
  ano: "Ano",
  tipo: "Chamado",
  responsavel: "Responsável",
};

async function exigir(): Promise<
  { ok: true; usuarioId: string } | { ok: false; estado: EstadoAcao }
> {
  const ctx = await contextoSu();
  if (!ctx.pode("sustentabilidade.parametros"))
    return { ok: false, estado: SEM_PERMISSAO };
  return { ok: true, usuarioId: ctx.usuario.id };
}

function concluir() {
  updateTag(TAG.sustentabilidade.parametros);
  refresh();
}

// ---------------------------------------------------------------------------
// Abas com colunas de sustentabilidade.parametros
// ---------------------------------------------------------------------------

export async function salvarParametros(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const grupo = form.get("grupo");
  if (!ehGrupo(grupo) || !temColunas(grupo))
    return { erro: "Aba de parâmetros inválida." };
  const campos = camposDoForm(form);
  const d = ESQUEMAS[grupo].safeParse(campos);
  if (!d.success) return primeiroErro(d.error, ROTULOS_PARAMETROS);

  // Custos do tour (aba Programas): tabela à parte, só com "Ver valores".
  let custos: { tour_custo_album: number; tour_custo_copo: number } | null =
    null;
  if (
    grupo === "programas" &&
    ("tour_custo_album" in campos || "tour_custo_copo" in campos)
  ) {
    if (!(await podeAgora("sustentabilidade.valores")))
      return {
        erro: "Os custos do tour só mudam com a permissão de ver valores.",
      };
    const c = esquemaCustosDoTour.safeParse(campos);
    if (!c.success) return primeiroErro(c.error, ROTULOS_PARAMETROS);
    custos = c.data;
  }

  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  const db = await su();
  const { data, error } = await db
    .from("parametros")
    .update({
      ...(d.data as Record<string, unknown>),
      atualizado_por: ctx.usuarioId,
    })
    .eq("id", true)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return SEM_PERMISSAO;
  if (custos) {
    const v = await db
      .from("parametros_valores")
      .update(custos)
      .eq("id", true)
      .select("id");
    if (v.error) return erroDoBanco(v.error);
    if (!v.data?.length) return SEM_PERMISSAO;
  }
  concluir();
  // Só os nomes das colunas: o antes e o depois ficam em core.auditoria.
  await logarSustentabilidade(
    "sustentabilidade_parametros",
    `Parâmetros de Sustentabilidade: ${GRUPOS[grupo]}`,
    {
      grupo,
      campos: [
        ...Object.keys(d.data as Record<string, unknown>),
        ...(custos ? Object.keys(custos) : []),
      ],
    },
  );
  return { ok: `${GRUPOS[grupo]}: salvo.` };
}

// ---------------------------------------------------------------------------
// Validade por setor econômico
// ---------------------------------------------------------------------------

export async function salvarValidadesPorSetor(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = esquemaSetores.safeParse(form.get("setores"));
  if (!d.success) return primeiroErro(d.error, ROTULOS_TABELAS);
  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  const db = await su();
  const lidas = await db.from("setor_validades").select("setor, meses");
  if (lidas.error) return erroDoBanco(lidas.error);

  const { inserir, atualizar, apagar } = diferencaDeLinhas(
    lidas.data ?? [],
    d.data,
    (l) => l.setor,
    (a, b) => a.meses === b.meses,
  );
  if (!inserir.length && !atualizar.length && !apagar.length)
    return { ok: "Nada mudou." };
  if (apagar.length) {
    const r = await db
      .from("setor_validades")
      .delete()
      .in(
        "setor",
        apagar.map((l) => l.setor),
      );
    if (r.error) return erroDoBanco(r.error);
  }
  for (const l of atualizar) {
    const r = await db
      .from("setor_validades")
      .update({ meses: l.meses })
      .eq("setor", l.setor);
    if (r.error) return erroDoBanco(r.error);
  }
  if (inserir.length) {
    const r = await db.from("setor_validades").insert(inserir);
    if (r.error) return erroDoBanco(r.error);
  }
  concluir();
  await logarSustentabilidade(
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: validade por setor",
    {
      grupo: "entrevistas",
      incluidos: inserir.length,
      alterados: atualizar.length,
      removidos: apagar.length,
    },
  );
  return { ok: "Validade por setor: salva." };
}

// ---------------------------------------------------------------------------
// Painel: marcos, equivalências e metas
// ---------------------------------------------------------------------------

export async function salvarMarcos(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = esquemaMarcos.safeParse(form.get("marcos"));
  if (!d.success) return primeiroErro(d.error, ROTULOS_TABELAS);
  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  const db = await su();
  const lidos = await db.from("marcos").select("indicador, ano, valor");
  if (lidos.error) return erroDoBanco(lidos.error);
  // Só os indicadores que a tela edita (marco de outro indicador não some daqui).
  const atuais = (lidos.data ?? []).filter(
    (m) => m.indicador in MARCOS_DO_PAINEL,
  );
  const chave = (m: { indicador: string; ano: number }) =>
    `${m.indicador}|${m.ano}`;
  const { inserir, atualizar, apagar } = diferencaDeLinhas(
    atuais,
    d.data,
    chave,
    (a, b) => a.valor === b.valor,
  );
  if (!inserir.length && !atualizar.length && !apagar.length)
    return { ok: "Nada mudou." };
  for (const m of apagar) {
    const r = await db
      .from("marcos")
      .delete()
      .eq("indicador", m.indicador)
      .eq("ano", m.ano);
    if (r.error) return erroDoBanco(r.error);
  }
  for (const m of atualizar) {
    const r = await db
      .from("marcos")
      .update({ valor: m.valor })
      .eq("indicador", m.indicador)
      .eq("ano", m.ano);
    if (r.error) return erroDoBanco(r.error);
  }
  if (inserir.length) {
    const r = await db.from("marcos").insert(inserir);
    if (r.error) return erroDoBanco(r.error);
  }
  concluir();
  await logarSustentabilidade(
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: marco inicial",
    {
      grupo: "painel",
      incluidos: inserir.length,
      alterados: atualizar.length,
      removidos: apagar.length,
    },
  );
  return { ok: "Marco inicial: salvo." };
}

export async function salvarEquivalencias(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = esquemaEquivalencias.safeParse(form.get("equivalencias"));
  if (!d.success) return primeiroErro(d.error, ROTULOS_TABELAS);
  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  const db = await su();
  const lidas = await db
    .from("equivalencias")
    .select("nome, fator, unidade, confirmado");
  if (lidas.error) return erroDoBanco(lidas.error);
  const { inserir, atualizar, apagar } = diferencaDeLinhas(
    lidas.data ?? [],
    d.data,
    (l) => l.nome,
    (a, b) =>
      a.fator === b.fator &&
      a.unidade === b.unidade &&
      a.confirmado === b.confirmado,
  );
  if (!inserir.length && !atualizar.length && !apagar.length)
    return { ok: "Nada mudou." };
  if (apagar.length) {
    const r = await db
      .from("equivalencias")
      .delete()
      .in(
        "nome",
        apagar.map((l) => l.nome),
      );
    if (r.error) return erroDoBanco(r.error);
  }
  for (const l of atualizar) {
    const r = await db
      .from("equivalencias")
      .update({
        fator: l.fator,
        unidade: l.unidade,
        confirmado: l.confirmado,
      })
      .eq("nome", l.nome);
    if (r.error) return erroDoBanco(r.error);
  }
  if (inserir.length) {
    const r = await db.from("equivalencias").insert(inserir);
    if (r.error) return erroDoBanco(r.error);
  }
  concluir();
  await logarSustentabilidade(
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: equivalências",
    {
      grupo: "painel",
      incluidos: inserir.length,
      alterados: atualizar.length,
      removidos: apagar.length,
    },
  );
  return { ok: "Equivalências: salvas." };
}

/** Metas de um ano (core.metas, sustentabilidade.<indicador>, a partir de 1º de janeiro). */
export async function salvarMetas(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ano = Number(form.get("ano"));
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100)
    return { erro: "Ano inválido." };
  const lidas = lerMetasDoForm(form);
  if (!lidas.ok) return { erro: lidas.erro };
  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  // Meta em reais só muda com "Ver valores" (a tela nem mostra o campo sem ele).
  const comValores = await podeAgora("sustentabilidade.valores");
  const metas = lidas.metas.filter(
    (m) => comValores || !infoDoIndicador(m.chave).reais,
  );

  const core = (await createClient()).schema("core");
  const desde = `${ano}-01-01`;
  const atuais = await core
    .from("metas")
    .select("id, indicador, meta")
    .eq("vigente_desde", desde)
    .in(
      "indicador",
      CHAVES_COM_META.map((c) => indicadorDaMeta(c)),
    );
  if (atuais.error) return erroDoBanco(atuais.error);
  const existente = new Map(
    (atuais.data ?? []).map((m) => [m.indicador, m] as const),
  );

  const gravar = metas.filter(
    (m) =>
      m.meta !== null &&
      existente.get(indicadorDaMeta(m.chave))?.meta !== m.meta,
  );
  const apagar = metas.filter(
    (m) => m.meta === null && existente.has(indicadorDaMeta(m.chave)),
  );
  if (!gravar.length && !apagar.length) return { ok: "Nada mudou." };

  if (gravar.length) {
    const r = await core.from("metas").upsert(
      gravar.map((m) => ({
        indicador: indicadorDaMeta(m.chave),
        direcao: INDICADORES_DO_PAINEL[m.chave].direcao,
        meta: m.meta as number,
        vigente_desde: desde,
      })),
      { onConflict: "indicador,vigente_desde" },
    );
    if (r.error) return erroDoBanco(r.error);
  }
  if (apagar.length) {
    const r = await core
      .from("metas")
      .delete()
      .in(
        "id",
        apagar.flatMap(
          (m) => existente.get(indicadorDaMeta(m.chave))?.id ?? [],
        ),
      )
      .like("indicador", "sustentabilidade.%");
    if (r.error) return erroDoBanco(r.error);
  }
  concluir();
  await logarSustentabilidade(
    "sustentabilidade_parametros",
    `Parâmetros de Sustentabilidade: metas de ${ano}`,
    {
      grupo: "painel",
      ano,
      alteradas: gravar.length,
      removidas: apagar.length,
    },
  );
  const n = gravar.length + apagar.length;
  return { ok: `Metas de ${ano}: ${n} ${n === 1 ? "alterada" : "alteradas"}.` };
}

// ---------------------------------------------------------------------------
// RCC: nova vigência (fator e, com "Ver valores", preço)
// ---------------------------------------------------------------------------

/**
 * Nova vigência do fator da caçamba (e dos preços): sempre uma linha nova, a
 * antiga fica como estava; só as notas lançadas a partir da data usam os
 * novos valores.
 */
export async function novaVigenciaRcc(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const campos = camposDoForm(form);
  const fator = esquemaVigenciaRcc.safeParse(campos);
  if (!fator.success) return primeiroErro(fator.error, ROTULOS_TABELAS);
  const comPreco =
    String(campos.preco_a ?? "").trim() !== "" ||
    String(campos.preco_b ?? "").trim() !== "";
  let preco: { preco_a: number; preco_b: number } | null = null;
  if (comPreco) {
    if (!(await podeAgora("sustentabilidade.valores")))
      return {
        erro: "Os preços da caçamba só mudam com a permissão de ver valores.",
      };
    const p = esquemaPrecosRcc.safeParse(campos);
    if (!p.success) return primeiroErro(p.error, ROTULOS_TABELAS);
    preco = p.data;
  }
  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  const db = await su();
  const f = await db.from("rcc_fatores").insert({
    ...fator.data,
    criado_por: ctx.usuarioId,
  });
  if (f.error) {
    if (f.error.code === "23505")
      return {
        erro: "Já existe uma vigência do fator nessa data. Escolha outra data para criar uma nova.",
      };
    return erroDoBanco(f.error);
  }
  if (preco) {
    const p = await db.from("rcc_precos").insert({
      vigente_desde: fator.data.vigente_desde,
      ...preco,
      criado_por: ctx.usuarioId,
    });
    if (p.error) {
      concluir();
      return {
        erro:
          p.error.code === "23505"
            ? "O fator foi salvo, mas já existe um preço com essa data. Use outra data para o preço."
            : "O fator foi salvo, mas o preço não. Tente de novo só com o preço.",
      };
    }
  }
  concluir();
  await logarSustentabilidade(
    "sustentabilidade_parametros",
    "Parâmetros de Sustentabilidade: nova vigência do RCC",
    {
      grupo: "rcc",
      vigenteDesde: fator.data.vigente_desde,
      comPreco: preco !== null,
    },
  );
  return {
    ok: "Vigência criada. As notas a partir dessa data usam os novos valores.",
  };
}

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

/** Apaga o que é de exemplo (sustentabilidade.remover_exemplos); poupa o que recebeu dado real. */
export async function removerExemplos(
  _: EstadoAcao,
  _form: FormData,
): Promise<EstadoAcao> {
  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  const { error } = await (await su()).rpc("remover_exemplos");
  if (error) return erroDoBanco(error);
  concluir();
  await logarSustentabilidade(
    "sustentabilidade_exemplos_removidos",
    "Removeu os dados de exemplo de Sustentabilidade",
  );
  return {
    ok: "Dados de exemplo removidos. As telas passam a mostrar só os dados reais.",
  };
}

// ---------------------------------------------------------------------------
// Chamados fixos (ronda, nota do RCC, relatório do mês)
// ---------------------------------------------------------------------------

export async function criarChamadoRecorrente(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = esquemaChamadoFixo.safeParse({
    tipo: form.get("tipo"),
    responsavel: form.get("responsavel"),
    dia_semana: form.get("dia_semana") ?? undefined,
    dia_mes: form.get("dia_mes") ?? undefined,
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS_TABELAS);
  const ctx = await exigir();
  if (!ctx.ok) return ctx.estado;
  if (!(await podeAgora("sustentabilidade.parametros"))) return SEM_PERMISSAO;
  const r = await criarChamadoFixo({
    tipo: d.data.tipo,
    responsavelId: d.data.responsavel,
    diaSemana: d.data.dia_semana,
    diaMes: d.data.dia_mes,
    abertoPor: ctx.usuarioId,
  });
  if (!r.ok) return { erro: r.erro };
  refresh();
  await logarSustentabilidade(
    "sustentabilidade_parametros",
    `Criou o chamado recorrente “${d.data.tipo}” (#${r.numero})`,
    { grupo: "chamados", tipo: d.data.tipo, chamado: r.id },
  );
  return {
    ok: `Chamado #${r.numero} criado (${r.repeticao.toLowerCase()}). Ajuste o Repetir ou o responsável direto nele, quando quiser.`,
  };
}
