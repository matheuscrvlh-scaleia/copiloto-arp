"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { ACOES, CONDICOES, GATILHOS } from "@/lib/os/modelos";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { os, registrar } from "@/server/os/base";
import {
  exigir,
  inteiro,
  json,
  NADA_ALTERADO,
  texto,
  textoOpcional,
  uuidOpcional,
} from "@/server/os/config-acoes";
import { COLUNAS_LOJA, dispararModelo } from "@/server/os/modelos";
import { type ResultadoRotina, rodarRotinas } from "@/server/os/rotinas";

// Modelos de entrada e saída e lembretes recorrentes (spec 4.12). Modelos e
// itens gravam pelo RLS (os.modelos). O disparo grava com a service role
// (os.disparos só cresce pelo servidor) depois de conferir a permissão.

const chaves = <T extends Record<string, string>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const ROTULOS = {
  nome: "Nome",
  gatilho: "Quando dispara",
  descricao: "Descrição",
  itens: "Itens",
};

const item = z.object({
  id: uuidOpcional,
  setor_id: z.uuid("escolha o setor de cada item"),
  categoria_id: uuidOpcional,
  titulo: texto(160, "dê um título a cada item"),
  prazo_dias: inteiro(0, 365),
  responsavel_id: uuidOpcional,
  condicao: z.enum(chaves(CONDICOES)),
  acao: z.enum(chaves(ACOES)),
});

const modelo = z.object({
  id: uuidOpcional,
  nome: texto(80, "informe o nome"),
  gatilho: z.enum(chaves(GATILHOS), "escolha quando dispara"),
  descricao: textoOpcional(400),
  itens: json.pipe(z.array(item).max(30, "no máximo 30 itens")),
});

/** Cria ou altera o modelo e troca a lista de itens pela da tela. */
export async function salvarModelo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { erro } = await exigir("os.modelos");
  if (erro) return erro;
  const dados = modelo.safeParse(Object.fromEntries(form));
  if (!dados.success) return primeiroErro(dados.error, ROTULOS);
  const { id, itens, ...campos } = dados.data;
  if (campos.gatilho !== "manual" && itens.length === 0)
    return {
      erro: "Um modelo de entrada ou saída precisa de ao menos um item.",
    };

  const db = await os();
  let modeloId = id;
  if (modeloId) {
    const { data, error } = await db
      .from("modelos")
      .update(campos)
      .eq("id", modeloId)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!data?.length) return NADA_ALTERADO;
  } else {
    const { data, error } = await db
      .from("modelos")
      .insert(campos)
      .select("id")
      .single();
    if (error) return erroDoBanco(error);
    modeloId = data.id;
  }

  // Itens que saíram da lista são apagados; os outros, gravados na ordem.
  const manter = itens.flatMap((i) => (i.id ? [i.id] : []));
  let apagar = db.from("modelo_itens").delete().eq("modelo_id", modeloId);
  if (manter.length) apagar = apagar.not("id", "in", `(${manter.join(",")})`);
  const removidos = await apagar;
  if (removidos.error) return erroDoBanco(removidos.error);
  const linhas = itens.map(({ id: itemId, ...i }, ordem) => ({
    ...(itemId ? { id: itemId } : {}),
    ...i,
    modelo_id: modeloId as string,
    ordem,
  }));
  const existentes = linhas.filter((l) => "id" in l);
  const novos = linhas.filter((l) => !("id" in l));
  if (existentes.length) {
    const { error } = await db.from("modelo_itens").upsert(existentes);
    if (error) return erroDoBanco(error);
  }
  if (novos.length) {
    const { error } = await db.from("modelo_itens").insert(novos);
    if (error) return erroDoBanco(error);
  }
  refresh();
  return {
    ok: id
      ? `Modelo salvo (${itens.length} ${itens.length === 1 ? "item" : "itens"}).`
      : "Modelo criado.",
  };
}

/** Ativa ou desativa: modelo desativado não dispara sozinho. */
export async function alternarModelo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { erro } = await exigir("os.modelos");
  if (erro) return erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { erro: "Modelo inválido." };
  const ativo = form.get("ativo") === "true";
  const { data, error } = await (await os())
    .from("modelos")
    .update({ ativo })
    .eq("id", id.data)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  refresh();
  return { ok: ativo ? "Modelo ativado." : "Modelo desativado." };
}

const disparo = z.object({
  modelo_id: z.uuid("escolha o modelo"),
  loja_id: z.uuid("escolha a loja (contrato)"),
});

/**
 * "Disparar modelo" à mão: quando o ENET não trouxer o dado ou num caso
 * fora do comum. Uma vez só por modelo e contrato.
 */
export async function dispararModeloManual(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { ctx, erro } = await exigir("os.modelos");
  if (erro) return erro;
  const dados = disparo.safeParse(Object.fromEntries(form));
  if (!dados.success)
    return primeiroErro(dados.error, { modelo_id: "Modelo", loja_id: "Loja" });

  const db = await os();
  const [m, loja] = await Promise.all([
    db
      .from("modelos")
      .select("*, itens:modelo_itens(*)")
      .eq("id", dados.data.modelo_id)
      .maybeSingle(),
    db
      .from("lojas")
      .select(COLUNAS_LOJA)
      .eq("id", dados.data.loja_id)
      .maybeSingle(),
  ]);
  if (m.error) return erroDoBanco(m.error);
  if (loja.error) return erroDoBanco(loja.error);
  if (!m.data || !loja.data) return NADA_ALTERADO;
  if (!m.data.itens.length) return { erro: "O modelo não tem itens." };

  try {
    const feito = await dispararModelo({
      modelo: m.data,
      loja: loja.data,
      usuario: { id: ctx.usuario.id, nome: ctx.usuario.nome },
      automatico: false,
    });
    if (!feito)
      return {
        erro: `O modelo ${m.data.nome} já foi disparado para ${loja.data.nome}. O histórico fica no contrato.`,
      };
    refresh();
    return {
      ok: `Aviso #${feito.numero} criado para ${loja.data.nome}.${feito.avisos.length ? ` ${feito.avisos.join(" ")}` : ""}`,
    };
  } catch (e) {
    console.error("disparar modelo", e);
    return {
      erro:
        e instanceof Error ? e.message : "Não foi possível disparar o modelo.",
    };
  }
}

/** Para a série: nenhuma ocorrência repete mais (as criadas ficam). */
export async function pararSerie(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { erro } = await exigir("os.modelos");
  if (erro) return erro;
  const serie = z.uuid().safeParse(form.get("serie_id"));
  const ultima = z.uuid().safeParse(form.get("ultima_id"));
  if (!serie.success || !ultima.success) return { erro: "Série inválida." };
  const { data, error } = await (await os())
    .from("chamados")
    .update({ recorrencia: null })
    .or(`serie_id.eq.${serie.data},id.eq.${serie.data}`)
    .not("recorrencia", "is", null)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  await registrar(ultima.data, {
    tipo: "alteracao",
    texto: "Parou de repetir: nenhuma ocorrência nova será criada.",
    dados: { campo: "recorrencia", para: null },
  });
  refresh();
  return { ok: "Série parada. As ocorrências já criadas continuam." };
}

export interface EstadoRotinas {
  resultados?: ResultadoRotina[];
  em?: string;
  erro?: string;
}

/** "Rodar rotinas agora": o mesmo que o cron faz de hora em hora. */
export async function rodarRotinasAgora(
  _: EstadoRotinas,
  _form: FormData,
): Promise<EstadoRotinas> {
  const { ctx, erro } = await exigir("os.parametros", "os.modelos");
  if (erro) return { erro: erro.erro };
  const agora = new Date();
  const resultados = await rodarRotinas(agora, ctx.usuario.id);
  refresh();
  return { resultados, em: agora.toISOString() };
}
