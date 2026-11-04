"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  type BlocoComCampos,
  conferirFaixasEvento,
  ESQUEMAS,
  faixaEvento,
  feriado,
  fonteDePara,
  type ItemLista,
  LISTAS,
  marcaDaLista,
  NOMES_LISTA,
  type NomeLista,
  obrigatoriosDoForm,
  planoDaLista,
  planoVazio,
  primeiroErro,
  tipoLuc,
  validarBloco,
} from "@/lib/comercial/parametros";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import { com } from "@/server/comercial/base";
import { logComercial } from "@/server/comercial/parametros";

// Gravações de Comercial › Configurações › Parâmetros (spec 4.13). Toda ação:
// Zod → confere comercial.parametros.editar no banco (podeAgora) → grava com
// a sessão (o RLS confere de novo e core.auditoria registra quem, quando,
// antes e depois) → updateTag do que mudou → refresh() → log em after().

const PERMISSAO = "comercial.parametros.editar" as const;
const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para alterar os parâmetros do Comercial.",
};
const NADA: EstadoAcao = { ok: "Nada mudou." };

async function exigir(): Promise<EstadoAcao | null> {
  return (await podeAgora(PERMISSAO)) ? null : SEM_PERMISSAO;
}

function erroDoBanco(
  error: { message: string; code?: string },
  repetido = "Já existe outro registro com esse valor.",
): EstadoAcao {
  if (error.code === "23505") return { erro: repetido };
  if (error.code === "23514") return { erro: "Valor fora do permitido." };
  if (error.code === "42501") return SEM_PERMISSAO;
  console.error("parâmetros do comercial", error);
  return { erro: "Não foi possível salvar. Tente de novo." };
}

async function salvo(
  evento: string,
  tags: string[],
  detalhes: Record<string, unknown> = {},
  ok = "Salvo.",
): Promise<EstadoAcao> {
  for (const t of tags) updateTag(t);
  refresh();
  logComercial(evento, (await usuarioAtual()).id, detalhes);
  return { ok };
}

// ---------------------------------------------------------------------------
// Campos da linha única (um formulário por bloco)
// ---------------------------------------------------------------------------

const BLOCOS_COM_CAMPOS = Object.keys(ESQUEMAS) as BlocoComCampos[];
type ParametrosPatch = Database["comercial"]["Tables"]["parametros"]["Update"];

export async function salvarParametros(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const bloco = form.get("bloco") as BlocoComCampos;
  if (!BLOCOS_COM_CAMPOS.includes(bloco)) return { erro: "Bloco inválido." };
  const negado = await exigir();
  if (negado) return negado;
  const v = validarBloco(bloco, Object.fromEntries(form));
  if (!v.ok) return { erro: v.erro };
  const patch: ParametrosPatch = { ...v.dados };
  if (bloco === "contratos")
    patch.obrigatorios_garantia = obrigatoriosDoForm(form.entries());
  const { error } = await (await com())
    .from("parametros")
    .update(patch)
    .eq("id", true);
  if (error) return erroDoBanco(error);
  return salvo("parametros_salvos", [TAG.comercial.parametros], { bloco });
}

// ---------------------------------------------------------------------------
// Listas (um valor por linha; o que sai fica inativo)
// ---------------------------------------------------------------------------

export async function salvarLista(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const lista = form.get("lista") as NomeLista;
  if (!NOMES_LISTA.includes(lista)) return { erro: "Lista inválida." };
  const negado = await exigir();
  if (negado) return negado;
  const banco = await com();
  const { data: atuais, error: falha } = await banco
    .from("listas")
    .select("id, valor, ordem, ativo, extra")
    .eq("lista", lista);
  if (falha) return erroDoBanco(falha);
  const marca = marcaDaLista(lista);
  const r = planoDaLista(
    (atuais ?? []) as ItemLista[],
    String(form.get("valores") ?? ""),
    marca
      ? {
          chave: marca.chave,
          marcados: new Set(
            form
              .getAll("marcados")
              .filter((m): m is string => typeof m === "string"),
          ),
        }
      : undefined,
  );
  if ("erro" in r) return { erro: `${LISTAS[lista].rotulo}: ${r.erro}` };
  const { plano } = r;
  if (planoVazio(plano)) return NADA;

  if (plano.desativar.length) {
    const { error } = await banco
      .from("listas")
      .update({ ativo: false })
      .in("id", plano.desativar);
    if (error) return erroDoBanco(error);
  }
  for (const a of plano.atualizar) {
    const { error } = await banco
      .from("listas")
      .update({ ordem: a.ordem, ativo: true, extra: a.extra as Json })
      .eq("id", a.id);
    if (error) return erroDoBanco(error);
  }
  if (plano.incluir.length) {
    const { error } = await banco.from("listas").insert(
      plano.incluir.map((i) => ({
        lista,
        valor: i.valor,
        ordem: i.ordem,
        extra: i.extra as Json,
      })),
    );
    if (error) return erroDoBanco(error, "Valor repetido na lista.");
  }
  return salvo("lista_salva", [TAG.comercial.listas], {
    lista,
    incluidos: plano.incluir.length,
    desativados: plano.desativar.length,
  });
}

// ---------------------------------------------------------------------------
// De-para de fontes do RD
// ---------------------------------------------------------------------------

/** Todas as linhas do de-para de uma vez (campos "de.<fonte do RD>"). */
export async function salvarDePara(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const linhas: z.infer<typeof fonteDePara>[] = [];
  for (const [k, v] of form.entries()) {
    if (!k.startsWith("de.")) continue;
    const d = fonteDePara.safeParse({
      fonte_rd: k.slice(3),
      fonte_ajustada: v,
    });
    if (!d.success) return { erro: primeiroErro(d.error) };
    linhas.push(d.data);
  }
  if (!linhas.length) return NADA;
  const banco = await com();
  const { data: atuais, error: falha } = await banco
    .from("fontes_de_para")
    .select("fonte_rd, fonte_ajustada");
  if (falha) return erroDoBanco(falha);
  const antes = new Map(
    (atuais ?? []).map((a) => [a.fonte_rd, a.fonte_ajustada]),
  );
  const mudou = linhas.filter(
    (l) => antes.get(l.fonte_rd) !== l.fonte_ajustada,
  );
  if (!mudou.length) return NADA;
  const { error } = await banco
    .from("fontes_de_para")
    .upsert(mudou, { onConflict: "fonte_rd" });
  if (error) return erroDoBanco(error);
  return salvo("de_para_salvo", [TAG.comercial.fontesDePara], {
    alteradas: mudou.length,
  });
}

export async function incluirFonteDePara(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const d = fonteDePara.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: primeiroErro(d.error) };
  const { error } = await (await com()).from("fontes_de_para").insert(d.data);
  if (error) return erroDoBanco(error, "Essa fonte do RD já está no de-para.");
  return salvo(
    "de_para_incluido",
    [TAG.comercial.fontesDePara],
    {},
    "Fonte incluída.",
  );
}

export async function removerFonteDePara(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const fonte = z.string().trim().min(1).safeParse(form.get("fonte_rd"));
  if (!fonte.success) return { erro: "Fonte inválida." };
  const { error } = await (await com())
    .from("fontes_de_para")
    .delete()
    .eq("fonte_rd", fonte.data);
  if (error) return erroDoBanco(error);
  return salvo(
    "de_para_removido",
    [TAG.comercial.fontesDePara],
    {},
    "Fonte removida.",
  );
}

// ---------------------------------------------------------------------------
// Tipos de LUC que contam na ocupação
// ---------------------------------------------------------------------------

/** Marca de cada tipo ("conta.<tipo>"); tipos listados em "tipos". */
export async function salvarTiposLuc(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const tipos = form
    .getAll("tipos")
    .filter((t): t is string => typeof t === "string");
  const banco = await com();
  const { data: atuais, error: falha } = await banco
    .from("tipos_luc")
    .select("tipo, conta_ocupacao");
  if (falha) return erroDoBanco(falha);
  const antes = new Map((atuais ?? []).map((a) => [a.tipo, a.conta_ocupacao]));
  const mudou = tipos
    .filter((t) => antes.has(t))
    .map((t) => ({ tipo: t, conta: form.get(`conta.${t}`) === "on" }))
    .filter((t) => antes.get(t.tipo) !== t.conta);
  if (!mudou.length) return NADA;
  for (const m of mudou) {
    const { error } = await banco
      .from("tipos_luc")
      .update({ conta_ocupacao: m.conta })
      .eq("tipo", m.tipo);
    if (error) return erroDoBanco(error);
  }
  return salvo("tipos_luc_salvos", [TAG.comercial.tiposLuc], {
    alterados: mudou.length,
  });
}

export async function incluirTipoLuc(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const d = tipoLuc.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: primeiroErro(d.error) };
  const banco = await com();
  const { data: ultimo } = await banco
    .from("tipos_luc")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await banco
    .from("tipos_luc")
    .insert({ ...d.data, ordem: (ultimo?.ordem ?? 0) + 1 });
  if (error) return erroDoBanco(error, "Esse tipo de LUC já está cadastrado.");
  return salvo(
    "tipo_luc_incluido",
    [TAG.comercial.tiposLuc],
    {},
    "Tipo incluído.",
  );
}

// ---------------------------------------------------------------------------
// Faixas de preço de eventos
// ---------------------------------------------------------------------------

const idFaixa = z.uuid({ message: "faixa inválida" });

async function faixasComEsta(
  id: string | null,
  nova: z.infer<typeof faixaEvento>,
): Promise<{ ordem: number; erro?: string }> {
  const { data } = await (await com()).from("faixas_evento").select("*");
  const atuais = (data ?? []).map((f) => ({
    ...f,
    area_de: Number(f.area_de),
    area_ate: Number(f.area_ate),
    valor_comum: Number(f.valor_comum),
    valor_sazonal: Number(f.valor_sazonal),
  }));
  const ordem = id
    ? (atuais.find((f) => f.id === id)?.ordem ?? 0)
    : Math.max(-1, ...atuais.map((f) => f.ordem)) + 1;
  const todas = [...atuais.filter((f) => f.id !== id), { ...nova, ordem }];
  return { ordem, erro: conferirFaixasEvento(todas) ?? undefined };
}

export async function salvarFaixaEvento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const bruto = form.get("id");
  const id = bruto ? idFaixa.safeParse(bruto) : null;
  if (id && !id.success) return { erro: "Faixa inválida." };
  const d = faixaEvento.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: primeiroErro(d.error) };
  const conferida = await faixasComEsta(id?.data ?? null, d.data);
  if (conferida.erro) return { erro: conferida.erro };
  const banco = await com();
  const { error } = id
    ? await banco.from("faixas_evento").update(d.data).eq("id", id.data)
    : await banco
        .from("faixas_evento")
        .insert({ ...d.data, ordem: conferida.ordem });
  if (error) return erroDoBanco(error);
  return salvo(
    id ? "faixa_evento_salva" : "faixa_evento_incluida",
    [TAG.comercial.faixasEvento],
    { faixa: d.data.nome },
    id ? "Salvo." : "Faixa incluída.",
  );
}

export async function removerFaixaEvento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const id = idFaixa.safeParse(form.get("id"));
  if (!id.success) return { erro: "Faixa inválida." };
  const { error } = await (await com())
    .from("faixas_evento")
    .delete()
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  return salvo(
    "faixa_evento_removida",
    [TAG.comercial.faixasEvento],
    {},
    "Faixa removida.",
  );
}

// ---------------------------------------------------------------------------
// Feriados de Nova Friburgo (os.feriados, o mesmo do Tickets)
// ---------------------------------------------------------------------------

export async function incluirFeriado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const d = feriado.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: primeiroErro(d.error) };
  const { error } = await (await createClient())
    .schema("os")
    .from("feriados")
    .upsert(d.data, { onConflict: "data" });
  if (error) return erroDoBanco(error);
  return salvo(
    "feriado_incluido",
    [TAG.os.feriados],
    { data: d.data.data },
    "Feriado incluído.",
  );
}

export async function removerFeriado(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const d = z.iso.date().safeParse(form.get("data"));
  if (!d.success) return { erro: "Data inválida." };
  const { data: removido, error } = await (await createClient())
    .schema("os")
    .from("feriados")
    .delete()
    .eq("data", d.data)
    .select("data");
  if (error) return erroDoBanco(error);
  if (!removido?.length) return NADA;
  return salvo(
    "feriado_removido",
    [TAG.os.feriados],
    { data: d.data },
    "Feriado removido.",
  );
}

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

export async function removerExemplos(
  _: EstadoAcao,
  _form: FormData,
): Promise<EstadoAcao> {
  const negado = await exigir();
  if (negado) return negado;
  const { data, error } = await (await com()).rpc("remover_exemplos");
  if (error) return erroDoBanco(error);
  const contagem = (data ?? {}) as Record<string, number>;
  const total = Object.values(contagem).reduce(
    (s, n) => s + (Number(n) || 0),
    0,
  );
  refresh();
  logComercial("exemplos_removidos", (await usuarioAtual()).id, contagem);
  return {
    ok: total
      ? `${total} registro(s) de exemplo removido(s).`
      : "Não havia dados de exemplo.",
  };
}
