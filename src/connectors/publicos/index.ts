import { z } from "zod";
import { ConnectorError, parseWith, requestJson } from "../http";

// Serviços públicos e gratuitos, sem cadastro (spec 4.3): CEP (BrasilAPI,
// ViaCEP de reserva), CNPJ e feriados nacionais (BrasilAPI) e os índices
// IGP-M e IPCA (Banco Central, SGS). Timeout curto: quem chama mostra o
// formulário mesmo se o serviço cair (a falha vira erro, nunca trava).

const TIMEOUT_MS = 4000;
const BRASILAPI = "https://brasilapi.com.br/api";

export interface Opcoes {
  fetch?: typeof fetch;
}

// A BrasilAPI (Cloudflare) recusa com 403 o User-Agent padrão do Node.
const CABECALHOS = { "User-Agent": "ARP-Centralizador/1.0" };

const pedir = (sistema: string, url: string, o: Opcoes, retries = 1) =>
  requestJson(sistema, url, {
    headers: CABECALHOS,
    timeoutMs: TIMEOUT_MS,
    retries,
    fetch: o.fetch,
  });

const texto = z
  .string()
  .nullish()
  .transform((v) => v?.trim() ?? "");

// ---------------------------------------------------------------------------
// CEP
// ---------------------------------------------------------------------------

export interface Endereco {
  /** Só dígitos. */
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

const cepBrasilApi = z.object({
  cep: z.string(),
  state: z.string(),
  city: z.string(),
  neighborhood: texto,
  street: texto,
});

const cepViaCep = z.union([
  z.object({ erro: z.union([z.literal(true), z.literal("true")]) }),
  z.object({
    cep: z.string(),
    logradouro: texto,
    bairro: texto,
    localidade: z.string(),
    uf: z.string(),
  }),
]);

/**
 * Endereço do CEP (8 dígitos). BrasilAPI v2 com uma nova tentativa; se
 * falhar, o ViaCEP. null quando o CEP não existe.
 */
export async function buscarCep(
  cep: string,
  o: Opcoes = {},
): Promise<Endereco | null> {
  if (!/^\d{8}$/.test(cep)) throw new Error("CEP com 8 dígitos");
  try {
    const r = parseWith(
      "BrasilAPI CEP",
      cepBrasilApi,
      await pedir("BrasilAPI CEP", `${BRASILAPI}/cep/v2/${cep}`, o),
    );
    return {
      cep,
      logradouro: r.street,
      bairro: r.neighborhood,
      cidade: r.city,
      uf: r.state,
    };
  } catch (erro) {
    if (erro instanceof ConnectorError && erro.status === 404) return null;
  }
  const v = parseWith(
    "ViaCEP",
    cepViaCep,
    await pedir("ViaCEP", `https://viacep.com.br/ws/${cep}/json/`, o, 0),
  );
  if ("erro" in v) return null;
  return {
    cep,
    logradouro: v.logradouro,
    bairro: v.bairro,
    cidade: v.localidade,
    uf: v.uf,
  };
}

// ---------------------------------------------------------------------------
// CNPJ
// ---------------------------------------------------------------------------

export interface Socio {
  nome: string;
  qualificacao: string;
}

export interface Empresa {
  /** Só dígitos. */
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  naturezaJuridica: string;
  /** "4781400 - Comércio varejista de artigos do vestuário e acessórios". */
  cnaePrincipal: string;
  capitalSocial: number | null;
  situacao: string;
  endereco: Endereco & { numero: string; complemento: string };
  socios: Socio[];
}

const cnpjBrasilApi = z.object({
  cnpj: z.string(),
  razao_social: z.string(),
  nome_fantasia: texto,
  natureza_juridica: texto,
  cnae_fiscal: z.union([z.number(), z.string()]).nullish(),
  cnae_fiscal_descricao: texto,
  capital_social: z.union([z.number(), z.string()]).nullish(),
  descricao_situacao_cadastral: texto,
  descricao_tipo_de_logradouro: texto,
  logradouro: texto,
  numero: texto,
  complemento: texto,
  bairro: texto,
  municipio: texto,
  uf: texto,
  cep: z.union([z.number(), z.string()]).nullish(),
  qsa: z
    .array(z.object({ nome_socio: z.string(), qualificacao_socio: texto }))
    .nullish(),
});

/** Dados públicos do CNPJ (14 dígitos). null quando não existe. */
export async function buscarCnpj(
  cnpj: string,
  o: Opcoes = {},
): Promise<Empresa | null> {
  if (!/^\d{14}$/.test(cnpj)) throw new Error("CNPJ com 14 dígitos");
  let dados: unknown;
  try {
    dados = await pedir("BrasilAPI CNPJ", `${BRASILAPI}/cnpj/v1/${cnpj}`, o);
  } catch (erro) {
    if (erro instanceof ConnectorError && erro.status === 404) return null;
    throw erro;
  }
  const r = parseWith("BrasilAPI CNPJ", cnpjBrasilApi, dados);
  const capital = r.capital_social == null ? null : Number(r.capital_social);
  const rua = [r.descricao_tipo_de_logradouro, r.logradouro]
    .filter(Boolean)
    .join(" ");
  return {
    cnpj,
    razaoSocial: r.razao_social.trim(),
    nomeFantasia: r.nome_fantasia,
    naturezaJuridica: r.natureza_juridica,
    cnaePrincipal: [r.cnae_fiscal, r.cnae_fiscal_descricao]
      .filter((v) => v !== null && v !== undefined && v !== "")
      .join(" - "),
    capitalSocial: Number.isFinite(capital) ? capital : null,
    situacao: r.descricao_situacao_cadastral,
    endereco: {
      cep: String(r.cep ?? "")
        .replace(/\D/g, "")
        .padStart(8, "0"),
      logradouro: rua,
      numero: r.numero,
      complemento: r.complemento,
      bairro: r.bairro,
      cidade: r.municipio,
      uf: r.uf,
    },
    socios: (r.qsa ?? []).map((s) => ({
      nome: s.nome_socio.trim(),
      qualificacao: s.qualificacao_socio,
    })),
  };
}

// ---------------------------------------------------------------------------
// Feriados nacionais
// ---------------------------------------------------------------------------

export interface Feriado {
  /** aaaa-mm-dd */
  data: string;
  nome: string;
}

const feriadosBrasilApi = z.array(
  z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    name: z.string(),
  }),
);

export async function buscarFeriados(
  ano: number,
  o: Opcoes = {},
): Promise<Feriado[]> {
  if (!Number.isInteger(ano) || ano < 1900 || ano > 2199)
    throw new Error("Ano fora do intervalo da BrasilAPI");
  const r = parseWith(
    "BrasilAPI feriados",
    feriadosBrasilApi,
    await pedir("BrasilAPI feriados", `${BRASILAPI}/feriados/v1/${ano}`, o),
  );
  return r.map((f) => ({ data: f.date, nome: f.name }));
}

// ---------------------------------------------------------------------------
// Índices do Banco Central (SGS): variação mensal em %
// ---------------------------------------------------------------------------

export const SERIES_SGS = { IGPM: 189, IPCA: 433 } as const;
export type IndiceSgs = keyof typeof SERIES_SGS;

export interface ValorMensal {
  /** "aaaa-mm-01". */
  competencia: string;
  /** Variação no mês, em %. */
  variacao: number;
}

export interface Acumulado {
  indice: IndiceSgs;
  /** Último mês com valor publicado ("aaaa-mm-01"). */
  ate: string;
  /** Acumulado dos 12 meses até `ate`, em %. */
  acumulado12m: number;
  meses: ValorMensal[];
}

const sgs = z.array(
  z.object({
    data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    valor: z.string().regex(/^-?\d+(\.\d+)?$/),
  }),
);

/** Os últimos `n` meses publicados da série, do mais antigo ao mais novo. */
export async function buscarIndice(
  indice: IndiceSgs,
  n = 12,
  o: Opcoes = {},
): Promise<ValorMensal[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SERIES_SGS[indice]}/dados/ultimos/${n}?formato=json`;
  const r = parseWith(
    `Banco Central ${indice}`,
    sgs,
    await pedir(`Banco Central ${indice}`, url, o),
  );
  return r
    .map((v) => {
      const [, m, a] = v.data.split("/");
      return { competencia: `${a}-${m}-01`, variacao: Number(v.valor) };
    })
    .sort((a, b) => a.competencia.localeCompare(b.competencia));
}

/** Acumulado composto de 12 meses: (1 + v1) × … × (1 + v12) − 1, em %. */
export function acumular(meses: ValorMensal[]): number {
  const fator = meses.reduce((f, m) => f * (1 + m.variacao / 100), 1);
  return Math.round((fator - 1) * 1e6) / 1e4;
}

/** IGP-M ou IPCA dos últimos 12 meses publicados, com o acumulado. */
export async function acumulado12Meses(
  indice: IndiceSgs,
  o: Opcoes = {},
): Promise<Acumulado> {
  const meses = await buscarIndice(indice, 12, o);
  if (meses.length < 12)
    throw new ConnectorError("série incompleta", `Banco Central ${indice}`);
  return {
    indice,
    ate: meses.at(-1)?.competencia as string,
    acumulado12m: acumular(meses),
    meses,
  };
}
