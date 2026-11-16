import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { z } from "zod";
import type { Permissao } from "@/lib/permissions";
import {
  indicadoresPorCampoDe,
  linhaDeUsoSchema,
  MARCO_DESCARTADO,
  type TipoFormulario,
  usoDoBanco,
} from "@/lib/sustentabilidade/editor-operacoes";
import {
  diferencas,
  type IndicadoresPorCampo,
  type Marca,
  todasAsPerguntas,
  type Uso,
} from "@/lib/sustentabilidade/formulario/editor";
import {
  type DefinicaoFormulario,
  definicaoSchema,
  UNIDADES_PADRAO,
} from "@/lib/sustentabilidade/formulario/tipos";
import { podeAgora } from "@/server/auth";
import { TAG } from "@/server/cache";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import { contextoSu, falhar, parametros, su, suAdmin } from "./base";

// Leituras dos formulários específicos (spec 4.13): o editor (rascunho, uso,
// versões, alterações), a lista de formulários de um programa e a definição
// publicada (lançamento e página do parceiro). O rascunho e o log são lidos
// com a sessão, sem cache: duas pessoas podem estar editando. Só a definição
// publicada (imutável, troca ao publicar) fica no cache.

const VAZIO: DefinicaoFormulario = { secoes: [] };

/** Definição gravada no banco (jsonb), conferida pelo Zod. */
export function lerDefinicao(json: unknown): DefinicaoFormulario {
  const r = definicaoSchema.safeParse(json);
  if (!r.success)
    throw new Error(`Formulário com definição inválida: ${r.error.message}`);
  return r.data;
}

/** Permissão de editar o formulário (a mesma do RLS e de publicar). */
export function permissaoDoFormulario(tipo: TipoFormulario): Permissao {
  return tipo === "questionario"
    ? "sustentabilidade.entrevistas.questionario"
    : "sustentabilidade.programas.gerenciar";
}

const tipoSchema = z.enum(["questionario", "programa"]);

/** Id do questionário da entrevista (há um só). */
export const idDoQuestionario = cache(async (): Promise<string | null> => {
  const { data, error } = await (await su())
    .from("formularios")
    .select("id")
    .eq("tipo", "questionario")
    .maybeSingle();
  falhar(error);
  return data?.id ?? null;
});

// ---------------------------------------------------------------- publicada

/**
 * Versão publicada (a mais recente) e a definição dela; versão 0 e
 * definição vazia quando nunca foi publicado. Não lê a sessão: quem chama
 * confere antes o acesso (sessão com acesso ao módulo, ou o token do link
 * do parceiro já validado) e só passa id de formulário que veio daí.
 */
export const definicaoPublicada = cache(
  (
    formularioId: string,
  ): Promise<{ versao: number; definicao: DefinicaoFormulario }> =>
    publicadaDoCache(formularioId),
);

async function publicadaDoCache(
  formularioId: string,
): Promise<{ versao: number; definicao: DefinicaoFormulario }> {
  "use cache";
  cacheLife("referencia");
  cacheTag(TAG.sustentabilidade.formularios);
  const { data, error } = await suAdmin()
    .from("formulario_versoes")
    .select("versao, definicao")
    .eq("formulario_id", formularioId)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  falhar(error);
  if (!data) return { versao: 0, definicao: VAZIO };
  return { versao: data.versao, definicao: lerDefinicao(data.definicao) };
}

// ---------------------------------------------------------------- programa

export interface FormularioDoPrograma {
  id: string;
  nome: string;
  ativo: boolean;
  versao_publicada: number;
  /** Campos ativos (em seção ativa) no rascunho atual. */
  campos_ativos: number;
  lancamentos: number;
}

function camposAtivos(json: unknown): number {
  const r = definicaoSchema.safeParse(json);
  if (!r.success) return 0;
  return r.data.secoes
    .filter((s) => s.ativa)
    .reduce((n, s) => n + s.perguntas.filter((p) => p.ativa).length, 0);
}

/** Formulários de um programa (aba Formulário), por nome. */
export const formulariosDoPrograma = cache(
  async (programaId: string): Promise<FormularioDoPrograma[]> => {
    const db = await su();
    const { data, error } = await db
      .from("formularios")
      .select("id, nome, ativo, versao_publicada, rascunho")
      .eq("tipo", "programa")
      .eq("programa_id", programaId)
      .order("nome");
    falhar(error);
    const contagens = await Promise.all(
      data.map((f) =>
        db
          .from("lancamentos")
          .select("id", { count: "exact", head: true })
          .eq("formulario_id", f.id),
      ),
    );
    return data.map((f, i) => {
      const c = contagens[i];
      falhar(c?.error ?? null);
      return {
        id: f.id,
        nome: f.nome,
        ativo: f.ativo,
        versao_publicada: f.versao_publicada,
        campos_ativos: camposAtivos(f.rascunho),
        lancamentos: c?.count ?? 0,
      };
    });
  },
);

// ---------------------------------------------------------------- editor

export interface Formulario {
  id: string;
  tipo: TipoFormulario;
  programa_id: string | null;
  nome: string;
  ativo: boolean;
  versao_publicada: number;
  rascunho: DefinicaoFormulario;
  rascunho_alterado: boolean;
  atualizado_em: string;
  exemplo: boolean;
}

/** O formulário com o rascunho, pela sessão (null: não existe ou sem acesso). */
export const formulario = cache(
  async (id: string): Promise<Formulario | null> => {
    const { data, error } = await (await su())
      .from("formularios")
      .select(
        "id, tipo, programa_id, nome, ativo, versao_publicada, rascunho, rascunho_alterado, atualizado_em, exemplo",
      )
      .eq("id", id)
      .maybeSingle();
    falhar(error);
    if (!data) return null;
    return {
      ...data,
      tipo: tipoSchema.parse(data.tipo),
      rascunho: lerDefinicao(data.rascunho),
    };
  },
);

/** Uso de cada pergunta e opção em todas as versões (pela sessão). */
export async function usoDoFormulario(id: string): Promise<Uso> {
  const { data, error } = await (await su()).rpc("uso_do_formulario", {
    p_id: id,
  });
  falhar(error);
  return usoDoBanco(z.array(linhaDeUsoSchema).parse(data ?? []));
}

/** Indicadores do programa que usam este formulário (todos e só ativos). */
export async function indicadoresDoFormulario(
  f: Pick<Formulario, "id" | "tipo">,
): Promise<{ todos: IndicadoresPorCampo; ativos: IndicadoresPorCampo }> {
  if (f.tipo !== "programa") return { todos: {}, ativos: {} };
  const { data, error } = await (await su())
    .from("programa_indicadores")
    .select("nome, campo_id, filtro, ativo")
    .eq("formulario_id", f.id);
  falhar(error);
  return {
    todos: indicadoresPorCampoDe(data),
    ativos: indicadoresPorCampoDe(data, true),
  };
}

export interface VersaoDoEditor {
  versao: number;
  em: string;
  por: string;
  resumo: string;
  /** Entrevistas salvas ou lançamentos nesta versão. */
  usos: number;
}

export interface AlteracaoDoEditor {
  id: string;
  quando: string;
  quem: string;
  descricao: string;
}

export interface DadosEditor {
  id: string;
  nome: string;
  tipo: TipoFormulario;
  /** Nome do programa (formulário de programa). */
  programa: string | null;
  ativo: boolean;
  /** Formulário dos dados de exemplo (as contagens são fictícias). */
  exemplo: boolean;
  versao: number;
  rascunho: DefinicaoFormulario;
  atualizadoEm: string;
  /** Rascunho diferente da versão publicada. */
  alterado: boolean;
  /** Alterações registradas desde a publicação (ou o descarte). */
  pendentes: number;
  marcas: Record<string, Marca>;
  uso: Uso;
  indicadores: IndicadoresPorCampo;
  indicadoresAtivos: IndicadoresPorCampo;
  /** Ids de seções, perguntas e opções da versão publicada. */
  idsPublicados: string[];
  versoes: VersaoDoEditor[];
  alteracoes: AlteracaoDoEditor[];
  /** "Formulários específicos – excluir". */
  podeExcluir: boolean;
  /** Unidades sugeridas (Parâmetros). */
  unidades: string[];
}

const LIMITE_ALTERACOES = 200;

/**
 * Tudo que o editor mostra. Null quando o formulário não existe ou a pessoa
 * não pode editá-lo (a tela mostra o aviso).
 */
export const dadosDoEditor = cache(
  async (id: string): Promise<DadosEditor | null> => {
    const f = await formulario(id);
    if (!f) return null;
    const permissao = permissaoDoFormulario(f.tipo);
    const ctx = await contextoSu();
    if (!ctx.pode(permissao)) return null;
    const db = await su();

    const [uso, indicadores, versoes, publicada, marco, programa, p, liberado] =
      await Promise.all([
        usoDoFormulario(id),
        indicadoresDoFormulario(f),
        db
          .from("formulario_versoes")
          .select("versao, resumo, publicado_por, publicado_em")
          .eq("formulario_id", id)
          .order("versao", { ascending: false }),
        definicaoPublicada(id),
        db
          .from("formulario_alteracoes")
          .select("quando")
          .eq("formulario_id", id)
          .contains("depois", MARCO_DESCARTADO)
          .order("quando", { ascending: false })
          .limit(1)
          .maybeSingle(),
        f.programa_id
          ? db
              .from("programas")
              .select("nome")
              .eq("id", f.programa_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        parametros(),
        // As contagens por versão leem entrevistas e lançamentos pela
        // service role (só números): confere a permissão no banco antes.
        podeAgora(permissao),
      ]);
    falhar(versoes.error);
    falhar(marco.error);
    falhar(programa.error);

    const publicadaEm = versoes.data[0]?.publicado_em ?? null;
    const desde = [publicadaEm, marco.data?.quando ?? null]
      .filter((x): x is string => Boolean(x))
      .sort()
      .at(-1);

    const [alteracoes, usos] = await Promise.all([
      f.rascunho_alterado
        ? (() => {
            let q = db
              .from("formulario_alteracoes")
              .select("id, quando, quem, descricao", { count: "exact" })
              .eq("formulario_id", id);
            if (desde) q = q.gt("quando", desde);
            return q
              .order("quando", { ascending: false })
              .limit(LIMITE_ALTERACOES);
          })()
        : Promise.resolve({ data: [], error: null, count: 0 }),
      Promise.all(
        versoes.data.map((v) =>
          liberado ? usosDaVersao(f, v.versao) : Promise.resolve(0),
        ),
      ),
    ]);
    falhar(alteracoes.error);

    const nomes = await nomesDeUsuarios(
      [
        ...versoes.data.map((v) => v.publicado_por),
        ...(alteracoes.data ?? []).map((a) => a.quem),
      ],
      [permissao],
    );
    const nome = (pessoa: string | null, sem: string) =>
      (pessoa && nomes.get(pessoa)) || sem;

    const pub = publicada.definicao;
    return {
      id: f.id,
      nome: f.nome,
      tipo: f.tipo,
      programa: programa.data?.nome ?? null,
      ativo: f.ativo,
      exemplo: f.exemplo,
      versao: f.versao_publicada,
      rascunho: f.rascunho,
      atualizadoEm: f.atualizado_em,
      alterado: f.rascunho_alterado,
      pendentes: f.rascunho_alterado ? (alteracoes.count ?? 0) : 0,
      marcas: f.versao_publicada ? diferencas(pub, f.rascunho) : {},
      uso,
      indicadores: indicadores.todos,
      indicadoresAtivos: indicadores.ativos,
      idsPublicados: [
        ...pub.secoes.map((s) => s.id),
        ...todasAsPerguntas(pub).flatMap((q) => [
          q.id,
          ...q.opcoes.map((o) => o.id),
        ]),
      ],
      versoes: versoes.data.map((v, i) => ({
        versao: v.versao,
        em: v.publicado_em,
        por: nome(v.publicado_por, "Importação"),
        resumo: v.resumo,
        usos: usos[i] ?? 0,
      })),
      alteracoes: (alteracoes.data ?? []).map((a) => ({
        id: a.id,
        quando: a.quando,
        quem: nome(a.quem, "—"),
        descricao: a.descricao,
      })),
      podeExcluir: ctx.pode("sustentabilidade.formularios.excluir"),
      unidades: p.unidades?.length ? p.unidades : UNIDADES_PADRAO,
    };
  },
);

/** Entrevistas salvas ou lançamentos de uma versão (service role, só a contagem). */
async function usosDaVersao(
  f: Pick<Formulario, "id" | "tipo">,
  versao: number,
): Promise<number> {
  const db = suAdmin();
  const { count, error } =
    f.tipo === "questionario"
      ? await db
          .from("entrevistas")
          .select("id", { count: "exact", head: true })
          .eq("situacao", "salva")
          .eq("formulario_versao", versao)
      : await db
          .from("lancamentos")
          .select("id", { count: "exact", head: true })
          .eq("formulario_id", f.id)
          .eq("formulario_versao", versao);
  falhar(error);
  return count ?? 0;
}
