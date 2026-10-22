import type { z } from "zod";
import { parseWith, requestJson } from "../http";
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

export interface DiarioDeObrasConfig {
  /** Token da empresa (Cadastros › Empresa › Gerar token no Diário de Obras). */
  token: string;
  /** Espaço mínimo entre requisições; nos testes, 0. */
  intervaloMs?: number;
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

/**
 * Cliente só de leitura (a API externa só tem GET).
 *
 * Limite: 150 requisições por minuto por empresa, zerado a cada minuto. O
 * cliente espaça as próprias chamadas; um 429 mesmo assim (o token usado em
 * outro lugar ao mesmo tempo) falha na hora, porque repetir em segundos não
 * vence a janela de um minuto.
 */
export function createDiarioDeObrasClient(config: DiarioDeObrasConfig) {
  const headers = { token: config.token };
  const intervalo = config.intervaloMs ?? INTERVALO_MS;
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
    await aguardarVez();
    const json = await requestJson(SISTEMA, `${API_URL}/${rota}`, {
      headers,
      query,
      repetirEm429: false,
      fetch: config.fetch,
    });
    return parseWith(SISTEMA, schema, json);
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
