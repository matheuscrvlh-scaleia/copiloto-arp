import "server-only";
import { cache } from "react";
import { z } from "zod";
import type {
  Anexo,
  Empresa,
  Foto,
  ListaDeTarefas,
  Obra,
  Relatorio,
  Video,
} from "@/connectors/diario-de-obras/schemas";
import {
  lerResumo,
  type ObraDoDiario,
  type RelatorioDaLista,
  type ResumoRelatorio,
  type Tarefas,
} from "@/lib/operacoes/diario";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioAtual } from "@/server/auth";
import { lerTudo } from "@/server/supabase-paginas";
import { cursorSchema } from "@/server/sync/diario-de-obras-regras";
import { falhar, op, type Tabela } from "./base";

// Leituras do Diário de Obra. Os dados (cópia do aplicativo) vêm com a
// sessão, pelo RLS (operacoes.obras.diario ou operacoes.painel). O estado da
// consulta (integracao.*, só service role) é lido depois de conferir a mesma
// regra do RLS das tabelas diario_*.

const SISTEMA = "diario_de_obras";
const RECURSO = "obras";
/** Execução "rodando" há mais que isso já foi dada como interrompida. */
const RODANDO_MAX_MS = 30 * 60_000;

async function exigirDiario(): Promise<void> {
  const u = await usuarioAtual();
  if (
    !u.ativo ||
    !(
      u.permissoes.includes("operacoes.obras.diario") ||
      u.permissoes.includes("operacoes.painel")
    )
  )
    throw new Error("Sem acesso ao Diário de Obra.");
}

export interface EstadoDiario {
  /** Há token salvo em Administração › Integrações (e ativo). */
  configurado: boolean;
  /** Token salvo, mas a integração foi desativada. */
  desativado: boolean;
  /** Última consulta que terminou bem. */
  ultima: { em: string; avisos: string[]; pendente: boolean } | null;
  /** A última consulta falhou depois da última boa: a tela mostra a cópia anterior. */
  falha: { em: string; erro: string } | null;
  /** Consulta em andamento (início). */
  rodando: string | null;
  /** Ainda há obras de exemplo (fictícias). */
  exemplo: boolean;
  /** Último relatório lançado no aplicativo (de /empresa). */
  ultimoRelatorioNoApp: string | null;
}

/** Estado da consulta ao aplicativo (topo das telas e botão Atualizar agora). */
export const estadoDoDiario = cache(async (): Promise<EstadoDiario> => {
  await exigirDiario();
  const admin = createAdminClient();
  const integracao = admin.schema("integracao");
  const [credencial, runs, exemplos, cadastros] = await Promise.all([
    integracao
      .from("credenciais")
      .select("ativa")
      .eq("sistema", SISTEMA)
      .maybeSingle(),
    integracao
      .from("sync_runs")
      .select("status, iniciado_em, finalizado_em, erro, cursor_depois")
      .eq("sistema", SISTEMA)
      .eq("recurso", RECURSO)
      .order("iniciado_em", { ascending: false })
      .limit(20),
    admin
      .schema("operacoes")
      .from("diario_obras")
      .select("id", { count: "exact", head: true })
      .eq("exemplo", true),
    admin
      .schema("operacoes")
      .from("diario_cadastros")
      .select("empresa")
      .eq("id", true)
      .maybeSingle(),
  ]);
  falhar(credencial.error);
  falhar(runs.error);
  falhar(exemplos.error);
  falhar(cadastros.error);

  const lista = runs.data ?? [];
  const boa = lista.find((r) => r.status === "sucesso");
  const terminada = lista.find((r) => r.status !== "rodando");
  const rodando = lista.find(
    (r) =>
      r.status === "rodando" &&
      Date.now() - Date.parse(r.iniciado_em) < RODANDO_MAX_MS,
  );
  const cursor = boa ? cursorSchema.parse(boa.cursor_depois ?? {}) : null;
  const empresa = cadastros.data?.empresa as Empresa | null | undefined;
  return {
    configurado: credencial.data?.ativa === true,
    desativado: credencial.data?.ativa === false,
    ultima:
      boa?.finalizado_em && cursor
        ? {
            em: boa.finalizado_em,
            avisos: cursor.avisos,
            pendente: cursor.pendente,
          }
        : null,
    falha:
      terminada?.status === "erro" && terminada.finalizado_em
        ? { em: terminada.finalizado_em, erro: terminada.erro ?? "" }
        : null,
    rodando: rodando?.iniciado_em ?? null,
    exemplo: (exemplos.count ?? 0) > 0,
    ultimoRelatorioNoApp: empresa?.log?.ultimoRelatorio ?? null,
  };
});

// ---------------------------------------------------------------------------
// Obras
// ---------------------------------------------------------------------------

const tarefasSchema = z
  .object({
    total: z.number(),
    naoIniciada: z.number(),
    emAndamento: z.number(),
    concluida: z.number(),
  })
  .nullable()
  .catch(null);

const COLUNAS_OBRA =
  "id, nome, status_id, grupo, responsavel, data_inicio, data_fim, prazo_contratual, prazo_decorrido, prazo_a_vencer, realizado, tarefas, dados, exemplo";

type LinhaObra = Pick<
  Tabela<"diario_obras">,
  | "id"
  | "nome"
  | "status_id"
  | "grupo"
  | "responsavel"
  | "data_inicio"
  | "data_fim"
  | "prazo_contratual"
  | "prazo_decorrido"
  | "prazo_a_vencer"
  | "realizado"
  | "tarefas"
  | "dados"
  | "exemplo"
>;

function obraDaLinha(l: LinhaObra): ObraDoDiario & { exemplo: boolean } {
  return {
    id: l.id,
    nome: l.nome,
    statusId: l.status_id,
    grupo: l.grupo,
    responsavel: l.responsavel,
    dataInicio: l.data_inicio,
    dataFim: l.data_fim,
    prazo: {
      contratual: l.prazo_contratual,
      decorrido: l.prazo_decorrido,
      aVencer: l.prazo_a_vencer,
    },
    realizado: l.realizado === null ? null : Number(l.realizado),
    tarefas: tarefasSchema.parse(l.tarefas) as Tarefas | null,
    // Gravado pela sincronização depois de passar pelo schema do conector.
    ficha: (l.dados ?? null) as Obra | null,
    exemplo: l.exemplo,
  };
}

/** Todas as obras do aplicativo (poucas: lidas inteiras). */
export const obrasDoDiario = cache(async () => {
  const { data, error } = await (await op())
    .from("diario_obras")
    .select(COLUNAS_OBRA)
    .order("nome")
    .order("id");
  falhar(error);
  return (data ?? []).map(obraDaLinha);
});

/** Uma obra, com o cronograma. */
export const obraDoDiario = cache(async (id: string) => {
  const { data, error } = await (await op())
    .from("diario_obras")
    .select(`${COLUNAS_OBRA}, lista_de_tarefas`)
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  return {
    ...obraDaLinha(data),
    cronograma: (data.lista_de_tarefas ?? null) as ListaDeTarefas | null,
  };
});

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

/** Datas e status de todos os relatórios (painel: último, a aprovar, dias sem). */
export const datasDosRelatorios = cache(
  async (): Promise<RelatorioDaLista[]> => {
    const db = await op();
    const linhas = await lerTudo(() =>
      db
        .from("diario_relatorios")
        .select("id, obra_id, numero, data, data_fim, status_id")
        .order("data")
        .order("id"),
    );
    return linhas.map((r) => ({
      id: r.id,
      obraId: r.obra_id,
      numero: r.numero,
      data: r.data,
      dataFim: r.data_fim,
      statusId: r.status_id,
    }));
  },
);

export interface FiltroRelatorios {
  obra?: string;
  /** aaaa-mm-dd, inclusive. */
  de: string;
  ate: string;
  /** Um ou mais ids de status (ex.: [1, 3] para "a aprovar"). */
  status?: number[];
  modelo?: string;
  autor?: string;
}

export interface LinhaRelatorio {
  id: string;
  obraId: string;
  obra: string;
  numero: number;
  data: string;
  dataFim: string | null;
  statusId: number;
  modelo: string | null;
  modeloId: string | null;
  autor: string | null;
  autorCargo: string | null;
  autorId: string | null;
  app: string | null;
  criadoNoApp: string | null;
  resumo: ResumoRelatorio | null;
  exemplo: boolean;
}

const COLUNAS_RELATORIO =
  "id, obra_id, numero, data, data_fim, status_id, modelo, modelo_id, autor, autor_cargo, autor_id, app, criado_no_app, resumo, exemplo, obra:diario_obras(nome)";

/**
 * Relatórios do período (data entre de e até), com os filtros da API: obra,
 * status, modelo e autor. Mais novos primeiro.
 */
export async function relatoriosDoPeriodo(
  f: FiltroRelatorios,
): Promise<LinhaRelatorio[]> {
  const db = await op();
  const linhas = await lerTudo(() => {
    let q = db
      .from("diario_relatorios")
      .select(COLUNAS_RELATORIO)
      .gte("data", f.de)
      .lte("data", f.ate);
    if (f.obra) q = q.eq("obra_id", f.obra);
    if (f.status?.length) q = q.in("status_id", f.status);
    if (f.modelo) q = q.eq("modelo_id", f.modelo);
    if (f.autor) q = q.eq("autor_id", f.autor);
    return q
      .order("data", { ascending: false })
      .order("numero", { ascending: false })
      .order("id");
  });
  return linhas.map((r) => ({
    id: r.id,
    obraId: r.obra_id,
    obra: r.obra?.nome ?? "—",
    numero: r.numero,
    data: r.data,
    dataFim: r.data_fim,
    statusId: r.status_id,
    modelo: r.modelo,
    modeloId: r.modelo_id,
    autor: r.autor,
    autorCargo: r.autor_cargo,
    autorId: r.autor_id,
    app: r.app,
    criadoNoApp: r.criado_no_app,
    resumo: lerResumo(r.resumo),
    exemplo: r.exemplo,
  }));
}

/** Opções dos filtros de modelo e autor: as que aparecem nos relatórios guardados. */
export const opcoesDosRelatorios = cache(async () => {
  const db = await op();
  const linhas = await lerTudo(() =>
    db
      .from("diario_relatorios")
      .select("id, modelo, modelo_id, autor, autor_id")
      .order("id"),
  );
  const modelos = new Map<string, string>();
  const autores = new Map<string, string>();
  for (const l of linhas) {
    if (l.modelo_id && l.modelo) modelos.set(l.modelo_id, l.modelo);
    if (l.autor_id && l.autor) autores.set(l.autor_id, l.autor);
  }
  const ordenar = (m: Map<string, string>) =>
    [...m]
      .map(([valor, rotulo]) => ({ valor, rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return { modelos: ordenar(modelos), autores: ordenar(autores) };
});

export interface RelatorioCompleto extends LinhaRelatorio {
  dados: Relatorio | null;
  detalhadoEm: string | null;
}

/** O relatório inteiro (Tela 4). */
export async function relatorioCompleto(
  id: string,
): Promise<RelatorioCompleto | null> {
  const { data, error } = await (await op())
    .from("diario_relatorios")
    .select(`${COLUNAS_RELATORIO}, dados, detalhado_em`)
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  if (!data) return null;
  return {
    id: data.id,
    obraId: data.obra_id,
    obra: data.obra?.nome ?? "—",
    numero: data.numero,
    data: data.data,
    dataFim: data.data_fim,
    statusId: data.status_id,
    modelo: data.modelo,
    modeloId: data.modelo_id,
    autor: data.autor,
    autorCargo: data.autor_cargo,
    autorId: data.autor_id,
    app: data.app,
    criadoNoApp: data.criado_no_app,
    resumo: lerResumo(data.resumo),
    exemplo: data.exemplo,
    // Gravado pela sincronização depois de passar pelo schema do conector.
    dados: (data.dados ?? null) as Relatorio | null,
    detalhadoEm: data.detalhado_em,
  };
}

/** Partes do relatório lidas pelas abas da obra (só o pedaço do JSON). */
export interface PartesDoRelatorio {
  id: string;
  numero: number;
  data: string;
  ocorrencias: Relatorio["ocorrencias"];
  equipamentos: Relatorio["equipamentos"];
  material: NonNullable<Relatorio["controleDeMaterial"]> | null;
  galeria: Foto[];
  videos: Video[];
  anexos: Anexo[];
  atividades: Relatorio["atividades"];
}

const PARTES = {
  ocorrencias: "ocorrencias:dados->ocorrencias",
  equipamentos: "equipamentos:dados->equipamentos",
  material: "material:dados->controleDeMaterial",
  galeria: "galeria:dados->galeriaDeFotos",
  videos: "videos:dados->videos",
  anexos: "anexos:dados->anexos",
  atividades: "atividades:dados->atividades",
} as const;
type Parte = keyof typeof PARTES;

/**
 * Pedaços do relatório completo de uma obra, no período (ou em todo o
 * histórico, sem período), do mais antigo ao mais novo. Só os campos
 * pedidos saem do banco.
 */
export async function partesDosRelatorios(
  obraId: string,
  partes: Parte[],
  periodo?: { de: string; ate: string },
): Promise<PartesDoRelatorio[]> {
  const db = await op();
  const colunas = ["id", "numero", "data", ...partes.map((p) => PARTES[p])];
  const linhas = await lerTudo(() => {
    let q = db
      .from("diario_relatorios")
      .select(colunas.join(", "))
      .eq("obra_id", obraId)
      .not("detalhado_em", "is", null);
    if (periodo) q = q.gte("data", periodo.de).lte("data", periodo.ate);
    return q.order("data").order("numero").order("id");
  });
  const lista = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return (linhas as unknown as Record<string, unknown>[]).map((l) => ({
    id: String(l.id),
    numero: Number(l.numero),
    data: String(l.data),
    ocorrencias: lista(l.ocorrencias),
    equipamentos: lista(l.equipamentos),
    material: (l.material ?? null) as PartesDoRelatorio["material"],
    galeria: lista(l.galeria),
    videos: lista(l.videos),
    anexos: lista(l.anexos),
    atividades: lista(l.atividades),
  }));
}
