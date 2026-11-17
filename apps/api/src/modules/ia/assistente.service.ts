import type Anthropic from "@anthropic-ai/sdk";
import {
  type ConsultaDasConversas,
  type EntradaPergunta,
  type EventoDoAssistente,
  type FonteConsultada,
  POR_PAGINA,
  precoDoModelo,
  type RespostaConversa,
  type RespostaConversas,
  type RespostaEstado,
} from "@arp/shared/ia/contratos";
import {
  custoEmDolar,
  limiteEfetivo,
  motivoDoBloqueio,
  somarUso,
  tituloDaConversa,
  tokensQueContam,
  USO_ZERADO,
  type UsoDeTokens,
} from "@arp/shared/ia/regras";
import { z } from "zod";
import type { ClaudeClient, Esforco } from "@/connectors/claude/client";
import { ConnectorError } from "@/connectors/http";
import { type Contexto, exigir } from "@/contexto";
import { ErroDeLimite, ErroDeNegocio, ErroNaoEncontrado } from "@/erros";
import { banco } from "@/infra/banco";
import { log } from "@/infra/log";
import {
  claude,
  configClaude,
  credencialEmUso,
  IntegracaoNaoConfigurada,
} from "@/modules/sync/credenciais.service";
import * as repo from "./assistente.repository";
import { type Fonte, montarCatalogo, textoDoCatalogo } from "./catalogo";
import { rotasRegistradas } from "./consulta";
import { executarFerramenta, FERRAMENTAS, LEITURAS } from "./ferramentas";
import {
  contextoDaConversa,
  contextoDoTurno,
  montarInstrucoes,
} from "./instrucoes";

// IA ARP: a pessoa pergunta, a IA consulta as fontes do sistema (com o
// acesso da pessoa) e responde em streaming. Cada pergunta fica na conversa
// (o dono e quem tem ia.conversas leem) e no registro de uso (tokens, custo, módulos consultados).

type Mensagem = Anthropic.Beta.BetaMessageParam;

// ---------------------------------------------------------------------------
// Catálogo (montado das rotas registradas; refeito se elas mudarem)
// ---------------------------------------------------------------------------

let memoria: { rotas: number; fontes: Fonte[]; texto: string } | null = null;

export function catalogo(): { fontes: Fonte[]; texto: string } {
  const rotas = rotasRegistradas();
  if (!memoria || memoria.rotas !== rotas.length) {
    const fontes = montarCatalogo(rotas);
    memoria = { rotas: rotas.length, fontes, texto: textoDoCatalogo(fontes) };
  }
  return memoria;
}

// ---------------------------------------------------------------------------
// Situação da pessoa: configuração, limite e uso do mês
// ---------------------------------------------------------------------------

const precos = z.record(z.string(), precoDoModelo);

interface Situacao {
  ativa: boolean;
  esforco: Esforco;
  maxConsultas: number;
  instrucoes: string;
  precos: z.infer<typeof precos>;
  configurada: boolean;
  modelo: string | null;
  limite: number | null;
  usados: number;
  gasto: number;
  orcamento: number | null;
  motivo: string | null;
  porLimite: boolean;
}

const ESFORCOS_VALIDOS = z.enum(["low", "medium", "high", "xhigh", "max"]);

async function situacao(ctx: Contexto): Promise<Situacao> {
  await exigir(ctx, "ia.usar");
  const cfg = await banco.comoUsuario(ctx.usuario.id, (tx) => repo.config(tx));
  if (!cfg) throw new ErroDeNegocio("A IA ainda não foi configurada.");
  let modelo: string | null = null;
  try {
    modelo = configClaude(await credencialEmUso("claude")).modelo;
  } catch (e) {
    if (!(e instanceof IntegracaoNaoConfigurada)) throw e;
  }
  // Limites e o uso de todos (teto do mês): só o gestor lê pela sessão.
  const { limites, uso } = await banco.comoServico(async (tx) => ({
    limites: await repo.limitesDaPessoa(tx, ctx.usuario.id),
    uso: await repo.usoDoMes(tx, ctx.usuario.id),
  }));
  const limite = limiteEfetivo({ ...limites, padrao: cfg.limite_padrao_mes });
  const s = {
    ativa: cfg.ativa,
    configurada: modelo !== null,
    usadosMes: uso.tokensDaPessoa,
    limiteMes: limite,
    gastoMesUsd: uso.gastoTotal,
    orcamentoMesUsd: cfg.orcamento_mes_usd,
  };
  const motivo = motivoDoBloqueio(s);
  return {
    ativa: cfg.ativa,
    esforco: ESFORCOS_VALIDOS.catch("medium").parse(cfg.esforco),
    maxConsultas: cfg.max_consultas,
    instrucoes: cfg.instrucoes,
    precos: precos.catch({}).parse(cfg.precos),
    configurada: s.configurada,
    modelo,
    limite,
    usados: s.usadosMes,
    gasto: s.gastoMesUsd,
    orcamento: cfg.orcamento_mes_usd,
    motivo,
    porLimite:
      motivo !== null &&
      s.ativa &&
      s.configurada &&
      ((limite !== null && s.usadosMes >= limite) ||
        (s.orcamentoMesUsd !== null && s.gastoMesUsd >= s.orcamentoMesUsd)),
  };
}

export async function estado(ctx: Contexto): Promise<RespostaEstado> {
  const s = await situacao(ctx);
  return {
    disponivel: s.motivo === null,
    motivo: s.motivo,
    modelo: s.modelo,
    usados_mes: s.usados,
    limite_mes: s.limite,
  };
}

// ---------------------------------------------------------------------------
// Conversas
// ---------------------------------------------------------------------------

/** Histórico da própria pessoa: busca e páginas de POR_PAGINA. */
export async function conversas(
  ctx: Contexto,
  c: ConsultaDasConversas,
): Promise<RespostaConversas> {
  const linhas = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.conversas(tx, {
      ...c,
      usuarioId: ctx.usuario.id,
      limite: POR_PAGINA + 1,
    }),
  );
  return paginar(linhas, ({ id, titulo, atualizada_em }) => ({
    id,
    titulo,
    atualizada_em,
  }));
}

/** Corta a linha a mais (que só diz se há próxima página). */
export function paginar<L extends { atualizada_em: string }, R>(
  linhas: L[],
  mapear: (l: L) => R,
): { conversas: R[]; proxima: string | null } {
  const pagina = linhas.slice(0, POR_PAGINA);
  const ultima = pagina.at(-1);
  return {
    conversas: pagina.map(mapear),
    proxima: linhas.length > POR_PAGINA && ultima ? ultima.atualizada_em : null,
  };
}

export const fontesSalvas = z.array(
  z.object({ caminho: z.string(), modulo: z.string(), ok: z.boolean() }),
);

export async function conversa(
  ctx: Contexto,
  id: string,
): Promise<RespostaConversa> {
  const r = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    const c = await repo.conversa(tx, id, ctx.usuario.id);
    return c ? { ...c, perguntas: await repo.perguntas(tx, id) } : null;
  });
  if (!r) throw new ErroNaoEncontrado("Conversa não encontrada.");
  return {
    id: r.id,
    titulo: r.titulo,
    perguntas: r.perguntas.map((p) => ({
      ...p,
      fontes: fontesSalvas.catch([]).parse(p.fontes),
    })),
  };
}

export async function apagarConversa(ctx: Contexto, id: string): Promise<void> {
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.apagarConversa(tx, id),
  );
  if (!ok) throw new ErroNaoEncontrado("Conversa não encontrada.");
}

export async function avaliar(
  ctx: Contexto,
  perguntaId: string,
  avaliacao: 1 | -1 | null,
): Promise<void> {
  const ok = await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.avaliar(tx, perguntaId, avaliacao),
  );
  if (!ok) throw new ErroNaoEncontrado("Resposta não encontrada.");
}

// ---------------------------------------------------------------------------
// Perguntar
// ---------------------------------------------------------------------------

/** Mensagens salvas no formato da API (jsonb), conferidas por formato. */
function ehMensagens(v: unknown): v is Mensagem[] {
  return (
    Array.isArray(v) &&
    v.every(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        "role" in m &&
        (m.role === "user" || m.role === "assistant") &&
        "content" in m &&
        (typeof m.content === "string" || Array.isArray(m.content)),
    )
  );
}

function usoDaMensagem(m: Anthropic.Beta.BetaMessage): UsoDeTokens {
  return {
    entrada: m.usage.input_tokens,
    saida: m.usage.output_tokens,
    cache_escrita: m.usage.cache_creation_input_tokens ?? 0,
    cache_leitura: m.usage.cache_read_input_tokens ?? 0,
  };
}

function mensagemDoErro(e: unknown): string {
  if (e instanceof ConnectorError) {
    if (e.status === 429)
      return "A IA está com muitos pedidos agora. Tente de novo em alguns segundos.";
    if (e.status === 401 || e.status === 403)
      return "A chave da Claude foi recusada. O administrador precisa conferir em Administração › Configurações › Integrações.";
    if (e.status !== undefined && e.status >= 500)
      return "A IA está indisponível agora. Tente de novo em instantes.";
  }
  return "Não consegui terminar a resposta. Tente de novo.";
}

interface Preparo {
  ia: ClaudeClient;
  s: Situacao;
  conversaId: string;
  perguntaId: string;
  historico: Mensagem[];
  nova: Mensagem;
}

/**
 * Confere tudo antes de começar a responder (erros saem como resposta HTTP
 * normal) e devolve o fluxo de eventos da resposta.
 */
export async function perguntar(
  ctx: Contexto,
  entrada: EntradaPergunta,
  sinal: AbortSignal,
): Promise<AsyncGenerator<EventoDoAssistente>> {
  const inicio = Date.now();
  const s = await situacao(ctx);
  if (s.motivo) {
    if (s.porLimite)
      await banco.comoServico((tx) =>
        repo.registrarUso(tx, {
          perguntaId: null,
          conversaId: entrada.conversa_id ?? null,
          usuarioId: ctx.usuario.id,
          modelo: s.modelo ?? "",
          entrada: 0,
          saida: 0,
          cacheEscrita: 0,
          cacheLeitura: 0,
          contados: 0,
          custoUsd: 0,
          consultas: 0,
          modulos: [],
          duracaoMs: 0,
          status: "limite",
        }),
      );
    throw s.porLimite
      ? new ErroDeLimite(s.motivo)
      : new ErroDeNegocio(s.motivo);
  }
  let ia: ClaudeClient;
  try {
    ia = await claude();
  } catch (e) {
    if (e instanceof IntegracaoNaoConfigurada)
      throw new ErroDeNegocio(
        "A IA ainda não foi configurada (falta a chave da Claude em Administração › Configurações › Integrações).",
      );
    throw e;
  }

  const preparo = await banco.comoUsuario(ctx.usuario.id, async (tx) => {
    let conversaId = entrada.conversa_id ?? null;
    let historico: Mensagem[] = [];
    if (conversaId) {
      if (!(await repo.conversa(tx, conversaId, ctx.usuario.id))) return null;
      historico = (await repo.historico(tx, conversaId)).flatMap((t) =>
        ehMensagens(t.mensagens) ? t.mensagens : [],
      );
    } else {
      conversaId = await repo.criarConversa(
        tx,
        tituloDaConversa(entrada.pergunta),
      );
    }
    const perguntaId = await repo.criarPergunta(
      tx,
      conversaId,
      entrada.pergunta,
    );
    return { conversaId, perguntaId, historico };
  });
  if (!preparo) throw new ErroNaoEncontrado("Conversa não encontrada.");

  const contexto = [
    ...(preparo.historico.length === 0
      ? [contextoDaConversa(ctx, entrada.telas ?? [])]
      : []),
    contextoDoTurno(entrada.tela),
  ].join("\n");
  const nova: Mensagem = {
    role: "user",
    content: [
      { type: "text", text: contexto },
      { type: "text", text: entrada.pergunta },
    ],
  };
  return responder(ctx, { ia, s, ...preparo, nova }, sinal, inicio);
}

async function* responder(
  ctx: Contexto,
  p: Preparo,
  sinal: AbortSignal,
  inicio: number,
): AsyncGenerator<EventoDoAssistente> {
  const { fontes, texto: textoDoCatalogo } = catalogo();
  const instrucoes = montarInstrucoes(textoDoCatalogo, p.s.instrucoes);
  const mensagens: Mensagem[] = [...p.historico, p.nova];
  const turno: Mensagem[] = [p.nova];
  const consultadas: FonteConsultada[] = [];
  let uso = USO_ZERADO;
  let custo = 0;
  let modelo = p.s.modelo ?? "";
  let resposta = "";
  let status: "ok" | "erro" | "recusa" | "cancelada" = "erro";
  let consultas = 0;

  const escrever = function* (texto: string) {
    resposta += texto;
    yield { tipo: "texto", texto } satisfies EventoDoAssistente;
  };

  try {
    yield {
      tipo: "inicio",
      conversa_id: p.conversaId,
      pergunta_id: p.perguntaId,
    };
    for (let passo = 0; passo < p.s.maxConsultas + 4; passo++) {
      // Texto de um passo anterior ("vou consultar…"): separa do próximo.
      if (resposta && !resposta.endsWith("\n")) yield* escrever("\n\n");
      let final: Anthropic.Beta.BetaMessage | null = null;
      for await (const pedaco of p.ia.turno({
        instrucoes,
        ferramentas: FERRAMENTAS,
        mensagens,
        esforco: p.s.esforco,
        sinal,
      })) {
        if (pedaco.tipo === "texto") yield* escrever(pedaco.texto);
        else final = pedaco.mensagem;
      }
      if (!final) break;
      const usoDoPasso = usoDaMensagem(final);
      uso = somarUso(uso, usoDoPasso);
      custo += custoEmDolar(usoDoPasso, p.s.precos[final.model]);
      modelo = final.model;
      const doAssistente: Mensagem = {
        role: "assistant",
        content: final.content,
      };
      mensagens.push(doAssistente);
      turno.push(doAssistente);

      if (final.stop_reason === "refusal") {
        status = "recusa";
        if (!resposta.trim())
          yield* escrever("Não posso ajudar com esse pedido.");
        break;
      }
      const pedidos = final.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
      );
      if (final.stop_reason === "max_tokens") {
        yield* escrever("\n\n_(Resposta cortada por tamanho.)_");
        status = pedidos.length ? "erro" : "ok";
        break;
      }
      if (final.stop_reason !== "tool_use" || pedidos.length === 0) {
        status = "ok";
        break;
      }

      for (const u of pedidos)
        if (LEITURAS.has(u.name)) {
          const alvo = z.object({ caminho: z.string() }).safeParse(u.input);
          if (alvo.success)
            yield {
              tipo: "consulta",
              fonte: {
                caminho: alvo.data.caminho,
                modulo: alvo.data.caminho.split("/")[1] ?? "",
                ok: true,
              },
            };
        }
      const resultados = await Promise.all(
        pedidos.map(async (u) => {
          if (LEITURAS.has(u.name) && ++consultas > p.s.maxConsultas)
            return {
              conteudo: `Limite de ${p.s.maxConsultas} consultas desta pergunta atingido. Responda com o que já tem e diga o que faltou.`,
              erro: true,
            };
          return executarFerramenta(ctx, fontes, u.name, u.input).catch(
            (e: unknown) => {
              log.error(
                { err: e, ferramenta: u.name },
                "IA: ferramenta falhou",
              );
              return { conteudo: "A leitura falhou.", erro: true };
            },
          );
        }),
      );
      for (const r of resultados)
        if ("fonte" in r && r.fonte) consultadas.push(r.fonte);
      const devolucao: Mensagem = {
        role: "user",
        content: pedidos.map((u, i) => ({
          type: "tool_result",
          tool_use_id: u.id,
          content: resultados[i]?.conteudo ?? "",
          ...(resultados[i]?.erro ? { is_error: true } : {}),
        })),
      };
      mensagens.push(devolucao);
      turno.push(devolucao);
    }
    if (status === "erro" && !resposta.trim())
      yield* escrever("Não consegui terminar a resposta. Tente de novo.");
  } catch (e) {
    if (sinal.aborted) status = "cancelada";
    else {
      log.error({ err: e, pergunta: p.perguntaId }, "IA: resposta falhou");
      status = "erro";
      yield { tipo: "erro", mensagem: mensagemDoErro(e) };
    }
  } finally {
    // Também roda quando a pessoa fecha o chat no meio (o fluxo é encerrado).
    if (status === "erro" && sinal.aborted) status = "cancelada";
    await salvar(ctx, p, {
      resposta,
      // Turno incompleto não volta para a conversa (status ≠ ok).
      mensagens: turno,
      fontes: consultadas,
      status,
      uso,
      custo,
      modelo,
      consultas,
      duracaoMs: Date.now() - inicio,
    }).catch((e: unknown) =>
      log.error({ err: e, pergunta: p.perguntaId }, "IA: registro falhou"),
    );
  }
  yield { tipo: "fim", tokens: tokensQueContam(uso), custo_usd: custo };
}

async function salvar(
  ctx: Contexto,
  p: Preparo,
  r: {
    resposta: string;
    mensagens: Mensagem[];
    fontes: FonteConsultada[];
    status: "ok" | "erro" | "recusa" | "cancelada";
    uso: UsoDeTokens;
    custo: number;
    modelo: string;
    consultas: number;
    duracaoMs: number;
  },
): Promise<void> {
  await banco.comoUsuario(ctx.usuario.id, (tx) =>
    repo.concluirPergunta(tx, p.perguntaId, {
      resposta: r.resposta,
      mensagens: r.mensagens,
      fontes: r.fontes,
      status: r.status,
    }),
  );
  await banco.comoServico((tx) =>
    repo.registrarUso(tx, {
      perguntaId: p.perguntaId,
      conversaId: p.conversaId,
      usuarioId: ctx.usuario.id,
      modelo: r.modelo,
      entrada: r.uso.entrada,
      saida: r.uso.saida,
      cacheEscrita: r.uso.cache_escrita,
      cacheLeitura: r.uso.cache_leitura,
      contados: tokensQueContam(r.uso),
      custoUsd: r.custo,
      consultas: r.consultas,
      // Um por consulta (com repetição): o painel conta consultas por módulo.
      modulos: r.fontes.map((f) => f.modulo).sort(),
      duracaoMs: r.duracaoMs,
      status: r.status,
    }),
  );
}
