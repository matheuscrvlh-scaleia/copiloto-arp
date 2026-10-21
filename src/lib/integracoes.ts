import { z } from "zod";

// Integrações configuráveis em Administração › Integrações. Cada uma tem
// campos comuns (guardados abertos, para mostrar e editar) e um segredo
// (senha ou token), que o servidor cifra antes de gravar e nunca devolve.

export const SISTEMAS = [
  "secullum",
  "wps",
  "diario_de_obras",
  "copiloto_rh",
] as const;
export type Sistema = (typeof SISTEMAS)[number];

export interface Campo {
  nome: string;
  rotulo: string;
  ajuda?: string;
  tipo: "text" | "url" | "number";
  exemplo?: string;
}

export interface DefinicaoIntegracao {
  nome: string;
  serve: string;
  campos: Campo[];
  segredo: { rotulo: string; ajuda?: string };
  /** Validação dos campos comuns (o segredo é validado à parte). */
  parametros: z.ZodType<Record<string, string | number>>;
}

const texto = z.string().trim().min(1, "obrigatório");

export const INTEGRACOES: Record<Sistema, DefinicaoIntegracao> = {
  secullum: {
    nome: "Ponto (Secullum)",
    serve: "Jornada, quadro e turnover do RH. Sincroniza todo dia às 6h.",
    campos: [
      {
        nome: "usuario",
        rotulo: "Usuário",
        tipo: "text",
        ajuda: "Login do Ponto Web com acesso à integração externa",
      },
      {
        nome: "banco_id",
        rotulo: "Id do banco",
        tipo: "text",
        ajuda: "O teste lista os bancos deste usuário se o id não bater",
      },
    ],
    segredo: { rotulo: "Senha" },
    parametros: z.object({
      usuario: texto,
      banco_id: z.string().trim().regex(/^\d+$/, "só números"),
    }),
  },
  wps: {
    nome: "Estacionamento (WPS)",
    serve: "Receita do estacionamento (pagamentos, entradas e saídas).",
    campos: [
      {
        nome: "base_url",
        rotulo: "Endereço da API",
        tipo: "url",
        exemplo: "https://…parkingplus.com.br",
      },
      { nome: "usuario", rotulo: "Usuário", tipo: "text" },
      {
        nome: "estacionamento_id",
        rotulo: "Id do estacionamento",
        tipo: "number",
      },
    ],
    segredo: { rotulo: "Senha" },
    parametros: z.object({
      base_url: z
        .url({ protocol: /^https$/, error: "use um endereço https" })
        .transform((u) => u.replace(/\/+$/, "")),
      usuario: texto,
      estacionamento_id: z.coerce
        .number({ error: "só números" })
        .int("só números")
        .positive("só números"),
    }),
  },
  diario_de_obras: {
    nome: "Diário de Obras",
    serve: "Obras, diários (RDO), mão de obra e ocorrências.",
    campos: [],
    segredo: {
      rotulo: "Token da API",
      ajuda: "Token da empresa, fornecido pelo Diário de Obras",
    },
    parametros: z.object({}),
  },
  copiloto_rh: {
    nome: "Copiloto RH",
    serve:
      "Nascimento, tipo de contrato, ativos, admissões, desligamentos e turnover do RH.",
    campos: [
      {
        nome: "base_url",
        rotulo: "Endereço da API",
        tipo: "url",
        exemplo: "https://…/functions/v1/public-api",
        ajuda: "O endereço que aparece na documentação da API do Copiloto",
      },
      {
        nome: "usuario",
        rotulo: "Usuário (client_id)",
        tipo: "text",
        ajuda:
          "Credencial criada no Copiloto em Configurações › Integrações › API pública",
      },
    ],
    segredo: { rotulo: "Senha (client_secret)" },
    parametros: z.object({
      base_url: z
        .url({ protocol: /^https$/, error: "use um endereço https" })
        .transform((u) => u.replace(/\/+$/, "")),
      usuario: texto,
    }),
  },
};

export function ehSistema(valor: unknown): valor is Sistema {
  return SISTEMAS.includes(valor as Sistema);
}
