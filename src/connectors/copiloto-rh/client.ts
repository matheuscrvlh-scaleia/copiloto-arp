import type { z } from "zod";
import { ConnectorError, parseWith, requestJson } from "../http";
import {
  type Colaborador,
  cargoSchema,
  colaboradorSchema,
  type Dependente,
  departamentoSchema,
  dependenteSchema,
  type Me,
  meSchema,
  paginaSchema,
  type StatusColaborador,
  type Turnover,
  tokenSchema,
  turnoverSchema,
} from "./schemas";

const SISTEMA = "copiloto_rh";
const POR_PAGINA = 100;

/** Escopos que a credencial precisa ter no Copiloto RH. */
export const ESCOPOS_NECESSARIOS = [
  "organization:read",
  "employees:read",
  "employees:personal:read",
  "reports:read",
] as const;

export interface CopilotoRhConfig {
  /** Ex.: https://….supabase.co/functions/v1/public-api (com ou sem /v1). */
  baseUrl: string;
  /** client_id da credencial (Configurações › Integrações › API pública). */
  usuario: string;
  /** client_secret da credencial. */
  senha: string;
  fetch?: typeof fetch;
}

export interface FiltroTurnover {
  /** aaaa-mm-dd */
  de: string;
  /** aaaa-mm-dd; período de até 36 meses. */
  ate: string;
  /** Departamento do Copiloto (UUID). */
  departamentoId?: string;
}

export interface FiltroColaboradores {
  status?: StatusColaborador[];
  /** Só os alterados a partir deste instante (sincronização incremental). */
  alteradosDesde?: Date;
}

/**
 * Cliente só de leitura (a API pública só tem GET, fora o login).
 * Limites: login 10 por minuto por IP (o token vale 1 hora e é reaproveitado);
 * demais rotas 120 por minuto por credencial.
 */
export function createCopilotoRhClient(config: CopilotoRhConfig) {
  const api = `${config.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;
  let token: { valor: string; expiraEm: number } | null = null;

  async function autenticar(): Promise<string> {
    const json = await requestJson(SISTEMA, `${api}/auth/token`, {
      method: "POST",
      body: { client_id: config.usuario, client_secret: config.senha },
      // 401 aqui é credencial errada; 429 é o limite de login por minuto.
      retries: 1,
      fetch: config.fetch,
    });
    const t = parseWith(SISTEMA, tokenSchema, json);
    const ttl = (t.expires_in ?? 3600) * 1000;
    token = { valor: t.access_token, expiraEm: Date.now() + ttl - 60_000 };
    return t.access_token;
  }

  async function bearer(): Promise<string> {
    if (token && token.expiraEm > Date.now()) return token.valor;
    return autenticar();
  }

  async function get<T extends z.ZodType>(
    rota: string,
    schema: T,
    query?: Record<string, string | number | undefined>,
  ): Promise<z.infer<T>> {
    const call = (t: string) =>
      requestJson(SISTEMA, `${api}/${rota}`, {
        query,
        headers: { Authorization: `Bearer ${t}` },
        fetch: config.fetch,
      });
    // Fora do try: login recusado não deve ser tentado de novo.
    const atual = await bearer();
    let json: unknown;
    try {
      json = await call(atual);
    } catch (err) {
      // Token encerrado ou expirado antes do previsto: renova uma vez.
      if (!(err instanceof ConnectorError && err.status === 401)) throw err;
      token = null;
      json = await call(await bearer());
    }
    return parseWith(SISTEMA, schema, json);
  }

  /** Percorre todas as páginas de uma rota paginada. */
  async function todas<T extends z.ZodType>(
    rota: string,
    item: T,
    query: Record<string, string | undefined> = {},
  ): Promise<z.infer<T>[]> {
    const schema = paginaSchema(item);
    const itens: z.infer<T>[] = [];
    for (let page = 1; ; page++) {
      const r = await get(rota, schema, {
        ...query,
        page,
        per_page: POR_PAGINA,
      });
      itens.push(...r.data);
      if (!r.pagination.has_more || r.data.length === 0) return itens;
    }
  }

  function filtro(f: FiltroColaboradores) {
    return {
      status: f.status?.join(","),
      updated_since: f.alteradosDesde?.toISOString(),
    };
  }

  return {
    /** Empresa e escopos da credencial. */
    me: (): Promise<Me> => get("me", meSchema),

    departamentos: () => todas("departments", departamentoSchema),

    cargos: () => todas("positions", cargoSchema),

    colaboradores: (f: FiltroColaboradores = {}): Promise<Colaborador[]> =>
      todas("employees", colaboradorSchema, filtro(f)),

    /**
     * Todos os dependentes. Sem updated_since de propósito: dependente
     * apagado no Copiloto só some da lista, e a sincronização tira quem sumiu.
     */
    dependentes: (): Promise<Dependente[]> =>
      todas("dependents", dependenteSchema),

    /**
     * Turnover do período como a tela Relatórios › Turnover do Copiloto:
     * taxas, contagens, série mês a mês e por departamento.
     */
    turnover: (f: FiltroTurnover): Promise<Turnover> =>
      get("turnover", turnoverSchema, {
        from: f.de,
        to: f.ate,
        department_id: f.departamentoId,
      }),

    /** Só o total (uma página de um item), para o teste de conexão. */
    async totalColaboradores(f: FiltroColaboradores = {}): Promise<number> {
      const r = await get("employees", paginaSchema(colaboradorSchema), {
        ...filtro(f),
        per_page: 1,
      });
      return r.pagination.total;
    },
  };
}

export type CopilotoRhClient = ReturnType<typeof createCopilotoRhClient>;
