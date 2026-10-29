import { z } from "zod";
import { parseWith, requestJson } from "../http";

// RD Station Marketing (API 2.0, OAuth). O refresh token vira um token de
// acesso de 24 horas; o refresh continua valendo até o app ser desautorizado.

const SISTEMA = "mkt_rd_station";
const API_URL = "https://api.rd.services";

export interface RdStationConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetch?: typeof fetch;
}

const tokenSchema = z.object({ access_token: z.string().min(1) });
const contaSchema = z.object({ name: z.string() });

export function createRdStationClient(config: RdStationConfig) {
  let token: Promise<string> | null = null;

  function acesso(): Promise<string> {
    token ??= requestJson(SISTEMA, `${API_URL}/auth/token`, {
      method: "POST",
      body: {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
      },
      retries: 1,
      fetch: config.fetch,
    }).then((r) => parseWith(SISTEMA, tokenSchema, r).access_token);
    return token;
  }

  return {
    /** Nome da conta que autorizou o app. */
    async conta() {
      const r = await requestJson(
        SISTEMA,
        `${API_URL}/marketing/account_info`,
        {
          headers: { Authorization: `Bearer ${await acesso()}` },
          retries: 1,
          fetch: config.fetch,
        },
      );
      return parseWith(SISTEMA, contaSchema, r);
    },
  };
}
