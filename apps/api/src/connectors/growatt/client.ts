import type { z } from "zod";
import { ConnectorError, parseWith, requestJson } from "../http";
import {
  agoraSchema,
  detalhesSchema,
  energiaSchema,
  envelopeSchema,
  listaSchema,
} from "./schemas";

// OpenAPI v1 da Growatt, só leitura. O token pode ser de um instalador e
// enxergar usinas de outros clientes: o cliente lê só a usina configurada e,
// da lista, só a contagem.

const SISTEMA = "sus_growatt";

/** A API recusa período de energia diária com mais de 8 dias. */
export const DIAS_POR_CONSULTA = 8;

export interface GrowattConfig {
  /** Ex.: https://openapi.growatt.com */
  baseUrl: string;
  token: string;
  usinaId: number;
  fetch?: typeof fetch;
}

/** Erros da API: token recusado (10011) vira 401; usina fora do token, 404. */
const ERROS: Record<number, { status?: number; texto: string }> = {
  10011: { status: 401, texto: "token recusado" },
  10002: {
    status: 404,
    texto: "usina não existe ou não é vista por este token",
  },
  10012: { texto: "consultas demais em pouco tempo; tente de novo depois" },
};

function dados<T extends z.ZodType>(r: unknown, schema: T): z.infer<T> {
  const env = parseWith(SISTEMA, envelopeSchema, r);
  if (env.error_code !== 0) {
    const conhecido = ERROS[env.error_code];
    throw new ConnectorError(
      conhecido?.texto ?? `código ${env.error_code}`,
      SISTEMA,
      conhecido?.status,
      JSON.stringify({ Message: env.error_msg }),
    );
  }
  return parseWith(SISTEMA, schema, env.data);
}

/** "aaaa-mm-dd" + n dias. */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Divide [de, ate] em janelas de até DIAS_POR_CONSULTA dias. */
export function janelas(de: string, ate: string): [string, string][] {
  const r: [string, string][] = [];
  for (let ini = de; ini <= ate; ini = somarDias(ini, DIAS_POR_CONSULTA)) {
    const fim = somarDias(ini, DIAS_POR_CONSULTA - 1);
    r.push([ini, fim < ate ? fim : ate]);
  }
  return r;
}

export interface DiaLido {
  /** aaaa-mm-dd */
  dia: string;
  kwh: number;
}

export function createGrowattClient(config: GrowattConfig) {
  const base = `${config.baseUrl.replace(/\/+$/, "")}/v1`;
  const usina = config.usinaId;

  async function ler<T extends z.ZodType>(
    caminho: string,
    query: Record<string, string | number>,
    schema: T,
  ): Promise<z.infer<T>> {
    const json = await requestJson(SISTEMA, `${base}/${caminho}`, {
      headers: { token: config.token },
      query,
      fetch: config.fetch,
    });
    return dados(json, schema);
  }

  return {
    usinaId: usina,

    /** Nome, potência de pico (kWp) e data de criação da usina. */
    detalhes: () => ler("plant/details", { plant_id: usina }, detalhesSchema),

    /** Potência agora (kW) e energia do dia, mês, ano e total (kWh). */
    agora: () => ler("plant/data", { plant_id: usina }, agoraSchema),

    /** Quantas usinas o token vê (sem nomes: podem ser de outros clientes). */
    async quantasUsinas(): Promise<number> {
      const r = await ler("plant/list", { page: 1, perpage: 1 }, listaSchema);
      return r.count ?? r.plants.length;
    },

    /**
     * Energia de cada dia entre `de` e `ate` ("aaaa-mm-dd", no fuso da usina),
     * em janelas de 8 dias, uma consulta de cada vez. Dia sem valor fica de
     * fora (não vira zero).
     */
    async energiaPorDia(de: string, ate: string): Promise<DiaLido[]> {
      const dias: DiaLido[] = [];
      for (const [ini, fim] of janelas(de, ate)) {
        const r = await ler(
          "plant/energy",
          {
            plant_id: usina,
            start_date: ini,
            end_date: fim,
            time_unit: "day",
          },
          energiaSchema,
        );
        for (const e of r.energys)
          if (e.energy !== null) dias.push({ dia: e.date, kwh: e.energy });
      }
      return dias;
    },
  };
}

export type GrowattClient = ReturnType<typeof createGrowattClient>;
