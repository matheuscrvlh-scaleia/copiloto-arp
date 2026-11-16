import { formatarData } from "@arp/shared/formato";
import type { Planilha } from "@arp/shared/os/contratos/visoes";
import type {
  AmbienteDaEntrada,
  DetalheDaVistoria,
  Foto,
  LojaParaVistoria,
  RespostaVistorias,
  Vistoria as VistoriaNaTela,
} from "@arp/shared/os/contratos/vistorias";
import type { ColunaExportar } from "@arp/shared/os/exportar";
import {
  intervalo,
  paginaDaUrl,
  totalDePaginas,
} from "@arp/shared/os/paginacao";
import { rotaVistoria } from "@arp/shared/os/rotas";
import {
  STATUS_VISTORIA,
  TIPOS_VISTORIA,
  type TipoVistoria,
} from "@arp/shared/os/rotulos";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import {
  AMBIENTES_PADRAO,
  LOCADOR_PADRAO,
  LOCAL_PADRAO,
  localEData,
  TEXTOS_PADRAO,
} from "@arp/shared/os/vistoria";
import {
  casarAmbientes,
  localDaUnidade,
  MENSAGEM_LAUDO_PADRAO,
  ROTULOS_SITUACAO,
  situacaoDaVistoria,
  type TextosDoTipo,
} from "@arp/shared/os/vistoria-regras";
import {
  CARTOES_VISTORIA,
  type CartaoVistoria,
  criterioDoCartaoVistoria,
  lerFiltroVistorias,
  vistoriadorDe,
} from "@arp/shared/os/vistorias-lista";
import { MENSAGENS_PADRAO } from "@arp/shared/os/whatsapp";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import { ErroDePermissao, ErroNaoEncontrado } from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { log } from "@/infra/log";
import { chamado } from "./alvo";
import * as base from "./base.repository";
import {
  baixarArquivo,
  pessoas as pessoasDoModulo,
  registrarComoSistema,
  urlsAssinadas,
} from "./base.service";
import { ACOES_DO_MODELO } from "./modelos.service";
import { gerarLaudo, type LaudoGerado } from "./pdf/laudo";
import { tentar } from "./tentar";
import type { Ambiente, Vistoria } from "./vistorias.repository";
import * as repo from "./vistorias.repository";

// Vistorias de locação (4.10): leitura das telas pela sessão (RLS da
// permissão os.vistorias), criação a partir do contrato (também pelo
// sistema, no modelo de entrada/saída de cliente) e os dados do laudo.

export const SEM_PERMISSAO = "Você não tem permissão para mexer em vistorias.";

/** As telas e as ações das vistorias pedem os.vistorias. */
export function exigirVistorias(ctx: Contexto, mensagem = SEM_PERMISSAO): void {
  if (!pode(ctx, "os.vistorias")) throw new ErroDePermissao(mensagem);
}

type Busca = Record<string, unknown>;

const textos = (busca: Busca) => {
  const r: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(busca))
    if (typeof v === "string") r[k] = v;
    else if (Array.isArray(v))
      r[k] = v.filter((x): x is string => typeof x === "string");
  return r;
};

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

export function padroesDe(p: {
  vistoria_locador: string;
  vistoria_local: string;
  vistoria_ambientes: string[];
  vistoria_textos: unknown;
  mensagens: unknown;
}): PadroesVistoria {
  const lidos = textosLidos.safeParse(p.vistoria_textos);
  const doBanco = lidos.success ? lidos.data : {};
  const porTipo = (t: TipoVistoria): TextosDoTipo => ({
    observacao: doBanco[t]?.observacao?.trim() || TEXTOS_PADRAO[t].observacao,
    termo: doBanco[t]?.termo?.trim() || TEXTOS_PADRAO[t].termo,
  });
  const textos = {
    entrada: porTipo("entrada"),
    saida: porTipo("saida"),
    preventiva: porTipo("preventiva"),
    extraordinaria: porTipo("extraordinaria"),
  } satisfies Record<TipoVistoria, TextosDoTipo>;
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

export async function padroesVistoria(tx: Tx): Promise<PadroesVistoria> {
  return padroesDe(await base.parametros(tx));
}

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

/** GET /os/vistorias: cartões, filtros e uma página da lista. */
export function lerVistorias(
  ctx: Contexto,
  busca: Busca,
): Promise<RespostaVistorias> {
  exigirVistorias(ctx, "Você não tem acesso às vistorias.");
  const sp = textos(busca);
  const f = lerFiltroVistorias(sp);
  const pedida = paginaDaUrl(sp.pagina);
  const hoje = hojeEmBrasilia(new Date());
  const c = f.cartao ? criterioDoCartaoVistoria(f.cartao, hoje) : null;
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const total = await repo.contarVistorias(tx, f, c);
    // Página além da última: a tela vai para a última (como antes).
    const pagina = Math.min(pedida, totalDePaginas(total));
    const { de, ate } = intervalo(pagina);
    const lista = await repo.vistoriasDoFiltro(tx, f, c, {
      limite: ate - de + 1,
      pular: de,
    });
    const ordens = await repo.ordensDasVistorias(
      tx,
      lista.map((v) => v.id),
    );
    const chaves = Object.keys(CARTOES_VISTORIA) as CartaoVistoria[];
    const contagem = {
      andamento: 0,
      assinatura: 0,
      concluidas: 0,
      com_os: 0,
    } satisfies Record<CartaoVistoria, number>;
    for (const k of chaves)
      contagem[k] = await repo.contarVistorias(
        tx,
        null,
        criterioDoCartaoVistoria(k, hoje),
      );
    const colunas = await repo.colunasDosFiltros(tx);
    const vistoriadores = new Map<string, string>();
    for (const v of colunas)
      vistoriadores.set(vistoriadorDe(v), v.vistoriador_nome);
    const blocos = [
      ...new Set(colunas.map((v) => v.bloco.trim() || "sem")),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      vistorias: lista.map((v) => ({ ...v, ordens: ordens.get(v.id) ?? 0 })),
      total,
      pagina,
      contagem,
      vistoriadores: [...vistoriadores],
      blocos,
    };
  });
}

const COLUNAS_EXPORTAR: ColunaExportar[] = [
  { titulo: "Código" },
  { titulo: "Tipo" },
  { titulo: "Locatário(a)" },
  { titulo: "Bloco / Área" },
  { titulo: "Locação / Unidade" },
  { titulo: "Data" },
  { titulo: "Vistoriador" },
  { titulo: "Status" },
  { titulo: "Situação" },
  { titulo: "OS geradas", numero: true },
];

/** "Entrada", "Saída"… (sem o "Vistoria de"). */
export const tipoCurto = (tipo: TipoVistoria): string =>
  TIPOS_VISTORIA[tipo].replace(/^Vistoria (de )?/, "");

/** Exportar: o filtro inteiro, lido só no clique (não só a página). */
export function exportarVistorias(
  ctx: Contexto,
  busca: Busca,
): Promise<Planilha> {
  if (!pode(ctx, "os.vistorias") || !pode(ctx, "os.exportar"))
    throw new ErroDePermissao("Sem permissão para exportar.");
  const f = lerFiltroVistorias(textos(busca));
  const hoje = hojeEmBrasilia(new Date());
  const c = f.cartao ? criterioDoCartaoVistoria(f.cartao, hoje) : null;
  return banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const lista = await repo.vistoriasDoFiltro(tx, f, c);
    const ordens = await repo.ordensDasVistorias(
      tx,
      lista.map((v) => v.id),
    );
    return {
      colunas: COLUNAS_EXPORTAR,
      linhas: lista.map((v) => [
        v.codigo,
        tipoCurto(v.tipo),
        v.locatario,
        v.bloco,
        v.unidade,
        formatarData(v.data),
        v.vistoriador_nome,
        STATUS_VISTORIA[v.status],
        ROTULOS_SITUACAO[situacaoDaVistoria(v)],
        ordens.get(v.id) ?? 0,
      ]),
    };
  });
}

/** GET /os/vistorias/nova: as lojas para escolher o contrato. */
export function lerNovaVistoria(
  ctx: Contexto,
): Promise<{ lojas: LojaParaVistoria[] }> {
  exigirVistorias(ctx, "Você não tem acesso às vistorias.");
  return banco.comoUsuario(ctx.usuario.id, async (tx) => ({
    lojas: await repo.lojasParaVistoria(tx),
  }));
}

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

type FotoSemUrl = Omit<Foto, "url">;

const ehImagem = (a: { mime: string | null; nome: string }) =>
  a.mime?.startsWith("image/") ?? /\.(jpe?g|png|webp|heic)$/i.test(a.nome);

/** Fotos dos ambientes, por ambiente, na ordem em que foram tiradas. */
export async function fotosPorAmbiente(
  tx: Tx,
  ambientes: string[],
): Promise<Map<string, FotoSemUrl[]>> {
  const mapa = new Map<string, FotoSemUrl[]>();
  for (const a of await repo.fotosDosAmbientes(tx, ambientes)) {
    if (!a.ambiente_id || !ehImagem(a)) continue;
    mapa.set(a.ambiente_id, [
      ...(mapa.get(a.ambiente_id) ?? []),
      { id: a.id, nome: a.nome, path: a.path },
    ]);
  }
  return mapa;
}

/** A vistoria sem o token do link (que não vai para a tela). */
function paraTela(v: Vistoria): VistoriaNaTela {
  const { assinatura_token: _t, criado_por: _c, ...resto } = v;
  return resto;
}

/** Vistoria com ambientes, fotos (URLs de 1 h), entrada e chamados. */
export async function lerVistoria(
  ctx: Contexto,
  id: string,
): Promise<DetalheDaVistoria> {
  exigirVistorias(ctx, "Você não tem acesso às vistorias.");
  const lido = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const vistoria = await repo.vistoria(tx, id);
    if (!vistoria) return null;
    const ambientes = await repo.ambientesDaVistoria(tx, id);
    const chamados = await repo.ligadosAVistoria(tx, id);
    const idsEntrada = ambientes
      .map((a) => a.entrada_ambiente_id)
      .filter((x): x is string => !!x);
    const entrada = vistoria.entrada_id
      ? ((await repo.resumoDaVistoria(tx, vistoria.entrada_id)) ?? null)
      : null;
    const daEntrada = await repo.ambientesPorId(tx, idsEntrada);
    const fotos = await fotosPorAmbiente(tx, [
      ...ambientes.map((a) => a.id),
      ...idsEntrada,
    ]);
    const lojas = await repo.lojasParaVistoria(tx);
    const pessoas = await pessoasDoModulo(tx);
    const padroes = await padroesVistoria(tx);
    return {
      vistoria,
      ambientes,
      chamados,
      entrada,
      daEntrada,
      fotos,
      lojas,
      pessoas,
      padroes,
    };
  });
  if (!lido) throw new ErroNaoEncontrado("Vistoria não encontrada.");
  const { vistoria: v, fotos } = lido;
  const assinaturas = [
    v.assinatura_locador_path,
    v.assinatura_locatario_path,
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
  const entradaPorId = new Map(lido.daEntrada.map((a) => [a.id, a]));

  return {
    vistoria: paraTela(v),
    ambientes: lido.ambientes.map((a) => {
      const e = a.entrada_ambiente_id
        ? entradaPorId.get(a.entrada_ambiente_id)
        : undefined;
      return {
        id: a.id,
        titulo: a.titulo,
        resposta: a.resposta,
        descricao: a.descricao,
        problema: a.problema,
        ordem: a.ordem,
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
    entrada: lido.entrada,
    chamados: lido.chamados,
    assinaturas: {
      locador: v.assinatura_locador_path
        ? (urls.get(v.assinatura_locador_path) ?? null)
        : null,
      locatario: v.assinatura_locatario_path
        ? (urls.get(v.assinatura_locatario_path) ?? null)
        : null,
    },
    lojas: lido.lojas,
    pessoas: lido.pessoas.map((p) => ({ id: p.id, nome: p.nome })),
    padroes: { local: lido.padroes.local, textos: lido.padroes.textos },
  };
}

/** O ambiente equivalente da entrada, com fotos (ambiente novo na saída). */
export async function entradaDoAmbiente(
  tx: Tx,
  ambienteId: string,
): Promise<AmbienteDaEntrada | null> {
  const a = await repo.ambiente(tx, ambienteId);
  if (!a?.entrada_ambiente_id) return null;
  const e = await repo.ambiente(tx, a.entrada_ambiente_id);
  if (!e) return null;
  const fotos = (await fotosPorAmbiente(tx, [e.id])).get(e.id) ?? [];
  const urls = await urlsAssinadas(fotos.map((f) => f.path));
  return {
    titulo: e.titulo,
    resposta: e.resposta,
    descricao: e.descricao,
    fotos: fotos.map((f) => ({ ...f, url: urls.get(f.path) ?? null })),
  };
}

/** Locatário, bloco e unidade que a loja (contrato) preenche. */
export function dadosDaLoja(l: {
  locatario: string | null;
  nome: string;
  bloco: string | null;
  luc: string;
}): { locatario: string; bloco: string; unidade: string } {
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
  loja: {
    id: string;
    locatario: string | null;
    nome: string;
    bloco: string | null;
    luc: string;
  } | null;
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
  tx: Tx,
  n: NovaVistoria,
  padroes: PadroesVistoria,
): Promise<string> {
  const daLoja = n.loja ? dadosDaLoja(n.loja) : null;
  // O código vem do banco (maior + 1). Duas vistorias criadas ao mesmo
  // tempo podem pegar o mesmo número; a segunda tenta de novo (até 3 vezes),
  // num savepoint para não derrubar a transação.
  const valores = {
    tipo: n.tipo,
    status: "andamento" as const,
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
  };
  let r = await tentar(tx, () => repo.inserirVistoria(tx, valores));
  for (let t = 1; !r.ok && r.codigo === "23505" && t < 3; t++)
    r = await tentar(tx, () => repo.inserirVistoria(tx, valores));
  if (!r.ok) throw r.erro;
  const id = r.valor;
  await repo.inserirAmbientes(
    tx,
    padroes.ambientes.map((titulo, ordem) => ({
      vistoria_id: id,
      titulo,
      ordem,
    })),
  );
  if (n.tipo === "saida" && n.loja) await ligarEntrada(tx, id);
  return id;
}

/**
 * Saída: acha a vistoria de entrada mais recente da mesma loja e liga cada
 * ambiente ao equivalente da entrada (pelo título), para comparar.
 */
export async function ligarEntrada(tx: Tx, vistoriaId: string): Promise<void> {
  const v = await repo.vistoria(tx, vistoriaId);
  if (!v || v.tipo !== "saida" || !v.loja_id) return;

  let entradaId = v.entrada_id;
  if (!entradaId) {
    const e = await repo.entradaMaisRecente(tx, {
      id: v.id,
      loja_id: v.loja_id,
      data: v.data,
    });
    if (!e) return;
    entradaId = e;
    await repo.atualizarVistoria(tx, v.id, { entrada_id: entradaId });
  }

  const saida = await repo.ambientesDaVistoria(tx, v.id);
  const entrada = await repo.ambientesDaVistoria(tx, entradaId);
  const usados = new Set(
    saida.map((a) => a.entrada_ambiente_id).filter(Boolean),
  );
  const pares = casarAmbientes(
    saida.filter((a) => !a.entrada_ambiente_id),
    entrada.filter((a) => !usados.has(a.id)),
  );
  for (const [id, entradaAmbienteId] of pares)
    await repo.ligarAmbienteAEntrada(tx, id, entradaAmbienteId);
}

/** Liga a entrada sem derrubar quem chamou (como antes: só registra). */
export async function ligarEntradaSemFalhar(
  tx: Tx,
  vistoriaId: string,
): Promise<void> {
  const r = await tentar(tx, () => ligarEntrada(tx, vistoriaId));
  if (!r.ok) log.error({ err: r.erro, vistoriaId }, "ligar entrada");
}

/**
 * Cria a vistoria a partir do contrato, pelo sistema (modelo de entrada ou
 * saída de cliente). `tx` do escopo `comoServico`; quem chama já conferiu o
 * acesso. Com `chamadoId`, o chamado (o Aviso) fica ligado à vistoria e
 * registra na linha do tempo.
 */
export async function criarVistoriaDoContrato(
  tx: Tx,
  p: {
    lojaId: string;
    tipo: TipoVistoria;
    vistoriadorId?: string | null;
    chamadoId?: string | null;
  },
): Promise<string> {
  const loja = await repo.loja(tx, p.lojaId);
  if (!loja) throw new Error(`Loja da vistoria não encontrada: ${p.lojaId}`);
  const nomeDoVistoriador = p.vistoriadorId
    ? await repo.nomeDoUsuario(tx, p.vistoriadorId)
    : undefined;
  const id = await inserirVistoria(
    tx,
    {
      tipo: p.tipo,
      data: hojeEmBrasilia(new Date()),
      vistoriadorId: nomeDoVistoriador ? (p.vistoriadorId ?? null) : null,
      vistoriadorNome: nomeDoVistoriador ?? "A definir",
      loja,
      criadoPor: null,
    },
    await padroesVistoria(tx),
  );

  if (p.chamadoId) {
    const chamadoId = p.chamadoId;
    const ligou = await tentar(tx, () =>
      repo.ligarChamadoAVistoria(tx, chamadoId, id),
    );
    if (!ligou.ok)
      log.error({ err: ligou.erro, chamadoId }, "ligar chamado à vistoria");
    const v = await repo.resumoDaVistoria(tx, id);
    await registrarComoSistema(tx, chamado(chamadoId), {
      tipo: "sistema",
      autorNome: "Sistema",
      texto: `${TIPOS_VISTORIA[p.tipo]} ${v?.codigo ?? ""} criada para ${dadosDaLoja(loja).locatario}.`,
      dados: { vistoria_id: id, href: rotaVistoria(id) },
    });
  }
  return id;
}

// Modelos de entrada e saída de cliente (4.12): o disparo cria a vistoria
// do contrato, e ela registra a criação na linha do tempo do Aviso.
ACOES_DO_MODELO.vistoria_entrada = async (tx, p, chamadoId) => {
  await criarVistoriaDoContrato(tx, {
    lojaId: p.loja.id,
    tipo: "entrada",
    chamadoId,
  });
};
ACOES_DO_MODELO.vistoria_saida = async (tx, p, chamadoId) => {
  await criarVistoriaDoContrato(tx, {
    lojaId: p.loja.id,
    tipo: "saida",
    chamadoId,
  });
};

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

interface LinhasDoLaudo {
  vistoria: Vistoria;
  ambientes: Ambiente[];
  comparar: boolean;
  fotos: Map<string, FotoSemUrl[]>;
}

/** As linhas do laudo (no escopo de quem chama: sessão ou link conferido). */
export async function linhasDoLaudo(
  tx: Tx,
  id: string,
  opcoes: { comparar: boolean },
): Promise<LinhasDoLaudo | null> {
  const vistoria = await repo.vistoria(tx, id);
  if (!vistoria) return null;
  const ambientes = await repo.ambientesDaVistoria(tx, id);
  const comparar = opcoes.comparar && vistoria.tipo === "saida";
  const idsEntrada = comparar
    ? ambientes
        .map((a) => a.entrada_ambiente_id)
        .filter((x): x is string => !!x)
    : [];
  const fotos = await fotosPorAmbiente(tx, [
    ...ambientes.map((a) => a.id),
    ...idsEntrada,
  ]);
  return { vistoria, ambientes, comparar, fotos };
}

/** Baixa vários arquivos, poucos por vez (não estoura a memória nem o disco). */
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

/** Os arquivos do laudo, lidos depois das linhas (fora da transação). */
export async function dadosDoLaudo(l: LinhasDoLaudo): Promise<DadosDoLaudo> {
  const { vistoria, fotos } = l;
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
    ambientes: l.ambientes.map((a) => ({
      titulo: a.titulo,
      resposta: a.resposta,
      descricao: a.descricao,
      fotos: bytes(a.id),
      fotosDaEntrada: l.comparar ? bytes(a.entrada_ambiente_id) : [],
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

/** GET /os/vistorias/:id/laudo: o PDF, lido pelo RLS da sessão. */
export async function laudoDaVistoria(
  ctx: Contexto,
  id: string,
  comparar: boolean,
): Promise<LaudoGerado> {
  exigirVistorias(ctx, "Você não tem acesso às vistorias.");
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    linhasDoLaudo(tx, id, { comparar }),
  );
  if (!linhas) throw new ErroNaoEncontrado("Vistoria não encontrada.");
  return gerarLaudo(await dadosDoLaudo(linhas));
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
