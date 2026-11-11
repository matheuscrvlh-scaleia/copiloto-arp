"use server";

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EstadoAcao } from "@/components/form-acao";
import { type Campo, problemasDosCampos } from "@/lib/formularios/campos";
import {
  aparenciaSchema,
  configuracoesSchema,
  conteudoSchema,
  deBrasilia,
  problemaParaPublicar,
  type Situacao,
  situacaoEfetiva,
} from "@/lib/formularios/formulario";
import {
  MODELOS,
  NOMES_DOS_MODELOS,
  type NomeDoModelo,
} from "@/lib/formularios/modelos";
import type { Json } from "@/lib/supabase/database.types";
import { podeAgora } from "@/server/auth";
import {
  apagarArquivos,
  arquivosDoFormulario,
  caminhosDasRespostas,
} from "../arquivos";
import {
  contexto,
  frm,
  lerCampos,
  ROTA_FORMULARIOS,
  rotaDoFormulario,
} from "../base";

// Relatórios (antigo Formulários): o que a equipe grava, com a sessão (o RLS confere
// formularios.editar de novo). Formulário e respostas não têm cache no
// servidor: basta o refresh(). O envio pelo link fica em responder.ts.

const SEM_PERMISSAO: EstadoAcao = {
  erro: "Você não tem permissão para editar relatórios.",
};
const FALHOU: EstadoAcao = { erro: "Não foi possível salvar. Tente de novo." };

const id = z.uuid();

async function podeEditar(): Promise<boolean> {
  return (await contexto()).edita;
}

/**
 * "Novo relatório": rascunho a partir de um modelo (em branco, visita,
 * vistoria…); abre o editor.
 */
export async function criarFormulario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await contexto();
  if (!ctx.edita) return SEM_PERMISSAO;
  const nome = z
    .enum(NOMES_DOS_MODELOS as [NomeDoModelo, ...NomeDoModelo[]])
    .catch("branco")
    .parse(form.get("modelo"));
  const m = MODELOS[nome].criar();
  const { data, error } = await (await frm())
    .from("formularios")
    .insert({
      titulo: m.titulo,
      descricao: m.descricao,
      campos: m.campos as unknown as Json,
      mensagem_final: m.mensagem_final,
      criado_por: ctx.usuario.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("criar formulário", error);
    return FALHOU;
  }
  redirect(rotaDoFormulario(data.id, "editar"));
}

export interface Conteudo {
  id: string;
  titulo: string;
  descricao: string;
  campos: Campo[];
}

/** Editor: título, descrição e perguntas, de uma vez. */
export async function salvarConteudo(
  c: Conteudo,
): Promise<EstadoAcao & { problemas?: string[] }> {
  if (!(await podeEditar())) return SEM_PERMISSAO;
  const ok = id.safeParse(c.id);
  const d = conteudoSchema.safeParse(c);
  if (!ok.success) return FALHOU;
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira o relatório." };
  const problemas = problemasDosCampos(d.data.campos);
  if (problemas.length) return { erro: problemas[0], problemas };

  const db = await frm();
  const atual = await db
    .from("formularios")
    .select("situacao")
    .eq("id", ok.data)
    .maybeSingle();
  if (atual.error || !atual.data) return FALHOU;
  if (atual.data.situacao === "publicado") {
    const p = problemaParaPublicar(d.data.campos);
    if (p) return { erro: `Relatório publicado: ${p.toLowerCase()}` };
  }
  const { data, error } = await db
    .from("formularios")
    .update({
      titulo: d.data.titulo,
      descricao: d.data.descricao,
      campos: d.data.campos as unknown as Json,
    })
    .eq("id", ok.data)
    .select("id");
  if (error || !data?.length) {
    console.error("salvar formulário", error);
    return FALHOU;
  }
  refresh();
  return { ok: "Relatório salvo." };
}

/** Configurações: mensagem de agradecimento, data e limite de respostas. */
export async function salvarConfiguracoes(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeEditar())) return SEM_PERMISSAO;
  const ok = id.safeParse(form.get("id"));
  const d = configuracoesSchema.safeParse({
    mensagem_final: form.get("mensagem_final") ?? "",
    encerra_em: form.get("encerra_em") ?? "",
    limite_respostas: form.get("limite_respostas") ?? "",
  });
  if (!ok.success) return FALHOU;
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira os campos." };
  const { data, error } = await (await frm())
    .from("formularios")
    .update({
      mensagem_final: d.data.mensagem_final,
      encerra_em: deBrasilia(d.data.encerra_em),
      limite_respostas: d.data.limite_respostas,
    })
    .eq("id", ok.data)
    .select("id");
  if (error || !data?.length) {
    console.error("configurações do formulário", error);
    return FALHOU;
  }
  refresh();
  return { ok: "Configurações salvas." };
}

/** Aparência: cor de destaque, uma seção por página e o endereço depois do envio. */
export async function salvarAparencia(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeEditar())) return SEM_PERMISSAO;
  const ok = id.safeParse(form.get("id"));
  const d = aparenciaSchema.safeParse({
    cor: form.get("cor"),
    paginas: form.get("paginas") === "on",
    redirecionar_para: form.get("redirecionar_para") ?? "",
  });
  if (!ok.success) return FALHOU;
  if (!d.success)
    return { erro: d.error.issues[0]?.message ?? "Confira os campos." };
  const { data, error } = await (await frm())
    .from("formularios")
    .update(d.data)
    .eq("id", ok.data)
    .select("id");
  if (error || !data?.length) {
    console.error("aparência do relatório", error);
    return FALHOU;
  }
  refresh();
  return { ok: "Aparência salva." };
}

const mudanca = z.object({
  id,
  acao: z.enum(["publicar", "encerrar", "reabrir", "rascunho"]),
});

/** Publicar, encerrar, reabrir ou voltar para rascunho. */
export async function mudarSituacao(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeEditar())) return SEM_PERMISSAO;
  const d = mudanca.safeParse({ id: form.get("id"), acao: form.get("acao") });
  if (!d.success) return FALHOU;
  const db = await frm();
  const { data: f, error: e1 } = await db
    .from("formularios")
    .select(
      "campos, situacao, publicado_em, encerra_em, limite_respostas, total_respostas",
    )
    .eq("id", d.data.id)
    .maybeSingle();
  if (e1 || !f) return FALHOU;

  const nova: Situacao =
    d.data.acao === "encerrar"
      ? "encerrado"
      : d.data.acao === "rascunho"
        ? "rascunho"
        : "publicado";
  if (nova === "publicado") {
    const campos = lerCampos(f.campos);
    const problema =
      problemaParaPublicar(campos) ?? problemasDosCampos(campos)[0];
    if (problema) return { erro: problema };
    // Reabrir sem tirar a data vencida ou o limite batido não adianta.
    const efetiva = situacaoEfetiva(
      { ...f, situacao: "publicado" },
      new Date(),
    );
    if (efetiva === "encerrado")
      return {
        erro: "A data de encerramento já passou ou o limite de respostas foi atingido. Ajuste em Configurações antes de publicar.",
      };
  }
  if (nova === "rascunho" && f.total_respostas > 0)
    return {
      erro: "Este relatório já tem respostas: encerre em vez de voltar para rascunho.",
    };

  const { error } = await db
    .from("formularios")
    .update({
      situacao: nova,
      publicado_em:
        nova === "publicado"
          ? (f.publicado_em ?? new Date().toISOString())
          : f.publicado_em,
    })
    .eq("id", d.data.id);
  if (error) {
    console.error("situação do formulário", error);
    return FALHOU;
  }
  refresh();
  return {
    ok:
      nova === "publicado"
        ? "Relatório publicado: o link já recebe respostas."
        : nova === "encerrado"
          ? "Relatório encerrado: o link não recebe mais respostas."
          : "Relatório voltou para rascunho.",
  };
}

/** "Gerar novo link": o link antigo para de funcionar na hora. */
export async function gerarNovoLink(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeEditar())) return SEM_PERMISSAO;
  const ok = id.safeParse(form.get("id"));
  if (!ok.success) return FALHOU;
  const { data, error } = await (await frm())
    .from("formularios")
    .update({ token: randomBytes(24).toString("base64url") })
    .eq("id", ok.data)
    .select("id");
  if (error || !data?.length) {
    console.error("novo link do formulário", error);
    return FALHOU;
  }
  refresh();
  return { ok: "Link novo gerado. O anterior não abre mais." };
}

/** "Duplicar": cópia em rascunho, sem as respostas; abre o editor. */
export async function duplicarFormulario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  const ctx = await contexto();
  if (!ctx.edita) return SEM_PERMISSAO;
  const ok = id.safeParse(form.get("id"));
  if (!ok.success) return FALHOU;
  const db = await frm();
  const { data: f, error: e1 } = await db
    .from("formularios")
    .select(
      "titulo, descricao, campos, mensagem_final, cor, paginas, redirecionar_para",
    )
    .eq("id", ok.data)
    .maybeSingle();
  if (e1 || !f) return FALHOU;
  const { data, error } = await db
    .from("formularios")
    .insert({
      titulo: `${f.titulo} (cópia)`.slice(0, 200),
      descricao: f.descricao,
      campos: f.campos,
      mensagem_final: f.mensagem_final,
      cor: f.cor,
      paginas: f.paginas,
      redirecionar_para: f.redirecionar_para,
      criado_por: ctx.usuario.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("duplicar formulário", error);
    return FALHOU;
  }
  redirect(rotaDoFormulario(data.id, "editar"));
}

/** "Excluir formulário": some com as respostas e os arquivos enviados. */
export async function excluirFormulario(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeEditar())) return SEM_PERMISSAO;
  const ok = id.safeParse(form.get("id"));
  if (!ok.success) return FALHOU;
  const { data, error } = await (await frm())
    .from("formularios")
    .delete()
    .eq("id", ok.data)
    .select("id");
  if (error || !data?.length) {
    console.error("excluir formulário", error);
    return { erro: "Não foi possível excluir. Tente de novo." };
  }
  // Os arquivos só pela service role: confere a permissão agora no banco.
  if (await podeAgora("formularios.editar"))
    await apagarArquivos(await arquivosDoFormulario(ok.data)).catch((e) =>
      console.error("arquivos do formulário excluído", e),
    );
  redirect(ROTA_FORMULARIOS);
}

/**
 * "Excluir resposta" (teste, spam): o total do formulário acompanha e os
 * arquivos da resposta saem do bucket.
 */
export async function excluirResposta(
  _: EstadoAcao,
  form: FormData,
): Promise<EstadoAcao> {
  if (!(await podeEditar())) return SEM_PERMISSAO;
  const f = id.safeParse(form.get("formulario"));
  const r = id.safeParse(form.get("resposta"));
  if (!f.success || !r.success) return FALHOU;
  const { data, error } = await (await frm())
    .from("respostas")
    .delete()
    .eq("formulario_id", f.data)
    .eq("id", r.data)
    .select("id, respostas");
  if (error || !data?.length) {
    console.error("excluir resposta", error);
    return { erro: "Não foi possível excluir. Tente de novo." };
  }
  const caminhos = caminhosDasRespostas(
    data.map((x) => x.respostas as Record<string, unknown>),
  ).filter((c) => c.startsWith(`${f.data}/`));
  if (caminhos.length && (await podeAgora("formularios.editar")))
    await apagarArquivos(caminhos);
  redirect(rotaDoFormulario(f.data));
}
