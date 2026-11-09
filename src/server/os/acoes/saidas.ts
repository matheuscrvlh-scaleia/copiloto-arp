"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { rotaAtivo } from "@/lib/os/rotas";
import {
  esquemaDaSaida,
  LIMITE_ANEXOS,
  limparListaDeSaida,
  ROTULOS_SAIDA,
  rotuloDaSaida,
  TIPO_VENDA,
} from "@/lib/os/saidas";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import { erroDoBanco, primeiroErro } from "@/server/acoes";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { enviarArquivo, os, removerArquivos } from "@/server/os/base";
import { exigir, json, NADA_ALTERADO } from "@/server/os/config-acoes";
import { listasDeSaida } from "@/server/os/saidas";

// Saída do ativo (venda, doação, descarte, devolução, outro): registra pela
// função do banco (os.registrar_saida_ativo, ou os.registrar_saida_sobra
// para material sem cadastro), que confere os.ativos_saida e baixa o ativo
// numa transação. Os anexos vão ao bucket "os" antes, depois de conferir a
// permissão agora no banco; se o registro falhar, eles são apagados.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para registrar a saída de ativos.",
};

// Fotos, recibo ou termo de doação: imagem ou PDF (o bucket é servido por
// link assinado; nada de HTML ou script).
const TIPOS_ANEXO = /^(image\/(jpeg|png|webp)|application\/pdf)$/;
const LIMITE_ARQUIVO = 4 * 1024 * 1024;
// A Server Action aceita até 10 MB (next.config.ts) com os campos.
const LIMITE_TOTAL = 9 * 1024 * 1024;

const vazioNulo = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? null : v;

const ativoExistente = z.object({ ativo_id: z.uuid("ativo inválido") });
const sobra = z.object({
  nome: z.string().trim().min(2, "diga o que está saindo").max(200),
  categoria_id: z.preprocess(vazioNulo, z.uuid().nullable()),
  bloco: z.preprocess(vazioNulo, z.string().trim().max(80).nullable()),
  area: z.preprocess(vazioNulo, z.string().trim().max(200).nullable()),
});

function anexosDoForm(form: FormData): File[] | EstadoAcao {
  const arquivos = form
    .getAll("anexos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (arquivos.length > LIMITE_ANEXOS)
    return { erro: `Anexos: até ${LIMITE_ANEXOS} arquivos.` };
  if (arquivos.some((a) => !TIPOS_ANEXO.test(a.type)))
    return { erro: "Anexos: envie fotos (JPG, PNG, WebP) ou PDF." };
  if (arquivos.some((a) => a.size > LIMITE_ARQUIVO))
    return { erro: "Anexos: até 4 MB por arquivo." };
  if (arquivos.reduce((s, a) => s + a.size, 0) > LIMITE_TOTAL)
    return { erro: "Anexos: até 9 MB somando todos." };
  return arquivos;
}

function caminhoDoAnexo(lote: string, nome: string): string {
  const limpo =
    nome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "anexo";
  return `saidas/${lote}/${randomBytes(6).toString("hex")}-${limpo}`;
}

/** Grava os anexos; se um falhar, apaga os que já foram. */
async function guardarAnexos(arquivos: File[]): Promise<string[] | null> {
  const lote = randomUUID();
  const gravados: string[] = [];
  try {
    for (const a of arquivos) {
      const caminho = caminhoDoAnexo(lote, a.name);
      await enviarArquivo(caminho, await a.arrayBuffer(), a.type);
      gravados.push(caminho);
    }
    return gravados;
  } catch (erro) {
    console.error("anexos da saída do ativo", erro);
    await removerArquivos(gravados);
    return null;
  }
}

/**
 * Registrar saída: com `ativo_id`, do ativo da ficha; sem ele, a sobra sem
 * cadastro (nome, categoria e local), que vira um ativo já baixado e abre a
 * ficha dele.
 */
export async function registrarSaida(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const campos = Object.fromEntries(
    [...form.entries()].filter(([, v]) => typeof v === "string"),
  );
  const ehSobra = !campos.ativo_id;
  const alvo = ehSobra
    ? sobra.safeParse(campos)
    : ativoExistente.safeParse(campos);
  if (!alvo.success) return primeiroErro(alvo.error, ROTULOS_SAIDA);
  const d = esquemaDaSaida(await listasDeSaida()).safeParse(campos);
  if (!d.success) return primeiroErro(d.error, ROTULOS_SAIDA);
  if (d.data.data > hojeEmBrasilia(new Date()))
    return { erro: "Data: não pode ser no futuro." };
  const arquivos = anexosDoForm(form);
  if (!Array.isArray(arquivos)) return arquivos;

  // Os anexos vão ao disco antes da função do banco: confere agora.
  if (!(await podeAgora("os.ativos_saida"))) return SEM_PERMISSAO;
  const anexos = arquivos.length ? await guardarAnexos(arquivos) : [];
  if (!anexos)
    return { erro: "Não foi possível guardar os anexos. Nada foi registrado." };

  const s = d.data;
  // O gerador de tipos não marca argumento de função como anulável; o
  // banco aceita null em todos estes (nullif/coalesce na função).
  const comuns = {
    p_tipo: s.tipo,
    p_data: s.data,
    p_quantidade: s.quantidade as string,
    p_valor: s.valor as number,
    p_forma: s.forma as string,
    p_recebido_por: s.recebido_por as string,
    p_destinatario: s.destinatario as string,
    p_documento: s.documento as string,
    p_responsavel: s.responsavel_id as string,
    p_motivo: s.motivo as string,
    p_nf: s.nf,
    p_nf_numero: s.nf_numero as string,
    p_observacoes: s.observacoes as string,
    p_anexos: anexos,
  };
  const db = await os();
  if (ehSobra && alvo.success && "nome" in alvo.data) {
    const { data, error } = await db.rpc("registrar_saida_sobra", {
      ...comuns,
      p_nome: alvo.data.nome,
      p_categoria: alvo.data.categoria_id as string,
      p_bloco: alvo.data.bloco as string,
      p_area: alvo.data.area as string,
    });
    const novo = data?.[0]?.ativo_id;
    if (error || !novo) {
      await removerArquivos(anexos);
      return error ? erroDoBanco(error) : { erro: "Ativo não criado." };
    }
    redirect(`${rotaAtivo(novo)}?saida=1`);
  }

  const { error } = await db.rpc("registrar_saida_ativo", {
    ...comuns,
    p_ativo: (alvo.data as { ativo_id: string }).ativo_id,
  });
  if (error) {
    await removerArquivos(anexos);
    if (error.code === "23514" && s.tipo === TIPO_VENDA)
      return { erro: "Valor: obrigatório na venda." };
    return erroDoBanco(error);
  }
  refresh();
  return {
    ok: `Saída registrada: o ativo ficou "Baixado – ${rotuloDaSaida(s.tipo)}".`,
  };
}

const desfazer = z.object({
  id: z.uuid("saída inválida"),
  motivo: z
    .string()
    .trim()
    .min(3, "diga por que a saída foi desfeita")
    .max(500),
});

/** Desfazer a saída (com motivo): o ativo volta à situação de antes. */
export async function desfazerSaida(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const d = desfazer.safeParse(Object.fromEntries(form));
  if (!d.success) return primeiroErro(d.error, { motivo: "Motivo" });
  const { error } = await (await os()).rpc("desfazer_saida_ativo", {
    p_saida: d.data.id,
    p_motivo: d.data.motivo,
  });
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Saída desfeita. O ativo voltou à situação de antes." };
}

// ---------------------------------------------------------------------------
// Parâmetros do Chamados: tipos de saída e formas de recebimento
// ---------------------------------------------------------------------------

const listas = z.object({
  ativos_saida_tipos: json,
  ativos_saida_formas: json,
});

const textos = (v: unknown) =>
  limparListaDeSaida(
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [],
  );

export async function salvarListasDeSaida(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const acesso = await exigir("os.parametros");
  if (acesso.erro) return acesso.erro;
  const d = listas.safeParse(Object.fromEntries(form));
  if (!d.success) return { erro: "Listas inválidas. Recarregue a tela." };
  const tipos = textos(d.data.ativos_saida_tipos);
  const formas = textos(d.data.ativos_saida_formas);
  if (!tipos.length || !formas.length)
    return {
      erro: "Deixe ao menos um tipo de saída e uma forma de recebimento.",
    };
  if (!tipos.includes(TIPO_VENDA))
    return {
      erro: `Mantenha o tipo "${TIPO_VENDA}": nele o valor é obrigatório e o relatório soma o total vendido.`,
    };
  const { data, error } = await (await os())
    .from("parametros")
    .update({ ativos_saida_tipos: tipos, ativos_saida_formas: formas })
    .eq("id", 1)
    .select("id");
  if (error) return erroDoBanco(error);
  if (!data?.length) return NADA_ALTERADO;
  updateTag(TAG.os.parametros);
  refresh();
  return { ok: "Salvo." };
}
