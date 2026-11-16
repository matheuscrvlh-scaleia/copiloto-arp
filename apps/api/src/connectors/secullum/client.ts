import { z } from "zod";
import {
  ConnectorError,
  parseWith,
  type RequestOptions,
  requestJson,
} from "../http";
import {
  afastamentoSchema,
  bancoSchema,
  type Calculo,
  calculoSchema,
  departamentoSchema,
  funcionarioSchema,
  motivoDemissaoSchema,
  tokenSchema,
} from "./schemas";

const SISTEMA = "secullum";
const AUTH_URL = "https://autenticador.secullum.com.br";
const API_URL =
  "https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna";

export interface SecullumConfig {
  usuario: string;
  senha: string;
  /** Id do banco do Ponto Web (ver `listarBancos`). */
  bancoId: string;
  fetch?: typeof fetch;
}

export interface Periodo {
  /** aaaa-mm-dd */
  inicio: string;
  /** aaaa-mm-dd */
  fim: string;
}

/** O manual limita /Calcular a um mês por consulta. */
function assertPeriodoDeUmMes({ inicio, fim }: Periodo) {
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fim}T00:00:00Z`);
  const limite = new Date(a);
  limite.setUTCMonth(limite.getUTCMonth() + 1);
  if (!(b >= a && b < limite)) {
    throw new ConnectorError(
      `período ${inicio}..${fim} inválido: /Calcular aceita no máximo um mês`,
      SISTEMA,
    );
  }
}

/**
 * Cliente só de leitura. A API também aceita POST/DELETE de cadastros,
 * mas o sistema nunca escreve no ponto.
 *
 * Limite: /Calcular e /Calcular/SomenteTotais aceitam 100 requisições por
 * hora por banco, e cada chamada é de um funcionário.
 */
export function createSecullumClient(config: SecullumConfig) {
  let token: { valor: string; expiraEm: number } | null = null;
  // Requisições ao /Calcular feitas por este cliente (contam no limite/hora).
  let chamadasCalcular = 0;

  async function autenticar(): Promise<string> {
    const json = await requestJson(SISTEMA, `${AUTH_URL}/Token`, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "password",
        username: config.usuario,
        password: config.senha,
        client_id: "3",
      }),
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
    opts: Pick<RequestOptions, "method" | "query" | "body" | "retries"> = {},
  ): Promise<z.infer<T>> {
    const call = async () =>
      requestJson(SISTEMA, `${API_URL}/${rota}`, {
        ...opts,
        // Os limites do Secullum são por hora: repetir o 429 só gasta cota.
        repetirEm429: false,
        headers: {
          Authorization: `Bearer ${await bearer()}`,
          secullumidbancoselecionado: config.bancoId,
        },
        fetch: config.fetch,
      });
    let json: unknown;
    try {
      json = await call();
    } catch (err) {
      // Token revogado ou expirado antes do previsto: renova uma vez.
      if (!(err instanceof ConnectorError && err.status === 401)) throw err;
      token = null;
      json = await call();
    }
    return parseWith(SISTEMA, schema, json);
  }

  return {
    /** Bancos (bases do Ponto Web) da conta. Usado só na configuração. */
    async listarBancos() {
      const json = await requestJson(
        SISTEMA,
        `${AUTH_URL}/ContasSecullumExterno/ListarBancos`,
        {
          headers: { Authorization: `Bearer ${await bearer()}` },
          fetch: config.fetch,
        },
      );
      return parseWith(SISTEMA, z.array(bancoSchema), json);
    },

    departamentos: () => get("Departamentos", z.array(departamentoSchema)),

    /** Dado protegido pela LGPD: exige autorização do administrador do ponto. */
    funcionarios: () => get("Funcionarios", z.array(funcionarioSchema)),

    motivosDemissao: () =>
      get("MotivosDemissao", z.array(motivoDemissaoSchema)),

    /** O período é obrigatório: sem ele a API responde 400. */
    afastamentos: ({ inicio, fim }: Periodo) =>
      get("FuncionariosAfastamentos", z.array(afastamentoSchema), {
        query: { dataInicio: inicio, dataFim: fim },
      }),

    /**
     * Cálculos do ponto (faltas, atrasos, banco de horas…) de um funcionário.
     * Tenta pelo CPF e, se a API não achar a pessoa (cadastro com CPF fora do
     * padrão), pelo PIS. Cada tentativa conta no limite de 100 por hora.
     */
    async calcular(
      funcionario: { cpf?: string | null; pis?: string | null },
      periodo: Periodo,
    ): Promise<Calculo> {
      assertPeriodoDeUmMes(periodo);
      const datas = { DataInicial: periodo.inicio, DataFinal: periodo.fim };
      const tentativas = [
        funcionario.cpf && { FuncionarioCpf: funcionario.cpf, ...datas },
        funcionario.pis && { FuncionarioPis: funcionario.pis, ...datas },
      ].filter(Boolean);
      if (tentativas.length === 0) {
        throw new ConnectorError("funcionário sem CPF e sem PIS", SISTEMA);
      }

      let ultimoErro: unknown;
      for (const body of tentativas) {
        try {
          chamadasCalcular++;
          // Sem retry: cada repetição gastaria cota do limite por hora.
          return await get("Calcular", calculoSchema, {
            method: "POST",
            body,
            retries: 0,
          });
        } catch (erro) {
          if (!(erro instanceof ConnectorError && erro.status === 400))
            throw erro;
          ultimoErro = erro;
        }
      }
      throw ultimoErro;
    },

    /** Quantas requisições ao /Calcular este cliente já fez. */
    chamadasCalcular: () => chamadasCalcular,
  };
}

/** Limite do /Calcular por banco e por hora (manual da Secullum). */
export const LIMITE_CALCULAR_POR_HORA = 100;

export type SecullumClient = ReturnType<typeof createSecullumClient>;
