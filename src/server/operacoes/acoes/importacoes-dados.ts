"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { tipoDoComprovante } from "@/lib/operacoes/agua-conta";
import { esquemaLeitura, primeiroErro } from "@/lib/operacoes/agua-edicao";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import { gravarArquivo, removerArquivos } from "@/server/arquivos";
import { podeAgora } from "@/server/auth";
import { op } from "@/server/operacoes/base";
import { logOperacoes } from "@/server/operacoes/historico";

// Corrigir o que a importação da água trouxe, uma leitura por vez: os
// campos, o valor (só quem vê reais), a foto do visor, ou excluir a
// leitura. Com a sessão: o RLS só deixa mexer na leitura que vale e para
// quem importa a água; cada mudança fica na auditoria (gatilho) e no
// histórico do sistema.

const PERMISSAO = "operacoes.agua.importar" as const;
const SEM_PERMISSAO = "Você não tem permissão para corrigir a água.";
const BUCKET = "operacoes" as const;
const FOTO_MAX = 10 * 1024 * 1024;

type Banco = Awaited<ReturnType<typeof op>>;

async function leituraQueVale(db: Banco, id: string) {
  const { data, error } = await db
    .from("agua_leituras")
    .select("id, referencia, bloco, sala, hidrometro, importacao_id, vigente")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.vigente ? data : null;
}

const descrever = (l: {
  referencia: string;
  hidrometro: string;
  bloco: string;
}) =>
  `hidrômetro ${l.hidrometro} (bloco ${l.bloco}) de ${rotuloMes(l.referencia)}`;

export async function salvarLeituraAgua(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = esquemaLeitura.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: primeiroErro(e.error) };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const { id, valor, ...lidos } = e.data;
  // O esquema já exige consumo e volume (o ?? só acerta o tipo).
  const campos = {
    ...lidos,
    consumo: lidos.consumo ?? 0,
    volume_faturado: lidos.volume_faturado ?? 0,
  };
  const db = await op();
  const atual = await leituraQueVale(db, id).catch(() => null);
  if (!atual)
    return {
      erro: "Leitura não encontrada ou não vale mais (o mês foi desfeito ou substituído).",
    };
  const { data, error } = await db
    .from("agua_leituras")
    .update(campos)
    .eq("id", id)
    .select("id");
  if (error) {
    if (error.code === "23505")
      return {
        erro: "Já há esse hidrômetro na mesma sala e bloco deste mês.",
      };
    console.error("corrigir leitura da água", error);
    return { erro: "Não foi possível salvar a correção." };
  }
  if (!data?.length) return { erro: SEM_PERMISSAO };

  let aviso = "";
  if (valor !== null) {
    if (await podeAgora("operacoes.agua.valores")) {
      const v = await db
        .from("agua_valores")
        .update({ valor })
        .eq("leitura_id", id)
        .select("leitura_id");
      if (v.error || !v.data?.length) {
        if (v.error) console.error("corrigir valor da água", v.error);
        aviso = " O valor não foi alterado.";
      }
    } else aviso = " O valor só muda com a permissão de ver reais.";
  }
  refresh();
  await logOperacoes(
    "operacoes_importacao_corrigida",
    `Corrigiu a leitura do ${descrever({ ...atual, ...campos })}`,
    { importacao: atual.importacao_id, leitura: id },
  );
  return { ok: `Leitura corrigida.${aviso}` };
}

const pedidoId = z.object({ id: z.uuid("Leitura inválida.") });

export async function excluirLeituraAgua(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = pedidoId.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Leitura inválida." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const db = await op();
  const atual = await leituraQueVale(db, e.data.id).catch(() => null);
  if (!atual) return { erro: "Leitura não encontrada ou já excluída." };
  const { data, error } = await db
    .from("agua_leituras")
    .delete()
    .eq("id", e.data.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("excluir leitura da água", error);
    return { erro: "Não foi possível excluir a leitura." };
  }
  refresh();
  await logOperacoes(
    "operacoes_importacao_corrigida",
    `Excluiu a leitura do ${descrever(atual)}`,
    { importacao: atual.importacao_id, leitura: e.data.id, excluida: true },
  );
  return { ok: "Leitura excluída." };
}

/**
 * Troca (ou põe) a foto do visor de uma leitura. A foto anterior fica no
 * disco: o mesmo arquivo pode estar ligado à leitura de outra versão do mês.
 */
export async function trocarFotoLeitura(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = pedidoId.safeParse({ id: form.get("id") });
  if (!e.success) return { erro: "Leitura inválida." };
  const arquivo = form.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha a foto." };
  if (arquivo.size > FOTO_MAX) return { erro: "A foto passa de 10 MB." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoDoComprovante(bytes);
  if (!tipo?.startsWith("image/"))
    return { erro: "O arquivo não é foto (.jpg, .png ou .webp)." };
  const db = await op();
  const atual = await leituraQueVale(db, e.data.id).catch(() => null);
  if (!atual) return { erro: "Leitura não encontrada ou não vale mais." };

  const ext = tipo === "image/jpeg" ? "jpg" : tipo.slice(6);
  const caminho = `agua/fotos/corrigidas/${atual.referencia.slice(0, 7)}/${randomUUID()}.${ext}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, tipo);
  } catch (erro) {
    console.error("gravar foto da leitura", erro);
    return { erro: "Não foi possível guardar a foto. Tente de novo." };
  }
  const { data, error } = await db
    .from("agua_leituras")
    .update({ foto: caminho })
    .eq("id", e.data.id)
    .select("id");
  if (error || !data?.length) {
    await removerArquivos(BUCKET, [caminho]).catch(() => {});
    if (error) console.error("ligar foto da leitura", error);
    return { erro: "Não foi possível ligar a foto." };
  }
  refresh();
  await logOperacoes(
    "operacoes_importacao_corrigida",
    `Trocou a foto do ${descrever(atual)}`,
    { importacao: atual.importacao_id, leitura: e.data.id, foto: caminho },
  );
  return { ok: "Foto atualizada." };
}

export async function tirarFotoLeitura(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const e = pedidoId.safeParse(Object.fromEntries(form));
  if (!e.success) return { erro: "Leitura inválida." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const db = await op();
  const atual = await leituraQueVale(db, e.data.id).catch(() => null);
  if (!atual) return { erro: "Leitura não encontrada ou não vale mais." };
  const { data, error } = await db
    .from("agua_leituras")
    .update({ foto: null })
    .eq("id", e.data.id)
    .select("id");
  if (error || !data?.length) {
    if (error) console.error("tirar foto da leitura", error);
    return { erro: "Não foi possível tirar a foto." };
  }
  refresh();
  await logOperacoes(
    "operacoes_importacao_corrigida",
    `Tirou a foto do ${descrever(atual)}`,
    { importacao: atual.importacao_id, leitura: e.data.id },
  );
  return { ok: "Foto retirada da leitura." };
}
