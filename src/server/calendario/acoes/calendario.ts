"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { ICONES_TIPO, RECORRENCIAS, VISIBILIDADES } from "@/lib/calendario";
import { createClient } from "@/lib/supabase/server";
import { erroDoBanco, primeiroErro, valores } from "@/server/acoes";
import { TAG } from "@/server/cache";
import { tipos } from "../base";

// Gravações do calendário, todas com a sessão: o RLS confere quem cria,
// edita, conclui e configura (supabase/migrations/…_calendario.sql). Os
// itens não ficam em cache (cada pessoa vê os seus): basta refresh(). Os
// tipos ficam: quem grava invalida TAG.calendario.tipos.

const texto = (max: number) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(max, `máximo de ${max} caracteres`).nullable(),
  );
const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");
const dataOpcional = z.preprocess((v) => (v ? v : null), data.nullable());
const hora = z.preprocess(
  (v) => (v ? v : null),
  z
    .string()
    .regex(/^\d{2}:\d{2}$/, "hora inválida")
    .nullable(),
);
const id = z.uuid("escolha um item da lista");
/** Campo repetido do formulário (um id por marcado). */
const ids = (max: number) =>
  z.preprocess(
    (v) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []),
    z.array(id).max(max, `no máximo ${max}`),
  );
const marcado = z.preprocess((v) => v === "on" || v === "true", z.boolean());

const item = z.object({
  id: z.preprocess((v) => (v ? v : undefined), id.optional()),
  tipo_id: id,
  titulo: z
    .string()
    .trim()
    .min(1, "informe o título")
    .max(160, "máximo de 160"),
  descricao: texto(4000),
  local: texto(200),
  inicio: data,
  fim: dataOpcional,
  dia_inteiro: marcado,
  hora_inicio: hora,
  hora_fim: hora,
  responsavel_id: z.preprocess((v) => (v ? v : null), id.nullable()),
  recorrencia: z.preprocess(
    (v) => (v ? v : null),
    z.enum(Object.keys(RECORRENCIAS) as [keyof typeof RECORRENCIAS]).nullable(),
  ),
  recorrencia_ate: dataOpcional,
  visibilidade: z.enum(
    Object.keys(VISIBILIDADES) as [keyof typeof VISIBILIDADES],
    "escolha quem vê",
  ),
  setores: ids(50),
  cargos: ids(50),
  usuarios: ids(200),
});

const ROTULOS_ITEM = {
  tipo_id: "Tipo",
  titulo: "Título",
  descricao: "Descrição",
  local: "Local",
  inicio: "Início",
  fim: "Fim",
  hora_inicio: "Hora de início",
  hora_fim: "Hora de fim",
  responsavel_id: "Responsável",
  recorrencia: "Repetir",
  recorrencia_ate: "Repetir até",
  visibilidade: "Quem vê",
  setores: "Setores",
  cargos: "Cargos",
  usuarios: "Pessoas",
};

export async function salvarItem(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = item.safeParse({
    ...Object.fromEntries(form),
    setores: valores(form, "setores"),
    cargos: valores(form, "cargos"),
    usuarios: valores(form, "usuarios"),
  });
  if (!d.success) return primeiroErro(d.error, ROTULOS_ITEM);
  const v = d.data;
  const tipo = (await tipos()).find((t) => t.id === v.tipo_id);
  if (!tipo) return { erro: "Tipo: escolha um da lista." };

  // Só grava o que o tipo usa; o resto fica vazio.
  const fim = tipo.usa_periodo && v.fim ? v.fim : v.inicio;
  const comHora = tipo.usa_horario && !v.dia_inteiro && !!v.hora_inicio;
  const recorrencia = tipo.usa_recorrencia ? v.recorrencia : null;
  const restrito = v.visibilidade === "restrito";
  if (fim < v.inicio) return { erro: "Fim: não pode ser antes do início." };
  if (
    comHora &&
    v.hora_fim &&
    fim === v.inicio &&
    v.hora_fim <= (v.hora_inicio ?? "")
  )
    return { erro: "Hora de fim: precisa ser depois do início." };
  if (tipo.usa_horario && !v.dia_inteiro && !v.hora_inicio)
    return { erro: "Hora de início: informe ou marque Dia inteiro." };
  if (restrito && !v.setores.length && !v.cargos.length && !v.usuarios.length)
    return { erro: "Quem vê: escolha ao menos um setor, cargo ou pessoa." };
  if (recorrencia && v.recorrencia_ate && v.recorrencia_ate < v.inicio)
    return { erro: "Repetir até: não pode ser antes do início." };

  const linha = {
    tipo_id: v.tipo_id,
    titulo: v.titulo,
    descricao: v.descricao,
    local: tipo.usa_local ? v.local : null,
    inicio: v.inicio,
    fim,
    hora_inicio: comHora ? v.hora_inicio : null,
    hora_fim: comHora ? v.hora_fim : null,
    responsavel_id: tipo.usa_responsavel ? v.responsavel_id : null,
    recorrencia,
    recorrencia_ate: recorrencia ? v.recorrencia_ate : null,
    visibilidade: v.visibilidade,
    setores: restrito ? v.setores : [],
    cargos: restrito ? v.cargos : [],
    usuarios: restrito ? v.usuarios : [],
  };
  const tabela = (await createClient()).schema("calendario").from("itens");
  const { data: gravados, error } = v.id
    ? await tabela.update(linha).eq("id", v.id).select("id")
    : await tabela.insert(linha).select("id");
  if (error) return erroDoBanco(error);
  if (!gravados?.length)
    return { erro: "Você não tem permissão para editar este item." };
  refresh();
  return { ok: v.id ? "Item atualizado." : "Item criado." };
}

export async function excluirItem(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const alvo = id.safeParse(form.get("id"));
  if (!alvo.success) return { erro: "Item inválido." };
  const { data: apagados, error } = await (await createClient())
    .schema("calendario")
    .from("itens")
    .delete()
    .eq("id", alvo.data)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!apagados?.length)
    return { erro: "Você não tem permissão para excluir este item." };
  refresh();
  return { ok: "Item excluído." };
}

export async function concluirItem(
  itemId: string,
  feito: boolean,
): Promise<EstadoAcao> {
  const alvo = id.safeParse(itemId);
  if (!alvo.success) return { erro: "Item inválido." };
  const { error } = await (await createClient())
    .schema("calendario")
    .rpc("concluir", { p_item: alvo.data, p_feito: feito });
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: feito ? "Marcado como feito." : "Reaberto." };
}

// ---------------------------------------------------------------------------
// Tipos (Calendário › Tipos de item)
// ---------------------------------------------------------------------------

const tipo = z.object({
  id: z.preprocess((v) => (v ? v : undefined), id.optional()),
  nome: z.string().trim().min(1, "informe o nome").max(40, "máximo de 40"),
  descricao: texto(200),
  cor: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^#[0-9a-f]{6}$/, "use uma cor como #2a78d6"),
  icone: z.enum(
    Object.keys(ICONES_TIPO) as [keyof typeof ICONES_TIPO],
    "escolha um ícone",
  ),
  usa_horario: marcado,
  usa_periodo: marcado,
  usa_local: marcado,
  usa_responsavel: marcado,
  usa_conclusao: marcado,
  usa_recorrencia: marcado,
  visibilidade_padrao: z.enum(
    Object.keys(VISIBILIDADES) as [keyof typeof VISIBILIDADES],
    "escolha quem vê",
  ),
  ordem: z.coerce.number().int("número inteiro").min(0).max(999),
  ativo: marcado,
});

const ROTULOS_TIPO = {
  nome: "Nome",
  descricao: "Descrição",
  cor: "Cor",
  icone: "Ícone",
  visibilidade_padrao: "Quem vê por padrão",
  ordem: "Ordem",
};

export async function salvarTipo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = tipo.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS_TIPO);
  const { id: tipoId, ...linha } = d.data;
  const tabela = (await createClient()).schema("calendario").from("tipos");
  const { data: gravados, error } = tipoId
    ? await tabela.update(linha).eq("id", tipoId).select("id")
    : await tabela.insert(linha).select("id");
  if (error) return erroDoBanco(error);
  if (!gravados?.length)
    return { erro: "Você não tem permissão para configurar o calendário." };
  updateTag(TAG.calendario.tipos);
  refresh();
  return { ok: tipoId ? "Tipo atualizado." : "Tipo criado." };
}

export async function excluirTipo(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const alvo = id.safeParse(form.get("id"));
  if (!alvo.success) return { erro: "Tipo inválido." };
  const { data: apagados, error } = await (await createClient())
    .schema("calendario")
    .from("tipos")
    .delete()
    .eq("id", alvo.data)
    .select("id");
  if (error?.code === "23503")
    return {
      erro: "Este tipo já tem itens no calendário. Desative-o em vez de excluir: os itens continuam lá.",
    };
  if (error) return erroDoBanco(error);
  if (!apagados?.length)
    return { erro: "Você não tem permissão para configurar o calendário." };
  updateTag(TAG.calendario.tipos);
  refresh();
  return { ok: "Tipo excluído." };
}
