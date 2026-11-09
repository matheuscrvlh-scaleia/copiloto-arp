"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { nomeSeguro } from "@/lib/arquivos/nome";
import { formatarDataHora, formatarMes } from "@/lib/formato";
import {
  ErroEnergisa,
  type FaturaLida,
  faturaParaGravar,
  itensParaGravar,
} from "@/lib/operacoes/energisa";
import { PAPEIS, type Papel } from "@/lib/operacoes/energisa-contas";
import { ehPdf, lerPdfEnergisa } from "@/lib/operacoes/energisa-pdf";
import {
  arquivosSchema,
  type PreviaFatura,
  type ResumoImportacao,
  resumoSchema,
} from "@/lib/operacoes/energisa-previa";
import type { Json } from "@/lib/supabase/database.types";
import { gravarArquivo, removerArquivos } from "@/server/arquivos";
import { podeAgora, usuarioAtual } from "@/server/auth";
import { op } from "../base";
import {
  minhasPrevias,
  previasDe,
  sha256,
  TAMANHO_MAXIMO,
} from "../contas-importacao";
import { logImportacaoOp } from "../historico";

// Importação das faturas da Energisa (PDF), uma fatura por importação:
// enviar → prévia (a fatura e os itens já gravados, fora das telas) →
// confirmar (operacoes.confirmar_importacao) ou descartar
// (operacoes.desfazer_importacao). Matrícula nova: a unidade é cadastrada
// na própria prévia. O PDF original fica no bucket "operacoes".
// Tudo com a sessão (o RLS confere a permissão operacoes.energia.contas);
// o arquivo vai para o disco, sem RLS, só depois de podeAgora().

const PERMISSAO = "operacoes.energia.contas" as const;
const SEM_PERMISSAO = "Você não tem permissão para importar as faturas.";
const BUCKET = "operacoes" as const;

export interface EstadoFatura {
  previa?: PreviaFatura;
  erro?: string;
  /** Prévia anterior da mesma fatura descartada para dar lugar a esta. */
  substituiu?: boolean;
}

const mesAno = (ref: string) => formatarMes(ref);

/** Descarta prévias da própria pessoa (reenvio da mesma fatura) e apaga os PDFs. */
async function descartar(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const banco = await op();
  const { data } = await banco
    .from("importacoes")
    .select("id, arquivos")
    .in("id", ids);
  for (const id of ids) {
    const { error } = await banco.rpc("desfazer_importacao", { p_id: id });
    if (error) throw error;
  }
  const caminhos = (data ?? []).flatMap((i) => {
    const a = arquivosSchema.safeParse(i.arquivos);
    return a.success ? a.data.map((x) => x.caminho) : [];
  });
  await removerArquivos(BUCKET, caminhos);
}

interface Conflito {
  erro?: string;
  minhas: string[];
}

/** Mesmo arquivo (sha256) ou mesma unidade e mês já importados ou em prévia. */
async function conflitos(
  usuarioId: string,
  hash: string,
  fatura: FaturaLida | null,
): Promise<Conflito> {
  const banco = await op();
  const minhas: string[] = [];
  const mesmoArquivo = await banco
    .from("importacoes")
    .select("id, status, criado_por, criado_em, referencia")
    .eq("tipo", "energisa")
    .in("status", ["previa", "confirmada"])
    // jsonb: o filtro "cs" recebe o JSON em texto.
    .contains("arquivos", JSON.stringify([{ sha256: hash }]));
  if (mesmoArquivo.error) throw mesmoArquivo.error;
  for (const i of mesmoArquivo.data ?? []) {
    if (i.status === "confirmada")
      return {
        erro: `Esta fatura já foi importada em ${formatarDataHora(i.criado_em)} (${mesAno(i.referencia)}).`,
        minhas,
      };
    if (i.criado_por !== usuarioId)
      return {
        erro: "Esta fatura está numa prévia de outra pessoa, ainda não confirmada. Confirme ou descarte essa prévia em Operações › Importações.",
        minhas,
      };
    minhas.push(i.id);
  }
  if (!fatura) return { minhas };

  const [vigente, previas] = await Promise.all([
    banco
      .from("energia_faturas")
      .select("id")
      .eq("matricula", fatura.matricula)
      .eq("referencia", fatura.referencia)
      .eq("vigente", true)
      .maybeSingle(),
    banco
      .from("importacoes")
      .select("id, criado_por")
      .eq("tipo", "energisa")
      .eq("status", "previa")
      .eq("referencia", fatura.referencia)
      .eq("resumo->>matricula", fatura.matricula),
  ]);
  if (vigente.error) throw vigente.error;
  if (previas.error) throw previas.error;
  if (vigente.data)
    return {
      erro: `A fatura da matrícula ${fatura.matricula} de ${mesAno(fatura.referencia)} já foi importada. Para trocar, desfaça a importação anterior em Operações › Importações.`,
      minhas,
    };
  for (const p of previas.data ?? []) {
    if (p.criado_por !== usuarioId)
      return {
        erro: `Já há uma prévia de outra pessoa para a matrícula ${fatura.matricula} de ${mesAno(fatura.referencia)}.`,
        minhas,
      };
    if (!minhas.includes(p.id)) minhas.push(p.id);
  }
  return { minhas };
}

/** Grava a fatura e os itens da prévia (a unidade já existe). */
async function gravarFatura(
  importacaoId: string,
  resumo: ResumoImportacao,
  arquivo: { caminho: string; sha256: string },
): Promise<{ erro?: string }> {
  const { error } = await (await op()).rpc("gravar_fatura_energisa", {
    p_importacao: importacaoId,
    p_arquivo: arquivo.caminho,
    p_sha256: arquivo.sha256,
    p_fatura: faturaParaGravar(resumo.fatura) as unknown as Json,
    p_itens: itensParaGravar(resumo.fatura) as unknown as Json,
  });
  if (!error) return {};
  if (error.code === "23505")
    return {
      erro: `A fatura da matrícula ${resumo.matricula} de ${mesAno(resumo.fatura.referencia)} (ou este mesmo arquivo) já está no sistema.`,
    };
  if (error.code === "42501") return { erro: SEM_PERMISSAO };
  console.error("gravar fatura da Energisa", error);
  return { erro: "Não foi possível gravar a fatura. Tente de novo." };
}

/** Lê um PDF, guarda o arquivo e devolve a prévia. Uma fatura por chamada. */
export async function lerFatura(form: FormData): Promise<EstadoFatura> {
  if (!(await podeAgora(PERMISSAO))) return { erro: SEM_PERMISSAO };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { erro: "Escolha o PDF da fatura." };
  if (arquivo.size > TAMANHO_MAXIMO)
    return { erro: "O arquivo passa de 10 MB." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (!ehPdf(bytes))
    return { erro: "O arquivo não é um PDF. Baixe a fatura em PDF." };
  const nome = arquivo.name.slice(0, 200) || "fatura.pdf";
  const hash = sha256(bytes);
  const usuario = await usuarioAtual();

  let fatura: FaturaLida;
  try {
    fatura = await lerPdfEnergisa(bytes, nome);
  } catch (e) {
    if (e instanceof ErroEnergisa) return { erro: e.message };
    console.error("leitura da fatura da Energisa", e);
    return {
      erro: "Não consegui ler o PDF. Confira se é a fatura da Energisa, em PDF com texto.",
    };
  }

  let conflito: Conflito;
  try {
    conflito = await conflitos(usuario.id, hash, fatura);
    if (conflito.erro) return { erro: conflito.erro };
    // Reenvio de uma fatura que a pessoa já tinha em prévia: a nova vale.
    await descartar(conflito.minhas);
  } catch (e) {
    console.error("conferência de duplicados da Energisa", e);
    return { erro: "Não foi possível conferir a fatura. Tente de novo." };
  }

  const caminho = `energisa/${randomUUID()}/${nomeSeguro(nome, "fatura.pdf")}`;
  try {
    await gravarArquivo(BUCKET, caminho, bytes, "application/pdf");
  } catch (e) {
    console.error("gravar PDF da Energisa", e);
    return { erro: "Não foi possível guardar o arquivo. Tente de novo." };
  }

  const resumo: ResumoImportacao = {
    versao: 1,
    matricula: fatura.matricula,
    arquivo: nome,
    fatura,
  };
  const banco = await op();
  const registro = await banco
    .from("importacoes")
    .insert({
      tipo: "energisa",
      referencia: fatura.referencia,
      arquivos: [{ nome, caminho, sha256: hash, bytes: bytes.length }],
      resumo: resumo as unknown as Json,
      avisos: fatura.avisos as unknown as Json,
      bate: fatura.bate,
      criado_por: usuario.id,
    })
    .select("id")
    .single();
  if (registro.error) {
    await removerArquivos(BUCKET, [caminho]);
    if (registro.error.code === "42501") return { erro: SEM_PERMISSAO };
    console.error("registro da importação da Energisa", registro.error);
    return { erro: "Não foi possível registrar a importação. Tente de novo." };
  }
  const id = registro.data.id;

  const unidade = await banco
    .from("energia_unidades")
    .select("matricula")
    .eq("matricula", fatura.matricula)
    .maybeSingle();
  if (unidade.error) console.error("unidade de energia", unidade.error);
  if (unidade.data) {
    const gravacao = await gravarFatura(id, resumo, { caminho, sha256: hash });
    if (gravacao.erro) {
      await descartar([id]).catch((e) =>
        console.error("descartar prévia da Energisa", e),
      );
      return { erro: gravacao.erro };
    }
  }
  const [previa] = await previasDe([{ id, resumo: resumo as unknown as Json }]);
  return { previa, substituiu: conflito.minhas.length > 0 };
}

/** As prévias da pessoa ainda não confirmadas (ao abrir a importação). */
export async function previasPendentes(): Promise<PreviaFatura[]> {
  if (!(await podeAgora(PERMISSAO))) return [];
  return minhasPrevias((await usuarioAtual()).id);
}

const id = z.uuid("importação inválida");

/** Prévia aberta pela pessoa, com o que foi lido. */
async function previaDaPessoa(importacaoId: string) {
  const usuario = await usuarioAtual();
  const { data, error } = await (await op())
    .from("importacoes")
    .select("id, tipo, status, criado_por, resumo, arquivos")
    .eq("id", importacaoId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.tipo !== "energisa")
    return { erro: "Prévia não encontrada." } as const;
  if (data.status !== "previa")
    return {
      erro: "Esta prévia já foi confirmada ou descartada.",
    } as const;
  if (data.criado_por !== usuario.id)
    return { erro: "Só quem enviou a fatura mexe nesta prévia." } as const;
  const resumo = resumoSchema.safeParse(data.resumo);
  if (!resumo.success)
    return {
      erro: "A prévia está incompleta. Descarte e envie a fatura de novo.",
    } as const;
  const arquivos = arquivosSchema.safeParse(data.arquivos);
  const arq = arquivos.success ? arquivos.data[0] : undefined;
  return { resumo: resumo.data, arquivo: arq } as const;
}

const cadastro = z.object({
  importacao_id: id,
  apelido: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(80, "máximo de 80 caracteres").nullable(),
  ),
  papel: z.enum(Object.keys(PAPEIS) as [Papel, ...Papel[]], "escolha o papel"),
});

/** Cadastra a unidade de uma matrícula nova e grava a fatura da prévia. */
export async function cadastrarUnidade(form: FormData): Promise<EstadoFatura> {
  const v = cadastro.safeParse({
    importacao_id: form.get("importacao_id"),
    apelido: form.get("apelido"),
    papel: form.get("papel"),
  });
  if (!v.success)
    return { erro: v.error.issues[0]?.message ?? "Dados inválidos." };
  try {
    const p = await previaDaPessoa(v.data.importacao_id);
    if ("erro" in p) return { erro: p.erro };
    const f = p.resumo.fatura;
    const banco = await op();
    const nova = await banco.from("energia_unidades").insert({
      matricula: f.matricula,
      apelido: v.data.apelido,
      papel: v.data.papel,
      endereco: f.endereco,
      classificacao: f.classificacao,
      ligacao: f.ligacao,
    });
    // Já cadastrada (por outra prévia ou em Parâmetros): segue com ela.
    if (nova.error && nova.error.code !== "23505") {
      if (nova.error.code === "42501") return { erro: SEM_PERMISSAO };
      console.error("cadastro da unidade de energia", nova.error);
      return { erro: "Não foi possível cadastrar a unidade. Tente de novo." };
    }
    const gravada = await banco
      .from("energia_faturas")
      .select("id")
      .eq("importacao_id", v.data.importacao_id)
      .maybeSingle();
    if (!gravada.data) {
      if (!p.arquivo)
        return {
          erro: "A prévia está sem o arquivo. Descarte e envie a fatura de novo.",
        };
      const g = await gravarFatura(v.data.importacao_id, p.resumo, p.arquivo);
      if (g.erro) return { erro: g.erro };
    }
    const [previa] = await previasDe([
      { id: v.data.importacao_id, resumo: p.resumo as unknown as Json },
    ]);
    return { previa };
  } catch (e) {
    console.error("cadastrar unidade na prévia", e);
    return { erro: "Não foi possível cadastrar a unidade. Tente de novo." };
  }
}

const confirmacao = z.object({
  importacao_id: id,
  motivo: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : String(v).trim()),
    z.string().max(500, "motivo com no máximo 500 caracteres").nullable(),
  ),
});

/** Confirma a prévia: a fatura passa a valer nas telas. */
export async function confirmarFatura(form: FormData): Promise<EstadoAcao> {
  const v = confirmacao.safeParse({
    importacao_id: form.get("importacao_id"),
    motivo: form.get("motivo"),
  });
  if (!v.success)
    return { erro: v.error.issues[0]?.message ?? "Dados inválidos." };
  const p = await previaDaPessoa(v.data.importacao_id);
  if ("erro" in p) return { erro: p.erro };
  const banco = await op();
  const gravada = await banco
    .from("energia_faturas")
    .select("id")
    .eq("importacao_id", v.data.importacao_id)
    .maybeSingle();
  if (!gravada.data)
    return { erro: "Cadastre a unidade da matrícula antes de confirmar." };
  if (!p.resumo.fatura.bate && !v.data.motivo)
    return {
      erro: "Os itens não somam o total da fatura: diga o motivo para confirmar assim mesmo.",
    };
  const { error } = await banco.rpc("confirmar_importacao", {
    p_id: v.data.importacao_id,
    p_motivo: v.data.motivo ?? undefined,
  });
  if (error) {
    if (error.code === "42501") return { erro: SEM_PERMISSAO };
    if (error.code === "22023" || error.code === "P0001")
      return {
        erro: `${error.message.charAt(0).toUpperCase()}${error.message.slice(1)}.`,
      };
    console.error("confirmar fatura da Energisa", error);
    return { erro: "Não foi possível confirmar. Nada foi alterado." };
  }
  refresh();
  const f = p.resumo.fatura;
  await logImportacaoOp(
    "confirmou",
    { id: v.data.importacao_id, tipo: "energisa", referencia: f.referencia },
    `matrícula ${f.matricula}${f.bate ? "" : ", itens sem bater com o total"}`,
    { matricula: f.matricula, motivo: v.data.motivo ?? undefined },
  );
  return {
    ok: `Fatura da matrícula ${f.matricula} de ${mesAno(f.referencia)} confirmada.`,
  };
}

/** Descarta a prévia: apaga a fatura gravada e o PDF. */
export async function descartarFatura(form: FormData): Promise<EstadoAcao> {
  const v = id.safeParse(form.get("importacao_id"));
  if (!v.success) return { erro: "Importação inválida." };
  const p = await previaDaPessoa(v.data);
  if ("erro" in p) return { erro: p.erro };
  try {
    await descartar([v.data]);
  } catch (e) {
    console.error("descartar prévia da Energisa", e);
    return { erro: "Não foi possível descartar. Tente de novo." };
  }
  const f = p.resumo.fatura;
  await logImportacaoOp(
    "descartou",
    { id: v.data, tipo: "energisa", referencia: f.referencia },
    `matrícula ${f.matricula}`,
    { matricula: f.matricula },
  );
  return { ok: "Prévia descartada." };
}
