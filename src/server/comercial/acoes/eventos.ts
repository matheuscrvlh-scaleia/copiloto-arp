"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  diasUteisAntes,
  STATUS_PROPOSTA,
  type StatusProposta,
  simular,
  valoresDaProposta,
} from "@/lib/comercial/eventos";
import { lerValorBr } from "@/lib/formato";
import type { Json } from "@/lib/supabase/database.types";
import {
  com,
  contextoCom,
  faixasEvento,
  parametros,
  valoresDaLista,
} from "@/server/comercial/base";
import {
  calendarioDe,
  faixasParaCalculo,
  feriadosDosAnos,
  regrasDe,
} from "@/server/comercial/eventos";

// Gravações das propostas de evento (spec 4.15), com a sessão: o RLS
// confere comercial.eventos.editar. Os valores são recalculados aqui pela
// tabela de faixas e pelos parâmetros (o navegador só mostra a prévia), e
// a faixa usada fica guardada na proposta. Proposta não é receita.

const SEM_PERMISSAO = "Você não tem permissão para editar propostas de evento.";

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();
const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();
const numero = z.preprocess(
  (v) => (typeof v === "string" ? (lerValorBr(v) ?? 0) : v),
  z.number(),
);

const proposta = z
  .object({
    id: z.uuid().nullable(),
    cliente: z.string().trim().min(1, "Informe o cliente.").max(200),
    oportunidade_rd: texto(200),
    data_evento: dia,
    data_evento_fim: dia,
    horario: texto(120),
    tipo_data: z.enum(["comum", "sazonal"]),
    area_m2: numero.pipe(z.number().positive("Informe a área.").max(100000)),
    dias: numero.pipe(z.number().int().min(1, "Informe os dias.").max(365)),
    pessoas: numero.pipe(z.number().int().min(0).max(1000000)),
    desconto_pct: numero.pipe(z.number().min(0).max(100)),
    desconto_primeira_edicao: numero.pipe(z.number().min(0)),
    validade: dia,
    condicao_pagamento: texto(300),
    montagem: texto(300),
    desmontagem: texto(300),
    area_evento: texto(300),
    observacoes: z.array(z.string().max(200)).max(50),
  })
  .refine(
    (p) =>
      !p.data_evento_fim ||
      !p.data_evento ||
      p.data_evento_fim >= p.data_evento,
    {
      message: "O fim do evento vem antes do início.",
      path: ["data_evento_fim"],
    },
  );

const primeiroErro = (e: z.ZodError) => {
  const m = e.issues[0]?.message;
  return m && !/^(Invalid|Too|Expected)/.test(m)
    ? m
    : "Confira os campos da proposta.";
};

export async function salvarProposta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const vazio = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() ? v : null;
  };
  const e = proposta.safeParse({
    id: vazio("id"),
    cliente: form.get("cliente") ?? "",
    oportunidade_rd: form.get("oportunidade_rd") ?? "",
    data_evento: vazio("data_evento"),
    data_evento_fim: vazio("data_evento_fim"),
    horario: form.get("horario") ?? "",
    tipo_data: form.get("tipo_data"),
    area_m2: form.get("area_m2"),
    dias: form.get("dias"),
    pessoas: vazio("pessoas") ?? 0,
    desconto_pct: vazio("desconto_pct") ?? 0,
    desconto_primeira_edicao: vazio("desconto_primeira_edicao") ?? 0,
    validade: vazio("validade"),
    condicao_pagamento: form.get("condicao_pagamento") ?? "",
    montagem: form.get("montagem") ?? "",
    desmontagem: form.get("desmontagem") ?? "",
    area_evento: form.get("area_evento") ?? "",
    observacoes: form.getAll("observacoes").map(String),
  });
  if (!e.success) return { erro: primeiroErro(e.error) };
  const ctx = await contextoCom();
  if (!ctx.pode("comercial.eventos.editar")) return { erro: SEM_PERMISSAO };
  const v = e.data;

  const [faixas, p, observacoesValidas] = await Promise.all([
    faixasEvento(),
    parametros(),
    valoresDaLista("evento_observacao"),
  ]);
  const s = simular(faixasParaCalculo(faixas), regrasDe(p), {
    tipo: v.tipo_data,
    area: v.area_m2,
    dias: v.dias,
    descontoPct: v.desconto_pct,
    pessoas: v.pessoas,
  });
  if (!s) return { erro: "Sem faixa de preço para esta área nos parâmetros." };
  const valores = valoresDaProposta(s, v.desconto_primeira_edicao);

  let fechamento: string | null = null;
  if (v.data_evento) {
    const ano = Number(v.data_evento.slice(0, 4));
    const { feriados } = await feriadosDosAnos([ano - 1, ano]);
    fechamento = diasUteisAntes(
      v.data_evento,
      p.evento_fechamento_dias_uteis,
      calendarioDe(feriados),
    );
  }

  const linha = {
    cliente: v.cliente,
    oportunidade_rd: v.oportunidade_rd,
    data_evento: v.data_evento,
    data_evento_fim: v.data_evento_fim,
    horario: v.horario,
    tipo_data: v.tipo_data,
    area_m2: v.area_m2,
    dias: v.dias,
    pessoas: v.pessoas,
    desconto_pct: v.desconto_pct,
    ...valores,
    segurancas: s.segurancas,
    agentes_limpeza: s.agentes,
    condicao_pagamento: v.condicao_pagamento,
    montagem: v.montagem,
    desmontagem: v.desmontagem,
    fechamento_ate: fechamento,
    area_evento: v.area_evento,
    notas: p.evento_notas,
    // Só as da lista (as que saíram da lista seguem se já estavam marcadas).
    observacoes: v.observacoes.filter((o, i, todas) => todas.indexOf(o) === i),
    validade: v.validade,
    calculo: {
      faixa: s.faixa.nome,
      fixo: s.faixa.fixo,
      preco: s.preco,
      valor_dia: s.valorDia,
      acima_da_tabela: s.acimaDaTabela,
      reajuste_pct: Number(p.evento_reajuste_pct),
      pessoas_por_seguranca: p.evento_pessoas_por_seguranca,
      m2_por_agente: p.evento_m2_por_agente,
      fechamento_dias_uteis: p.evento_fechamento_dias_uteis,
    } satisfies Json,
  };
  const novas = linha.observacoes.filter(
    (o) => !observacoesValidas.includes(o),
  );

  const db = await com();
  if (v.id) {
    if (novas.length) {
      const atual = await db
        .from("propostas_evento")
        .select("observacoes")
        .eq("id", v.id)
        .maybeSingle();
      if (novas.some((o) => !atual.data?.observacoes.includes(o)))
        return { erro: "Observação fora da lista padrão." };
    }
    const { data, error } = await db
      .from("propostas_evento")
      .update(linha)
      .eq("id", v.id)
      .select("id");
    if (error) return { erro: erroDoBanco(error) };
    if (!data?.length) return { erro: SEM_PERMISSAO };
    refresh();
    return { ok: "Proposta salva." };
  }
  if (novas.length) return { erro: "Observação fora da lista padrão." };
  const { data, error } = await db
    .from("propostas_evento")
    .insert({ ...linha, status: "rascunho" })
    .select("id")
    .single();
  if (error) return { erro: erroDoBanco(error) };
  redirect(`/comercial/eventos/proposta/${data.id}`);
}

function erroDoBanco(error: { code?: string; message: string }): string {
  if (error.code === "42501") return SEM_PERMISSAO;
  console.error("proposta de evento", error);
  return "Não foi possível salvar a proposta. Tente de novo.";
}

export async function mudarStatusProposta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = z
    .object({
      id: z.uuid(),
      status: z.enum(Object.keys(STATUS_PROPOSTA) as [StatusProposta]),
    })
    .safeParse({ id: form.get("id"), status: form.get("status") });
  if (!e.success) return { erro: "Status inválido." };
  const { data, error } = await (await com())
    .from("propostas_evento")
    .update({ status: e.data.status })
    .eq("id", e.data.id)
    .select("id");
  if (error) return { erro: erroDoBanco(error) };
  if (!data?.length) return { erro: SEM_PERMISSAO };
  refresh();
  return {
    ok: `Proposta marcada como ${STATUS_PROPOSTA[e.data.status].toLowerCase()}.`,
  };
}
