"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { primeiroErro } from "@/lib/operacoes/agua-edicao";
import {
  codigoDaSala,
  esquemaHidrometro,
  esquemaSala,
} from "@/lib/operacoes/cadastros";
import { podeAgora } from "@/server/auth";
import { op } from "@/server/operacoes/base";
import { logOperacoes } from "@/server/operacoes/historico";

// Cadastros de Operações: hidrômetro (quem importa a água ou liga
// hidrômetro a sala) e sala da energia (quem edita a energia). Com a
// sessão: o RLS confere de novo; cada mudança vai para a auditoria
// (gatilho) e para o histórico do sistema.

const PODE_HIDROMETRO = [
  "operacoes.agua.importar",
  "operacoes.agua.vinculo",
] as const;
const PODE_SALA = "operacoes.energia.editar" as const;

const pedidoId = z.object({ id: z.uuid("Registro inválido.") });

async function podeHidrometro() {
  for (const p of PODE_HIDROMETRO) if (await podeAgora(p)) return true;
  return false;
}

export async function salvarHidrometro(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaHidrometro.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: primeiroErro(e.error) };
  if (!(await podeHidrometro()))
    return { erro: "Você não tem permissão para cadastrar hidrômetros." };
  const { id, ...campos } = e.data;
  const db = await op();
  // Sem sala da energia escolhida: liga à de mesmo código, se existir.
  if (!campos.sala_id && campos.sala) {
    const { data: s } = await db
      .from("salas")
      .select("id")
      .eq("codigo", codigoDaSala(campos.bloco, campos.sala))
      .maybeSingle();
    campos.sala_id = s?.id ?? null;
  }
  const { data, error } = id
    ? await db.from("hidrometros").update(campos).eq("id", id).select("id")
    : await db.from("hidrometros").insert(campos).select("id");
  if (error?.code === "23505")
    return { erro: `Já existe um hidrômetro com o número ${campos.numero}.` };
  if (error || !data?.length) {
    if (error) console.error("salvar hidrômetro", error);
    return { erro: "Não foi possível salvar o hidrômetro." };
  }
  refresh();
  await logOperacoes(
    "operacoes_cadastro",
    `${id ? "Alterou" : "Cadastrou"} o hidrômetro ${campos.numero} (bloco ${campos.bloco}${campos.sala ? `, sala ${campos.sala}` : ""})`,
    { hidrometro: data[0]?.id },
  );
  return {
    ok: id ? "Hidrômetro salvo." : `Hidrômetro ${campos.numero} cadastrado.`,
  };
}

export async function excluirHidrometro(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = pedidoId.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Hidrômetro inválido." };
  if (!(await podeHidrometro()))
    return { erro: "Você não tem permissão para excluir hidrômetros." };
  const { data, error } = await (await op())
    .from("hidrometros")
    .delete()
    .eq("id", e.data.id)
    .select("numero");
  if (error || !data?.length) {
    if (error) console.error("excluir hidrômetro", error);
    return { erro: "Não foi possível excluir o hidrômetro." };
  }
  refresh();
  await logOperacoes(
    "operacoes_cadastro",
    `Excluiu o hidrômetro ${data[0]?.numero} do cadastro`,
    { hidrometro: e.data.id },
  );
  return { ok: "Hidrômetro excluído do cadastro." };
}

export async function salvarSala(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaSala.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: primeiroErro(e.error) };
  if (!(await podeAgora(PODE_SALA)))
    return { erro: "Você não tem permissão para cadastrar salas." };
  const { id, ...campos } = e.data;
  const codigo = codigoDaSala(campos.bloco, campos.sala);
  const db = await op();
  const { data, error } = id
    ? await db
        .from("salas")
        .update({ ...campos, codigo })
        .eq("id", id)
        .select("id")
    : await db
        .from("salas")
        .insert({ ...campos, codigo })
        .select("id");
  if (error?.code === "23505") return { erro: `Já existe a sala ${codigo}.` };
  if (error || !data?.length) {
    if (error) console.error("salvar sala", error);
    return { erro: "Não foi possível salvar a sala." };
  }
  refresh();
  await logOperacoes(
    "operacoes_cadastro",
    `${id ? "Alterou" : "Cadastrou"} a sala ${codigo}`,
    { sala: data[0]?.id },
  );
  return { ok: id ? "Sala salva." : `Sala ${codigo} cadastrada.` };
}

export async function excluirSala(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = pedidoId.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Sala inválida." };
  if (!(await podeAgora(PODE_SALA)))
    return { erro: "Você não tem permissão para excluir salas." };
  const { data, error } = await (await op())
    .from("salas")
    .delete()
    .eq("id", e.data.id)
    .select("codigo");
  if (error || !data?.length) {
    if (error) console.error("excluir sala", error);
    return { erro: "Não foi possível excluir a sala." };
  }
  refresh();
  await logOperacoes(
    "operacoes_cadastro",
    `Excluiu a sala ${data[0]?.codigo}`,
    { sala: e.data.id },
  );
  return {
    ok: "Sala excluída. Caixas e hidrômetros ligados a ela ficaram sem sala.",
  };
}
