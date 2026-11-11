import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { type Campo, camposSchema } from "@/lib/formularios/campos";
import {
  hexDaCor,
  type MotivoFechado,
  motivoFechado,
  type Situacao,
  situacaoEfetiva,
} from "@/lib/formularios/formulario";
import type { Permissao } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type Usuario, usuarioAtual } from "@/server/auth";
import { urlDoSistema } from "@/server/os/base";
import { lerTudo } from "@/server/supabase-paginas";

// Módulo Relatórios (antigo Formulários; schema formularios): leituras. Formulários e respostas são lidos com a
// sessão (RLS: formularios.ver ou formularios.editar), sem cache no servidor.
// O link público (/responder/<token>) lê pela service role só o formulário
// daquele token.

type Linha = Database["formularios"]["Tables"]["formularios"]["Row"];

export const ROTA_FORMULARIOS = "/relatorios";
export const rotaDoFormulario = (id: string, sub = "") =>
  `${ROTA_FORMULARIOS}/${id}${sub ? `/${sub}` : ""}`;
export const linkDoFormulario = (token: string) =>
  urlDoSistema(`/responder/${token}`);

/** Token do link: 32 a 128 caracteres de base64url ou hex. */
export const tokenValido = (t: string) => /^[A-Za-z0-9_-]{32,128}$/.test(t);

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler os formulários: ${erro.message}`);
}

/** Cliente com a sessão, no schema formularios. */
export async function frm() {
  return (await createClient()).schema("formularios");
}

/** Service role no schema formularios (só depois de conferir o acesso). */
export function frmAdmin() {
  return createAdminClient().schema("formularios");
}

/** Perguntas gravadas; o que não passar no Zod vira lista vazia. */
export function lerCampos(json: unknown): Campo[] {
  const r = camposSchema.safeParse(json);
  return r.success ? r.data : [];
}

export interface Contexto {
  usuario: Usuario;
  pode: (p: Permissao) => boolean;
  /** Vê formulários e respostas (ver ou editar). */
  ve: boolean;
  edita: boolean;
}

/** Quem está logado e o que pode no módulo. Lê a sessão: use em <Suspense>. */
export const contexto = cache(async (): Promise<Contexto> => {
  const usuario = await usuarioAtual();
  const pode = (p: Permissao) => usuario.permissoes.includes(p);
  const edita = pode("formularios.editar");
  return { usuario, pode, ve: edita || pode("formularios.ver"), edita };
});

export interface FormularioDaLista {
  id: string;
  titulo: string;
  situacao: Situacao;
  /** Publicado vencido ou cheio já aparece como encerrado. */
  efetiva: Situacao;
  perguntas: number;
  total_respostas: number;
  ultima_resposta_em: string | null;
  atualizado_em: string;
  criado_em: string;
}

/** Todos os formulários (o RLS filtra), do mais recente para o mais antigo. */
export const listaDeFormularios = cache(
  async (): Promise<FormularioDaLista[]> => {
    await connection();
    const db = await frm();
    const linhas = await lerTudo(() =>
      db
        .from("formularios")
        .select(
          "id, titulo, situacao, campos, encerra_em, limite_respostas, total_respostas, ultima_resposta_em, atualizado_em, criado_em",
        )
        .order("atualizado_em", { ascending: false })
        .order("id"),
    );
    const agora = new Date();
    return linhas.map((f) => ({
      id: f.id,
      titulo: f.titulo,
      situacao: f.situacao as Situacao,
      efetiva: situacaoEfetiva(
        { ...f, situacao: f.situacao as Situacao },
        agora,
      ),
      perguntas: lerCampos(f.campos).filter((c) => c.tipo !== "secao").length,
      total_respostas: f.total_respostas,
      ultima_resposta_em: f.ultima_resposta_em,
      atualizado_em: f.atualizado_em,
      criado_em: f.criado_em,
    }));
  },
);

export interface Formulario
  extends Omit<Linha, "campos" | "situacao" | "criado_por"> {
  situacao: Situacao;
  efetiva: Situacao;
  campos: Campo[];
  link: string;
}

/** Um formulário (com a sessão); null se não existe ou não pode ver. */
export const formularioPorId = cache(
  async (id: string): Promise<Formulario | null> => {
    await connection();
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const { data, error } = await (await frm())
      .from("formularios")
      .select(
        "id, titulo, descricao, campos, mensagem_final, situacao, token, encerra_em, limite_respostas, total_respostas, ultima_resposta_em, criado_em, publicado_em, atualizado_em, cor, paginas, redirecionar_para",
      )
      .eq("id", id)
      .maybeSingle();
    falhar(error);
    if (!data) return null;
    const situacao = data.situacao as Situacao;
    return {
      ...data,
      situacao,
      efetiva: situacaoEfetiva({ ...data, situacao }, new Date()),
      campos: lerCampos(data.campos),
      link: linkDoFormulario(data.token),
    };
  },
);

export interface Resposta {
  id: string;
  enviada_em: string;
  respostas: Record<string, unknown>;
  perguntas: Record<string, string>;
}

const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

/** Respostas de um formulário, das mais recentes para as mais antigas. */
export const respostasDo = cache(
  async (formularioId: string): Promise<Resposta[]> => {
    const db = await frm();
    const linhas = await lerTudo(() =>
      db
        .from("respostas")
        .select("id, enviada_em, respostas, perguntas")
        .eq("formulario_id", formularioId)
        .order("enviada_em", { ascending: false })
        .order("id"),
    );
    return linhas.map((r) => ({
      id: r.id,
      enviada_em: r.enviada_em,
      respostas: objeto(r.respostas),
      perguntas: Object.fromEntries(
        Object.entries(objeto(r.perguntas)).map(([k, v]) => [k, String(v)]),
      ),
    }));
  },
);

/** Uma resposta do formulário (com a sessão). */
export async function respostaPorId(
  formularioId: string,
  id: string,
): Promise<Resposta | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await (await frm())
    .from("respostas")
    .select("id, enviada_em, respostas, perguntas")
    .eq("formulario_id", formularioId)
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  return {
    id: data.id,
    enviada_em: data.enviada_em,
    respostas: objeto(data.respostas),
    perguntas: Object.fromEntries(
      Object.entries(objeto(data.perguntas)).map(([k, v]) => [k, String(v)]),
    ),
  };
}

// ---------------------------------------------------------------------------
// Link público (sem login)
// ---------------------------------------------------------------------------

export interface FormularioPublico {
  /** Só no servidor (caminho dos arquivos); a página não repassa. */
  id: string;
  titulo: string;
  descricao: string;
  campos: Campo[];
  mensagem_final: string;
  token: string;
  /** Cor de destaque (hex). */
  cor: string;
  paginas: boolean;
  redirecionar_para: string | null;
}

/**
 * O formulário do link, pela service role: só o que quem responde vê. Fechado
 * (rascunho, encerrado, vencido ou cheio) volta o motivo.
 */
export async function formularioPeloToken(
  token: string,
): Promise<{ formulario: FormularioPublico } | { motivo: MotivoFechado }> {
  if (!tokenValido(token)) return { motivo: "inexistente" };
  const { data, error } = await frmAdmin()
    .from("formularios")
    .select(
      "id, titulo, descricao, campos, mensagem_final, situacao, encerra_em, limite_respostas, total_respostas, cor, paginas, redirecionar_para",
    )
    .eq("token", token)
    .maybeSingle();
  falhar(error);
  const motivo = motivoFechado(
    data ? { ...data, situacao: data.situacao as Situacao } : null,
    new Date(),
  );
  if (motivo || !data) return { motivo: motivo ?? "inexistente" };
  return {
    formulario: {
      id: data.id,
      titulo: data.titulo,
      descricao: data.descricao,
      campos: lerCampos(data.campos),
      mensagem_final: data.mensagem_final,
      token,
      cor: hexDaCor(data.cor),
      paginas: data.paginas,
      redirecionar_para: data.redirecionar_para,
    },
  };
}
