import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { ConnectorError, parseWith } from "../http";

// IA da Anthropic (Claude) pelo SDK oficial. Cada tela manda as instruções
// dela (fixas: vão no system, com cache) e o conteúdo a analisar; recebe
// texto ou um objeto validado pelo schema Zod da tela. Nada daqui vai para o
// log: o conteúdo pode ter dado pessoal, e o erro leva só a mensagem da API.

const SISTEMA = "claude";

/** Se o modelo recusar, a API refaz o pedido num modelo reserva. */
const BETA_FALLBACK = "server-side-fallback-2026-07-01";
// atalho: lista fixa dos modelos que aceitam fallbacks: "default"; outro modelo vai sem.
const ACEITA_FALLBACK = /^claude-(fable-5|mythos-5|opus-5|sonnet-5-5)/;

/** Quanto o modelo pensa antes de responder (mais = melhor e mais caro). */
export type Esforco = "low" | "medium" | "high" | "xhigh" | "max";

export interface ClaudeConfig {
  apiKey: string;
  /** Ex.: claude-opus-5-5 */
  modelo: string;
  fetch?: typeof fetch;
}

export interface Pedido {
  /** Instruções da tela: papel, regras e formato. Iguais a cada chamada. */
  instrucoes: string;
  /** O que a tela manda analisar (dados, texto do usuário). */
  conteudo: string;
  /** Sem valor, o padrão do modelo. */
  esforco?: Esforco;
  /** Teto da resposta, em tokens. */
  maxTokens?: number;
}

type Resposta = Anthropic.Beta.BetaMessage;

/** Um passo de conversa com ferramentas (o assistente do sistema). */
export interface Turno {
  /** Instruções fixas (com cache: iguais para todo mundo). */
  instrucoes: string;
  ferramentas: Anthropic.Beta.BetaTool[];
  /** A conversa inteira até aqui, no formato da API. */
  mensagens: Anthropic.Beta.BetaMessageParam[];
  esforco?: Esforco;
  maxTokens?: number;
  /** Cancela o pedido (a pessoa fechou o chat ou parou a resposta). */
  sinal?: AbortSignal;
}

/** O que chega durante o passo: pedaços do texto e, no fim, a mensagem. */
export type PedacoDoTurno =
  | { tipo: "texto"; texto: string }
  | { tipo: "fim"; mensagem: Resposta };

function traduzir(erro: unknown): never {
  if (erro instanceof ConnectorError) throw erro;
  if (erro instanceof Anthropic.APIError) {
    // erro.error é o corpo da API ({"error":{"message":…}}): sem a chave.
    throw new ConnectorError(
      erro.status === undefined ? "sem resposta da API" : "a API recusou",
      SISTEMA,
      erro.status,
      erro.error === undefined ? undefined : JSON.stringify(erro.error),
    );
  }
  throw erro;
}

function conferir(r: Resposta): void {
  if (r.stop_reason === "refusal")
    throw new ConnectorError("a IA recusou o pedido", SISTEMA);
  if (r.stop_reason === "max_tokens")
    throw new ConnectorError("a resposta passou do tamanho máximo", SISTEMA);
}

export function createClaudeClient(config: ClaudeConfig) {
  const sdk = new Anthropic({
    apiKey: config.apiKey,
    fetch: config.fetch,
    timeout: 180_000,
    maxRetries: 1,
  });
  const fallback = ACEITA_FALLBACK.test(config.modelo)
    ? { betas: [BETA_FALLBACK], fallbacks: "default" as const }
    : {};

  function base(p: Pedido) {
    return {
      model: config.modelo,
      max_tokens: p.maxTokens ?? 16_000,
      system: [
        {
          type: "text" as const,
          text: p.instrucoes,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user" as const, content: p.conteudo }],
      ...fallback,
    };
  }

  return {
    modelo: config.modelo,

    /** Confere a chave e o modelo sem gastar tokens. */
    async verificar(): Promise<{ id: string; nome: string }> {
      const m = await sdk.models.retrieve(config.modelo).catch(traduzir);
      return { id: m.id, nome: m.display_name };
    },

    /** Resposta em texto livre. */
    async texto(p: Pedido): Promise<string> {
      const r = await sdk.beta.messages
        .create({
          ...base(p),
          ...(p.esforco ? { output_config: { effort: p.esforco } } : {}),
        })
        .catch(traduzir);
      conferir(r);
      return r.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("")
        .trim();
    },

    /** Resposta num objeto no formato do schema (saída estruturada). */
    async json<T extends z.ZodType>(
      p: Pedido & { schema: T },
    ): Promise<z.infer<T>> {
      const r = await sdk.beta.messages
        .parse({
          ...base(p),
          output_config: {
            format: betaZodOutputFormat(p.schema),
            ...(p.esforco ? { effort: p.esforco } : {}),
          },
        })
        .catch(traduzir);
      conferir(r);
      return parseWith(SISTEMA, p.schema, r.parsed_output);
    },

    /**
     * Um passo da conversa, em streaming: devolve o texto conforme chega e,
     * no fim, a mensagem inteira (com `stop_reason`, ferramentas pedidas e o
     * uso de tokens). Quem chama roda as ferramentas e chama de novo. Recusa
     * e corte por tamanho não lançam aqui: quem chama decide pelo
     * `stop_reason` (a resposta parcial ainda é registrada).
     */
    async *turno(t: Turno): AsyncGenerator<PedacoDoTurno> {
      const fluxo = sdk.beta.messages.stream(
        {
          model: config.modelo,
          max_tokens: t.maxTokens ?? 32_000,
          system: [
            {
              type: "text",
              text: t.instrucoes,
              cache_control: { type: "ephemeral" },
            },
          ],
          tools: t.ferramentas,
          messages: t.mensagens,
          // A conversa cresce a cada passo: guarda até o último bloco.
          cache_control: { type: "ephemeral" },
          ...(t.esforco ? { output_config: { effort: t.esforco } } : {}),
          ...fallback,
        },
        { signal: t.sinal },
      );
      try {
        for await (const e of fluxo)
          if (e.type === "content_block_delta" && e.delta.type === "text_delta")
            yield { tipo: "texto", texto: e.delta.text };
        yield { tipo: "fim", mensagem: await fluxo.finalMessage() };
      } catch (erro) {
        traduzir(erro);
      } finally {
        // Quem consome parou antes do fim: não deixa o pedido aberto.
        if (!fluxo.ended) fluxo.abort();
      }
    },
  };
}

export type ClaudeClient = ReturnType<typeof createClaudeClient>;
