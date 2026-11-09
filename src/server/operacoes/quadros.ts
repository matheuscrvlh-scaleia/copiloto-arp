import "server-only";
import { cache } from "react";
import { z } from "zod";
import {
  type CaixaBase,
  type ContratoEnet,
  contratoDaSala,
} from "@/lib/operacoes/energia";
import { salaNoTermo } from "@/lib/operacoes/termo";
import { linksDeLeitura } from "@/server/arquivos";
import { nomesDeUsuarios } from "@/server/comercial/usuarios";
import {
  type ContextoOp,
  contextoOp,
  falhar,
  op,
  type Parametros,
  parametros,
  type Tabela,
} from "./base";

// Leituras dos quadros de medidores (spec 4.5), todas com a sessão (RLS de
// operacoes.energia.*), sem cache no servidor: é dado de negócio. O
// histórico de ocupantes só é lido para quem tem
// operacoes.energia.historico (e o RLS também esconde).

export const BUCKET_OPERACOES = "operacoes" as const;
/** Validade dos links das fotos e dos termos (segundos). */
export const LINK_SEGUNDOS = 10 * 60;

const COLUNAS_QUADRO =
  "id, codigo, nome, bloco, projeto, subestacao, roteiro_base, armario, disjuntor_geral, espacos, observacoes, fotos, ordem, ativo, exemplo" as const;

export type Quadro = Pick<
  Tabela<"quadros">,
  | "id"
  | "codigo"
  | "nome"
  | "bloco"
  | "projeto"
  | "subestacao"
  | "roteiro_base"
  | "armario"
  | "disjuntor_geral"
  | "espacos"
  | "observacoes"
  | "fotos"
  | "ordem"
  | "ativo"
  | "exemplo"
>;

/** Quadros na ordem do cadastro. */
export const listaDeQuadros = cache(async (): Promise<Quadro[]> => {
  const { data, error } = await (await op())
    .from("quadros")
    .select(COLUNAS_QUADRO)
    .order("ordem")
    .order("bloco")
    .order("codigo");
  falhar(error);
  return data;
});

const resumoSchema = z.array(
  z.object({
    quadro_id: z.uuid(),
    caixas: z.number().int(),
    ocupadas: z.number().int(),
    reservadas: z.number().int(),
    livres: z.number().int(),
    sem_termo: z.number().int(),
    locatarios_novos: z.number().int(),
  }),
);
export type ResumoDoQuadro = z.infer<typeof resumoSchema>[number];

/** Contagem por quadro, feita no banco (operacoes.resumo_quadros). */
export const resumoDosQuadros = cache(
  async (): Promise<Map<string, ResumoDoQuadro>> => {
    const { data, error } = await (await op()).rpc("resumo_quadros");
    falhar(error);
    return new Map(resumoSchema.parse(data).map((r) => [r.quadro_id, r]));
  },
);

// ---------------------------------------------------------------------------
// Caixas
// ---------------------------------------------------------------------------

const COLUNAS_CAIXA =
  "id, quadro_id, numero, numero_antigo, lado, coluna, linha, rota, sala_id, salas_texto, pavimento, status, ocupante, ocupante_documento, ocupante_desde, contrato, ocupante_origem, locatario_novo, termo_externo, disjuntor_amperes, ligacao, disjuntor_texto, medidor_situacao, medidor_numero, modulo, observacoes, exemplo, cadastro:salas(id, codigo, bloco, sala, pavimento), termos(count)" as const;

type LinhaCaixa = Omit<Tabela<"caixas">, "criado_em" | "atualizado_em"> & {
  cadastro: Pick<
    Tabela<"salas">,
    "id" | "codigo" | "bloco" | "sala" | "pavimento"
  > | null;
  termos: { count: number }[];
};

export interface Caixa
  extends CaixaBase,
    Omit<LinhaCaixa, "cadastro" | "termos"> {
  /** Bloco da sala (o quadro do Bloco 04 atende salas do 03). */
  sala_bloco: string | null;
  /** Unidade da sala ("101-102"), para ligar ao ENET. */
  sala_unidade: string | null;
  /** Termos emitidos no sistema. */
  termos: number;
}

function paraCaixa(r: LinhaCaixa): Caixa {
  const { cadastro, termos, ...resto } = r;
  const emitidos = termos[0]?.count ?? 0;
  return {
    ...resto,
    sala:
      r.salas_texto?.trim() || (cadastro ? salaNoTermo(cadastro.sala) : null),
    sala_bloco: cadastro?.bloco ?? null,
    sala_unidade: cadastro?.sala ?? null,
    pavimento: r.pavimento ?? cadastro?.pavimento ?? null,
    termos: emitidos,
    com_termo: r.termo_externo || emitidos > 0,
  };
}

/** Caixas de um quadro (ou de todos), na ordem do desenho. */
export const caixasDoQuadro = cache(
  async (quadroId: string | null): Promise<Caixa[]> => {
    let q = (await op()).from("caixas").select(COLUNAS_CAIXA);
    if (quadroId) q = q.eq("quadro_id", quadroId);
    const { data, error } = await q
      .order("quadro_id")
      .order("lado")
      .order("linha")
      .order("coluna")
      .order("numero")
      .limit(2000);
    falhar(error);
    return (data as unknown as LinhaCaixa[]).map(paraCaixa);
  },
);

export interface CaixaComQuadro extends Caixa {
  quadro: Quadro;
}

/** A caixa e o quadro dela; null se não existe ou o RLS esconde. */
export const caixaPorId = cache(
  async (id: string): Promise<CaixaComQuadro | null> => {
    if (!z.uuid().safeParse(id).success) return null;
    const { data, error } = await (await op())
      .from("caixas")
      .select(`${COLUNAS_CAIXA}, quadro:quadros(${COLUNAS_QUADRO})`)
      .eq("id", id)
      .maybeSingle();
    falhar(error);
    if (!data) return null;
    const { quadro, ...linha } = data as unknown as LinhaCaixa & {
      quadro: Quadro;
    };
    return { ...paraCaixa(linha), quadro };
  },
);

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

export type Sala = Pick<
  Tabela<"salas">,
  "id" | "codigo" | "bloco" | "sala" | "pavimento"
> & { caixas: number };

/** Cadastro de salas, com quantas caixas cada uma tem. */
export const listaDeSalas = cache(async (): Promise<Sala[]> => {
  const { data, error } = await (await op())
    .from("salas")
    .select("id, codigo, bloco, sala, pavimento, caixas(count)")
    .order("bloco")
    .order("sala")
    .order("id")
    .limit(5000);
  falhar(error);
  return (
    data as unknown as (Omit<Sala, "caixas"> & {
      caixas: { count: number }[];
    })[]
  ).map(({ caixas, ...s }) => ({ ...s, caixas: caixas[0]?.count ?? 0 }));
});

// ---------------------------------------------------------------------------
// ENET (contratos vigentes) e o que é da ficha
// ---------------------------------------------------------------------------

const contratosSchema = z.array(
  z.object({
    bloco: z.string().nullable(),
    luc: z.string(),
    nome: z.string(),
    locatario: z.string().min(1),
    documento: z.string().nullable(),
    contrato: z.string().nullable(),
    inicio: z.iso.date().nullable(),
    fim: z.iso.date().nullable(),
  }),
);

/** Contratos vigentes do ENET (os.lojas), pela função do banco. */
export const contratosEnet = cache(async (): Promise<ContratoEnet[]> => {
  const { data, error } = await (await op()).rpc("enet_contratos");
  falhar(error);
  const lidos = contratosSchema.safeParse(data);
  if (!lidos.success) {
    console.error("ENET: resposta fora do formato", lidos.error.issues[0]);
    return [];
  }
  return lidos.data;
});

export interface TermoEmitido {
  id: string;
  versao: number;
  locatario: string;
  documento: string;
  bloco: string;
  sala: string;
  data_emissao: string;
  emitido_em: string;
  emitidoPor: string;
  temWord: boolean;
}

/** Termos da caixa, do mais novo ao mais antigo, com quem emitiu. */
export const termosDaCaixa = cache(
  async (caixaId: string): Promise<TermoEmitido[]> => {
    const { data, error } = await (await op())
      .from("termos")
      .select(
        "id, versao, locatario, documento, bloco, sala, data_emissao, emitido_em, emitido_por, docx",
      )
      .eq("caixa_id", caixaId)
      .order("versao", { ascending: false });
    falhar(error);
    const nomes = await nomesDeUsuarios(
      data.map((t) => t.emitido_por),
      ["operacoes.energia.ver"],
    );
    return data.map((t) => ({
      id: t.id,
      versao: t.versao,
      locatario: t.locatario,
      documento: t.documento,
      bloco: t.bloco,
      sala: t.sala,
      data_emissao: t.data_emissao,
      emitido_em: t.emitido_em,
      emitidoPor: (t.emitido_por && nomes.get(t.emitido_por)) || "—",
      temWord: !!t.docx,
    }));
  },
);

export type OcupanteAnterior = Pick<
  Tabela<"caixa_ocupantes">,
  "id" | "nome" | "documento" | "entrada" | "saida" | "origem"
>;

/**
 * Histórico de ocupantes (sigiloso). Quem chama confere
 * operacoes.energia.historico antes; o RLS confere de novo.
 */
export async function historicoDaCaixa(
  caixaId: string,
): Promise<OcupanteAnterior[]> {
  const { data, error } = await (await op())
    .from("caixa_ocupantes")
    .select("id, nome, documento, entrada, saida, origem")
    .eq("caixa_id", caixaId)
    .order("saida", { ascending: false, nullsFirst: false })
    .order("nome");
  falhar(error);
  return data;
}

/** Links temporários das fotos da sala de medidores (o quadro já foi lido pelo RLS). */
export async function linksDasFotos(
  fotos: string[],
): Promise<{ caminho: string; url: string }[]> {
  const links = await linksDeLeitura(BUCKET_OPERACOES, fotos, LINK_SEGUNDOS);
  return fotos.flatMap((caminho) => {
    const url = links.get(caminho);
    return url ? [{ caminho, url }] : [];
  });
}

/** Termo para baixar: arquivos e campos do nome; null se o RLS esconde. */
export async function termoParaBaixar(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await (await op())
    .from("termos")
    .select("id, caixa_id, versao, bloco, sala, locatario, pdf, docx")
    .eq("id", id)
    .maybeSingle();
  falhar(error);
  return data;
}

// ---------------------------------------------------------------------------
// Ficha da caixa e termos recentes
// ---------------------------------------------------------------------------

export interface DadosDaFicha {
  ctx: ContextoOp;
  caixa: CaixaComQuadro;
  parametros: Parametros;
  termos: TermoEmitido[];
  /** null: sem a permissão do histórico (sigiloso). */
  historico: OcupanteAnterior[] | null;
  /** Contrato vigente do ENET na sala da caixa. */
  enet: ContratoEnet | null;
  /** Salas para o cadastro (só para quem edita). */
  salas: Sala[];
}

/** Tudo o que a ficha da caixa mostra, em paralelo; null se não existe. */
export const fichaDaCaixa = cache(
  async (id: string): Promise<DadosDaFicha | null> => {
    const [ctx, caixa, p] = await Promise.all([
      contextoOp(),
      caixaPorId(id),
      parametros(),
    ]);
    if (!caixa) return null;
    const [termos, historico, contratos, salas] = await Promise.all([
      termosDaCaixa(caixa.id),
      ctx.pode("operacoes.energia.historico")
        ? historicoDaCaixa(caixa.id)
        : Promise.resolve(null),
      contratosEnet(),
      ctx.pode("operacoes.energia.editar")
        ? listaDeSalas()
        : Promise.resolve([]),
    ]);
    const enet = contratoDaSala(contratos, {
      bloco: caixa.sala_bloco ?? caixa.quadro.bloco,
      sala: caixa.sala_unidade ?? caixa.sala,
    });
    return { ctx, caixa, parametros: p, termos, historico, enet, salas };
  },
);

export interface TermoRecente {
  id: string;
  caixa_id: string;
  versao: number;
  locatario: string;
  bloco: string;
  sala: string;
  data_emissao: string;
  emitido_em: string;
  temWord: boolean;
}

/** Últimos termos emitidos (todas as caixas). */
export async function termosRecentes(limite = 30): Promise<TermoRecente[]> {
  const { data, error } = await (await op())
    .from("termos")
    .select(
      "id, caixa_id, versao, locatario, bloco, sala, data_emissao, emitido_em, docx",
    )
    .order("emitido_em", { ascending: false })
    .limit(limite);
  falhar(error);
  return data.map(({ docx, ...t }) => ({ ...t, temWord: !!docx }));
}
