"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { EstadoOS } from "@/components/os/ordem/tipos";
import { formatarData, lerValorBr } from "@/lib/formato";
import { formatarDuracao, minutosDaSessao } from "@/lib/os/calculos";
import { podeIr } from "@/lib/os/ciclo";
import {
  almocoQueCabe,
  erroDaSessao,
  fecharSessao,
  horaCurta,
  precisaAprovacao,
} from "@/lib/os/ordem";
import { rotaOrdem } from "@/lib/os/rotas";
import { STATUS } from "@/lib/os/rotulos";
import { hojeEmBrasilia, paraBrasilia } from "@/lib/os/tempo";
import type { Json } from "@/lib/supabase/database.types";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import {
  membrosDoSetor,
  notificar,
  ordem,
  os,
  parametros,
  registrar,
} from "@/server/os/base";
import { assumirOuIniciar } from "@/server/os/chamados";
import {
  chamadoParaEditar,
  destinoAoConcluir,
  liberarAtivoDaOS,
  marcarAtivoParado,
  podeConcluirOS,
  recalcularOS,
  tecnicoDoUsuario,
} from "@/server/os/ordem";

// Ações do bloco da OS (página e janela lateral do chamado). Gravam pela
// sessão (RLS) depois de conferir quem mexe no chamado; o cálculo é
// refeito e gravado pelo servidor a cada mudança que mexe em tempo,
// técnicos, materiais, valores ou rateio.

const id = z.uuid("inválido");
const hora = z.string().regex(/^\d{2}:\d{2}$/, "use hh:mm");
const textoOpcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
  z.string().max(4000).nullable(),
);
const uuidOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.uuid().nullable(),
);

function chamadoDo(form: FormData): string | null {
  const r = id.safeParse(form.get("ordem_id"));
  return r.success ? r.data : null;
}

// ---------------------------------------------------------------------------
// Cronômetro
// ---------------------------------------------------------------------------

/** Iniciar: abre uma sessão com a data e a hora de agora (Brasília). */
export async function iniciarTempo(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const ordemId = chamadoDo(form);
  if (!ordemId) return { erro: "Chamado inválido." };
  const alvo = await chamadoParaEditar(ordemId);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch } = alvo;
  if (!["aberto", "em_andamento", "aguardando"].includes(ch.status))
    return {
      erro: `A OS está ${STATUS[ch.status].toLowerCase()}: reabra para registrar tempo.`,
    };

  const tecnico = await tecnicoDoUsuario(ctx.usuario, ch.setor_id);
  if (tecnico.desligado)
    return {
      erro: "Seu cadastro de técnico está desligado. Fale com o gestor.",
    };

  const db = await os();
  const { data: rodando } = await db
    .from("sessao_tecnicos")
    .select("sessoes!inner(ordem_id, fim, ordens(numero))")
    .eq("tecnico_id", tecnico.id)
    .is("sessoes.fim", null);
  const outra = rodando?.[0]?.sessoes;
  if (outra)
    return {
      erro:
        outra.ordem_id === ordemId
          ? "Seu cronômetro já está rodando nesta OS."
          : `Pause o tempo da OS ${outra.ordens?.numero ?? ""} antes de iniciar outro.`,
    };

  const agora = paraBrasilia(new Date());
  const { data: sessao, error } = await db
    .from("sessoes")
    .insert({
      ordem_id: ordemId,
      data: agora.data,
      inicio: agora.hora,
      fim: null,
      criado_por: ctx.usuario.id,
    })
    .select("id")
    .single();
  if (error) return erroDoBanco(error);
  const { error: e2 } = await db
    .from("sessao_tecnicos")
    .insert({ sessao_id: sessao.id, tecnico_id: tecnico.id });
  if (e2) {
    await db.from("sessoes").delete().eq("id", sessao.id);
    return erroDoBanco(e2);
  }

  // Começar a trabalhar leva a OS a Em andamento (e assume, se está sem dono).
  const andamento = await assumirOuIniciar(ordemId);
  if (andamento.erro) console.error("iniciar pelo cronômetro", andamento.erro);
  await registrar(ordem(ordemId), {
    tipo: "tempo",
    texto: `Iniciou o cronômetro às ${agora.hora}.`,
    dados: { sessao_id: sessao.id },
  });
  refresh();
  return {
    ok: tecnico.criado
      ? "Cronômetro iniciado. Seu cadastro de técnico foi criado agora: falta cadastrar o valor por minuto em Parâmetros."
      : "Cronômetro iniciado.",
  };
}

/** Pausar ou Finalizar: fecha a minha sessão aberta nesta OS. */
export async function pausarTempo(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const ordemId = chamadoDo(form);
  if (!ordemId) return { erro: "Chamado inválido." };
  const finalizar = form.get("finalizar") === "1";
  const alvo = await chamadoParaEditar(ordemId);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx } = alvo;

  const db = await os();
  const { data: tecnico } = await db
    .from("tecnicos")
    .select("id")
    .eq("usuario_id", ctx.usuario.id)
    .maybeSingle();
  if (!tecnico) return { erro: "Você não tem cronômetro rodando nesta OS." };
  const { data: abertas, error } = await db
    .from("sessoes")
    .select("id, data, inicio, sessao_tecnicos!inner(tecnico_id)")
    .eq("ordem_id", ordemId)
    .is("fim", null)
    .eq("sessao_tecnicos.tecnico_id", tecnico.id);
  if (error) return erroDoBanco(error);
  if (!abertas?.length)
    return { erro: "Você não tem cronômetro rodando nesta OS." };

  const p = await parametros();
  const agora = new Date();
  let total = 0;
  let esquecida = false;
  for (const s of abertas) {
    const inicio = horaCurta(s.inicio);
    const f = fecharSessao({ data: s.data, inicio }, agora);
    esquecida ||= f.esquecida;
    if (f.minutos < 1) {
      // Iniciou e parou no mesmo minuto: não vira sessão.
      await db.from("sessoes").delete().eq("id", s.id);
      continue;
    }
    const almoco = almocoQueCabe(
      { data: s.data, inicio, fim: f.fim },
      { inicio: horaCurta(p.almoco_inicio), fim: horaCurta(p.almoco_fim) },
    );
    const { error: e } = await db
      .from("sessoes")
      .update({
        fim: f.fim,
        almoco_inicio: almoco?.inicio ?? null,
        almoco_fim: almoco?.fim ?? null,
      })
      .eq("id", s.id);
    if (e) return erroDoBanco(e);
    total += minutosDaSessao({
      data: s.data,
      inicio,
      fim: f.fim,
      almoco_inicio: almoco?.inicio ?? null,
      almoco_fim: almoco?.fim ?? null,
      tecnicos: [],
    });
  }

  await recalcularOS(ordemId);
  await registrar(ordem(ordemId), {
    tipo: "tempo",
    texto: `${finalizar ? "Finalizou" : "Pausou"} o cronômetro: ${formatarDuracao(total)}.`,
  });
  refresh();
  const aviso = esquecida
    ? " A sessão ficou aberta mais de um dia: confira o horário em Tempo."
    : "";
  if (!finalizar)
    return { ok: `Tempo registrado: ${formatarDuracao(total)}.${aviso}` };
  const motivo = await podeConcluirOS(ordemId);
  return {
    ok: `Tempo registrado: ${formatarDuracao(total)}.${aviso}`,
    concluir: motivo === null,
    motivo,
  };
}

// ---------------------------------------------------------------------------
// Sessões à mão
// ---------------------------------------------------------------------------

// Sem almoço marcado, os campos do almoço nem vão no formulário.
const horaOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  hora.nullable(),
);

const sessao = z.object({
  ordem_id: id,
  id: uuidOpcional,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "informe a data"),
  inicio: hora,
  fim: horaOpcional,
  almoco: z.preprocess((v) => v === "on", z.boolean()),
  almoco_inicio: horaOpcional,
  almoco_fim: horaOpcional,
  observacao: textoOpcional,
});

const ROTULOS_SESSAO = {
  data: "Data",
  inicio: "Início",
  fim: "Fim",
  almoco_inicio: "Início do almoço",
  almoco_fim: "Fim do almoço",
};

/** Inclui ou corrige uma sessão (um ou vários técnicos). */
export async function salvarSessao(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = sessao.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_SESSAO);
  const s = d.data;
  const tecnicos = [...new Set(valores(form, "tecnicos"))];
  const alvo = await chamadoParaEditar(s.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx } = alvo;

  const almoco =
    s.almoco && s.almoco_inicio && s.almoco_fim
      ? { inicio: s.almoco_inicio, fim: s.almoco_fim }
      : null;
  const problema = erroDaSessao({
    data: s.data,
    inicio: s.inicio,
    fim: s.fim,
    almoco,
    tecnicos,
    hoje: hojeEmBrasilia(new Date()),
  });
  if (problema) return { erro: problema };
  // Sessão manual sempre tem fim; sem fim, só a que já estava rodando.
  if (s.fim === null && !s.id) return { erro: "Fim: informe a hora de fim." };

  const db = await os();
  const anteriores = s.id
    ? ((
        await db
          .from("sessao_tecnicos")
          .select("tecnico_id")
          .eq("sessao_id", s.id)
      ).data?.map((t) => t.tecnico_id) ?? [])
    : [];
  const { data: cadastrados } = await db
    .from("tecnicos")
    .select("id, nome, desligado_em")
    .in("id", tecnicos);
  if ((cadastrados ?? []).length !== tecnicos.length)
    return { erro: "Técnico não encontrado." };
  const desligado = (cadastrados ?? []).find(
    (t) =>
      t.desligado_em && t.desligado_em <= s.data && !anteriores.includes(t.id),
  );
  if (desligado)
    return {
      erro: `${desligado.nome} foi desligado em ${formatarData(desligado.desligado_em)}.`,
    };

  const guardado = almocoQueCabe(
    { data: s.data, inicio: s.inicio, fim: s.fim },
    almoco,
  );
  const linha = {
    ordem_id: s.ordem_id,
    data: s.data,
    inicio: s.inicio,
    fim: s.fim,
    almoco_inicio: guardado?.inicio ?? null,
    almoco_fim: guardado?.fim ?? null,
    observacao: s.observacao,
  };
  let sessaoId = s.id;
  if (sessaoId) {
    const { data: mudou, error } = await db
      .from("sessoes")
      .update(linha)
      .eq("id", sessaoId)
      .eq("ordem_id", s.ordem_id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!mudou?.length) return { erro: "Sessão não encontrada." };
    const { error: e } = await db
      .from("sessao_tecnicos")
      .delete()
      .eq("sessao_id", sessaoId);
    if (e) return erroDoBanco(e);
  } else {
    const { data: nova, error } = await db
      .from("sessoes")
      .insert({ ...linha, criado_por: ctx.usuario.id })
      .select("id")
      .single();
    if (error) return erroDoBanco(error);
    sessaoId = nova.id;
  }
  const { error: e3 } = await db
    .from("sessao_tecnicos")
    .insert(
      tecnicos.map((tecnico_id) => ({ sessao_id: sessaoId, tecnico_id })),
    );
  if (e3) return erroDoBanco(e3);

  await recalcularOS(s.ordem_id);
  const nomesTec = (cadastrados ?? []).map((t) => t.nome).join(", ");
  await registrar(ordem(s.ordem_id), {
    tipo: "tempo",
    texto: `${s.id ? "Corrigiu" : "Incluiu"} a sessão de ${formatarData(s.data)} ${s.inicio}–${s.fim ?? "…"} (${nomesTec}).`,
    dados: { sessao_id: sessaoId },
  });
  refresh();
  return { ok: s.id ? "Sessão corrigida." : "Sessão incluída." };
}

export async function excluirSessao(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = z.object({ ordem_id: id, id }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Sessão inválida." };
  const alvo = await chamadoParaEditar(d.data.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { data, error } = await (await os())
    .from("sessoes")
    .delete()
    .eq("id", d.data.id)
    .eq("ordem_id", d.data.ordem_id)
    .select("data, inicio, fim");
  if (error) return erroDoBanco(error);
  const s = data?.[0];
  if (!s) return { erro: "Sessão não encontrada." };
  await recalcularOS(d.data.ordem_id);
  await registrar(ordem(d.data.ordem_id), {
    tipo: "tempo",
    texto: `Excluiu a sessão de ${formatarData(s.data)} ${horaCurta(s.inicio)}–${horaCurta(s.fim) ?? "…"}.`,
  });
  refresh();
  return { ok: "Sessão excluída." };
}

// ---------------------------------------------------------------------------
// Execução, local, ativo e visita
// ---------------------------------------------------------------------------

const execucao = z.object({
  ordem_id: id,
  execucao: z.enum(["interna", "terceirizada"]),
  empresa_id: uuidOpcional,
  bloco: textoOpcional,
  loja_id: uuidOpcional,
  local: textoOpcional,
  ativo_id: uuidOpcional,
  ativo_parado: z.preprocess((v) => v === "on", z.boolean()),
  visita_data: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  ),
  visita_periodo: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.enum(["manha", "tarde", "noite"]).nullable(),
  ),
});

export async function salvarExecucao(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = execucao.safeParse(Object.fromEntries(form));
  if (!d.success)
    return primeiroErro(d.error, {
      visita_data: "Data da visita",
      visita_periodo: "Período",
    });
  const e = d.data;
  const alvo = await chamadoParaEditar(e.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch } = alvo;
  if (ch.tipo !== "os") return { erro: "Só Ordem de Serviço tem execução." };
  const terceirizada = e.execucao === "terceirizada";
  const profissionais = terceirizada ? valores(form, "profissionais") : [];

  const db = await os();
  const { error } = await db
    .from("ordens")
    .update({
      execucao: e.execucao,
      empresa_id: terceirizada ? e.empresa_id : null,
      bloco: e.bloco,
      loja_id: e.loja_id,
      local: e.local,
      ativo_id: e.ativo_id,
      ativo_parado: !!e.ativo_id && e.ativo_parado,
      visita_data: terceirizada ? e.visita_data : null,
      visita_periodo: terceirizada ? e.visita_periodo : null,
    })
    .eq("id", e.ordem_id);
  if (error) return erroDoBanco(error);

  const { error: e2 } = await db
    .from("ordem_profissionais")
    .delete()
    .eq("ordem_id", e.ordem_id);
  if (e2) return erroDoBanco(e2);
  if (profissionais.length) {
    const { error: e3 } = await db.from("ordem_profissionais").insert(
      profissionais.map((profissional_id) => ({
        ordem_id: e.ordem_id,
        profissional_id,
      })),
    );
    if (e3) return erroDoBanco(e3);
  }

  // Ativo parado: o que estava parado volta; o novo para (se a OS está aberta).
  const parado = !!e.ativo_id && e.ativo_parado;
  if (ch.ativo_id && ch.ativo_parado && (ch.ativo_id !== e.ativo_id || !parado))
    await marcarAtivoParado(ch.ativo_id, false, ctx);
  if (parado && e.ativo_id && !["fechado", "cancelado"].includes(ch.status))
    await marcarAtivoParado(e.ativo_id, true, ctx);

  const mudancas: string[] = [];
  if (ch.execucao !== e.execucao)
    mudancas.push(`execução ${terceirizada ? "terceirizada" : "interna"}`);
  if (ch.ativo_id !== e.ativo_id) mudancas.push("ativo vinculado");
  if (ch.ativo_parado !== parado)
    mudancas.push(parado ? "ativo parado" : "ativo liberado");
  if (ch.visita_data !== (terceirizada ? e.visita_data : null))
    mudancas.push("data da visita");
  await registrar(ordem(e.ordem_id), {
    tipo: "alteracao",
    texto: mudancas.length
      ? `Atualizou a OS: ${mudancas.join(", ")}.`
      : "Atualizou a execução e o local da OS.",
    dados: {
      campo: "execucao",
      de: ch.execucao,
      para: e.execucao,
    },
  });
  refresh();
  return { ok: "Salvo." };
}

// ---------------------------------------------------------------------------
// Materiais
// ---------------------------------------------------------------------------

const material = z.object({
  ordem_id: id,
  id: uuidOpcional,
  descricao: z.string().trim().min(2, "descreva o material").max(300),
  quantidade: z.string(),
  unidade: textoOpcional,
  valor_unitario: z.string().optional(),
});

export async function salvarMaterial(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = material.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { descricao: "Material" });
  const m = d.data;
  const quantidade = lerValorBr(m.quantidade);
  if (quantidade === null || Number.isNaN(quantidade) || quantidade <= 0)
    return { erro: "Quantidade: informe um número maior que zero." };
  const alvo = await chamadoParaEditar(m.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx } = alvo;
  const comCustos = ctx.pode("os.custos");
  const valor =
    comCustos && m.valor_unitario !== undefined
      ? lerValorBr(m.valor_unitario)
      : undefined;
  if (
    valor !== undefined &&
    valor !== null &&
    (Number.isNaN(valor) || valor < 0)
  )
    return { erro: "Valor unitário: informe um valor em reais." };

  const db = await os();
  const linha = {
    ordem_id: m.ordem_id,
    descricao: m.descricao,
    quantidade,
    unidade: m.unidade,
  };
  let materialId = m.id;
  if (materialId) {
    const { data, error } = await db
      .from("materiais")
      .update(linha)
      .eq("id", materialId)
      .eq("ordem_id", m.ordem_id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!data?.length) return { erro: "Material não encontrado." };
  } else {
    const { data, error } = await db
      .from("materiais")
      .insert({ ...linha, criado_por: ctx.usuario.id })
      .select("id")
      .single();
    if (error) return erroDoBanco(error);
    materialId = data.id;
  }
  if (valor !== undefined) {
    const { error } =
      valor === null
        ? await db
            .from("material_valores")
            .delete()
            .eq("material_id", materialId)
        : await db
            .from("material_valores")
            .upsert({ material_id: materialId, valor_unitario: valor });
    if (error) return erroDoBanco(error);
  }

  await recalcularOS(m.ordem_id);
  await registrar(ordem(m.ordem_id), {
    tipo: "alteracao",
    texto: `${m.id ? "Corrigiu" : "Incluiu"} o material: ${m.descricao}.`,
    dados: { campo: "materiais", material_id: materialId },
  });
  refresh();
  return { ok: m.id ? "Material corrigido." : "Material incluído." };
}

export async function excluirMaterial(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = z.object({ ordem_id: id, id }).safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Material inválido." };
  const alvo = await chamadoParaEditar(d.data.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { data, error } = await (await os())
    .from("materiais")
    .delete()
    .eq("id", d.data.id)
    .eq("ordem_id", d.data.ordem_id)
    .select("descricao");
  if (error) return erroDoBanco(error);
  if (!data?.length) return { erro: "Material não encontrado." };
  await recalcularOS(d.data.ordem_id);
  await registrar(ordem(d.data.ordem_id), {
    tipo: "alteracao",
    texto: `Excluiu o material: ${data[0]?.descricao}.`,
    dados: { campo: "materiais" },
  });
  refresh();
  return { ok: "Material excluído." };
}

// ---------------------------------------------------------------------------
// Rateio e custo do terceirizado
// ---------------------------------------------------------------------------

const rateio = z.object({
  ordem_id: id,
  rateio: z.enum(["sim", "nao"]),
  rateio_regra: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .enum(["hora_trabalhada", "manual", "percentual", "terceirizado"])
      .nullable(),
  ),
  rateio_valor: z.string().optional(),
});

/** Entra no rateio (todos que editam); regra e valor, só com os.custos. */
export async function salvarRateio(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = rateio.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { rateio_regra: "Regra" });
  const r = d.data;
  const alvo = await chamadoParaEditar(r.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch } = alvo;
  const sim = r.rateio === "sim";

  const db = await os();
  if (ch.rateio !== sim) {
    const { error } = await db
      .from("ordens")
      .update({ rateio: sim })
      .eq("id", r.ordem_id);
    if (error) return erroDoBanco(error);
  }
  if (ctx.pode("os.custos") && r.rateio_regra) {
    const valor = r.rateio_valor ? lerValorBr(r.rateio_valor) : null;
    if (valor !== null && (Number.isNaN(valor) || valor < 0))
      return { erro: "Valor do rateio: informe um número." };
    if (r.rateio_regra === "percentual" && valor !== null && valor > 100)
      return { erro: "Percentual: no máximo 100%." };
    const { error } = await db.from("os_custos").upsert({
      ordem_id: r.ordem_id,
      rateio_regra: r.rateio_regra,
      rateio_valor:
        r.rateio_regra === "manual" || r.rateio_regra === "percentual"
          ? valor
          : null,
    });
    if (error) return erroDoBanco(error);
  }

  await recalcularOS(r.ordem_id);
  await registrar(ordem(r.ordem_id), {
    tipo: "alteracao",
    texto: sim ? "Rateio do condomínio: Sim." : "Rateio do condomínio: Não.",
    dados: { campo: "rateio", de: ch.rateio, para: sim },
  });
  refresh();
  return { ok: "Rateio salvo." };
}

const terceirizado = z.object({
  ordem_id: id,
  valor_terceirizado: z.string(),
  orcamento_numero: textoOpcional,
});

/** Quanto o terceirizado cobrou e o número do orçamento ou nota. */
export async function salvarCustoTerceirizado(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = terceirizado.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const t = d.data;
  const alvo = await chamadoParaEditar(t.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch } = alvo;
  if (!ctx.pode("os.custos"))
    return { erro: "Você não tem permissão para ver e editar custos." };
  const valor = lerValorBr(t.valor_terceirizado);
  if (valor !== null && (Number.isNaN(valor) || valor < 0))
    return { erro: "Valor cobrado: informe um valor em reais." };

  const db = await os();
  const { data: antes } = await db
    .from("os_custos")
    .select("valor_terceirizado, orcamento_aprovado_em")
    .eq("ordem_id", t.ordem_id)
    .maybeSingle();
  const mudouValor = (antes?.valor_terceirizado ?? null) !== valor;
  const { error } = await db.from("os_custos").upsert({
    ordem_id: t.ordem_id,
    valor_terceirizado: valor,
    orcamento_numero: t.orcamento_numero,
    // Valor novo: a aprovação anterior não vale mais.
    ...(mudouValor
      ? { orcamento_aprovado_em: null, orcamento_aprovado_por: null }
      : {}),
  });
  if (error) return erroDoBanco(error);

  // O cálculo, a linha do tempo e o teto não dependem um do outro.
  const [, , p] = await Promise.all([
    recalcularOS(t.ordem_id),
    registrar(ordem(t.ordem_id), {
      tipo: "alteracao",
      texto: "Atualizou o custo do terceirizado.",
      dados: { campo: "custo_terceirizado" },
    }),
    parametros(),
  ]);
  if (mudouValor && precisaAprovacao(valor, p.teto_terceirizado)) {
    // O aviso não muda a resposta: sai depois dela.
    after(async () =>
      notificar(
        await membrosDoSetor(ch.setor_id, true),
        {
          tipo: "orcamento",
          titulo: `#${ch.numero} ${ch.titulo}`,
          texto:
            "O orçamento do terceirizado passou do teto e precisa da sua aprovação.",
          href: rotaOrdem(ch.id),
          alvo: ordem(ch.id),
        },
        ctx.usuario.id,
      ),
    );
  }
  refresh();
  return { ok: "Custo do terceirizado salvo." };
}

// ---------------------------------------------------------------------------
// Resultado e conclusão
// ---------------------------------------------------------------------------

const resultado = z.object({
  ordem_id: id,
  solucao: textoOpcional,
  causa_falha: textoOpcional,
});

export async function salvarResultado(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const d = resultado.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { solucao: "Solução" });
  const r = d.data;
  const alvo = await chamadoParaEditar(r.ordem_id);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ch } = alvo;
  const p = await parametros();
  if (
    r.causa_falha &&
    !p.causas_falha.includes(r.causa_falha) &&
    r.causa_falha !== ch.causa_falha
  )
    return { erro: "Causa da falha: escolha uma da lista." };
  const { error } = await (await os())
    .from("ordens")
    .update({ solucao: r.solucao, causa_falha: r.causa_falha })
    .eq("id", r.ordem_id);
  if (error) return erroDoBanco(error);
  await registrar(ordem(r.ordem_id), {
    tipo: "alteracao",
    texto: "Atualizou a solução aplicada e a causa da falha.",
    dados: { campo: "solucao", causa_falha: r.causa_falha },
  });
  refresh();
  return { ok: "Resultado salvo." };
}

/**
 * Concluir pela OS (depois de Finalizar o cronômetro): confere o checklist
 * obrigatório e as regras da OS e leva a Concluído (ou Fechado, se a
 * categoria não pede confirmação).
 */
export async function concluirOS(
  _: EstadoOS,
  form: FormData,
): Promise<EstadoOS> {
  const ordemId = chamadoDo(form);
  if (!ordemId) return { erro: "Chamado inválido." };
  const alvo = await chamadoParaEditar(ordemId);
  if (alvo.erro !== undefined) return { erro: alvo.erro };
  const { ctx, ch, gerencia } = alvo;
  if (ch.responsavel_id !== ctx.usuario.id && !gerencia)
    return { erro: "Só o responsável ou quem gerencia o setor conclui." };
  const destino = destinoAoConcluir(ch);
  if (!podeIr(ch.status, destino))
    return {
      erro: `Não dá para concluir uma OS ${STATUS[ch.status].toLowerCase()}.`,
    };
  const pendente = (Array.isArray(ch.checklist) ? ch.checklist : []).find(
    (i) => {
      const item = i as Record<string, Json | undefined>;
      return item.obrigatorio === true && item.feito !== true;
    },
  ) as Record<string, Json | undefined> | undefined;
  if (pendente)
    return {
      erro: `Falta o item obrigatório do checklist: ${String(pendente.texto ?? "")}.`,
    };
  const motivo = await podeConcluirOS(ordemId);
  if (motivo) return { erro: motivo };

  const { error } = await (await os())
    .from("ordens")
    .update({ status: destino })
    .eq("id", ordemId);
  if (error) return erroDoBanco(error);
  await registrar(ordem(ordemId), {
    tipo: "status",
    texto: destino === "fechado" ? "Concluiu e fechou a OS." : "Concluiu a OS.",
    dados: { de: ch.status, para: destino },
  });
  if (destino === "fechado") await liberarAtivoDaOS(ordemId);
  after(() =>
    notificar(
      [ch.aberto_por],
      {
        tipo: "concluido",
        titulo: `#${ch.numero} ${ch.titulo}`,
        texto:
          destino === "fechado"
            ? "A OS foi concluída."
            : "A OS foi concluída. Confira e confirme.",
        href: rotaOrdem(ch.id),
        alvo: ordem(ch.id),
      },
      ctx.usuario.id,
    ),
  );
  refresh();
  return {
    ok: destino === "fechado" ? "OS concluída e fechada." : "OS concluída.",
  };
}
