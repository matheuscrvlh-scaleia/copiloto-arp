import type { z } from "zod";
import { ConnectorError, parseWith, requestJson } from "../http";
import {
  type Cadastros,
  cadastrosSchema,
  type Empresa,
  empresaSchema,
  type ListaDeTarefas,
  listaDeTarefasSchema,
  type Obra,
  type ObraResumo,
  obraResumoSchema,
  obraSchema,
  type Relatorio,
  type RelatorioResumo,
  relatorioResumoSchema,
  relatorioSchema,
  type Tarefa,
  tarefaSchema,
} from "./schemas";

const SISTEMA = "diario_de_obras";
const API_URL = "https://apiexterna.diariodeobra.app/v1";
/** 150 requisições por minuto por empresa: uma a cada 400 ms. */
const INTERVALO_MS = 60_000 / 150;
/** Em 429, sem Retry-After, espera o minuto do limite virar. */
const ESPERA_429_MS = 60_000;
/** Teto de um Retry-After (um valor absurdo não prende a sincronização). */
const ESPERA_429_MAX_MS = 120_000;
/** Espalha a volta, para não bater todos juntos no início do minuto. */
const JITTER_429_MS = 3_000;

export interface DiarioDeObrasConfig {
  /** Token da empresa (Cadastros › Empresa › Gerar token no Diário de Obras). */
  token: string;
  /** Espaço mínimo entre requisições; nos testes, 0. */
  intervaloMs?: number;
  /** Em 429 (limite por minuto): quantas esperas antes de desistir e quanto esperar. */
  limite?: {
    /** Esperas antes de desistir (padrão 3). */
    tentativas?: number;
    /** Sem Retry-After (padrão 60 s). */
    esperaMs?: number;
    /** Teto do Retry-After (padrão 120 s). */
    maxMs?: number;
    /** Até quanto somar ao acaso (padrão 3 s). */
    jitterMs?: number;
  };
  fetch?: typeof fetch;
}

export interface FiltroRelatorios {
  /** A API só filtra por data com início e fim juntos. */
  periodo?: {
    /** aaaa-mm-dd */
    inicio: string;
    /** aaaa-mm-dd */
    fim: string;
  };
  /** A API não pagina: limita a quantidade devolvida. */
  limite?: number;
  usuarioId?: string;
  statusId?: number;
  modeloDeRelatorioId?: string;
  ordem?: "asc" | "desc";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 429 que sobrou depois das esperas: a cota do minuto continua estourada. */
export function limiteAtingido(erro: unknown): boolean {
  return erro instanceof ConnectorError && erro.status === 429;
}

/**
 * Quanto esperar depois de um 429: o Retry-After (segundos ou data HTTP),
 * limitado ao teto; sem ele, o padrão.
 */
export function esperaDoLimite(
  retryAfter: string | null,
  padraoMs: number,
  maxMs: number,
  agora = Date.now(),
): number {
  const v = retryAfter?.trim();
  if (!v) return padraoMs;
  const segundos = Number(v);
  const ms = Number.isFinite(segundos)
    ? segundos * 1000
    : Date.parse(v) - agora;
  if (!Number.isFinite(ms)) return padraoMs;
  return Math.min(Math.max(ms, 1000), maxMs);
}

/**
 * Cliente só de leitura (a API externa só tem GET).
 *
 * Limite: 150 requisições por minuto por empresa, zerado a cada minuto. O
 * cliente espaça as próprias chamadas; um 429 mesmo assim (o token usado em
 * outro lugar ao mesmo tempo) pausa todas as chamadas do cliente pelo
 * Retry-After (ou até o minuto virar), com um pouco de acaso, e tenta de
 * novo um número limitado de vezes. Depois disso, o erro sobe
 * (`limiteAtingido`) e quem chama continua noutra execução.
 */
export function createDiarioDeObrasClient(config: DiarioDeObrasConfig) {
  const headers = { token: config.token };
  const intervalo = config.intervaloMs ?? INTERVALO_MS;
  const limite = {
    tentativas: config.limite?.tentativas ?? 3,
    esperaMs: config.limite?.esperaMs ?? ESPERA_429_MS,
    maxMs: config.limite?.maxMs ?? ESPERA_429_MAX_MS,
    jitterMs: config.limite?.jitterMs ?? JITTER_429_MS,
  };
  const doFetch = config.fetch ?? fetch;
  let proxima = 0;

  /** Reserva a vez da próxima chamada, respeitando o intervalo. */
  async function aguardarVez() {
    const agora = Date.now();
    const vez = Math.max(agora, proxima);
    proxima = vez + intervalo;
    if (vez > agora) await sleep(vez - agora);
  }

  async function get<T extends z.ZodType>(
    rota: string,
    schema: T,
    query?: Record<string, string | number | undefined>,
  ): Promise<z.infer<T>> {
    for (let tentativa = 0; ; tentativa++) {
      await aguardarVez();
      const visto = { retryAfter: null as string | null };
      try {
        const json = await requestJson(SISTEMA, `${API_URL}/${rota}`, {
          headers,
          query,
          repetirEm429: false,
          fetch: async (url, init) => {
            const res = await doFetch(url, init);
            if (res.status === 429)
              visto.retryAfter = res.headers.get("retry-after");
            return res;
          },
        });
        return parseWith(SISTEMA, schema, json);
      } catch (erro) {
        if (!limiteAtingido(erro) || tentativa >= limite.tentativas) throw erro;
        const espera =
          esperaDoLimite(visto.retryAfter, limite.esperaMs, limite.maxMs) +
          Math.random() * limite.jitterMs;
        // A cota é da empresa: todas as chamadas deste cliente esperam.
        proxima = Math.max(proxima, Date.now() + espera);
      }
    }
  }

  const obra = (id: string) => `obras/${encodeURIComponent(id)}`;

  return {
    /** Empresa dona do token; usada no teste de conexão. */
    empresa: (): Promise<Empresa> => get("empresa", empresaSchema),

    /** Modelos de relatório, tipos de ocorrência, grupos e status. */
    cadastros: (): Promise<Cadastros> => get("cadastros", cadastrosSchema),

    /** Todas as obras, com a data da última alteração de cada uma. */
    obras: (): Promise<ObraResumo[]> => get("obras", obraResumoSchema.array()),

    obra: (obraId: string): Promise<Obra> => get(obra(obraId), obraSchema),

    /** Diários da obra. Sem `limite`, a quantidade devolvida não está documentada. */
    relatorios: (
      obraId: string,
      f: FiltroRelatorios = {},
    ): Promise<RelatorioResumo[]> =>
      get(`${obra(obraId)}/relatorios`, relatorioResumoSchema.array(), {
        dataInicio: f.periodo?.inicio,
        dataFim: f.periodo?.fim,
        limite: f.limite,
        usuarioId: f.usuarioId,
        statusId: f.statusId,
        modeloDeRelatorioId: f.modeloDeRelatorioId,
        ordem: f.ordem,
      }),

    /** O diário completo: clima, mão de obra, atividades, ocorrências… */
    relatorio: (obraId: string, relatorioId: string): Promise<Relatorio> =>
      get(
        `${obra(obraId)}/relatorios/${encodeURIComponent(relatorioId)}`,
        relatorioSchema,
      ),

    /** Cronograma: etapas, tarefas e percentual realizado da obra. */
    listaDeTarefas: (obraId: string): Promise<ListaDeTarefas> =>
      get(`${obra(obraId)}/lista-de-tarefas`, listaDeTarefasSchema),

    /** Uma tarefa e o avanço dela em cada relatório. */
    tarefa: (obraId: string, tarefaId: string): Promise<Tarefa> =>
      get(
        `${obra(obraId)}/lista-de-tarefas/${encodeURIComponent(tarefaId)}`,
        tarefaSchema,
      ),
  };
}

export type DiarioDeObrasClient = ReturnType<typeof createDiarioDeObrasClient>;
