import { z } from "zod";

// Integrações configuráveis. As gerais ficam em Administração › Integrações;
// as do Marketing (prefixo mkt_), em Marketing › Configurações › Integrações.
// Cada uma tem campos comuns (guardados abertos, para mostrar e editar) e um
// ou mais segredos (senha, token), que o servidor cifra antes de gravar e
// nunca devolve.

export const SISTEMAS = [
  "secullum",
  "wps",
  "diario_de_obras",
  "copiloto_rh",
  "mkt_meta_ads",
  "mkt_google_ads",
  "mkt_tiktok",
  "mkt_ga4",
  "mkt_rd_station",
  "mkt_redes_meta",
  "mkt_youtube",
  "mkt_google_perfil",
  "mkt_asana",
] as const;
export type Sistema = (typeof SISTEMAS)[number];

export interface Campo {
  nome: string;
  rotulo: string;
  ajuda?: string;
  tipo: "text" | "url" | "number";
  exemplo?: string;
  opcional?: boolean;
}

export interface Segredo {
  /** Nome no formulário e chave no JSON (quando há mais de um). */
  nome: string;
  rotulo: string;
  ajuda?: string;
  opcional?: boolean;
}

export interface DefinicaoIntegracao {
  nome: string;
  serve: string;
  modulo: "admin" | "marketing";
  campos: Campo[];
  segredos: Segredo[];
  /** Validação dos campos comuns (os segredos são validados à parte). */
  parametros: z.ZodType<Record<string, string | number>>;
}

const texto = z.string().trim().min(1, "obrigatório");

/** Id numérico; tira traços, espaços e prefixos como "act_" e "accounts/". */
const id = (prefixo?: RegExp) =>
  z
    .string()
    .trim()
    .transform((v) => (prefixo ? v.replace(prefixo, "") : v))
    .transform((v) => v.replace(/[-\s]/g, ""))
    .pipe(z.string().regex(/^\d+$/, "só números"));
const idOpcional = z
  .string()
  .trim()
  .transform((v) => v.replace(/[-\s]/g, ""))
  .pipe(z.string().regex(/^\d*$/, "só números"));

// OAuth do Google: o mesmo cliente (Google Cloud) pode servir a todas; o
// token de atualização sai do OAuth Playground com o escopo de cada uma.
const clienteGoogle: Campo = {
  nome: "client_id",
  rotulo: "Client ID (OAuth)",
  tipo: "text",
  exemplo: "…apps.googleusercontent.com",
  ajuda: "Google Cloud › APIs e serviços › Credenciais (app da Web)",
};
const segredosGoogle = (escopo: string): Segredo[] => [
  { nome: "client_secret", rotulo: "Client secret (OAuth)" },
  {
    nome: "refresh_token",
    rotulo: "Refresh token",
    ajuda: `Gerado no OAuth Playground com o Client ID acima e o escopo ${escopo}`,
  },
];
const tokenMeta: Segredo = {
  nome: "segredo",
  rotulo: "Token de acesso",
  ajuda:
    "Token de usuário do sistema (Business Manager › Usuários do sistema), sem validade",
};

export const INTEGRACOES: Record<Sistema, DefinicaoIntegracao> = {
  secullum: {
    nome: "Ponto (Secullum)",
    modulo: "admin",
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
    segredos: [{ nome: "segredo", rotulo: "Senha" }],
    parametros: z.object({
      usuario: texto,
      banco_id: z.string().trim().regex(/^\d+$/, "só números"),
    }),
  },
  wps: {
    nome: "Estacionamento (WPS)",
    modulo: "admin",
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
    segredos: [{ nome: "segredo", rotulo: "Senha" }],
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
    modulo: "admin",
    serve: "Obras, diários (RDO), mão de obra e ocorrências.",
    campos: [],
    segredos: [
      {
        nome: "segredo",
        rotulo: "Token da API",
        ajuda: "Token da empresa, fornecido pelo Diário de Obras",
      },
    ],
    parametros: z.object({}),
  },
  copiloto_rh: {
    nome: "Copiloto RH",
    modulo: "admin",
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
    segredos: [{ nome: "segredo", rotulo: "Senha (client_secret)" }],
    parametros: z.object({
      base_url: z
        .url({ protocol: /^https$/, error: "use um endereço https" })
        .transform((u) => u.replace(/\/+$/, "")),
      usuario: texto,
    }),
  },
  mkt_meta_ads: {
    nome: "Meta Ads",
    serve: "Facebook e Instagram: campanhas, gasto e resultados por dia.",
    modulo: "marketing",
    campos: [
      {
        nome: "ad_account_id",
        rotulo: "Id da conta de anúncios",
        tipo: "text",
        exemplo: "act_1234567890",
        ajuda: "Gerenciador de Anúncios › Configurações da conta",
      },
    ],
    segredos: [{ ...tokenMeta, ajuda: `${tokenMeta.ajuda}, com ads_read` }],
    parametros: z.object({ ad_account_id: id(/^act_/i) }),
  },
  mkt_google_ads: {
    nome: "Google Ads",
    serve: "Campanhas (inclui YouTube) e termos de pesquisa.",
    modulo: "marketing",
    campos: [
      {
        nome: "customer_id",
        rotulo: "Id do cliente",
        tipo: "text",
        exemplo: "123-456-7890",
        ajuda: "Número no topo do Google Ads, da conta que anuncia",
      },
      {
        nome: "login_customer_id",
        rotulo: "Id da conta de administrador (MCC)",
        tipo: "text",
        opcional: true,
        ajuda: "Só se o acesso vier por uma conta de administrador",
      },
      clienteGoogle,
    ],
    segredos: [
      {
        nome: "developer_token",
        rotulo: "Token de desenvolvedor",
        ajuda:
          "Google Ads › Ferramentas › Central de API (acesso básico ou acima)",
      },
      ...segredosGoogle("https://www.googleapis.com/auth/adwords"),
    ],
    parametros: z.object({
      customer_id: id(),
      login_customer_id: idOpcional,
      client_id: texto,
    }),
  },
  mkt_tiktok: {
    nome: "TikTok",
    serve: "Anúncios e, se houver, a conta Business (seguidores e vídeos).",
    modulo: "marketing",
    campos: [
      {
        nome: "advertiser_id",
        rotulo: "Id do anunciante",
        tipo: "text",
        ajuda: "TikTok Ads Manager, ao lado do nome da conta",
      },
      {
        nome: "business_id",
        rotulo: "Id da conta Business",
        tipo: "text",
        opcional: true,
        ajuda: "open_id da conta Business, devolvido quando a conta autoriza",
      },
    ],
    segredos: [
      {
        nome: "segredo",
        rotulo: "Token de acesso (Ads)",
        ajuda:
          "TikTok for Business › app de desenvolvedor, com leitura de relatórios",
      },
      {
        nome: "token_conta",
        rotulo: "Token da conta Business",
        opcional: true,
        ajuda: "Só para a conta Business; em branco, usa o token de Ads",
      },
    ],
    parametros: z.object({
      advertiser_id: id(),
      business_id: z.string().trim(),
    }),
  },
  mkt_ga4: {
    nome: "Google Analytics 4 e Search Console",
    serve: "Tráfego do site e buscas no Google.",
    modulo: "marketing",
    campos: [
      {
        nome: "property_id",
        rotulo: "Id da propriedade do GA4",
        tipo: "text",
        exemplo: "123456789",
        ajuda: "GA4 › Administrador › Detalhes da propriedade",
      },
      {
        nome: "site_url",
        rotulo: "Propriedade do Search Console",
        tipo: "text",
        exemplo: "sc-domain:arp.com.br",
        ajuda: "Como aparece no Search Console (domínio ou endereço com https)",
      },
      clienteGoogle,
    ],
    segredos: segredosGoogle(
      "analytics.readonly e webmasters.readonly (os dois juntos)",
    ),
    parametros: z.object({
      property_id: id(/^properties\//),
      site_url: z
        .string()
        .trim()
        .regex(
          /^(sc-domain:\S+|https?:\/\/\S+)$/,
          "use sc-domain:… ou https://…",
        ),
      client_id: texto,
    }),
  },
  mkt_rd_station: {
    nome: "RD Station Marketing",
    serve: "Leads, conversões e landing pages; base do custo por lead.",
    modulo: "marketing",
    campos: [
      {
        nome: "client_id",
        rotulo: "Client ID",
        tipo: "text",
        ajuda: "App criado na RD Station App Store (área do desenvolvedor)",
      },
    ],
    segredos: [
      { nome: "client_secret", rotulo: "Client secret" },
      {
        nome: "refresh_token",
        rotulo: "Refresh token",
        ajuda: "Devolvido quando a conta da ARP autoriza o app",
      },
    ],
    parametros: z.object({ client_id: texto }),
  },
  mkt_redes_meta: {
    nome: "Instagram e Facebook",
    serve: "Foto diária de seguidores, alcance e posts das contas da ARP.",
    modulo: "marketing",
    campos: [
      {
        nome: "page_id",
        rotulo: "Id da página do Facebook",
        tipo: "text",
        ajuda: "Página › Sobre › Transparência da página",
      },
      {
        nome: "instagram_id",
        rotulo: "Id da conta do Instagram",
        tipo: "text",
        ajuda:
          "Conta profissional ligada à página (instagram_business_account)",
      },
    ],
    segredos: [
      {
        ...tokenMeta,
        ajuda: `${tokenMeta.ajuda}, com pages_read_engagement, read_insights e instagram_manage_insights`,
      },
    ],
    parametros: z.object({ page_id: id(), instagram_id: id() }),
  },
  mkt_youtube: {
    nome: "YouTube",
    serve: "Inscritos, visualizações e vídeos do canal da ARP.",
    modulo: "marketing",
    campos: [
      {
        nome: "channel_id",
        rotulo: "Id do canal",
        tipo: "text",
        exemplo: "UC…",
        ajuda:
          "YouTube Studio › Configurações › Canal › Configurações avançadas",
      },
      clienteGoogle,
    ],
    segredos: segredosGoogle(
      "youtube.readonly e yt-analytics.readonly, com a conta dona do canal",
    ),
    parametros: z.object({
      channel_id: z
        .string()
        .trim()
        .regex(/^UC[\w-]{22}$/, "começa com UC e tem 24 caracteres"),
      client_id: texto,
    }),
  },
  mkt_google_perfil: {
    nome: "Google Perfil da Empresa",
    serve: "Avaliações da ARP e dos locatários que têm a ARP como gerente.",
    modulo: "marketing",
    campos: [
      {
        nome: "account_id",
        rotulo: "Id da conta do Perfil da Empresa",
        tipo: "text",
        exemplo: "accounts/123456789",
        ajuda: "Conta (grupo de locais) em que a ARP é proprietária ou gerente",
      },
      clienteGoogle,
    ],
    segredos: segredosGoogle("business.manage"),
    parametros: z.object({ account_id: id(/^accounts\//), client_id: texto }),
  },
  mkt_asana: {
    nome: "Asana",
    serve: "Tarefas, calendário de eventos e ronda.",
    modulo: "marketing",
    campos: [
      {
        nome: "workspace_gid",
        rotulo: "Id do workspace",
        tipo: "text",
        ajuda: "O teste lista os workspaces deste token se o id não bater",
      },
    ],
    segredos: [
      {
        nome: "segredo",
        rotulo: "Token de acesso pessoal",
        ajuda:
          "Asana › Meus aplicativos › Token de acesso pessoal, de um usuário que vê todos os projetos",
      },
    ],
    parametros: z.object({ workspace_gid: id() }),
  },
};

/**
 * Junta os segredos para cifrar: um só vai como texto (como sempre foi);
 * vários, como JSON, sem os vazios.
 */
export function juntarSegredos(
  def: DefinicaoIntegracao,
  valores: Record<string, string>,
): string {
  const [unico] = def.segredos;
  if (def.segredos.length === 1 && unico) return valores[unico.nome] ?? "";
  return JSON.stringify(
    Object.fromEntries(
      def.segredos
        .filter((s) => valores[s.nome])
        .map((s) => [s.nome, valores[s.nome]]),
    ),
  );
}

export function separarSegredos(
  def: DefinicaoIntegracao,
  segredo: string,
): Record<string, string> {
  const [unico] = def.segredos;
  if (def.segredos.length === 1 && unico) return { [unico.nome]: segredo };
  try {
    const r = z.record(z.string(), z.string()).safeParse(JSON.parse(segredo));
    return r.success ? r.data : {};
  } catch {
    return {};
  }
}

export function ehSistema(valor: unknown): valor is Sistema {
  return SISTEMAS.includes(valor as Sistema);
}
