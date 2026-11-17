import type { z } from "zod";
import { parseWith, type RequestOptions, requestJson } from "../http";
import {
  type AcessosDoDia,
  aberturasManuaisSchema,
  abonosGeradosSchema,
  abonosUtilizadosSchema,
  acessosDoDiaSchema,
  clientesSchema,
  descontosSchema,
  devolucoesDeTrocoSchema,
  garagensSchema,
  lancamentosSchema,
  limpezasDePatioSchema,
  manobrasSchema,
  type Pagamento,
  type PagamentosDoDia,
  pagamentosCanceladosSchema,
  pagamentosDoDiaSchema,
  selosGeradosSchema,
  selosUtilizadosSchema,
  setoresSchema,
  totalDeClientesSchema,
  validacoesSchema,
} from "./schemas";

const SISTEMA = "wps";

/** Entradas, saídas e clientes com detalhe podem ter milhares de registros. */
const TEMPO_DAS_LISTAS_MS = 120_000;

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

/**
 * Leituras de um dia que viram eventos (a chave é o `tipo` gravado em
 * financeiro.estacionamento_eventos).
 */
const ROTAS_DO_DIA = {
  cancela_manual_entrada: {
    rota: "entrada/manual/",
    schema: aberturasManuaisSchema,
  },
  cancela_manual_saida: {
    rota: "saida/manual/",
    schema: aberturasManuaisSchema,
  },
  pagamento_cancelado: {
    rota: "pagamentocancelado",
    schema: pagamentosCanceladosSchema,
  },
  devolucao_troco: { rota: "devolucaotroco", schema: devolucoesDeTrocoSchema },
  manutencao_patio: { rota: "manut_patio/", schema: limpezasDePatioSchema },
  desconto: { rota: "desconto", schema: descontosSchema },
  validacao: { rota: "validacao/", schema: validacoesSchema },
  abono_utilizado: { rota: "abono/utilizacao", schema: abonosUtilizadosSchema },
  abono_gerado: { rota: "abono/geracao", schema: abonosGeradosSchema },
  selo_utilizado: { rota: "selo/utilizacao/", schema: selosUtilizadosSchema },
  selo_gerado: { rota: "selo/geracao/", schema: selosGeradosSchema },
  manobra: { rota: "manobra/", schema: manobrasSchema },
} as const;

export type LeituraDoDia = keyof typeof ROTAS_DO_DIA;
export type RespostaDoDia<K extends LeituraDoDia> = z.infer<
  (typeof ROTAS_DO_DIA)[K]["schema"]
>;

/** O mesmo mapa, tipado por chave (para `doDia` devolver a resposta certa). */
export const LEITURAS_DO_DIA: {
  [K in LeituraDoDia]: {
    rota: string;
    schema: z.ZodType<RespostaDoDia<K>>;
  };
} = ROTAS_DO_DIA;

export function createWpsClient(config: WpsConfig) {
  const raiz = `${config.baseUrl.replace(/\/$/, "")}/servicos/operacional/estacionamento`;
  const base = `${raiz}/${config.estacionamentoId}`;
  const auth = Buffer.from(`${config.usuario}:${config.senha}`).toString(
    "base64",
  );
  const opts: RequestOptions = {
    headers: { Authorization: `Basic ${auth}` },
    fetch: config.fetch,
  };
  const comDetalhe: RequestOptions = {
    ...opts,
    query: { detalhe: "true" },
    timeoutMs: TEMPO_DAS_LISTAS_MS,
  };

  const acessos = async (data: Date, rota: string): Promise<AcessosDoDia> =>
    parseWith(
      SISTEMA,
      acessosDoDiaSchema,
      await requestJson(SISTEMA, `${base}/${dia(data)}/${rota}`, comDetalhe),
    );

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

    /** Com detalhe: cada entrada com hora, tipo de cliente e serviço. */
    entradas: (data: Date) => acessos(data, "entrada"),

    saidas: (data: Date) => acessos(data, "saida"),

    async doDia<K extends LeituraDoDia>(
      leitura: K,
      data: Date,
    ): Promise<RespostaDoDia<K>> {
      const { rota, schema } = LEITURAS_DO_DIA[leitura];
      const json = await requestJson(
        SISTEMA,
        `${base}/${dia(data)}/${rota}`,
        comDetalhe,
      );
      return parseWith(SISTEMA, schema, json);
    },

    /** Contratos de vaga (mensalistas e credenciados) como estão hoje. */
    async clientes() {
      const json = await requestJson(SISTEMA, `${base}/clientes/`, comDetalhe);
      return parseWith(SISTEMA, clientesSchema, json);
    },

    /** Quantos clientes com vaga a WPS conta (a lista com detalhe vem incompleta). */
    async totalDeClientes(tipo: "MENSALISTA" | "CREDENCIADO") {
      const json = await requestJson(SISTEMA, `${base}/clientes/`, {
        ...opts,
        query: { tipo },
      });
      return parseWith(SISTEMA, totalDeClientesSchema, json).quantidade;
    },

    /** Mensalidades com vencimento de `de` a `ate`. */
    async lancamentos(de: Date, ate: Date) {
      const json = await requestJson(
        SISTEMA,
        `${base}/${dia(de)}/lancamentos`,
        {
          ...comDetalhe,
          query: { detalhe: "true", dataFim: dia(ate) },
        },
      );
      return parseWith(SISTEMA, lancamentosSchema, json);
    },

    async garagens() {
      const json = await requestJson(SISTEMA, `${raiz}/garagens/`, opts);
      return parseWith(SISTEMA, garagensSchema, json);
    },

    async setores() {
      const json = await requestJson(SISTEMA, `${base}/setores/`, comDetalhe);
      return parseWith(SISTEMA, setoresSchema, json);
    },
  };
}

export type WpsClient = ReturnType<typeof createWpsClient>;
