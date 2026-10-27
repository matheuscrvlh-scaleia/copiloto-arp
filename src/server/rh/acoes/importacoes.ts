"use server";

import { randomUUID } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { formatarMes } from "@/lib/formato";
import { ErroExtrato } from "@/lib/rh/folha/extrato";
import { GRUPOS_CLASSIFICAVEIS } from "@/lib/rh/rubricas";
import { createClient } from "@/lib/supabase/server";
import { pode, podeAgora, usuarioAtual } from "@/server/auth";
import { TAG } from "@/server/cache";
import {
  recalcularCusto,
  recalcularEmAberto,
  tentarRecalcular,
} from "@/server/rh/custo";
import {
  BUCKET,
  contextoDoBanco,
  folhaParaGravar,
  lerPdfDaFolha,
  montarPrevia,
  type Previa,
  sha256,
  TAMANHO_MAXIMO,
} from "@/server/rh/folha";

export interface EstadoLeitura {
  previa?: Previa;
  erro?: string;
}

const SEM_PERMISSAO = "Você não tem permissão para importar a folha.";

function ehPdf(bytes: Uint8Array): boolean {
  // Todo PDF começa com "%PDF".
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

/** Lê o arquivo, guarda no bucket privado e devolve a prévia para conferência. */
export async function lerFolha(
  _: EstadoLeitura,
  form: FormData,
): Promise<EstadoLeitura> {
  if (!(await pode("rh.folha"))) return { erro: SEM_PERMISSAO };

  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { erro: "Escolha o arquivo do Extrato Mensal (PDF)." };
  }
  if (arquivo.size > TAMANHO_MAXIMO)
    return { erro: "O arquivo passa de 10 MB." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!ehPdf(bytes)) {
    return {
      erro: "O arquivo não é um PDF. Por enquanto a importação aceita o Extrato Mensal em PDF.",
    };
  }

  let extrato: Awaited<ReturnType<typeof lerPdfDaFolha>>;
  try {
    extrato = await lerPdfDaFolha(bytes);
  } catch (erro) {
    if (erro instanceof ErroExtrato) return { erro: erro.message };
    console.error("leitura da folha", erro);
    return {
      erro: "Não consegui ler o PDF. Confira se é o Extrato Mensal da Sousa e Couto.",
    };
  }

  const [usuario, ctx, supabase] = await Promise.all([
    usuarioAtual(),
    contextoDoBanco(extrato),
    createClient(),
  ]);
  const id = randomUUID();
  const nome = arquivo.name.slice(0, 200);
  const caminho = `folha/${id}/${
    nome
      .normalize("NFD")
      .replace(/[^\w.-]+/g, "_")
      .slice(-80) || "extrato.pdf"
  }`;

  const envio = await supabase.storage
    .from(BUCKET)
    .upload(caminho, bytes, { contentType: "application/pdf", upsert: false });
  if (envio.error) {
    console.error("upload da folha", envio.error);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }

  const previa = montarPrevia(extrato, ctx, {
    importacaoId: id,
    arquivo: nome,
  });
  const registro = await supabase
    .schema("core")
    .from("importacoes")
    .insert({
      id,
      tipo: "folha",
      referencia: extrato.competencia,
      arquivo_nome: nome,
      arquivo_path: caminho,
      arquivo_sha256: sha256(bytes),
      enviado_por: usuario.id,
      avisos: {
        pessoas: previa.pessoas,
        rubricas_novas: previa.rubricasNovas.length,
        fora_do_copiloto: previa.foraDoCopiloto.length,
        departamentos_sem_codigo: previa.departamentosSemCodigo.map(
          (d) => d.codigo,
        ),
        pessoas_incoerentes: previa.conferencia.incoerentes.length,
      },
    });
  if (registro.error) {
    console.error("registro da importação", registro.error);
    return { erro: "Não foi possível registrar a importação. Tente de novo." };
  }
  return { previa };
}

const confirmacao = z.object({
  importacao_id: z.uuid(),
  substituir: z.preprocess((v) => v === "on", z.boolean()),
});

/** Relê o arquivo guardado e grava a folha numa transação só. */
export async function confirmarFolha(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.folha"))) return { erro: SEM_PERMISSAO };
  const dados = confirmacao.safeParse(Object.fromEntries(form));
  if (!dados.success)
    return { erro: "Prévia inválida. Envie o arquivo de novo." };

  // De-para escolhido na prévia: dep_<código da folha> = id do departamento.
  const departamentos: Record<string, string> = {};
  for (const [campo, valor] of form) {
    const codigo = campo.match(/^dep_(\d+)$/)?.[1];
    if (
      codigo &&
      typeof valor === "string" &&
      z.uuid().safeParse(valor).success
    ) {
      departamentos[codigo] = valor;
    }
  }

  const supabase = await createClient();
  const { data: importacao, error } = await supabase
    .schema("core")
    .from("importacoes")
    .select("arquivo_path, status")
    .eq("id", dados.data.importacao_id)
    .maybeSingle();
  if (error || !importacao)
    return { erro: "Importação não encontrada. Envie o arquivo de novo." };
  if (importacao.status !== "previa")
    return { erro: "Esta prévia já foi usada. Envie o arquivo de novo." };

  const arquivo = await supabase.storage
    .from(BUCKET)
    .download(importacao.arquivo_path);
  if (arquivo.error)
    return { erro: "Não encontrei o arquivo enviado. Envie de novo." };
  const extrato = await lerPdfDaFolha(
    new Uint8Array(await arquivo.data.arrayBuffer()),
  );

  const { data: resultado, error: falha } = await supabase
    .schema("rh")
    .rpc("importar_folha", {
      p_importacao_id: dados.data.importacao_id,
      p_folha: folhaParaGravar(extrato),
      p_departamentos: departamentos,
      p_substituir: dados.data.substituir,
    });
  if (falha) {
    // Erros levantados pela função (P0001) já vêm em português, para a tela.
    if (falha.code === "P0001" || falha.code === "42501")
      return { erro: falha.message };
    console.error("importar_folha", falha);
    return { erro: "Não foi possível gravar a folha. Nada foi alterado." };
  }

  // A importação cria departamentos, cargos e rubricas novos e grava o
  // código da folha nos departamentos do de-para.
  updateTag(TAG.rh.departamentos);
  updateTag(TAG.rh.cargos);
  updateTag(TAG.rh.rubricas);
  const r = resultado as Record<string, number>;
  const calculado = await tentarRecalcular(() =>
    recalcularCusto(extrato.competencia),
  );
  refresh();
  return {
    ok: `Folha de ${formatarMes(extrato.competencia)} importada: ${r.colaboradores} pessoas${
      r.fora_do_copiloto
        ? ` (${r.fora_do_copiloto} sem cadastro no Copiloto RH ficaram de fora)`
        : ""
    }${
      r.rubricas_novas
        ? `, ${r.rubricas_novas} rubrica(s) nova(s) para classificar`
        : ""
    }.${calculado ? " Custo de pessoal calculado." : " O custo não foi calculado: use Recalcular em Custo de pessoal."}`,
  };
}

/**
 * Exclui a folha importada errada, com o custo do mês (regra no banco).
 * Para trocar pelo arquivo certo do mesmo mês, basta importar de novo.
 */
export async function excluirFolha(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeAgora("rh.folha")))
    return { erro: "Você não tem permissão para excluir a folha." };
  const id = z.uuid().safeParse(form.get("folha_id"));
  if (!id.success) return { erro: "Folha inválida." };
  const { data: competencia, error } = await (await createClient())
    .schema("rh")
    .rpc("excluir_folha", { p_folha_id: id.data });
  if (error) {
    if (error.code === "P0001" || error.code === "42501")
      return { erro: `${error.message}.` };
    console.error("excluir_folha", error);
    return { erro: "Não foi possível excluir. Nada foi alterado." };
  }
  refresh();
  return { ok: `Folha de ${formatarMes(competencia)} excluída.` };
}

const classificacao = z.object({
  codigo: z.coerce.number().int().positive(),
  grupo: z.enum(GRUPOS_CLASSIFICAVEIS),
});

export async function classificarRubrica(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  // O recálculo usa a service role: a permissão é conferida agora no banco.
  const [folha, parametros] = await Promise.all([
    podeAgora("rh.folha"),
    podeAgora("rh.parametros"),
  ]);
  if (!folha && !parametros) {
    return { erro: "Você não tem permissão para classificar rubricas." };
  }
  const dados = classificacao.safeParse(Object.fromEntries(form));
  if (!dados.success) return { erro: "Escolha o grupo da rubrica." };
  const usuario = await usuarioAtual();
  const { error } = await (await createClient())
    .schema("rh")
    .from("rubricas")
    .update({
      grupo: dados.data.grupo,
      classificada_por: usuario.id,
      classificada_em: new Date().toISOString(),
    })
    .eq("codigo", dados.data.codigo);
  if (error) return { erro: "Não foi possível salvar. Tente de novo." };
  updateTag(TAG.rh.rubricas);
  // A classificação vale para todos os meses em aberto.
  const calculado = await tentarRecalcular(recalcularEmAberto);
  refresh();
  return {
    ok: calculado
      ? "Classificada. Custo recalculado."
      : "Classificada, mas o custo não foi recalculado.",
  };
}
