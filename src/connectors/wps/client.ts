import { parseWith, type RequestOptions, requestJson } from "../http";
import {
  type MovimentoDoDia,
  movimentoDoDiaSchema,
  type Pagamento,
  type PagamentosDoDia,
  pagamentosDoDiaSchema,
} from "./schemas";

const SISTEMA = "wps";

export interface WpsConfig {
  /** Ex.: https://demonstracao.parkingplus.com.br (homologação). */
  baseUrl: string;
  usuario: string;
  senha: string;
  estacionamentoId: number;
  fetch?: typeof fetch;
}

/** Data local no formato da rota: yyyymmdd. */
function dia(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * A API lista o mesmo pagamento em mais de um grupo (ex.: em `cartao_credito`
 * e em `desconto`) e repete o registro dentro do grupo quando há mais de uma
 * RPS. Somar os grupos conta em dobro: use sempre esta função.
 */
export function pagamentosUnicos(dia: PagamentosDoDia): Pagamento[] {
  const porCodigo = new Map<number, Pagamento>();
  for (const grupo of Object.values(dia.subdetalhes)) {
    for (const p of grupo.detalhes ?? []) {
      if (!porCodigo.has(p.codigo)) porCodigo.set(p.codigo, p);
    }
  }
  return [...porCodigo.values()];
}

export function createWpsClient(config: WpsConfig) {
  const base = `${config.baseUrl.replace(/\/$/, "")}/servicos/operacional/estacionamento/${config.estacionamentoId}`;
  const auth = Buffer.from(`${config.usuario}:${config.senha}`).toString(
    "base64",
  );
  const opts: RequestOptions = {
    headers: { Authorization: `Basic ${auth}` },
    fetch: config.fetch,
  };

  return {
    estacionamentoId: config.estacionamentoId,

    async pagamentos(data: Date): Promise<PagamentosDoDia> {
      const json = await requestJson(
        SISTEMA,
        `${base}/${dia(data)}/pagamento`,
        {
          ...opts,
          query: { detalhe: "true" },
        },
      );
      return parseWith(SISTEMA, pagamentosDoDiaSchema, json);
    },

    async entradas(data: Date): Promise<MovimentoDoDia> {
      const json = await requestJson(
        SISTEMA,
        `${base}/${dia(data)}/entrada`,
        opts,
      );
      return parseWith(SISTEMA, movimentoDoDiaSchema, json);
    },

    async saidas(data: Date): Promise<MovimentoDoDia> {
      const json = await requestJson(
        SISTEMA,
        `${base}/${dia(data)}/saida`,
        opts,
      );
      return parseWith(SISTEMA, movimentoDoDiaSchema, json);
    },
  };
}

export type WpsClient = ReturnType<typeof createWpsClient>;
