"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { reordenar } from "@/lib/os/catalogo";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { os } from "@/server/os/base";
import {
  exigir,
  marcado,
  NADA_ALTERADO,
  texto,
  uuidOpcional,
} from "@/server/os/config-acoes";

// Setores e quem é de cada um (os.catalogo). Setor não é apagado: chamados
// antigos continuam nele; inativo, some da abertura de chamados. A
// auditoria guarda cada entrada e saída de pessoa e a marca de gestor.

const ROTULOS = {
  nome: "Nome",
  cor: "Cor",
  icone: "Ícone",
  usuario_id: "Pessoa",
};

const setor = z.object({
  id: uuidOpcional,
  nome: texto(60, "informe o nome"),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "escolha uma cor"),
  icone: z.string().regex(/^[a-z0-9-]{1,40}$/, "escolha um ícone"),
  ativo: marcado,
});

export async function salvarSetor(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = setor.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { id, ...linha } = d.data;
  const banco = await os();
  if (id) {
    const { data, error } = await banco
      .from("setores")
      .update(linha)
      .eq("id", id)
      .select("id");
    if (error) return erroDoBanco(error);
    if (!data?.length) return NADA_ALTERADO;
    refresh();
    return { ok: "Setor salvo." };
  }
  const ultima = await banco
    .from("setores")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1);
  const { error } = await banco
    .from("setores")
    .insert({ ...linha, ordem: (ultima.data?.[0]?.ordem ?? 0) + 1 });
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Setor criado. Inclua as pessoas e monte o catálogo dele." };
}

const movimento = z.object({
  id: z.uuid(),
  delta: z.enum(["-1", "1"]).transform(Number),
});

export async function moverSetor(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = movimento.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const banco = await os();
  const lista = await banco
    .from("setores")
    .select("id, ordem")
    .order("ordem")
    .order("nome");
  if (lista.error) return erroDoBanco(lista.error);
  for (const m of reordenar(lista.data ?? [], d.data.id, d.data.delta)) {
    const { error } = await banco
      .from("setores")
      .update({ ordem: m.ordem })
      .eq("id", m.id);
    if (error) return erroDoBanco(error);
  }
  refresh();
  return {};
}

const membro = z.object({
  setor_id: z.uuid(),
  usuario_id: z.uuid("escolha a pessoa"),
  gestor: marcado,
});

export async function incluirMembro(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = membro.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, ROTULOS);
  const { error } = await (await os())
    .from("setor_membros")
    .upsert(d.data, { onConflict: "setor_id,usuario_id" });
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Pessoa incluída." };
}

const gestor = z.object({
  setor_id: z.uuid(),
  usuario_id: z.uuid(),
  gestor: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function marcarGestor(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = gestor.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const { data, error } = await (await os())
    .from("setor_membros")
    .update({ gestor: d.data.gestor })
    .eq("setor_id", d.data.setor_id)
    .eq("usuario_id", d.data.usuario_id)
    .select("setor_id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  refresh();
  return {};
}

const saida = z.object({ setor_id: z.uuid(), usuario_id: z.uuid() });

export async function removerMembro(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.catalogo");
  if (acesso.erro) return acesso.erro;
  const d = saida.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error);
  const { data, error } = await (await os())
    .from("setor_membros")
    .delete()
    .eq("setor_id", d.data.setor_id)
    .eq("usuario_id", d.data.usuario_id)
    .select("setor_id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  refresh();
  return {};
}
