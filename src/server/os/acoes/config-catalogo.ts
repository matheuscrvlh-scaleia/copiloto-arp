"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import type { CategoriaDoFormulario } from "@/components/os/novo/tipos";
import { CONFIGURACOES_OS } from "@/config/navigation";
import {
  nomeDaCopia,
  reordenar,
  validarCamposExtras,
  validarChecklist,
} from "@/lib/os/catalogo";
import { PRIORIDADES, TIPOS, UNIDADES_PRAZO } from "@/lib/os/rotulos";
import type { Json } from "@/lib/supabase/database.types";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { TAG } from "@/server/cache";
import { os, osAdmin } from "@/server/os/base";
import {
  exigir,
  exigirAgora,
  inteiroOpcional,
  json,
  marcado,
  NADA_ALTERADO,
  texto,
  textoOpcional,
  uuidOpcional,
} from "@/server/os/config-acoes";

// Catálogo por setor (spec 4.5). Grava pelo RLS (os.catalogo); o banco
// confere que a subcategoria tem um nível só e é do mesmo setor, e a
// auditoria guarda o antes e o depois. Categoria só é apagada se nunca foi
// usada (sem chamados, subcategorias, preventivas nem itens de modelo); a
// usada é desativada (os chamados antigos continuam apontando para ela).

const ROTULOS = {
  nome: "Nome",
  setor_id: "Setor",
  pai_id: "Subcategoria de",
  icone: "Ícone",
  cor: "Cor",
  tipo_padrao: "Tipo padrão",
  responsavel_padrao_id: "Responsável padrão",
  prioridade_padrao: "Prioridade padrão",
  prazo_valor: "Prazo",
  prazo_unidade: "Unidade do prazo",
  resposta_horas: "Primeira resposta",
  agenda_id: "Agenda",
  prazo_terceirizado_dias: "Retorno do terceirizado",
  campos: "Campos extras",
  checklist: "Checklist",
  orientacao_portal: "Orientação ao lojista",
};

const chaves = <T extends Record<string, string>>(o: T) =>
  Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const categoria = z.object({
  id: uuidOpcional,
  nome: texto(80, "informe o nome"),
  setor_id: z.uuid("escolha o setor"),
  pai_id: uuidOpcional,
  icone: z.string().regex(/^[a-z0-9-]{1,40}$/, "escolha um ícone"),
  cor: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "cor inválida")
      .nullable(),
  ),
  ativo: marcado,
  tipo_padrao: z.enum(chaves(TIPOS), "escolha o tipo"),
  responsavel_padrao_id: uuidOpcional,
  prioridade_padrao: z.enum(chaves(PRIORIDADES), "escolha a prioridade"),
  prazo_valor: inteiroOpcional(1, 9999),
  prazo_unidade: z.enum(chaves(UNIDADES_PRAZO)),
  resposta_horas: inteiroOpcional(1, 9999),
  precisa_confirmacao: marcado,
  registrar_tempo: marcado,
  vincular_ativo: marcado,
  vincular_loja: marcado,
  preventiva: marcado,
  agenda_id: uuidOpcional,
  prazo_terceirizado_dias: inteiroOpcional(1, 365),
  campos: json,
  checklist: json,
  no_portal: marcado,
  orientacao_portal: textoOpcional(1000),
});

export async function salvarCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = categoria.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const campos = validarCamposExtras(d.data.campos);
  if (!campos.ok) return { erro: `Campos extras: ${campos.erro}.` };
  const checklist = validarChecklist(d.data.checklist);
  if (!checklist.ok) return { erro: `Checklist: ${checklist.erro}.` };

  const { id, campos: _c, checklist: _k, ...resto } = d.data;
  if (id && resto.pai_id === id)
    return { erro: "A categoria não pode ser subcategoria dela mesma." };
  const linha = {
    ...resto,
    // Aviso não pede confirmação de quem pediu (vai e volta como ciência).
    precisa_confirmacao:
      resto.tipo_padrao === "aviso" ? false : resto.precisa_confirmacao,
    campos: campos.valor as unknown as Json,
    checklist: checklist.valor as unknown as Json,
  };
  const banco = await os();

  if (id) {
    const filhas = await banco
      .from("categorias")
      .select("id", { count: "exact", head: true })
      .eq("pai_id", id);
    if (filhas.error) return erroDoBanco(filhas.error);
    if ((filhas.count ?? 0) > 0 && linha.pai_id)
      return {
        erro: "Esta categoria tem subcategorias e por isso não pode virar subcategoria.",
      };
    const { data, error } = await banco
      .from("categorias")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!data?.length) return NADA_ALTERADO;
    updateTag(TAG.os.categorias);
    // Mudou de setor: as subcategorias vão junto (sempre do mesmo setor).
    if ((filhas.count ?? 0) > 0) {
      const mover = await banco
        .from("categorias")
        .update({ setor_id: linha.setor_id })
        .eq("pai_id", id)
        .neq("setor_id", linha.setor_id);
      if (mover.error) return erroDoBanco(mover.error);
    }
    refresh();
    return { ok: "Categoria salva." };
  }

  const ordem = await proximaOrdem(linha.setor_id, linha.pai_id);
  const { error } = await banco.from("categorias").insert({ ...linha, ordem });
  if (error) return erroDoBanco(error);
  updateTag(TAG.os.categorias);
  redirect(`${CONFIGURACOES_OS.catalogo}?setor=${linha.setor_id}&criada=1`);
}

const rapida = z.object({
  nome: texto(80, "informe o nome"),
  setorId: z.uuid("escolha o setor"),
  icone: z.string().regex(/^[a-z0-9-]{1,40}$/, "escolha um ícone"),
  tipo: z.enum(chaves(TIPOS), "escolha o tipo"),
});

/**
 * Categoria criada no "Novo chamado" por quem usa o módulo: só nome, setor,
 * ícone e tipo. Editar e excluir seguem com os.catalogo (o RLS só deixa
 * inserir a simples).
 */
export async function criarCategoriaRapida(
  dados: z.input<typeof rapida>,
): Promise<{ erro: string } | { categoria: CategoriaDoFormulario }> {
  const acesso = await exigir("os.acessar");
  if (acesso.erro) return { erro: acesso.erro.erro ?? "" };
  const d = rapida.safeParse(dados);
  if (!d.success)
    return {
      erro:
        primeiroErro(d.error, { nome: "Nome", setorId: "Setor", tipo: "Tipo" })
          .erro ?? "",
    };
  const { nome, setorId, icone, tipo } = d.data;
  const { data, error } = await (await os())
    .from("categorias")
    .insert({
      nome,
      setor_id: setorId,
      icone,
      tipo_padrao: tipo,
      precisa_confirmacao: tipo !== "aviso",
      ordem: await proximaOrdem(setorId, null),
    })
    .select("id, prioridade_padrao")
    .single();
  if (error) return { erro: erroDoBanco(error).erro ?? "" };
  updateTag(TAG.os.categorias);
  return {
    categoria: {
      id: data.id,
      setorId,
      paiId: null,
      nome,
      icone,
      cor: null,
      tipo,
      prioridade: data.prioridade_padrao,
      responsavelId: null,
      prazo: null,
      precisaConfirmacao: tipo !== "aviso",
      vincularAtivo: false,
      vincularLoja: false,
      agendaId: null,
      campos: [],
      itensChecklist: 0,
    },
  };
}

async function proximaOrdem(setorId: string, paiId: string | null) {
  let q = (await os())
    .from("categorias")
    .select("ordem")
    .eq("setor_id", setorId)
    .order("ordem", { ascending: false })
    .limit(1);
  q = paiId ? q.eq("pai_id", paiId) : q.is("pai_id", null);
  const { data } = await q;
  return (data?.[0]?.ordem ?? 0) + 1;
}

const movimento = z.object({
  id: z.uuid(),
  delta: z.enum(["-1", "1"]).transform(Number),
});

/** Sobe ou desce a categoria entre as irmãs (mesmo setor e mesmo pai). */
export async function moverCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = movimento.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const banco = await os();
  const atual = await banco
    .from("categorias")
    .select("setor_id, pai_id")
    .eq("id", d.data.id)
    .maybeSingle();
  if (atual.error) return erroDoBanco(atual.error);
  if (!atual.data) return NADA_ALTERADO;
  let q = banco
    .from("categorias")
    .select("id, ordem, nome")
    .eq("setor_id", atual.data.setor_id)
    .order("ordem")
    .order("nome");
  q = atual.data.pai_id
    ? q.eq("pai_id", atual.data.pai_id)
    : q.is("pai_id", null);
  const irmas = await q;
  if (irmas.error) return erroDoBanco(irmas.error);
  // Em paralelo: cada linha recebe a própria ordem (não há unique nela).
  const gravados = await Promise.all(
    reordenar(irmas.data ?? [], d.data.id, d.data.delta).map((m) =>
      banco.from("categorias").update({ ordem: m.ordem }).eq("id", m.id),
    ),
  );
  updateTag(TAG.os.categorias);
  const falha = gravados.find((g) => g.error)?.error;
  if (falha) return erroDoBanco(falha);
  refresh();
  return {};
}

const alternancia = z.object({
  id: z.uuid(),
  ativo: z.enum(["true", "false"]).transform((v) => v === "true"),
});

/** Desativa (some da abertura de chamados) ou reativa a categoria. */
export async function alternarCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = alternancia.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const { data, error } = await (await os())
    .from("categorias")
    .update({ ativo: d.data.ativo })
    .eq("id", d.data.id)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  updateTag(TAG.os.categorias);
  refresh();
  return {
    ok: d.data.ativo ? "Categoria reativada." : "Categoria desativada.",
  };
}

/**
 * Apaga a categoria que nunca foi usada. A contagem vê todos os chamados
 * (service role, depois de conferir os.catalogo no banco); a exclusão vai
 * pelo RLS.
 */
export async function excluirCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigirAgora("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return primeiroErro(id.error);
  const admin = osAdmin();
  const contar = (tabela: "chamados" | "planos_preventivos" | "modelo_itens") =>
    admin
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .eq("categoria_id", id.data);
  const [categoria, filhas, ...usos] = await Promise.all([
    admin.from("categorias").select("setor_id").eq("id", id.data).maybeSingle(),
    admin
      .from("categorias")
      .select("id", { count: "exact", head: true })
      .eq("pai_id", id.data),
    contar("chamados"),
    contar("planos_preventivos"),
    contar("modelo_itens"),
  ]);
  const falha = [categoria, filhas, ...usos].find((r) => r.error)?.error;
  if (falha) return erroDoBanco(falha);
  if (!categoria.data) return NADA_ALTERADO;
  if (filhas.count) return { erro: "Exclua ou mova as subcategorias antes." };
  const [chamados, planos, itens] = usos.map((u) => u.count ?? 0);
  if (chamados || planos || itens)
    return {
      erro: `Esta categoria já foi usada (${[
        chamados && `${chamados} chamado${chamados === 1 ? "" : "s"}`,
        planos && `${planos} preventiva${planos === 1 ? "" : "s"}`,
        itens && `${itens} item${itens === 1 ? "" : "s"} de modelo`,
      ]
        .filter(Boolean)
        .join(", ")}). Desative em vez de excluir.`,
    };
  const { data, error } = await (await os())
    .from("categorias")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  updateTag(TAG.os.categorias);
  redirect(`${CONFIGURACOES_OS.catalogo}?setor=${categoria.data.setor_id}`);
}

/** Cria uma cópia (sem as subcategorias) e abre para editar. */
export async function duplicarCategoria(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return primeiroErro(id.error);
  const banco = await os();
  const original = await banco
    .from("categorias")
    .select("*")
    .eq("id", id.data)
    .maybeSingle();
  if (original.error) return erroDoBanco(original.error);
  if (!original.data) return NADA_ALTERADO;
  const { id: _i, criado_em: _c, atualizado_em: _a, ...copia } = original.data;
  let irmas = banco
    .from("categorias")
    .select("nome")
    .eq("setor_id", copia.setor_id);
  irmas = copia.pai_id
    ? irmas.eq("pai_id", copia.pai_id)
    : irmas.is("pai_id", null);
  // Os nomes das irmãs e a próxima ordem não dependem um do outro.
  const [nomes, ordem] = await Promise.all([
    irmas,
    proximaOrdem(copia.setor_id, copia.pai_id),
  ]);
  if (nomes.error) return erroDoBanco(nomes.error);
  const nova = await banco
    .from("categorias")
    .insert({
      ...copia,
      nome: nomeDaCopia(
        copia.nome,
        (nomes.data ?? []).map((n) => n.nome),
      ),
      ordem,
    })
    .select("id")
    .single();
  if (nova.error) return erroDoBanco(nova.error);
  updateTag(TAG.os.categorias);
  redirect(`${CONFIGURACOES_OS.catalogo}/${nova.data.id}?copia=1`);
}
