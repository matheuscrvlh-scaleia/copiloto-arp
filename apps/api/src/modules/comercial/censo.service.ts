import {
  convitesDosLocatarios,
  filtrarRespostas,
  indicadoresCenso,
  type OpcoesQuestionario,
  periodoDosContatos,
  porGrupo,
  ROTULO_ESTIMADO,
  situacaoDoLink,
  VAZIO,
  validarQuestionario,
} from "@arp/shared/comercial/censo";
import {
  type LinhaCenso,
  lerPlanilhaCenso,
  nomeDaRodada,
  paraResultadoLeitura,
} from "@arp/shared/comercial/censo-importacao";
import type {
  ConviteCenso,
  RespostaCenso,
  RespostaCensoLida,
  RespostaCensoPublico,
  RespostaFeedbacksCenso,
  RespostaIndicadoresCenso,
  RespostaRodadaCenso,
  ValoresQuestionario,
} from "@arp/shared/comercial/contratos/censo";
import type { Formulario } from "@arp/shared/comercial/contratos/configuracoes";
import type { Aba, LinhaLida } from "@arp/shared/comercial/importacao";
import { hojeEmBrasilia } from "@arp/shared/os/tempo";
import { sql } from "kysely";
import { z } from "zod";
import { type Contexto, pode } from "@/contexto";
import {
  ErroDaApi,
  ErroDeNegocio,
  ErroDePermissao,
  ErroDeValidacao,
  ErroNaoEncontrado,
} from "@/erros";
import { banco, type Tx } from "@/infra/banco";
import { codigoDoBanco } from "@/infra/banco/erros";
import { log } from "@/infra/log";
import {
  contextoCom,
  listas,
  nomesDeUsuarios,
  parametros,
  podeAgora,
  tiposLuc,
  valoresDaLista,
} from "./base";
import * as repo from "./censo.repository";
import { gerarPanoramaCenso } from "./censo-pdf";
import { comoServicoNaTransacao } from "./fichas.service";
import { dadosEnet } from "./fontes";
import {
  type ContextoGravacao,
  ErroImportacao,
  importador,
} from "./importacoes.service";

// Censo (spec 4.8, 4.9 e 4.13). As telas internas leem e gravam com a
// sessão (o RLS confere comercial.censo.ver e .aplicar). O questionário pelo
// link não tem sessão: o servidor confere o token e grava pela service role
// só a resposta daquele convite. A importação grava pela service role depois
// de comercial.censo.importar (rodada fechada e respostas com importacao_id).

const SEM_PERMISSAO = "Você não tem permissão para aplicar o Censo.";
const LINK_INATIVO =
  "Este link não está mais ativo. Fale com a administração do Espaço ARP.";
const CONFIRA = "Confira as respostas marcadas antes de enviar.";
const uuid = z.uuid();
const FORMATO_TOKEN = /^[A-Za-z0-9]{32,64}$/;

/** Erros das gravações com a sessão, como a tela de antes mostrava. */
function falhou(e: unknown, oQue: string): never {
  if (e instanceof ErroDePermissao) throw new ErroDePermissao(SEM_PERMISSAO);
  if (e instanceof ErroDaApi) throw e;
  log.error({ err: e }, oQue);
  throw new ErroDeNegocio(`Não foi possível ${oQue}. Tente de novo.`);
}

function exigirVer(ctx: Contexto) {
  if (!pode(ctx, "comercial.censo.ver"))
    throw new ErroDePermissao("Você não tem acesso ao Censo.");
}

function exigirAplicar(ctx: Contexto) {
  if (!pode(ctx, "comercial.censo.aplicar"))
    throw new ErroDePermissao(SEM_PERMISSAO);
}

const comoUsuario = <T>(ctx: Contexto, fn: (tx: Tx) => Promise<T>) =>
  banco.comoUsuario(ctx.usuario.id, fn);

const numeroOuNulo = (v: number | string | null) =>
  v === null ? null : Number(v);

function respostaLida(
  r: Awaited<ReturnType<typeof repo.respostasDaRodada>>[number],
): RespostaCensoLida {
  return {
    ...r,
    ticket: numeroOuNulo(r.ticket),
    ticket_ajustado: numeroOuNulo(r.ticket_ajustado),
  };
}

// ---------------------------------------------------------------------------
// Leituras
// ---------------------------------------------------------------------------

/** Rodadas e as listas da tela (os filtros de bloco, segmento e expectativas). */
export async function tela(ctx: Contexto): Promise<RespostaCenso> {
  exigirVer(ctx);
  const c = contextoCom(ctx);
  const [rodadas, todas, params] = await Promise.all([
    comoUsuario(ctx, repo.rodadas),
    listas(ctx),
    parametros(ctx),
  ]);
  return {
    hoje: c.hoje,
    dadosDe: c.dadosDe,
    rodadas,
    textoConvite: params.formulario_texto_convite,
    blocos: valoresDaLista(todas, "censo_bloco"),
    segmentos: valoresDaLista(todas, "censo_segmento"),
    expectativas: valoresDaLista(todas, "censo_expectativa"),
  };
}

/** Quantos convites (só quem aplica) e respostas cada rodada tem. */
async function contagem(tx: Tx, rodadas: string[], comConvites: boolean) {
  const [convites, respostas] = await Promise.all([
    comConvites ? repo.contarConvites(tx) : [],
    repo.contarRespostas(tx),
  ]);
  const c = new Map(convites.map((x) => [x.rodada_id, x.n]));
  const r = new Map(respostas.map((x) => [x.rodada_id, x.n]));
  return rodadas.map((id) => ({
    rodada: id,
    convites: c.get(id) ?? 0,
    respostas: r.get(id) ?? 0,
  }));
}

export async function indicadores(
  ctx: Contexto,
): Promise<RespostaIndicadoresCenso> {
  exigirVer(ctx);
  const aplicar = pode(ctx, "comercial.censo.aplicar");
  return comoUsuario(ctx, async (tx) => {
    const ids = (await repo.rodadas(tx)).map((r) => r.id);
    if (!ids.length) return { respostas: [], contagem: [] };
    const [respostas, n] = await Promise.all([
      repo.respostasDosIndicadores(tx, ids),
      contagem(tx, ids, aplicar),
    ]);
    return {
      respostas: respostas.map((r) => ({
        ...r,
        ticket_ajustado: numeroOuNulo(r.ticket_ajustado),
      })),
      contagem: n,
    };
  });
}

/** "Panorama do Censo em PDF de uma página", com os filtros da tela. */
export async function panorama(
  ctx: Contexto,
  q: { rodada?: string; bloco?: string; segmento?: string },
): Promise<{ bytes: Uint8Array; nome: string }> {
  if (!pode(ctx, "comercial.censo.ver") || !pode(ctx, "comercial.exportar"))
    throw new ErroDePermissao("Você não tem permissão para exportar o Censo.");
  const c = contextoCom(ctx);
  const [rodadas, todas] = await Promise.all([
    comoUsuario(ctx, repo.rodadas),
    listas(ctx),
  ]);
  const blocos = valoresDaLista(todas, "censo_bloco");
  const segmentos = valoresDaLista(todas, "censo_segmento");
  const expectativas = valoresDaLista(todas, "censo_expectativa");
  const rodada = rodadas.find((r) => r.id === q.rodada) ?? rodadas[0];
  if (!rodada) throw new ErroNaoEncontrado("Nenhuma rodada do Censo.");
  const bloco = [...blocos, VAZIO].includes(q.bloco ?? "")
    ? (q.bloco ?? "")
    : "";
  const segmento = [...segmentos, VAZIO].includes(q.segmento ?? "")
    ? (q.segmento ?? "")
    : "";
  const lidas = await comoUsuario(ctx, (tx) =>
    repo.respostasDosIndicadores(tx, [rodada.id]),
  );
  const respostas = filtrarRespostas(
    lidas.map((r) => ({
      ...r,
      ticket_ajustado: numeroOuNulo(r.ticket_ajustado),
    })),
    { bloco, segmento },
  );
  const filtros = [
    `Bloco: ${bloco ? (bloco === VAZIO ? VAZIO : `Bloco ${bloco}`) : "Todos"}`,
    `Segmento: ${segmento || "Todos"}`,
  ].join(" · ");
  const bytes = await gerarPanoramaCenso({
    rodada: rodada.nome,
    filtros,
    geradoEm: c.dadosDe,
    rotulo: rodada.exemplo
      ? `${ROTULO_ESTIMADO} Rodada de exemplo (fictícia).`
      : ROTULO_ESTIMADO,
    indicadores: indicadoresCenso(respostas, expectativas),
    segmentos: porGrupo(respostas, "segmento"),
    blocos: porGrupo(respostas, "bloco"),
  });
  const nome = rodada.nome
    .normalize("NFD")
    .replace(/[^\w]+/g, "-")
    .toLowerCase();
  return { bytes, nome: `panorama-${nome}.pdf` };
}

const pedacos = <T>(ids: T[]) =>
  Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) =>
    ids.slice(i * 200, i * 200 + 200),
  );

/** Aba Feedbacks: sugestões do Censo e registros de contato, com os temas. */
export async function feedbacks(
  ctx: Contexto,
  q: { rodada: string; origem?: string },
): Promise<RespostaFeedbacksCenso> {
  exigirVer(ctx);
  const c = contextoCom(ctx);
  const origem = q.origem === "censo" || q.origem === "contato" ? q.origem : "";
  const todas = await listas(ctx);
  const tiposFeedback = todas
    .filter(
      (l) =>
        l.lista === "tipo_contato" &&
        l.ativo &&
        z.object({ feedback: z.literal(true) }).safeParse(l.extra).success,
    )
    .map((l) => l.valor);
  const lido = await comoUsuario(ctx, async (tx) => {
    const rodadas = await repo.rodadas(tx);
    const periodo = periodoDosContatos(rodadas, q.rodada, c.hoje);
    const [temas, respostas, contatos] = await Promise.all([
      repo.temas(tx),
      origem === "contato" ? [] : repo.respostasDaRodada(tx, q.rodada),
      origem === "censo" || !periodo || !tiposFeedback.length
        ? []
        : repo.contatosDeFeedback(tx, tiposFeedback, periodo.de, periodo.ate),
    ]);
    const comSugestao = respostas
      .filter((r) => r.considerada && r.sugestao?.trim())
      .map((r) => r.id);
    const vinculos = (
      await Promise.all([
        ...pedacos(comSugestao).map((ids) =>
          repo.vinculosDasRespostas(tx, ids),
        ),
        ...pedacos(contatos.map((x) => x.id)).map((ids) =>
          repo.vinculosDosContatos(tx, ids),
        ),
      ])
    ).flat();
    return { temas, respostas, contatos, vinculos };
  });
  const nomes = await nomesDeUsuarios(
    ctx,
    lido.vinculos.map((v) => v.movido_por),
    ["comercial.censo.ver"],
  );
  return {
    temas: lido.temas,
    respostas: lido.respostas.map(respostaLida),
    contatos: lido.contatos,
    vinculos: lido.vinculos,
    nomes: [...nomes].map(([id, nome]) => ({ id, nome })),
    clientes:
      origem === "censo"
        ? []
        : dadosEnet(c.hoje).clientes.map((x) => ({
            codigo: x.codigo,
            nome: x.nome,
            atividade: x.atividade,
          })),
  };
}

/** Aba Rodadas: convites e respostas de cada rodada (quem aplica). */
export async function contagemDasRodadas(ctx: Contexto) {
  exigirAplicar(ctx);
  return comoUsuario(ctx, async (tx) => {
    const ids = (await repo.rodadas(tx)).map((r) => r.id);
    return { contagem: await contagem(tx, ids, true) };
  });
}

export async function rodada(
  ctx: Contexto,
  id: string,
): Promise<RespostaRodadaCenso> {
  exigirAplicar(ctx);
  const [convites, respostas] = await comoUsuario(ctx, (tx) =>
    Promise.all([
      repo.convitesDaRodada(tx, id),
      repo.respostasDaRodada(tx, id),
    ]),
  );
  const nomes = await nomesDeUsuarios(
    ctx,
    respostas.map((r) => r.lancada_por),
    ["comercial.censo.ver"],
  );
  return {
    convites,
    respostas: respostas.map(respostaLida),
    nomes: [...nomes].map(([i, nome]) => ({ id: i, nome })),
  };
}

// ---------------------------------------------------------------------------
// Questionário (link sem login, presencial ou demonstração)
// ---------------------------------------------------------------------------

/**
 * Opções das listas do Censo e o dia padrão de mensalidade (service role:
 * quem chama já conferiu o token ou a permissão).
 */
async function opcoesDoQuestionario(): Promise<{
  opcoes: OpcoesQuestionario;
  diasPadrao: number;
}> {
  const [l, p] = await banco.comoServico((tx) =>
    Promise.all([repo.listasDoQuestionario(tx), repo.diasDaMensalidade(tx)]),
  );
  const de = (lista: string) =>
    l.filter((x) => x.lista === lista).map((x) => x.valor);
  return {
    opcoes: {
      blocos: de("censo_bloco"),
      segmentos: de("censo_segmento"),
      expectativas: de("censo_expectativa"),
    },
    diasPadrao: p.censo_dias_mensalidade,
  };
}

export async function demonstracao(ctx: Contexto) {
  exigirVer(ctx);
  return opcoesDoQuestionario();
}

type Lido = NonNullable<Awaited<ReturnType<typeof repo.convite>>>;
type Resposta = Awaited<ReturnType<typeof repo.respostaDoConvite>>;

interface ConviteDoLink {
  convite: Lido;
  resposta: Resposta;
  opcoes: OpcoesQuestionario;
  diasPadrao: number;
  hoje: string;
}

async function montarConvite(
  filtro: { token: string } | { id: string },
): Promise<ConviteDoLink | null> {
  const lido = await banco.comoServico(async (tx) => {
    const convite = await repo.convite(tx, filtro);
    if (!convite) return null;
    return { convite, resposta: await repo.respostaDoConvite(tx, convite.id) };
  });
  if (!lido) return null;
  return {
    ...lido,
    ...(await opcoesDoQuestionario()),
    hoje: hojeEmBrasilia(new Date()),
  };
}

/** O convite do link, pela service role depois de conferir o formato do token. */
async function conviteDoLink(token: string) {
  if (!FORMATO_TOKEN.test(token)) return null;
  return montarConvite({ token });
}

/**
 * Convite para lançar em nome da empresa (presencial). A leitura pela
 * sessão confirma pelo RLS antes de usar a service role.
 */
async function conviteParaLancar(ctx: Contexto, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const visivel = await comoUsuario(ctx, (tx) => repo.conviteVisivel(tx, id));
  if (!visivel) return null;
  return montarConvite({ id });
}

const rodadaDe = (c: Lido) => ({
  id: c.rodada_id,
  nome: c.rodada_nome,
  inicio: c.rodada_inicio,
  fim: c.rodada_fim,
  situacao: c.rodada_situacao,
});

/** Valores do formulário: a resposta já dada ou o que vem do convite (ENET). */
function valoresIniciais(c: ConviteDoLink): ValoresQuestionario {
  const r = c.resposta;
  const texto = (v: number | null | undefined) =>
    v === null || v === undefined ? "" : String(v);
  const ticket = r ? numeroOuNulo(r.ticket) : null;
  return {
    email: r?.email ?? "",
    bloco: r?.bloco ?? c.convite.bloco ?? "",
    segmento: r?.segmento ?? "",
    empresa_nome: r?.empresa_nome ?? c.convite.empresa_nome,
    colaboradores: texto(r?.colaboradores),
    visitantes_dia: texto(r?.visitantes_dia),
    ticket: ticket === null ? "" : String(ticket).replace(".", ","),
    mensalidade: r?.mensalidade === true,
    dias_uso: texto(r?.dias_uso),
    conversoes_dia: texto(r?.conversoes_dia),
    expectativas: r?.expectativas ?? [],
    sugestao: r?.sugestao ?? "",
  };
}

function paraTela(c: ConviteDoLink): ConviteCenso {
  return {
    hoje: c.hoje,
    convite: {
      id: c.convite.id,
      token: c.convite.token,
      empresa_nome: c.convite.empresa_nome,
      luc: c.convite.luc,
      bloco: c.convite.bloco,
    },
    rodada: rodadaDe(c.convite),
    respondidaEm: c.resposta?.respondida_em ?? null,
    opcoes: c.opcoes,
    diasPadrao: c.diasPadrao,
    inicial: valoresIniciais(c),
  };
}

export async function presencial(
  ctx: Contexto,
  convite: string,
): Promise<ConviteCenso> {
  exigirAplicar(ctx);
  const c = await conviteParaLancar(ctx, convite);
  if (!c) throw new ErroNaoEncontrado("Convite não encontrado.");
  return paraTela(c);
}

/** A página do link (sem login). */
export async function publico(token: string): Promise<RespostaCensoPublico> {
  const c = await conviteDoLink(token);
  return c ? paraTela(c) : { motivo: "inexistente" };
}

const QUESTOES = [
  "email",
  "bloco",
  "segmento",
  "empresa_nome",
  "colaboradores",
  "visitantes_dia",
  "ticket",
  "mensalidade",
  "dias_uso",
  "conversoes_dia",
  "sugestao",
] as const;

function camposDoForm(form: Formulario): Record<string, string | string[]> {
  const campos: Record<string, string | string[]> = {};
  for (const chave of QUESTOES) {
    const v = form[chave];
    const um = Array.isArray(v) ? v[0] : v;
    if (typeof um === "string") campos[chave] = um;
  }
  const e = form.expectativas;
  campos.expectativas = e === undefined ? [] : [e].flat();
  return campos;
}

/**
 * Grava (ou corrige) a resposta da empresa na rodada. Uma resposta por
 * convite: enviar de novo corrige a mesma, até a rodada fechar.
 */
async function gravarResposta(
  c: ConviteDoLink,
  form: Formulario,
  lancadaPor: string | null,
): Promise<string> {
  const rodada = rodadaDe(c.convite);
  const fechada = `A rodada ${rodada.nome} não está aberta para respostas.`;
  if (situacaoDoLink(rodada, hojeEmBrasilia(new Date())) !== "aberta")
    throw new ErroDeNegocio(fechada);
  const v = validarQuestionario(camposDoForm(form), c.opcoes);
  if (!v.ok) throw new ErroDeValidacao(CONFIRA, v.erros);
  const linha = {
    ...v.dados,
    rodada_id: rodada.id,
    convite_id: c.convite.id,
    locatario_enet_id: c.convite.locatario_enet_id,
    luc: c.convite.luc,
  };
  const atual = c.resposta;
  try {
    await banco.comoServico(async (tx) => {
      if (atual) await repo.corrigirResposta(tx, atual.id, linha);
      else
        await repo.incluirResposta(tx, {
          ...linha,
          origem: lancadaPor ? "presencial" : "link",
          exemplo: c.convite.exemplo,
          lancada_por: lancadaPor,
        });
    });
  } catch (e) {
    // Dois envios ao mesmo tempo: o segundo vira correção do primeiro.
    if (codigoDoBanco(e) === "23505" || e instanceof ErroDaApi) {
      if (e instanceof ErroDaApi && e.codigo === "conflito")
        throw new ErroDeNegocio(
          "Esta empresa já respondeu nesta rodada. Recarregue para corrigir a resposta.",
        );
      if (e instanceof ErroDeNegocio) throw new ErroDeNegocio(fechada);
    }
    log.error({ err: e, convite: c.convite.id }, "resposta do Censo");
    throw new ErroDeNegocio("Não foi possível enviar. Tente de novo.");
  }
  return atual
    ? "Resposta corrigida. Obrigado!"
    : lancadaPor
      ? "Resposta lançada em nome da empresa."
      : "Respostas enviadas. Obrigado por participar do Censo!";
}

/** Pelo link: confere o token a cada envio. */
export async function responderPeloLink(
  token: string,
  form: Formulario,
): Promise<string> {
  const c = await conviteDoLink(token);
  if (!c) throw new ErroDeNegocio(LINK_INATIVO);
  return gravarResposta(c, form, null);
}

/** Presencial (em nome da empresa) ou demonstração (não grava nada). */
export async function responderNaTela(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const modo = form.modo;
  if (modo === "demonstracao") {
    if (!(await podeAgora(ctx, "comercial.censo.ver")))
      throw new ErroDePermissao(SEM_PERMISSAO);
    const { opcoes } = await opcoesDoQuestionario();
    const v = validarQuestionario(camposDoForm(form), opcoes);
    if (!v.ok) throw new ErroDeValidacao(CONFIRA, v.erros);
    return "Demonstração: as respostas passaram na conferência. Nada foi gravado.";
  }
  const convite = uuid.safeParse(form.convite);
  if (modo !== "presencial" || !convite.success)
    throw new ErroDeNegocio(LINK_INATIVO);
  if (!(await podeAgora(ctx, "comercial.censo.aplicar")))
    throw new ErroDePermissao(SEM_PERMISSAO);
  const c = await conviteParaLancar(ctx, convite.data);
  if (!c) throw new ErroDeNegocio(LINK_INATIVO);
  return gravarResposta(c, form, ctx.usuario.id);
}

// ---------------------------------------------------------------------------
// Rodadas e convites
// ---------------------------------------------------------------------------

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const novaRodada = z
  .object({
    nome: z
      .string()
      .trim()
      .min(3, "Dê um nome à rodada (ex.: Censo 2027).")
      .max(80),
    inicio: data,
    fim: data,
  })
  .refine((r) => r.fim >= r.inicio, "O fim vem depois do início.");

const umValor = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

/** Monta os convites que faltam na rodada, dos locatários ativos do ENET. */
async function convitesQueFaltam(ctx: Contexto, rodada: string) {
  const hoje = hojeEmBrasilia(new Date());
  const [tipos, todas] = await Promise.all([tiposLuc(ctx), listas(ctx)]);
  const enet = dadosEnet(hoje);
  const fora = new Set(
    tipos.filter((t) => !t.conta_ocupacao).map((t) => t.tipo),
  );
  const novos = convitesDosLocatarios(
    enet,
    hoje,
    fora,
    valoresDaLista(todas, "censo_bloco"),
  );
  if (!novos.length) return 0;
  const gravados = await comoUsuario(ctx, (tx) =>
    repo.incluirConvites(
      tx,
      // Empresa do ENET de exemplo: convite marcado (Remover dados de exemplo apaga).
      novos.map((n) => ({ ...n, rodada_id: rodada, exemplo: enet.exemplo })),
    ),
  );
  return gravados.length;
}

export async function abrirRodada(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const d = novaRodada.safeParse({
    nome: umValor(form.nome),
    inicio: umValor(form.inicio),
    fim: umValor(form.fim),
  });
  if (!d.success)
    throw new ErroDeValidacao(
      d.error.issues[0]?.message ?? "Confira os campos.",
    );
  let id: string;
  try {
    id = (await comoUsuario(ctx, (tx) => repo.incluirRodada(tx, d.data))).id;
  } catch (e) {
    if (e instanceof ErroDaApi && e.codigo === "conflito")
      throw new ErroDeNegocio("Já existe uma rodada com esse nome.");
    falhou(e, "abrir a rodada");
  }
  try {
    const n = await convitesQueFaltam(ctx, id);
    return `Rodada aberta com ${n} convites (um link por empresa).`;
  } catch (erro) {
    log.error({ err: erro }, "convites do Censo");
    throw new ErroDeNegocio(
      "Rodada aberta, mas os convites não foram gerados. Use “Gerar convites”.",
    );
  }
}

export async function gerarConvites(ctx: Contexto, id: string) {
  try {
    const n = await convitesQueFaltam(ctx, id);
    return n
      ? `${n} convite(s) novo(s) para locatários que ainda não tinham link.`
      : "Todos os locatários ativos já têm link nesta rodada.";
  } catch (e) {
    falhou(e, "gerar os convites");
  }
}

export async function encerrarRodada(ctx: Contexto, id: string) {
  let r: { nome: string }[];
  try {
    r = await comoUsuario(ctx, (tx) =>
      repo.encerrarRodada(tx, id, ctx.usuario.id),
    );
  } catch (e) {
    falhou(e, "encerrar a rodada");
  }
  if (!r.length) throw new ErroDePermissao(SEM_PERMISSAO);
  return `Rodada ${r[0]?.nome} encerrada. Os links deixam de aceitar respostas.`;
}

const SO_LIDERANCA =
  "Esta rodada já tem respostas: alterar ou excluir agora precisa da liderança do setor (permissão “Censo – editar ou excluir rodada que já tem respostas”).";

/**
 * Confere se dá para mexer na rodada: sem respostas, quem aplica o Censo
 * pode; com respostas, só a liderança (comercial.censo.aprovar).
 */
async function rodadaAlteravel(ctx: Contexto, id: string) {
  const r = await comoUsuario(ctx, (tx) => repo.rodadaParaAlterar(tx, id));
  if (!r) throw new ErroDeNegocio("Rodada não encontrada.");
  if (r.respostas > 0 && !pode(ctx, "comercial.censo.aprovar"))
    throw new ErroDePermissao(SO_LIDERANCA);
  return r;
}

/** Corrige nome e datas (ex.: prorrogar o fim) da rodada. */
export async function editarRodada(
  ctx: Contexto,
  id: string,
  form: Formulario,
): Promise<string> {
  const d = novaRodada.safeParse({
    nome: umValor(form.nome),
    inicio: umValor(form.inicio),
    fim: umValor(form.fim),
  });
  if (!d.success)
    throw new ErroDeValidacao(
      d.error.issues[0]?.message ?? "Confira os campos.",
    );
  await rodadaAlteravel(ctx, id);
  let r: { id: string }[];
  try {
    r = await comoUsuario(ctx, (tx) => repo.alterarRodada(tx, id, d.data));
  } catch (e) {
    if (e instanceof ErroDaApi && e.codigo === "conflito")
      throw new ErroDeNegocio("Já existe uma rodada com esse nome.");
    falhou(e, "alterar a rodada");
  }
  if (!r.length) throw new ErroDePermissao(SEM_PERMISSAO);
  return `Rodada ${d.data.nome} alterada.`;
}

/** Exclui a rodada lançada por engano, com os convites e as respostas. */
export async function excluirRodada(ctx: Contexto, id: string) {
  const atual = await rodadaAlteravel(ctx, id);
  let r: { nome: string }[];
  try {
    r = await comoUsuario(ctx, (tx) => repo.excluirRodada(tx, id));
  } catch (e) {
    falhou(e, "excluir a rodada");
  }
  if (!r.length) throw new ErroDePermissao(SO_LIDERANCA);
  return `Rodada ${atual.nome} excluída${atual.respostas ? ` com ${atual.respostas} resposta(s)` : ""}.`;
}

/** Marca que o link foi copiado para enviar (quadro: "Enviado, sem resposta"). */
export async function marcarConviteEnviado(ctx: Contexto, id: string) {
  try {
    await comoUsuario(ctx, (tx) => repo.marcarEnviado(tx, id));
  } catch (e) {
    log.error({ err: e, convite: id }, "convite enviado");
  }
  return "Convite marcado como enviado.";
}

// ---------------------------------------------------------------------------
// Temas dos feedbacks (4.9)
// ---------------------------------------------------------------------------

const mover = z.object({
  chave: z.string().regex(/^[rc]:[0-9a-f-]{36}$/i),
  vinculo: z.union([uuid, z.literal("")]),
  tema: z.union([uuid, z.literal("")]),
});

/**
 * Move a sugestão para outro tema (ou tira do tema, com tema vazio). O
 * gatilho do banco grava quem moveu e quando; na primeira classificação, a
 * ação grava.
 */
export async function moverSugestao(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const d = mover.safeParse({
    chave: umValor(form.chave),
    vinculo: umValor(form.vinculo) ?? "",
    tema: umValor(form.tema) ?? "",
  });
  if (!d.success)
    throw new ErroDeValidacao("Sugestão inválida. Recarregue a tela.");
  const { chave, vinculo, tema } = d.data;
  const coluna = chave.startsWith("r:") ? "resposta_id" : "contato_id";
  const idAlvo = chave.slice(2);
  try {
    return await comoUsuario(ctx, async (tx) => {
      if (!tema) {
        if (!vinculo) return "A sugestão já está sem tema.";
        await repo.apagarVinculo(tx, vinculo);
        return "Sugestão sem tema.";
      }
      const ja = await repo.vinculoNoTema(tx, coluna, idAlvo, tema);
      if (ja) {
        if (vinculo && vinculo !== ja.id) await repo.apagarVinculo(tx, vinculo);
        return "A sugestão já estava nesse tema.";
      }
      if (vinculo) await repo.mudarTema(tx, vinculo, tema);
      else
        await repo.incluirVinculo(tx, {
          [coluna]: idAlvo,
          tema_id: tema,
          movido_por: ctx.usuario.id,
        });
      return "Sugestão movida. Fica registrado quem mudou.";
    });
  } catch (e) {
    falhou(e, tema ? "mover a sugestão" : "tirar a sugestão do tema");
  }
}

const tema = z.object({
  id: z.union([uuid, z.literal("")]),
  nome: z.string().trim().min(2, "Dê um nome ao tema.").max(80),
  ativo: z.preprocess((v) => v !== "nao", z.boolean()),
});

export async function salvarTema(
  ctx: Contexto,
  form: Formulario,
): Promise<string> {
  const d = tema.safeParse({
    id: umValor(form.id) ?? "",
    nome: umValor(form.nome),
    ativo: umValor(form.ativo) ?? "sim",
  });
  if (!d.success)
    throw new ErroDeValidacao(d.error.issues[0]?.message ?? "Confira o tema.");
  const { id, nome, ativo } = d.data;
  try {
    await comoUsuario(ctx, async (tx) => {
      if (id) await repo.alterarTema(tx, id, { nome, ativo });
      else await repo.incluirTema(tx, { nome, ativo });
    });
  } catch (e) {
    if (e instanceof ErroDaApi && e.codigo === "conflito")
      throw new ErroDeNegocio("Já existe um tema com esse nome.");
    falhou(e, "salvar o tema");
  }
  return id ? "Tema salvo." : `Tema “${nome}” criado.`;
}

// ---------------------------------------------------------------------------
// Importação da rodada 2026 (4.13)
// ---------------------------------------------------------------------------

async function lerCenso(ctx: Contexto, abas: Aba[]) {
  const aba = abas[0];
  if (!aba) return { erro: "O arquivo não tem nenhuma aba." };
  const todas = await listas(ctx);
  return paraResultadoLeitura(
    lerPlanilhaCenso(aba.linhas, {
      blocos: valoresDaLista(todas, "censo_bloco"),
      segmentos: valoresDaLista(todas, "censo_segmento"),
      expectativas: valoresDaLista(todas, "censo_expectativa"),
    }),
    aba.nome,
    aba.linhas[0] ?? [],
  );
}

/**
 * Cria a rodada fechada e grava as respostas que entram. A rodada de
 * exemplo com o mesmo nome sai antes; uma rodada de verdade com o mesmo
 * nome bloqueia (a importação anterior já foi desfeita se a pessoa pediu
 * para substituir).
 */
async function gravarCenso(
  linhas: LinhaLida<LinhaCenso>[],
  g: ContextoGravacao,
): Promise<number> {
  const pode = await sql<{
    pode: boolean;
  }>`select core.pode('comercial.censo.importar') as pode`.execute(g.tx);
  if (pode.rows[0]?.pode !== true)
    throw new ErroImportacao("Você não tem permissão para importar o Censo.");
  const dados = linhas.map((l) => l.dados);
  const datas = dados
    .map((l) => l.carimbo?.slice(0, 10))
    .filter((x): x is string => !!x)
    .sort();
  const hoje = hojeEmBrasilia(new Date());
  const inicio = datas[0] ?? hoje;
  const fim = datas.at(-1) ?? hoje;
  const nome =
    nomeDaRodada({ linhas: dados, duplicadas: 0, comAviso: 0, inicio, fim }) ??
    `Censo ${hoje.slice(0, 4)}`;

  return comoServicoNaTransacao(g.tx, async () => {
    const mesma = await repo.rodadaComNome(g.tx, nome);
    if (mesma && !mesma.exemplo)
      throw new ErroImportacao(
        `Já existe a rodada “${nome}” no sistema. Desfaça a importação anterior ou renomeie a rodada antes de importar.`,
      );
    if (mesma) await repo.apagarRodada(g.tx, mesma.id);
    const rodada = await repo.incluirRodadaImportada(g.tx, {
      nome,
      inicio,
      fim,
      criada_por: g.usuarioId,
      importacao_id: g.importacaoId,
    });
    const agora = new Date().toISOString();
    const respostas = dados.map((l) => ({
      rodada_id: rodada.id,
      email: l.email,
      bloco: l.bloco,
      segmento: l.segmento,
      empresa_nome: l.empresa,
      colaboradores: l.colaboradores,
      visitantes_dia: l.visitantes,
      ticket: l.ticket,
      mensalidade: l.mensalidade,
      dias_uso: l.mensalidade ? l.dias : null,
      conversoes_dia: l.conversoes,
      expectativas: l.expectativas,
      sugestao: l.sugestao,
      ticket_ajustado: l.ticketAjustado,
      considerada: true,
      origem: "importacao",
      respondida_em: l.carimbo ?? agora,
      importacao_id: g.importacaoId,
    }));
    for (let i = 0; i < respostas.length; i += 500) {
      try {
        await repo.incluirRespostasImportadas(
          g.tx,
          respostas.slice(i, i + 500),
        );
      } catch (e) {
        if (codigoDoBanco(e) === "23505")
          throw new ErroImportacao(
            "Há empresas repetidas entre as linhas que entram. Escolha uma linha de cada.",
          );
        throw e;
      }
    }
    return respostas.length;
  });
}

export const importadorCenso = importador<LinhaCenso>(
  (ctx, abas) => lerCenso(ctx, abas),
  gravarCenso,
);
