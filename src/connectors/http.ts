import type { z } from "zod";

/** Erro de qualquer chamada a sistema externo. Nunca carrega credenciais. */
export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly sistema: string,
    readonly status?: number,
    readonly detalhe?: string,
  ) {
    super(`[${sistema}] ${message}`);
    this.name = "ConnectorError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  /** Objeto vira JSON; URLSearchParams vira form-urlencoded. */
  body?: unknown;
  timeoutMs?: number;
  /** Tentativas extras em 429, 5xx e falha de rede. */
  retries?: number;
  /**
   * false: 429 falha na hora. Para limites longos (ex.: por hora), repetir
   * só gasta cota; quem chama decide parar e deixar para depois.
   */
  repetirEm429?: boolean;
  fetch?: typeof fetch;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

function buildUrl(url: string, query: RequestOptions["query"]): string {
  if (!query) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

function backoffMs(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds)) return seconds * 1000;
  return 500 * 2 ** attempt;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Faz a requisição com timeout e retry e devolve o JSON sem validar. */
export async function requestJson(
  sistema: string,
  url: string,
  opts: RequestOptions = {},
): Promise<unknown> {
  const {
    method = "GET",
    headers = {},
    query,
    body,
    timeoutMs = 30_000,
    retries = 3,
    repetirEm429 = true,
    fetch: doFetch = fetch,
  } = opts;

  const init: RequestInit = { method, headers: { ...headers } };
  if (body instanceof URLSearchParams) {
    init.body = body;
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/x-www-form-urlencoded";
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] =
      "application/json";
  }

  const target = buildUrl(url, query);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await doFetch(target, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      if (attempt < retries) {
        await sleep(backoffMs(attempt, null));
        continue;
      }
      throw new ConnectorError(
        "falha de rede ou timeout",
        sistema,
        undefined,
        String(err),
      );
    }

    if (res.ok) {
      try {
        return await res.json();
      } catch {
        throw new ConnectorError("resposta não é JSON", sistema, res.status);
      }
    }

    const repete = res.status !== 429 || repetirEm429;
    if (RETRYABLE.has(res.status) && repete && attempt < retries) {
      await sleep(backoffMs(attempt, res.headers.get("retry-after")));
      continue;
    }
    const texto = (await res.text().catch(() => "")).slice(0, 500);
    throw new ConnectorError(`HTTP ${res.status}`, sistema, res.status, texto);
  }
}

/**
 * Mensagem do erro segura para log e aviso: inclui o "Message" que a API
 * devolveu, sem sequências de dígitos que possam ser documento (CPF, PIS).
 */
export function mensagemSegura(erro: unknown): string {
  if (!(erro instanceof ConnectorError)) {
    return erro instanceof Error ? erro.message : String(erro);
  }
  const daApi = [...(erro.detalhe ?? "").matchAll(/"Message"\s*:\s*"([^"]*)"/g)]
    .map((m) => m[1])
    .join("; ");
  const texto = daApi ? `${erro.message}: ${daApi}` : erro.message;
  return texto.replace(/\d[\d.\-/]{7,}\d/g, "<documento>");
}

/** Valida a resposta contra o schema; formato inesperado vira erro explícito. */
export function parseWith<T extends z.ZodType>(
  sistema: string,
  schema: T,
  data: unknown,
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ConnectorError(
      "resposta fora do formato esperado",
      sistema,
      undefined,
      result.error.message.slice(0, 1000),
    );
  }
  return result.data;
}
