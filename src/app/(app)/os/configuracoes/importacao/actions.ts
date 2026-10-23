"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import {
  chaveDoStatus,
  ESCOLHAS_CHAMADO,
  ESCOLHAS_VISTORIA,
} from "@/lib/os/importacao-conferencia";
import { supabasePublico } from "@/lib/supabase/config";
import type { Json } from "@/lib/supabase/database.types";
import { erroDoBanco } from "@/server/acoes";
import { os } from "@/server/os/base";
import { exigir } from "@/server/os/config-acoes";
import { apagarDadosDeExemplo, gerarDadosDeExemplo } from "@/server/os/exemplo";
import {
  apagarEnvio,
  enderecosDeEnvio,
  pastaDaImportacao,
} from "@/server/os/importacao/arquivos";
import {
  confirmarImportacao,
  copiarFotos,
  desfazerImportacao,
} from "@/server/os/importacao/gravar";
import {
  importacao,
  lerMapeamento,
  montarPrevia,
} from "@/server/os/importacao/previa";

// Dados de exemplo e importação única do sistema de OS atual (etapa 1 e
// spec 4.14). Tudo exige os.importacao. As linhas de os.importacoes gravam
// pela sessão (RLS); os dados importados e os de exemplo, com a service
// role (o RLS de abertura de chamado exige que quem abre seja quem grava).

const SEM_PERMISSAO = "Você não tem permissão para a importação.";

// ---------------------------------------------------------------------------
// Dados de exemplo
// ---------------------------------------------------------------------------

export async function gerarExemplo(
  _: EstadoAcao,
  _form: FormData,
): Promise<EstadoAcao> {
  const { ctx, erro } = await exigir("os.importacao");
  if (erro) return erro;
  try {
    const r = await gerarDadosDeExemplo(ctx.usuario.id);
    refresh();
    const c = r.contagens;
    return {
      ok: [
        `Dados de exemplo criados: ${c.lojas} lojas, ${c.chamados} chamados (${c.os} OS), ${c.ativos} ativos, ${c.planos} planos preventivos e ${c.vistorias} vistorias.`,
        r.colocadosEmSetor.length
          ? `Entraram num setor para ver a Minha caixa: ${r.colocadosEmSetor.join("; ")}.`
          : "",
        ...r.avisos,
      ]
        .filter(Boolean)
        .join(" "),
    };
  } catch (e) {
    console.error("gerar dados de exemplo", e);
    refresh();
    return {
      erro:
        e instanceof Error
          ? `${e.message} Se parou no meio, apague os dados de exemplo e gere de novo.`
          : "Não foi possível gerar os dados de exemplo.",
    };
  }
}

export async function apagarExemplo(
  _: EstadoAcao,
  _form: FormData,
): Promise<EstadoAcao> {
  const { ctx, erro } = await exigir("os.importacao");
  if (erro) return erro;
  try {
    const c = await apagarDadosDeExemplo(ctx.usuario.id);
    refresh();
    return {
      ok: `Dados de exemplo apagados: ${c.chamados ?? 0} chamados, ${c.lojas ?? 0} lojas, ${c.ativos ?? 0} ativos e ${c.vistorias ?? 0} vistorias.`,
    };
  } catch (e) {
    console.error("apagar dados de exemplo", e);
    return {
      erro: e instanceof Error ? e.message : "Não foi possível apagar.",
    };
  }
}

// ---------------------------------------------------------------------------
// Importação: envio → prévia → confirmação
// ---------------------------------------------------------------------------

const envio = z
  .array(
    z.object({
      nome: z.string().trim().min(1).max(300),
      tamanho: z.number().int().min(1, "arquivo vazio"),
    }),
  )
  .min(1, "Escolha os arquivos do backup.")
  .max(200, "No máximo 200 arquivos de uma vez: junte as fotos em ZIPs.");

export type RespostaDoEnvio =
  | {
      importacaoId: string;
      chave: string;
      enderecos: { nome: string; url: string; tamanho: number }[];
    }
  | { erro: string };

/** Registra a importação e devolve onde o navegador envia cada arquivo. */
export async function prepararEnvio(
  arquivos: { nome: string; tamanho: number }[],
): Promise<RespostaDoEnvio> {
  const { ctx, erro } = await exigir("os.importacao");
  if (erro) return { erro: erro.erro ?? SEM_PERMISSAO };
  const lista = envio.safeParse(arquivos);
  if (!lista.success)
    return { erro: lista.error.issues[0]?.message ?? "Arquivos inválidos." };

  const db = await os();
  const { data, error } = await db
    .from("importacoes")
    .insert({
      arquivo_nome: lista.data
        .map((a) => a.nome)
        .join(", ")
        .slice(0, 300),
      enviado_por: ctx.usuario.id,
    })
    .select("id")
    .single();
  if (error) return { erro: erroDoBanco(error).erro ?? "Falha ao registrar." };
  try {
    const enderecos = await enderecosDeEnvio(data.id, lista.data);
    const { error: e } = await db
      .from("importacoes")
      .update({
        arquivo_path: pastaDaImportacao(data.id),
        resumo: {
          arquivos: enderecos.map(({ url: _, ...a }) => a),
        } as unknown as Json,
      })
      .eq("id", data.id);
    if (e) throw e;
    return {
      importacaoId: data.id,
      chave: supabasePublico().anonKey,
      enderecos: enderecos.map((a) => ({
        nome: a.nome,
        url: a.url,
        tamanho: a.tamanho,
      })),
    };
  } catch (e) {
    console.error("preparar envio da importação", e);
    await db.from("importacoes").delete().eq("id", data.id);
    return { erro: "Não foi possível preparar o envio. Tente de novo." };
  }
}

const idDaImportacao = z.uuid("importação inválida");

/** Depois do envio: lê o pacote e monta a prévia. */
export async function lerEnvio(importacaoId: string): Promise<EstadoAcao> {
  const { erro } = await exigir("os.importacao");
  if (erro) return erro;
  const id = idDaImportacao.safeParse(importacaoId);
  if (!id.success) return { erro: "Importação inválida." };
  try {
    const previa = await montarPrevia(id.data);
    refresh();
    return previa
      ? { ok: "Prévia pronta: confira antes de confirmar." }
      : { erro: "Não foi possível ler o pacote: veja o motivo na prévia." };
  } catch (e) {
    console.error("ler envio", e);
    return { erro: e instanceof Error ? e.message : "Falha ao ler o pacote." };
  }
}

/** Ler de novo (depois de mudar algo no módulo, por exemplo). */
export async function relerPrevia(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  return lerEnvio(String(form.get("importacao_id") ?? ""));
}

/** Status antigos fora da tabela: a escolha de cada um. */
export async function salvarMapeamento(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { erro } = await exigir("os.importacao");
  if (erro) return erro;
  const id = idDaImportacao.safeParse(form.get("importacao_id"));
  if (!id.success) return { erro: "Importação inválida." };
  const imp = await importacao(id.data);
  if (!imp || imp.status !== "previa")
    return { erro: "Esta prévia não está mais aberta." };

  const mapeamento = lerMapeamento(imp.mapeamento);
  for (const [campo, valor] of form.entries()) {
    const m = /^status:(os|tarefa|vistoria):(.+)$/s.exec(campo);
    if (!m || typeof valor !== "string" || !valor) continue;
    const [, tipo, antigo] = m as unknown as [
      string,
      "os" | "tarefa" | "vistoria",
      string,
    ];
    const validos: string[] =
      tipo === "vistoria" ? ESCOLHAS_VISTORIA : ESCOLHAS_CHAMADO;
    if (!validos.includes(valor))
      return { erro: `Status inválido para "${antigo}".` };
    mapeamento[chaveDoStatus(tipo, antigo)] = valor;
  }
  const { error } = await (await os())
    .from("importacoes")
    .update({ mapeamento })
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  const previa = await montarPrevia(id.data);
  refresh();
  return previa?.podeConfirmar
    ? { ok: "Status salvos. A prévia já pode ser confirmada." }
    : { ok: "Status salvos." };
}

export async function confirmar(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { ctx, erro } = await exigir("os.importacao");
  if (erro) return erro;
  const id = idDaImportacao.safeParse(form.get("importacao_id"));
  if (!id.success) return { erro: "Importação inválida." };
  try {
    const r = await confirmarImportacao(id.data, ctx.usuario.id);
    refresh();
    const g = r.gravacao;
    return {
      ok: [
        `Importado: ${g.os ?? 0} OS, ${g.tarefas ?? 0} tarefas, ${g.vistorias ?? 0} vistorias, ${g.tecnicos ?? 0} técnicos, ${g.ativos ?? 0} equipamentos e ${g.contatos ?? 0} contatos.`,
        r.fotos ? `Agora copie as ${r.fotos} fotos.` : "",
        ...r.avisos,
      ]
        .filter(Boolean)
        .join(" "),
    };
  } catch (e) {
    console.error("confirmar importação", e);
    refresh();
    return {
      erro: e instanceof Error ? e.message : "Não foi possível importar.",
    };
  }
}

export interface EstadoFotos {
  copiadas: number;
  total: number;
  falhas: string[];
  erro?: string;
}

/** Copia um lote de fotos (a tela repete até terminar). */
export async function copiarLoteDeFotos(
  importacaoId: string,
): Promise<EstadoFotos> {
  const { erro } = await exigir("os.importacao");
  if (erro) return { copiadas: 0, total: 0, falhas: [], erro: erro.erro };
  const id = idDaImportacao.safeParse(importacaoId);
  if (!id.success)
    return { copiadas: 0, total: 0, falhas: [], erro: "Importação inválida." };
  try {
    return await copiarFotos(id.data);
  } catch (e) {
    console.error("copiar fotos da importação", e);
    return {
      copiadas: 0,
      total: 0,
      falhas: [],
      erro: e instanceof Error ? e.message : "Falha ao copiar as fotos.",
    };
  }
}

/** Prévia que não vai ser usada: some com os arquivos enviados. */
export async function descartar(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { erro } = await exigir("os.importacao");
  if (erro) return erro;
  const id = idDaImportacao.safeParse(form.get("importacao_id"));
  if (!id.success) return { erro: "Importação inválida." };
  const imp = await importacao(id.data);
  if (!imp || imp.status !== "previa")
    return { erro: "Só uma prévia pode ser descartada." };
  await apagarEnvio(id.data);
  const { error } = await (await os())
    .from("importacoes")
    .delete()
    .eq("id", id.data);
  if (error) return erroDoBanco(error);
  refresh();
  return { ok: "Prévia descartada." };
}

export async function desfazer(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const { ctx, erro } = await exigir("os.importacao");
  if (erro) return erro;
  const id = idDaImportacao.safeParse(form.get("importacao_id"));
  if (!id.success) return { erro: "Importação inválida." };
  try {
    await desfazerImportacao(id.data, ctx.usuario.id);
    refresh();
    return { ok: "Importação desfeita: o que ela trouxe foi apagado." };
  } catch (e) {
    console.error("desfazer importação", e);
    return {
      erro: e instanceof Error ? e.message : "Não foi possível desfazer.",
    };
  }
}
