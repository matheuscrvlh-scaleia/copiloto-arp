"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { nomeSeguro } from "@/lib/arquivos/nome";
import {
  conferirConta,
  esquemaConta,
  LIMITE_CONTA_BYTES,
  type SugestaoConta,
  sugerirDoTexto,
  tipoDoComprovante,
} from "@/lib/operacoes/agua-conta";
import { rotuloMes } from "@/lib/operacoes/agua-formato";
import { textosDoPdf } from "@/lib/operacoes/energisa-pdf";
import { lerArquivos } from "@/lib/operacoes/importacoes";
import type { Json } from "@/lib/supabase/database.types";
import {
  gravarArquivo,
  linkDeLeitura,
  removerArquivos,
} from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { op } from "@/server/operacoes/base";
import { logImportacaoOp, logOperacoes } from "@/server/operacoes/historico";
import { importacaoDoArquivo } from "@/server/operacoes/importacoes";
import { sha256 } from "../contas-importacao";

// Conta da concessionária de água (tipo "agua_conta"), uma conta por
// importação:
//   1. lerContaAgua: guarda o PDF ou a foto (comprovante), sugere os campos
//      lidos do texto do PDF e grava a importação "prévia".
//   2. confirmarContaAgua: grava os campos conferidos em agua_contas e
//      confirma (operacoes.confirmar_importacao). A conta da mesma matrícula
//      e mês que valia é substituída e volta se esta for desfeita.
//   3. corrigirContaAgua: corrige um campo da conta que já vale.
//   Descartar e desfazer: o "Desfazer" do histórico (desfazer_importacao).
// Tudo com a sessão (RLS e funções conferem operacoes.agua.importar); o
// arquivo vai para o disco só depois de podeAgora().

const PERMISSAO = "operacoes.agua.importar" as const;
const SEM_PERMISSAO = "Você não tem permissão para importar a água.";
const BUCKET = "operacoes" as const;

export interface PreviaConta {
  id: string;
  arquivo: { nome: string; tipo: string; url: string | null };
  sugestao: SugestaoConta;
  /** Mês sugerido (aaaa-mm): o do PDF ou o mês passado. */
  mes: string;
}

interface ResumoConta {
  versao: 1;
  arquivo: string;
  tipo: string;
  sugestao: SugestaoConta;
  conta?: Record<string, Json>;
}

const mesPassado = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};

async function montar(
  id: string,
  resumo: ResumoConta,
  caminho: string | undefined,
  referencia: string,
): Promise<PreviaConta> {
  return {
    id,
    arquivo: {
      nome: resumo.arquivo,
      tipo: resumo.tipo,
      url: caminho
        ? await linkDeLeitura(BUCKET, caminho, { segundos: 3600 })
        : null,
    },
    sugestao: resumo.sugestao,
    mes: /^\d{4}-\d{2}-01$/.test(referencia)
      ? referencia.slice(0, 7)
      : mesPassado(),
  };
}

const resumoSchema = z.object({
  versao: z.literal(1),
  arquivo: z.string(),
  tipo: z.string(),
  sugestao: z.record(z.string(), z.string()).catch({}),
});

/** Lê a conta enviada, guarda o comprovante e abre a prévia. */
export async function lerContaAgua(
  form: FormData,
): Promise<{ previa: PreviaConta } | { erro: string }> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha o PDF ou a foto da conta." };
  if (arquivo.size > LIMITE_CONTA_BYTES)
    return { erro: "O arquivo passa de 10 MB." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoDoComprovante(bytes);
  if (!tipo)
    return { erro: "Envie a conta em PDF ou foto (.jpg, .png ou .webp)." };
  const nome = arquivo.name.slice(0, 200) || "conta";
  const hash = sha256(bytes);
  const usuario = await usuarioAtual();
  const db = await op();

  try {
    const ja = await importacaoDoArquivo(db, "agua_conta", hash, [
      "confirmada",
    ]);
    if (ja)
      return {
        erro: `Este arquivo já foi importado (conta de ${rotuloMes(ja.referencia)}). Para corrigir, abra a importação no histórico.`,
      };
    // Reenvio: a prévia aberta da própria pessoa dá lugar à nova.
    await descartarAbertas(db, usuario.id);
  } catch (e) {
    console.error("conferir conta de água repetida", e);
    return { erro: "Não foi possível conferir o arquivo. Tente de novo." };
  }

  let sugestao: SugestaoConta = {};
  if (tipo === "application/pdf") {
    try {
      const paginas = await textosDoPdf(bytes);
      sugestao = sugerirDoTexto(
        paginas.map((p) => p.map((i) => i.str).join(" ")).join(" "),
      );
    } catch (e) {
      // PDF só com imagem ou protegido: a pessoa digita os campos.
      console.warn("texto da conta de água", e);
    }
  }

  const ext = tipo === "application/pdf" ? "conta.pdf" : "conta.jpg";
  const caminho = `agua/contas/${randomUUID()}/${nomeSeguro(nome, ext)}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, tipo);
  } catch (e) {
    console.error("gravar conta de água", e);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }
  const referencia = `${sugestao.referencia ?? mesPassado()}-01`;
  const resumo: ResumoConta = { versao: 1, arquivo: nome, tipo, sugestao };
  const { data, error } = await db
    .from("importacoes")
    .insert({
      tipo: "agua_conta",
      referencia,
      arquivos: [{ nome, caminho, sha256: hash, bytes: bytes.length }],
      resumo: resumo as unknown as Json,
      avisos: [],
      bate: null,
      criado_por: usuario.id,
    })
    .select("id")
    .single();
  if (error) {
    await removerArquivos(BUCKET, [caminho]).catch(() => {});
    if (error.code === "42501") return { erro: SEM_PERMISSAO };
    console.error("registrar importação da conta de água", error);
    return { erro: "Não foi possível registrar a importação. Tente de novo." };
  }
  return { previa: await montar(data.id, resumo, caminho, referencia) };
}

async function descartarAbertas(
  db: Awaited<ReturnType<typeof op>>,
  quem: string,
) {
  const { data, error } = await db
    .from("importacoes")
    .select("id, arquivos")
    .eq("tipo", "agua_conta")
    .eq("status", "previa")
    .eq("criado_por", quem);
  if (error) throw error;
  for (const p of data ?? []) {
    const r = await db.rpc("desfazer_importacao", { p_id: p.id });
    if (r.error) throw r.error;
    await removerArquivos(
      BUCKET,
      lerArquivos(p.arquivos).flatMap((a) => (a.caminho ? [a.caminho] : [])),
    ).catch(() => {});
  }
}

/** A prévia que a pessoa deixou aberta (fechou a aba no meio). */
export async function previaAbertaContaAgua(): Promise<PreviaConta | null> {
  try {
    if (!(await podeAgora(PERMISSAO))) return null;
    const usuario = await usuarioAtual();
    const { data } = await (await op())
      .from("importacoes")
      .select("id, referencia, resumo, arquivos")
      .eq("tipo", "agua_conta")
      .eq("status", "previa")
      .eq("criado_por", usuario.id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    const r = resumoSchema.safeParse(data.resumo);
    if (!r.success) return null;
    return await montar(
      data.id,
      r.data as ResumoConta,
      lerArquivos(data.arquivos)[0]?.caminho,
      data.referencia,
    );
  } catch (e) {
    console.error("prévia aberta da conta de água", e);
    return null;
  }
}

/** Campos do formulário → colunas de agua_contas (sem o id). */
function linhaDaConta(form: FormData) {
  const e = esquemaConta.safeParse(Object.fromEntries(form));
  if (!e.success)
    return { erro: e.error.issues[0]?.message ?? "Dados inválidos." } as const;
  return { conta: e.data } as const;
}

export async function confirmarContaAgua(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao & { avisos?: string[] }> {
  const id = z.uuid().safeParse(form.get("importacao"));
  if (!id.success) return { erro: "Prévia inválida." };
  const lida = linhaDaConta(form);
  if ("erro" in lida) return { erro: lida.erro };
  const { conta } = lida;
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const db = await op();
  const { data: imp } = await db
    .from("importacoes")
    .select("id, status, resumo")
    .eq("id", id.data)
    .eq("tipo", "agua_conta")
    .maybeSingle();
  if (!imp) return { erro: "Prévia não encontrada." };
  if (imp.status !== "previa")
    return { erro: "Esta prévia já foi confirmada ou descartada." };

  const avisos = conferirConta(conta);
  const resumo = {
    ...((imp.resumo ?? {}) as Record<string, Json>),
    conta: {
      matricula: conta.matricula,
      referencia: conta.referencia,
      consumo_m3: conta.consumo_m3,
    },
  };
  const ajuste = await db
    .from("importacoes")
    .update({
      referencia: conta.referencia,
      resumo: resumo as Json,
      avisos: avisos.map((mensagem) => ({ nivel: "aviso", mensagem })) as Json,
    })
    .eq("id", id.data);
  if (ajuste.error) {
    console.error("ajustar prévia da conta de água", ajuste.error);
    return { erro: "Não foi possível gravar a conta. Tente de novo." };
  }
  const existente = await db
    .from("agua_contas")
    .select("id")
    .eq("importacao_id", id.data)
    .maybeSingle();
  const gravar = existente.data
    ? await db.from("agua_contas").update(conta).eq("id", existente.data.id)
    : await db.from("agua_contas").insert({ ...conta, importacao_id: id.data });
  if (gravar.error) {
    if (gravar.error.code === "42501") return { erro: SEM_PERMISSAO };
    console.error("gravar conta de água", gravar.error);
    return { erro: "Não foi possível gravar a conta. Tente de novo." };
  }
  const { error } = await db.rpc("confirmar_importacao", { p_id: id.data });
  if (error) {
    if (error.code === "42501") return { erro: SEM_PERMISSAO };
    if (error.code === "23505")
      return {
        erro: "Já há outra conta dessa matrícula e mês valendo. Tente de novo.",
      };
    if (error.code === "22023" || error.code === "P0001")
      return { erro: error.message };
    console.error("confirmar conta de água", error);
    return { erro: "Não foi possível confirmar. Nada foi alterado." };
  }
  const { data: depois } = await db
    .from("importacoes")
    .select("substitui")
    .eq("id", id.data)
    .maybeSingle();
  refresh();
  await logImportacaoOp(
    "confirmou",
    { id: id.data, tipo: "agua_conta", referencia: conta.referencia },
    depois?.substitui ? "substituiu a anterior" : undefined,
  );
  return {
    ok: `Conta de ${rotuloMes(conta.referencia)} (matrícula ${conta.matricula}) importada${depois?.substitui ? "; a conta anterior da mesma matrícula e mês ficou guardada no histórico" : ""}.`,
    avisos,
  };
}

export async function descartarContaAgua(id: string): Promise<EstadoAcao> {
  if (!z.uuid().safeParse(id).success) return { erro: "Prévia inválida." };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const db = await op();
  const { data: imp } = await db
    .from("importacoes")
    .select("arquivos, status")
    .eq("id", id)
    .eq("tipo", "agua_conta")
    .maybeSingle();
  if (!imp || imp.status !== "previa")
    return { erro: "Prévia não encontrada ou já confirmada." };
  const { error } = await db.rpc("desfazer_importacao", { p_id: id });
  if (error) {
    console.error("descartar conta de água", error);
    return { erro: "Não foi possível descartar. Tente de novo." };
  }
  await removerArquivos(
    BUCKET,
    lerArquivos(imp.arquivos).flatMap((a) => (a.caminho ? [a.caminho] : [])),
  ).catch(() => {});
  refresh();
  await logImportacaoOp("descartou", { id, tipo: "agua_conta" });
  return { ok: "Prévia descartada." };
}

/** Corrige a conta que já vale (tela da importação). O mês não muda aqui. */
export async function corrigirContaAgua(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const id = z.uuid().safeParse(form.get("importacao"));
  if (!id.success) return { erro: "Importação inválida." };
  const lida = linhaDaConta(form);
  if ("erro" in lida) return { erro: lida.erro };
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const { referencia, ...campos } = lida.conta;
  const db = await op();
  const { data, error } = await db
    .from("agua_contas")
    .update(campos)
    .eq("importacao_id", id.data)
    .eq("vigente", true)
    .select("id, referencia");
  if (error) {
    if (error.code === "23505")
      return {
        erro: "Já há outra conta dessa matrícula no mesmo mês valendo.",
      };
    console.error("corrigir conta de água", error);
    return { erro: "Não foi possível salvar a correção." };
  }
  if (!data?.length)
    return {
      erro: "Conta não encontrada ou não vale mais (desfeita ou substituída).",
    };
  refresh();
  const avisos = conferirConta(lida.conta);
  await logOperacoes(
    "operacoes_importacao_corrigida",
    `Corrigiu a conta de água de ${rotuloMes(data[0]?.referencia ?? referencia)} (matrícula ${campos.matricula})`,
    { importacao: id.data },
  );
  return {
    ok: `Conta corrigida.${avisos.length ? ` Confira: ${avisos.join(" ")}` : ""}`,
  };
}
