import "server-only";
import {
  type ContextoDaConferencia,
  conferir,
  ORIGEM_LEGADO,
  type Previa,
} from "@/lib/os/importacao-conferencia";
import { escolherLeitor, indiceDeArquivos } from "@/lib/os/importacao-leitor";
import type {
  ArquivoDoPacote,
  PacoteImportacao,
} from "@/lib/os/importacao-modelo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { os, osAdmin, type Tabela } from "../base";
import { type ArquivoEnviado, abrirEnvio } from "./arquivos";

// Prévia da importação: abre o que foi enviado, escolhe o leitor, lê o
// pacote e confere com o que já está no módulo. O resultado fica em
// os.importacoes (resumo e problemas), para a tela mostrar e a confirmação
// conferir de novo antes de gravar. As linhas da importação são lidas e
// gravadas pela sessão (RLS: os.importacao); o que já existe no módulo é
// lido com a service role (a conferência precisa de todos os números, não
// só dos chamados que a pessoa vê).

export interface PlanoDeFoto {
  citado: string;
  path: string;
  nome: string;
  categoria: "foto" | "antes" | "depois" | "assinatura";
  chamadoId?: string;
  vistoriaId?: string;
  ambienteId?: string;
  assinatura?: "locador" | "locatario";
}

/** O que a importação guarda em os.importacoes.resumo (só este servidor grava). */
export interface ResumoDaImportacao {
  arquivos: ArquivoEnviado[];
  leitor?: string;
  previa?: Previa;
  /** Arquivo que não abriu ou pacote que não pôde ser lido. */
  erro?: string;
  gravacao?: Record<string, number>;
  avisos?: string[];
  fotos?: { total: number; copiadas: number; plano: PlanoDeFoto[] };
}

export type Importacao = Tabela<"importacoes">;

export function lerResumo(json: Json): ResumoDaImportacao {
  const r = (json ?? {}) as unknown as Partial<ResumoDaImportacao>;
  return { ...r, arquivos: Array.isArray(r.arquivos) ? r.arquivos : [] };
}

export function lerMapeamento(json: Json): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return Object.fromEntries(
    Object.entries(json).filter(
      (e): e is [string, string] => typeof e[1] === "string",
    ),
  );
}

export async function importacao(id: string): Promise<Importacao | null> {
  const { data, error } = await (await os())
    .from("importacoes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Importação: ${error.message}`);
  return data;
}

export async function gravarResumo(
  id: string,
  resumo: ResumoDaImportacao,
  extra: Partial<Pick<Importacao, "problemas" | "mapeamento" | "status">> = {},
): Promise<void> {
  const { error } = await (await os())
    .from("importacoes")
    .update({ resumo: resumo as unknown as Json, ...extra })
    .eq("id", id);
  if (error) throw new Error(`Gravar a prévia: ${error.message}`);
}

export interface PacoteAberto {
  pacote: PacoteImportacao;
  leitor: string;
  acharArquivo: (citado: string) => ArquivoDoPacote | null;
}

export async function abrirPacote(
  importacaoId: string,
  resumo: ResumoDaImportacao,
): Promise<PacoteAberto> {
  const arquivos = await abrirEnvio(importacaoId, resumo.arquivos);
  const leitor = escolherLeitor(arquivos);
  const pacote = await leitor.ler(arquivos);
  return {
    pacote,
    leitor: leitor.nome,
    acharArquivo: indiceDeArquivos(pacote.arquivos),
  };
}

export type NumeroNoModulo = {
  id: string;
  legado_origem: string | null;
  legado_id: string | null;
};

export interface ContextoDoModulo
  extends Omit<ContextoDaConferencia, "numerosNoModulo" | "codigosNoModulo"> {
  numerosNoModulo: Map<number, NumeroNoModulo>;
  codigosNoModulo: Map<string, { id: string; legado_id: string | null }>;
  /** Tarefas importadas antes: id antigo → chamado. */
  tarefasNoModulo: Map<string, string>;
}

/** O que já existe no módulo com os números e códigos do pacote. */
export async function contextoDoModulo(
  pacote: PacoteImportacao,
  mapeamento: Record<string, string>,
  acharArquivo: ContextoDaConferencia["acharArquivo"],
): Promise<ContextoDoModulo> {
  const db = osAdmin();
  const r = pacote.registros;
  const numeros = [
    ...new Set([
      ...r.os_internas.map((o) => o.numero),
      ...r.os_terceirizadas.map((o) => o.numero),
    ]),
  ];
  const numerosNoModulo = new Map<number, NumeroNoModulo>();
  for (let i = 0; i < numeros.length; i += 300) {
    const { data, error } = await db
      .from("chamados")
      .select("id, numero, legado_origem, legado_id")
      .in("numero", numeros.slice(i, i + 300));
    if (error) throw new Error(`Números no módulo: ${error.message}`);
    for (const c of data ?? []) numerosNoModulo.set(c.numero, c);
  }
  // Re-importação: o registro importado antes pode ter ganhado número novo.
  for (const tipo of ["os_internas", "os_terceirizadas"] as const) {
    const ids = r[tipo].map((o) => String(o.numero));
    for (let i = 0; i < ids.length; i += 300) {
      const { data, error } = await db
        .from("chamados")
        .select("id, numero, legado_origem, legado_id")
        .eq("legado_origem", ORIGEM_LEGADO[tipo])
        .in("legado_id", ids.slice(i, i + 300));
      if (error) throw new Error(`OS importadas antes: ${error.message}`);
      for (const c of data ?? [])
        if (c.legado_id && Number(c.legado_id) !== c.numero)
          numerosNoModulo.set(Number(c.legado_id), c);
    }
  }

  const codigos = [
    ...new Set(r.vistorias.map((v) => v.codigo.trim().toUpperCase())),
  ];
  const codigosNoModulo = new Map<
    string,
    { id: string; legado_id: string | null }
  >();
  if (codigos.length) {
    const { data, error } = await db
      .from("vistorias")
      .select("id, codigo, legado_id");
    if (error) throw new Error(`Vistorias no módulo: ${error.message}`);
    const pedidos = new Set(codigos);
    for (const v of data ?? []) {
      const c = v.codigo.trim().toUpperCase();
      if (pedidos.has(c))
        codigosNoModulo.set(c, { id: v.id, legado_id: v.legado_id });
    }
  }

  const tarefasNoModulo = new Map<string, string>();
  const ids = r.tarefas.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await db
      .from("chamados")
      .select("id, legado_id")
      .eq("legado_origem", ORIGEM_LEGADO.tarefas)
      .in("legado_id", ids.slice(i, i + 150));
    if (error) throw new Error(`Tarefas importadas antes: ${error.message}`);
    for (const t of data ?? [])
      if (t.legado_id) tarefasNoModulo.set(t.legado_id, t.id);
  }

  const usuarios = await createAdminClient()
    .schema("core")
    .from("usuarios")
    .select("id, nome")
    .eq("ativo", true);
  if (usuarios.error) throw new Error(`Usuários: ${usuarios.error.message}`);

  return {
    numerosNoModulo,
    codigosNoModulo,
    tarefasNoModulo,
    usuarios: usuarios.data ?? [],
    mapeamento,
    acharArquivo,
  };
}

/** Lê o pacote, confere e guarda a prévia. Erro de leitura vira o motivo. */
export async function montarPrevia(
  importacaoId: string,
): Promise<Previa | null> {
  const imp = await importacao(importacaoId);
  if (!imp) throw new Error("Importação não encontrada.");
  const resumo = lerResumo(imp.resumo);
  try {
    const aberto = await abrirPacote(importacaoId, resumo);
    const ctx = await contextoDoModulo(
      aberto.pacote,
      lerMapeamento(imp.mapeamento),
      aberto.acharArquivo,
    );
    const previa = conferir(aberto.pacote, ctx);
    await gravarResumo(
      importacaoId,
      { arquivos: resumo.arquivos, leitor: aberto.leitor, previa },
      { problemas: previa.problemas as unknown as Json },
    );
    return previa;
  } catch (erro) {
    const texto =
      erro instanceof Error ? erro.message : "Não foi possível ler o pacote.";
    console.error("prévia da importação", importacaoId, erro);
    await gravarResumo(
      importacaoId,
      { arquivos: resumo.arquivos, erro: texto },
      { problemas: [{ texto, bloqueia: true }] as unknown as Json },
    );
    return null;
  }
}
