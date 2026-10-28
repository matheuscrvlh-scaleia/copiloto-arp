import "server-only";
import { cache } from "react";
import { z } from "zod";
import { formatarData } from "@/lib/formato";
import {
  buscaNoOr,
  type Filtravel,
  totalForaDoIntervalo,
} from "@/lib/os/filtro-postgrest";
import { intervalo } from "@/lib/os/paginacao";
import { rotaVistoria } from "@/lib/os/rotas";
import {
  RESPOSTAS_AMBIENTE,
  TIPOS_VISTORIA,
  type TipoVistoria,
} from "@/lib/os/rotulos";
import { hojeEmBrasilia } from "@/lib/os/tempo";
import {
  AMBIENTES_PADRAO,
  LOCADOR_PADRAO,
  LOCAL_PADRAO,
  localEData,
  TEXTOS_PADRAO,
} from "@/lib/os/vistoria";
import {
  casarAmbientes,
  localDaUnidade,
  MENSAGEM_LAUDO_PADRAO,
  motivoParaAssinaturaDoLocatario,
  type TextosDoTipo,
} from "@/lib/os/vistoria-regras";
import {
  CARTOES_VISTORIA,
  type CartaoVistoria,
  type CriterioVistoria,
  criterioDoCartaoVistoria,
  ehUuid,
  type FiltroVistorias,
  vistoriadorDe,
} from "@/lib/os/vistorias-lista";
import { MENSAGENS_PADRAO } from "@/lib/os/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";
import { configDoSistema } from "./automacao";
import {
  baixarArquivo,
  os,
  osAdmin,
  type Parametros,
  parametros as parametrosDoModulo,
  registrarComoSistema,
  type Tabela,
  urlsAssinadas,
} from "./base";

// Vistorias de locação (4.10): leitura das telas pela sessão (RLS da
// permissão os.vistorias), criação a partir do contrato (também pelo
// sistema, no modelo de entrada/saída de cliente) e os dados do laudo.

export type Vistoria = Tabela<"vistorias">;
export type Ambiente = Tabela<"vistoria_ambientes">;
export type Loja = Tabela<"lojas">;
type Db = ReturnType<typeof osAdmin>;

function falhar(erro: { message: string } | null): asserts erro is null {
  if (erro) throw new Error(`Falha ao ler as vistorias: ${erro.message}`);
}

/** O PostgREST devolve no máximo 1000 linhas por consulta (max_rows). */
const PAGINA = 1000;

/** Lê todas as linhas, página a página (a consulta precisa de ordem estável). */
async function emPaginas<T>(
  pagina: (
    de: number,
    ate: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await pagina(de, de + PAGINA - 1);
    falhar(error);
    todas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) return todas;
  }
}

// ---------------------------------------------------------------------------
// Padrões (Parâmetros, com os do laudo atual como reserva)
// ---------------------------------------------------------------------------

export interface PadroesVistoria {
  locador: string;
  local: string;
  ambientes: string[];
  textos: Record<TipoVistoria, TextosDoTipo>;
  /** Mensagem do WhatsApp com o link do laudo. */
  mensagem: string;
  /** Mensagem do WhatsApp com o link para o locatário assinar. */
  mensagemAssinatura: string;
}

const textosLidos = z.record(
  z.string(),
  z.object({
    observacao: z.string().optional(),
    termo: z.string().optional(),
  }),
);
const mensagensLidas = z.record(z.string(), z.unknown());

export function padroesDe(
  p: Pick<
    Parametros,
    | "vistoria_locador"
    | "vistoria_local"
    | "vistoria_ambientes"
    | "vistoria_textos"
    | "mensagens"
  >,
): PadroesVistoria {
  const lidos = textosLidos.safeParse(p.vistoria_textos);
  const doBanco = lidos.success ? lidos.data : {};
  const tipos = Object.keys(TIPOS_VISTORIA) as TipoVistoria[];
  const textos = Object.fromEntries(
    tipos.map((t) => [
      t,
      {
        observacao:
          doBanco[t]?.observacao?.trim() || TEXTOS_PADRAO[t].observacao,
        termo: doBanco[t]?.termo?.trim() || TEXTOS_PADRAO[t].termo,
      },
    ]),
  ) as Record<TipoVistoria, TextosDoTipo>;
  const ambientes = p.vistoria_ambientes.map((a) => a.trim()).filter(Boolean);
  const mensagens = mensagensLidas.safeParse(p.mensagens);
  const mensagem = mensagens.success ? mensagens.data.laudo : null;
  const assinatura = mensagens.success
    ? mensagens.data.vistoria_assinatura
    : null;
  return {
    locador: p.vistoria_locador.trim() || LOCADOR_PADRAO,
    local: p.vistoria_local.trim() || LOCAL_PADRAO,
    ambientes: ambientes.length ? ambientes : AMBIENTES_PADRAO,
    textos,
    mensagem:
      typeof mensagem === "string" && mensagem.trim()
        ? mensagem
        : MENSAGEM_LAUDO_PADRAO,
    mensagemAssinatura:
      typeof assinatura === "string" && assinatura.trim()
        ? assinatura
        : MENSAGENS_PADRAO.vistoria_assinatura,
  };
}

/** Padrões das telas (Parâmetros do cache, depois de conferir o acesso). */
export const padroesVistoria = cache(
  async (): Promise<PadroesVistoria> => padroesDe(await parametrosDoModulo()),
);

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

const COLUNAS_LISTA =
  "id, codigo, tipo, status, rascunho, data, hora, vistoriador_id, vistoriador_nome, loja_id, locatario, bloco, unidade, assinatura_locador_path, assinatura_locatario_path, legado_id, exemplo, criado_em, atualizado_em" as const;

export type VistoriaResumo = Pick<
  Vistoria,
  | "id"
  | "codigo"
  | "tipo"
  | "status"
  | "rascunho"
  | "data"
  | "hora"
  | "vistoriador_id"
  | "vistoriador_nome"
  | "loja_id"
  | "locatario"
  | "bloco"
  | "unidade"
  | "assinatura_locador_path"
  | "assinatura_locatario_path"
  | "legado_id"
  | "exemplo"
  | "criado_em"
  | "atualizado_em"
> & {
  /** OS abertas a partir dos ambientes desta vistoria. */
  ordens: number;
};

/** Ordens de serviço (ou chamados de um ambiente) que nasceram da vistoria. */
const ehOsDaVistoria = (c: { tipo: string; ambiente_id: string | null }) =>
  c.tipo === "os" || c.ambiente_id !== null;

/**
 * "Com OS gerada" no banco: um segundo embutido dos chamados, com !inner,
 * deixa só as vistorias com OS (ou chamado de ambiente) fora da lixeira.
 */
const comOS = (colunas: string, cartao: CriterioVistoria | null) =>
  cartao?.comOS ? `${colunas}, osv:chamados!inner(id)` : colunas;

function filtrarVistorias<Q extends Filtravel<Q>>(
  q: Q,
  f: FiltroVistorias | null,
  c: CriterioVistoria | null,
): Q {
  let r = q;
  if (f) {
    if (f.tipo) r = r.eq("tipo", f.tipo);
    if (f.status) r = r.eq("status", f.status);
    if (f.vistoriador)
      r = ehUuid(f.vistoriador)
        ? r.eq("vistoriador_id", f.vistoriador)
        : r.is("vistoriador_id", null).eq("vistoriador_nome", f.vistoriador);
    if (f.bloco === "sem") r = r.or("bloco.is.null,bloco.eq.");
    else if (f.bloco) r = r.eq("bloco", f.bloco);
    if (f.de) r = r.gte("data", f.de);
    if (f.ate) r = r.lte("data", f.ate);
    const busca = buscaNoOr(f.q, ["codigo", "locatario", "bloco", "unidade"]);
    if (busca) r = r.or(busca);
  }
  if (c) {
    if (c.status) r = r.eq("status", c.status);
    if (c.semStatus) r = r.not("status", "in", `(${c.semStatus.join(",")})`);
    if (c.legadoNulo) r = r.is("legado_id", null);
    if (c.ou) r = r.or(c.ou);
    if (c.dataEntre)
      r = r.gte("data", c.dataEntre.de).lt("data", c.dataEntre.ate);
    if (c.comOS)
      r = r
        .is("osv.lixeira_em", null)
        .or("tipo.eq.os,ambiente_id.not.is.null", { referencedTable: "osv" });
  }
  return r;
}

/** Quantas OS cada vistoria da página gerou (só as da página). */
async function ordensDasVistorias(ids: string[]): Promise<Map<string, number>> {
  const ordens = new Map<string, number>();
  if (ids.length === 0) return ordens;
  const db = await os();
  const chamados = await emPaginas((de, ate) =>
    db
      .from("chamados")
      .select("vistoria_id, tipo, ambiente_id")
      .in("vistoria_id", ids)
      .is("lixeira_em", null)
      .order("id")
      .range(de, ate),
  );
  for (const c of chamados) {
    if (!c.vistoria_id || !ehOsDaVistoria(c)) continue;
    ordens.set(c.vistoria_id, (ordens.get(c.vistoria_id) ?? 0) + 1);
  }
  return ordens;
}

async function comOrdens(
  lista: Omit<VistoriaResumo, "ordens">[],
): Promise<VistoriaResumo[]> {
  const ordens = await ordensDasVistorias(lista.map((v) => v.id));
  return lista.map((v) => ({ ...v, ordens: ordens.get(v.id) ?? 0 }));
}

/** Uma página da lista (a mais recente primeiro) e o total do filtro. */
export async function paginaDeVistorias(
  f: FiltroVistorias,
  pagina: number,
  hoje: string,
): Promise<{ vistorias: VistoriaResumo[]; total: number }> {
  const db = await os();
  const c = f.cartao ? criterioDoCartaoVistoria(f.cartao, hoje) : null;
  const { de, ate } = intervalo(pagina);
  const { data, error, count } = await filtrarVistorias(
    db
      .from("vistorias")
      .select(comOS(COLUNAS_LISTA, c) as typeof COLUNAS_LISTA, {
        count: "exact",
      }),
    f,
    c,
  )
    .order("data", { ascending: false })
    .order("codigo", { ascending: false })
    .order("id")
    .range(de, ate);
  if (error) {
    const total = totalForaDoIntervalo(error);
    if (total !== null) return { vistorias: [], total };
    falhar(error);
  }
  return { vistorias: await comOrdens(data ?? []), total: count ?? 0 };
}

/** Todas as vistorias do filtro (exportar, no clique). */
export async function vistoriasDoFiltro(
  f: FiltroVistorias,
  hoje: string,
): Promise<VistoriaResumo[]> {
  const db = await os();
  const c = f.cartao ? criterioDoCartaoVistoria(f.cartao, hoje) : null;
  const lista = await emPaginas((de, ate) =>
    filtrarVistorias(
      db
        .from("vistorias")
        .select(comOS(COLUNAS_LISTA, c) as typeof COLUNAS_LISTA),
      f,
      c,
    )
      .order("data", { ascending: false })
      .order("codigo", { ascending: false })
      .order("id")
      .range(de, ate),
  );
  // As OS de todas, de 100 em 100 ids (vão na URL), os lotes juntos.
  const lotes = await Promise.all(
    Array.from({ length: Math.ceil(lista.length / 100) }, (_, k) =>
      comOrdens(lista.slice(k * 100, k * 100 + 100)),
    ),
  );
  return lotes.flat();
}

/** Os cartões do topo (todas as vistorias, como antes): contagens no banco. */
export async function contarCartoesVistoria(
  hoje: string,
): Promise<Record<CartaoVistoria, number>> {
  const db = await os();
  const chaves = Object.keys(CARTOES_VISTORIA) as CartaoVistoria[];
  const contagens = await Promise.all(
    chaves.map(async (cartao) => {
      const c = criterioDoCartaoVistoria(cartao, hoje);
      const { count, error } = await filtrarVistorias(
        db
          .from("vistorias")
          .select(comOS("id", c) as "id", { count: "exact", head: true }),
        null,
        c,
      );
      falhar(error);
      return [cartao, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(contagens) as Record<CartaoVistoria, number>;
}

/**
 * Opções dos filtros de vistoriador e bloco: só essas três colunas de
 * todas as vistorias (o banco não devolve valores distintos sem uma função).
 */
export async function opcoesDosFiltrosDeVistoria(): Promise<{
  vistoriadores: Map<string, string>;
  blocos: string[];
}> {
  const db = await os();
  const lista = await emPaginas((de, ate) =>
    db
      .from("vistorias")
      .select("vistoriador_id, vistoriador_nome, bloco")
      .order("id")
      .range(de, ate),
  );
  const vistoriadores = new Map<string, string>();
  for (const v of lista)
    vistoriadores.set(vistoriadorDe(v), v.vistoriador_nome);
  const blocos = [...new Set(lista.map((v) => v.bloco.trim() || "sem"))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  return { vistoriadores, blocos };
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

export interface Foto {
  id: string;
  nome: string;
  path: string;
  url: string | null;
}

export interface AmbienteDaEntrada {
  titulo: string;
  resposta: Ambiente["resposta"];
  descricao: string | null;
  fotos: Foto[];
}

export interface AmbienteCompleto extends Ambiente {
  fotos: Foto[];
  entrada: AmbienteDaEntrada | null;
}

export interface ChamadoDaVistoria {
  id: string;
  numero: number;
  tipo: Tabela<"chamados">["tipo"];
  titulo: string;
  status: Tabela<"chamados">["status"];
  ambiente_id: string | null;
  criado_em: string;
}

export interface VistoriaCompleta {
  vistoria: Vistoria;
  ambientes: AmbienteCompleto[];
  loja: Loja | null;
  entrada: Pick<Vistoria, "id" | "codigo" | "data"> | null;
  chamados: ChamadoDaVistoria[];
  assinaturas: { locador: string | null; locatario: string | null };
}

const ehImagem = (a: { mime: string | null; nome: string }) =>
  a.mime?.startsWith("image/") ?? /\.(jpe?g|png|webp|heic)$/i.test(a.nome);

/** Fotos dos ambientes, na ordem em que foram tiradas (sem as URLs). */
async function fotosDosAmbientes(
  db: Db | Awaited<ReturnType<typeof os>>,
  ambientes: string[],
): Promise<Map<string, Omit<Foto, "url">[]>> {
  const mapa = new Map<string, Omit<Foto, "url">[]>();
  if (!ambientes.length) return mapa;
  const { data, error } = await db
    .from("anexos")
    .select("id, nome, path, mime, ambiente_id, categoria")
    .in("ambiente_id", ambientes)
    .not("categoria", "in", "(laudo,assinatura)")
    .order("em")
    .order("id");
  falhar(error);
  for (const a of data ?? []) {
    if (!a.ambiente_id || !ehImagem(a)) continue;
    mapa.set(a.ambiente_id, [
      ...(mapa.get(a.ambiente_id) ?? []),
      { id: a.id, nome: a.nome, path: a.path },
    ]);
  }
  return mapa;
}

/** Vistoria com ambientes, fotos (URLs de 1 h), entrada e chamados. */
export async function vistoriaCompleta(
  id: string,
): Promise<VistoriaCompleta | null> {
  const db = await os();
  // Ambientes e chamados só dependem do id: vêm junto com a vistoria (o
  // RLS é o mesmo; sem a vistoria, nada disso é usado).
  const [lida, ambientes, chamados] = await Promise.all([
    db.from("vistorias").select("*").eq("id", id).maybeSingle(),
    db
      .from("vistoria_ambientes")
      .select("*")
      .eq("vistoria_id", id)
      .order("ordem")
      .order("criado_em"),
    db
      .from("chamados")
      .select("id, numero, tipo, titulo, status, ambiente_id, criado_em")
      .eq("vistoria_id", id)
      .is("lixeira_em", null)
      .order("criado_em"),
  ]);
  falhar(lida.error);
  const vistoria = lida.data;
  if (!vistoria) return null;
  falhar(ambientes.error);
  falhar(chamados.error);

  const lista = ambientes.data ?? [];
  const idsEntrada = lista
    .map((a) => a.entrada_ambiente_id)
    .filter((x): x is string => !!x);
  const [loja, entrada, comEntrada, fotos] = await Promise.all([
    vistoria.loja_id
      ? db.from("lojas").select("*").eq("id", vistoria.loja_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    vistoria.entrada_id
      ? db
          .from("vistorias")
          .select("id, codigo, data")
          .eq("id", vistoria.entrada_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    idsEntrada.length
      ? db.from("vistoria_ambientes").select("*").in("id", idsEntrada)
      : Promise.resolve({ data: [] as Ambiente[], error: null }),
    fotosDosAmbientes(db, [...lista.map((a) => a.id), ...idsEntrada]),
  ]);
  falhar(loja.error);
  falhar(entrada.error);
  falhar(comEntrada.error);
  const daEntrada = comEntrada.data;
  const assinaturas = [
    vistoria.assinatura_locador_path,
    vistoria.assinatura_locatario_path,
  ].filter((p): p is string => !!p);
  const urls = await urlsAssinadas([
    ...[...fotos.values()].flat().map((f) => f.path),
    ...assinaturas,
  ]);
  const comUrl = (ambienteId: string): Foto[] =>
    (fotos.get(ambienteId) ?? []).map((f) => ({
      ...f,
      url: urls.get(f.path) ?? null,
    }));
  const entradaPorId = new Map((daEntrada ?? []).map((a) => [a.id, a]));

  return {
    vistoria,
    ambientes: lista.map((a) => {
      const e = a.entrada_ambiente_id
        ? entradaPorId.get(a.entrada_ambiente_id)
        : undefined;
      return {
        ...a,
        fotos: comUrl(a.id),
        entrada: e
          ? {
              titulo: e.titulo,
              resposta: e.resposta,
              descricao: e.descricao,
              fotos: comUrl(e.id),
            }
          : null,
      };
    }),
    loja: loja.data ?? null,
    entrada: entrada.data ?? null,
    chamados: chamados.data ?? [],
    assinaturas: {
      locador: vistoria.assinatura_locador_path
        ? (urls.get(vistoria.assinatura_locador_path) ?? null)
        : null,
      locatario: vistoria.assinatura_locatario_path
        ? (urls.get(vistoria.assinatura_locatario_path) ?? null)
        : null,
    },
  };
}

/** O ambiente equivalente da entrada, com fotos (ambiente novo na saída). */
export async function entradaDoAmbiente(
  ambienteId: string,
): Promise<AmbienteDaEntrada | null> {
  const db = await os();
  const { data: a, error } = await db
    .from("vistoria_ambientes")
    .select("entrada_ambiente_id")
    .eq("id", ambienteId)
    .maybeSingle();
  falhar(error);
  if (!a?.entrada_ambiente_id) return null;
  const { data: e, error: e2 } = await db
    .from("vistoria_ambientes")
    .select("*")
    .eq("id", a.entrada_ambiente_id)
    .maybeSingle();
  falhar(e2);
  if (!e) return null;
  const fotos = (await fotosDosAmbientes(db, [e.id])).get(e.id) ?? [];
  const urls = await urlsAssinadas(fotos.map((f) => f.path));
  return {
    titulo: e.titulo,
    resposta: e.resposta,
    descricao: e.descricao,
    fotos: fotos.map((f) => ({ ...f, url: urls.get(f.path) ?? null })),
  };
}

export type LojaParaVistoria = Pick<
  Loja,
  "id" | "nome" | "luc" | "bloco" | "locatario" | "situacao"
>;

/** Lojas para escolher o contrato (vigentes primeiro). */
export const lojasParaVistoria = cache(
  async (): Promise<LojaParaVistoria[]> => {
    const db = await os();
    // Só o que a escolha do contrato mostra e preenche.
    return emPaginas((de, ate) =>
      db
        .from("lojas")
        .select("id, nome, luc, bloco, locatario, situacao")
        .order("situacao", { ascending: false })
        .order("bloco")
        .order("luc")
        .order("id")
        .range(de, ate),
    );
  },
);

/** Locatário, bloco e unidade que a loja (contrato) preenche. */
export function dadosDaLoja(
  l: Pick<Loja, "locatario" | "nome" | "bloco" | "luc">,
): {
  locatario: string;
  bloco: string;
  unidade: string;
} {
  return {
    locatario: (l.locatario || l.nome).trim(),
    bloco: l.bloco?.trim() ?? "",
    unidade: l.luc.trim(),
  };
}

// ---------------------------------------------------------------------------
// Criação (tela, duplicar e modelo de entrada/saída de cliente)
// ---------------------------------------------------------------------------

export interface NovaVistoria {
  tipo: TipoVistoria;
  data: string;
  vistoriadorId: string | null;
  vistoriadorNome: string;
  loja: Loja | null;
  locatario?: string;
  bloco?: string;
  unidade?: string;
  criadoPor: string | null;
}

/**
 * Grava a vistoria com os ambientes padrão e, na saída, liga a entrada
 * mais recente do mesmo contrato. Serve à sessão e à service role.
 */
export async function inserirVistoria(
  db: Db,
  n: NovaVistoria,
  padroes: PadroesVistoria,
): Promise<string> {
  const daLoja = n.loja ? dadosDaLoja(n.loja) : null;
  // O código vem do banco (os.proximo_codigo_vistoria: maior + 1). Duas
  // vistorias criadas ao mesmo tempo podem pegar o mesmo número; a segunda
  // tenta de novo com o seguinte.
  const gravar = () =>
    db
      .from("vistorias")
      .insert({
        tipo: n.tipo,
        status: "andamento",
        rascunho: true,
        data: n.data,
        vistoriador_id: n.vistoriadorId,
        vistoriador_nome: n.vistoriadorNome,
        locador: padroes.locador,
        loja_id: n.loja?.id ?? null,
        locatario: daLoja?.locatario ?? n.locatario?.trim() ?? "",
        bloco: daLoja?.bloco ?? n.bloco?.trim() ?? "",
        unidade: daLoja?.unidade ?? n.unidade?.trim() ?? "",
        observacao: padroes.textos[n.tipo].observacao,
        termo: padroes.textos[n.tipo].termo,
        local_data: localEData(padroes.local, n.data),
        criado_por: n.criadoPor,
      })
      .select("id")
      .single();
  let { data, error } = await gravar();
  for (let tentativa = 1; error?.code === "23505" && tentativa < 3; tentativa++)
    ({ data, error } = await gravar());
  if (error) throw error;
  if (!data) throw new Error("A vistoria não foi criada.");

  const { error: e2 } = await db.from("vistoria_ambientes").insert(
    padroes.ambientes.map((titulo, ordem) => ({
      vistoria_id: data.id,
      titulo,
      ordem,
    })),
  );
  if (e2) throw e2;
  if (n.tipo === "saida" && n.loja) await ligarEntrada(db, data.id);
  return data.id;
}

/**
 * Saída: acha a vistoria de entrada mais recente da mesma loja e liga cada
 * ambiente ao equivalente da entrada (pelo título), para comparar.
 */
export async function ligarEntrada(db: Db, vistoriaId: string): Promise<void> {
  const { data: v, error } = await db
    .from("vistorias")
    .select("id, tipo, loja_id, entrada_id, data")
    .eq("id", vistoriaId)
    .single();
  if (error) throw error;
  if (v.tipo !== "saida" || !v.loja_id) return;

  let entradaId = v.entrada_id;
  if (!entradaId) {
    const { data: e, error: e1 } = await db
      .from("vistorias")
      .select("id")
      .eq("loja_id", v.loja_id)
      .eq("tipo", "entrada")
      .neq("status", "cancelado")
      .neq("id", v.id)
      .lte("data", v.data)
      .order("data", { ascending: false })
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e1) throw e1;
    if (!e) return;
    entradaId = e.id;
    const { error: e2 } = await db
      .from("vistorias")
      .update({ entrada_id: entradaId })
      .eq("id", v.id);
    if (e2) throw e2;
  }

  const [saida, entrada] = await Promise.all([
    db
      .from("vistoria_ambientes")
      .select("id, titulo, entrada_ambiente_id")
      .eq("vistoria_id", v.id)
      .order("ordem"),
    db
      .from("vistoria_ambientes")
      .select("id, titulo")
      .eq("vistoria_id", entradaId)
      .order("ordem"),
  ]);
  if (saida.error) throw saida.error;
  if (entrada.error) throw entrada.error;
  const usados = new Set(
    (saida.data ?? []).map((a) => a.entrada_ambiente_id).filter(Boolean),
  );
  const pares = casarAmbientes(
    (saida.data ?? []).filter((a) => !a.entrada_ambiente_id),
    (entrada.data ?? []).filter((a) => !usados.has(a.id)),
  );
  await Promise.all(
    [...pares].map(async ([id, entradaAmbienteId]) => {
      const { error: e } = await db
        .from("vistoria_ambientes")
        .update({ entrada_ambiente_id: entradaAmbienteId })
        .eq("id", id);
      if (e) throw e;
    }),
  );
}

/**
 * Cria a vistoria a partir do contrato, pelo sistema (modelo de entrada ou
 * saída de cliente). Quem chama já conferiu o acesso. Com `chamadoId`, o
 * chamado (o Aviso) fica ligado à vistoria e registra na linha do tempo.
 */
export async function criarVistoriaDoContrato(p: {
  lojaId: string;
  tipo: TipoVistoria;
  vistoriadorId?: string | null;
  chamadoId?: string | null;
}): Promise<string> {
  const db = osAdmin();
  const [loja, config, vistoriador] = await Promise.all([
    db.from("lojas").select("*").eq("id", p.lojaId).single(),
    configDoSistema(),
    p.vistoriadorId
      ? createAdminClient()
          .schema("core")
          .from("usuarios")
          .select("nome")
          .eq("id", p.vistoriadorId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (loja.error) throw new Error(`Loja da vistoria: ${loja.error.message}`);
  if (vistoriador.error)
    throw new Error(`Vistoriador: ${vistoriador.error.message}`);

  const id = await inserirVistoria(
    db,
    {
      tipo: p.tipo,
      data: hojeEmBrasilia(new Date()),
      vistoriadorId: vistoriador.data ? (p.vistoriadorId ?? null) : null,
      vistoriadorNome: vistoriador.data?.nome ?? "A definir",
      loja: loja.data,
      criadoPor: null,
    },
    padroesDe(config.p),
  );

  if (p.chamadoId) {
    const { error } = await db
      .from("chamados")
      .update({ vistoria_id: id })
      .eq("id", p.chamadoId);
    if (error) console.error("ligar chamado à vistoria", p.chamadoId, error);
    const { data: v } = await db
      .from("vistorias")
      .select("codigo")
      .eq("id", id)
      .single();
    await registrarComoSistema(p.chamadoId, {
      tipo: "sistema",
      autorNome: "Sistema",
      texto: `${TIPOS_VISTORIA[p.tipo]} ${v?.codigo ?? ""} criada para ${dadosDaLoja(loja.data).locatario}.`,
      dados: { vistoria_id: id, href: rotaVistoria(id) },
    });
  }
  return id;
}

// ---------------------------------------------------------------------------
// Laudo
// ---------------------------------------------------------------------------

export interface AmbienteDoLaudo {
  titulo: string;
  resposta: Ambiente["resposta"];
  descricao: string | null;
  fotos: (Uint8Array | null)[];
  /** Fotos da entrada (saída com comparação). */
  fotosDaEntrada: (Uint8Array | null)[];
}

export interface DadosDoLaudo {
  vistoria: Vistoria;
  ambientes: AmbienteDoLaudo[];
  assinaturas: { locador: Uint8Array | null; locatario: Uint8Array | null };
}

/** Baixa vários arquivos, poucos por vez (não estoura a memória nem a rede). */
async function baixarVarios(
  paths: string[],
  deUmaVez = 6,
): Promise<Map<string, Uint8Array | null>> {
  const saida = new Map<string, Uint8Array | null>();
  const fila = [...new Set(paths)];
  const trabalhar = async () => {
    for (let p = fila.shift(); p !== undefined; p = fila.shift())
      saida.set(p, await baixarArquivo(p));
  };
  await Promise.all(Array.from({ length: deUmaVez }, trabalhar));
  return saida;
}

/**
 * Tudo o que o laudo precisa. As linhas são lidas pela sessão (o RLS
 * confere a permissão), ou pela service role no link do locatário; os
 * arquivos vêm do bucket depois disso.
 */
export async function dadosDoLaudo(
  id: string,
  opcoes: { comparar: boolean },
  /** Service role: só no link do locatário, depois de conferir o token. */
  admin?: Db,
): Promise<DadosDoLaudo | null> {
  const db = admin ?? (await os());
  // A vistoria e os ambientes juntos (os ambientes só dependem do id).
  const [lida, ambientes] = await Promise.all([
    db.from("vistorias").select("*").eq("id", id).maybeSingle(),
    db
      .from("vistoria_ambientes")
      .select("*")
      .eq("vistoria_id", id)
      .order("ordem")
      .order("criado_em"),
  ]);
  falhar(lida.error);
  const vistoria = lida.data;
  if (!vistoria) return null;
  falhar(ambientes.error);
  const lista = ambientes.data ?? [];
  const comparar = opcoes.comparar && vistoria.tipo === "saida";
  const idsEntrada = comparar
    ? lista.map((a) => a.entrada_ambiente_id).filter((x): x is string => !!x)
    : [];
  const fotos = await fotosDosAmbientes(db, [
    ...lista.map((a) => a.id),
    ...idsEntrada,
  ]);
  const arquivos = await baixarVarios([
    ...[...fotos.values()].flat().map((f) => f.path),
    ...[
      vistoria.assinatura_locador_path,
      vistoria.assinatura_locatario_path,
    ].filter((p): p is string => !!p),
  ]);
  const bytes = (ambienteId: string | null) =>
    ambienteId
      ? (fotos.get(ambienteId) ?? []).map((f) => arquivos.get(f.path) ?? null)
      : [];
  return {
    vistoria,
    ambientes: lista.map((a) => ({
      titulo: a.titulo,
      resposta: a.resposta,
      descricao: a.descricao,
      fotos: bytes(a.id),
      fotosDaEntrada: comparar ? bytes(a.entrada_ambiente_id) : [],
    })),
    assinaturas: {
      locador: vistoria.assinatura_locador_path
        ? (arquivos.get(vistoria.assinatura_locador_path) ?? null)
        : null,
      locatario: vistoria.assinatura_locatario_path
        ? (arquivos.get(vistoria.assinatura_locatario_path) ?? null)
        : null,
    },
  };
}

/** Variáveis da mensagem do WhatsApp com o laudo. */
export function variaveisDaMensagem(
  v: Pick<
    Vistoria,
    "tipo" | "codigo" | "locatario" | "bloco" | "unidade" | "data"
  >,
  link: string,
  dias: number,
): Record<string, string | number> {
  return {
    nome: v.locatario.split(/\s+/)[0] ?? "",
    tipo: TIPOS_VISTORIA[v.tipo],
    codigo: v.codigo,
    unidade: localDaUnidade(v.bloco, v.unidade) || "unidade",
    data: formatarData(v.data),
    link,
    dias,
  };
}

// ---------------------------------------------------------------------------
// Link do locatário (sem login)
// ---------------------------------------------------------------------------

/** Token como o novoToken() gera (base64url, 32+ caracteres). */
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{32,64}$/;

/**
 * A vistoria do link, pela service role depois de conferir o token. null:
 * token inexistente ou vistoria cancelada.
 */
export async function vistoriaPeloToken(
  token: string,
): Promise<Vistoria | null> {
  if (!FORMATO_TOKEN.test(token)) return null;
  const { data, error } = await osAdmin()
    .from("vistorias")
    .select("*")
    .eq("assinatura_token", token)
    .maybeSingle();
  falhar(error);
  return data && data.status !== "cancelado" ? data : null;
}

export interface PaginaDaVistoria {
  token: string;
  codigo: string;
  tipo: string;
  data: string;
  unidade: string;
  locador: string;
  locatario: string;
  observacao: string;
  consideracoes: string | null;
  termo: string;
  localData: string;
  ambientes: {
    id: string;
    titulo: string;
    texto: string;
    fotos: { id: string; nome: string; url: string }[];
  }[];
  assinaturaLocador: string | null;
  /** Já assinou (pelo link ou na tela). */
  assinado: {
    nome: string;
    documento: string | null;
    em: string | null;
  } | null;
  /** Por que não dá para assinar agora (null: pode). */
  motivo: string | null;
}

/** O que o locatário vê no link: o laudo inteiro, para conferir e assinar. */
export async function paginaDaVistoria(
  token: string,
): Promise<PaginaDaVistoria | null> {
  const v = await vistoriaPeloToken(token);
  if (!v) return null;
  const db = osAdmin();
  const { data: ambientes, error } = await db
    .from("vistoria_ambientes")
    .select("id, titulo, resposta, descricao")
    .eq("vistoria_id", v.id)
    .order("ordem")
    .order("criado_em");
  falhar(error);
  const lista = ambientes ?? [];
  const fotos = await fotosDosAmbientes(
    db,
    lista.map((a) => a.id),
  );
  const urls = await urlsAssinadas([
    ...[...fotos.values()].flat().map((f) => f.path),
    ...(v.assinatura_locador_path ? [v.assinatura_locador_path] : []),
  ]);
  return {
    token,
    codigo: v.codigo,
    tipo: TIPOS_VISTORIA[v.tipo],
    data: formatarData(v.data),
    unidade: localDaUnidade(v.bloco, v.unidade),
    locador: v.locador,
    locatario: v.locatario,
    observacao: v.observacao,
    consideracoes: v.consideracoes,
    termo: v.termo,
    localData: v.local_data,
    ambientes: lista.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      texto:
        a.resposta === "respondido"
          ? a.descricao?.trim() || "Sem observações."
          : RESPOSTAS_AMBIENTE[a.resposta],
      fotos: (fotos.get(a.id) ?? []).flatMap((f) => {
        const url = urls.get(f.path);
        return url ? [{ id: f.id, nome: f.nome, url }] : [];
      }),
    })),
    assinaturaLocador: v.assinatura_locador_path
      ? (urls.get(v.assinatura_locador_path) ?? null)
      : null,
    assinado: v.assinatura_locatario_path
      ? {
          nome: v.locatario_assinatura_nome ?? v.locatario,
          documento: v.locatario_assinatura_documento,
          em: v.locatario_assinado_em ?? v.assinado_em,
        }
      : null,
    motivo: motivoParaAssinaturaDoLocatario(v),
  };
}
