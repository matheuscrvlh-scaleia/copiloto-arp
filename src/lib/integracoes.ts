import { z } from "zod";

// Integrações configuráveis. As gerais ficam em Administração › Integrações;
// as do Marketing (prefixo mkt_), em Marketing › Configurações › Integrações.
// Cada uma tem campos comuns (guardados abertos, para mostrar e editar) e um
// ou mais segredos (senha, token), que o servidor cifra antes de gravar e
// nunca devolve. Endereço público (o site) não tem segredo.

export const SISTEMAS = [
  "secullum",
  "wps",
  "diario_de_obras",
  "copiloto_rh",
  "mkt_google",
  "mkt_meta",
  "mkt_tiktok",
  "mkt_rd_station",
  "mkt_asana",
  "mkt_site",
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

/** Id numérico sem traços, espaços e prefixos como "act_" e "accounts/". */
const limparId = (prefixo?: RegExp) =>
  z
    .string()
    .trim()
    .transform((v) => (prefixo ? v.replace(prefixo, "") : v))
    .transform((v) => v.replace(/[-\s]/g, ""));
const id = (prefixo?: RegExp) =>
  limparId(prefixo).pipe(z.string().regex(/^\d+$/, "só números"));
const idOpcional = (prefixo?: RegExp) =>
  limparId(prefixo).pipe(z.string().regex(/^\d*$/, "só números"));

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
  mkt_google: {
    nome: "Google",
    serve:
      "Google Ads, Analytics 4, Search Console, YouTube e Perfil da Empresa com um login só. Preencha o id dos produtos que a ARP usa; cada um é testado à parte.",
    modulo: "marketing",
    campos: [
      {
        nome: "client_id",
        rotulo: "Client ID (OAuth)",
        tipo: "text",
        exemplo: "…apps.googleusercontent.com",
        ajuda: "Google Cloud › APIs e serviços › Credenciais (app da Web)",
      },
      {
        nome: "customer_id",
        rotulo: "Google Ads: id do cliente",
        tipo: "text",
        exemplo: "123-456-7890",
        opcional: true,
        ajuda: "Número no topo do Google Ads, da conta que anuncia",
      },
      {
        nome: "login_customer_id",
        rotulo: "Google Ads: id da conta de administrador (MCC)",
        tipo: "text",
        opcional: true,
        ajuda: "Só se o acesso vier por uma conta de administrador",
      },
      {
        nome: "property_id",
        rotulo: "Analytics 4: id da propriedade",
        tipo: "text",
        exemplo: "123456789",
        opcional: true,
        ajuda: "GA4 › Administrador › Detalhes da propriedade",
      },
      {
        nome: "site_url",
        rotulo: "Search Console: propriedade",
        tipo: "text",
        exemplo: "sc-domain:espacoarp.com.br",
        opcional: true,
        ajuda: "Como aparece no Search Console (domínio ou endereço com https)",
      },
      {
        nome: "channel_id",
        rotulo: "YouTube: id do canal",
        tipo: "text",
        exemplo: "UC…",
        opcional: true,
        ajuda:
          "YouTube Studio › Configurações › Canal › Configurações avançadas",
      },
      {
        nome: "account_id",
        rotulo: "Perfil da Empresa: id da conta",
        tipo: "text",
        exemplo: "accounts/123456789",
        opcional: true,
        ajuda: "Conta (grupo de locais) em que a ARP é proprietária ou gerente",
      },
    ],
    segredos: [
      { nome: "client_secret", rotulo: "Client secret (OAuth)" },
      {
        nome: "refresh_token",
        rotulo: "Refresh token",
        ajuda:
          "OAuth Playground com o Client ID acima, os escopos adwords, analytics.readonly, webmasters.readonly, youtube.readonly, yt-analytics.readonly e business.manage, e uma conta Google com acesso a todos os produtos",
      },
      {
        nome: "developer_token",
        rotulo: "Google Ads: token de desenvolvedor",
        opcional: true,
        ajuda:
          "Só para o Google Ads: Ferramentas › Central de API (acesso básico ou acima)",
      },
    ],
    parametros: z
      .object({
        client_id: texto,
        customer_id: idOpcional(),
        login_customer_id: idOpcional(),
        property_id: idOpcional(/^properties\//),
        site_url: z
          .string()
          .trim()
          .regex(
            /^(|sc-domain:\S+|https?:\/\/\S+)$/,
            "use sc-domain:… ou https://…",
          ),
        channel_id: z
          .string()
          .trim()
          .regex(/^(|UC[\w-]{22})$/, "começa com UC e tem 24 caracteres"),
        account_id: idOpcional(/^accounts\//),
      })
      .refine(
        (p) =>
          [
            p.customer_id,
            p.property_id,
            p.site_url,
            p.channel_id,
            p.account_id,
          ].some(Boolean),
        "preencha o id de pelo menos um produto",
      ),
  },
  mkt_meta: {
    nome: "Meta",
    serve:
      "Meta Ads, Instagram e Facebook com um token só. Preencha o id do que a ARP usa; cada um é testado à parte.",
    modulo: "marketing",
    campos: [
      {
        nome: "ad_account_id",
        rotulo: "Meta Ads: id da conta de anúncios",
        tipo: "text",
        exemplo: "act_1234567890",
        opcional: true,
        ajuda: "Gerenciador de Anúncios › Configurações da conta",
      },
      {
        nome: "page_id",
        rotulo: "Facebook: id da página",
        tipo: "text",
        opcional: true,
        ajuda: "Página › Sobre › Transparência da página",
      },
      {
        nome: "instagram_id",
        rotulo: "Instagram: id da conta profissional",
        tipo: "text",
        opcional: true,
        ajuda: "Conta ligada à página (instagram_business_account)",
      },
    ],
    segredos: [
      {
        nome: "segredo",
        rotulo: "Token de acesso",
        ajuda:
          "Token de usuário do sistema (Business Manager › Usuários do sistema), sem validade, com ads_read, pages_read_engagement, read_insights, instagram_basic e instagram_manage_insights",
      },
    ],
    parametros: z
      .object({
        ad_account_id: idOpcional(/^act_/i),
        page_id: idOpcional(),
        instagram_id: idOpcional(),
      })
      .refine(
        (p) => [p.ad_account_id, p.page_id, p.instagram_id].some(Boolean),
        "preencha o id de pelo menos um produto",
      ),
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
  mkt_site: {
    nome: "Site (agenda de eventos)",
    serve:
      "Eventos publicados no site da ARP (WordPress). Endereço público, sem login; a agenda é relida a cada hora.",
    modulo: "marketing",
    campos: [
      {
        nome: "endpoint",
        rotulo: "Endereço da lista de eventos",
        tipo: "url",
        exemplo:
          "https://www.espacoarp.com.br/wp-json/wp/v2/evento?per_page=100&_embed=wp:featuredmedia",
        ajuda:
          "API do WordPress do site. O sistema troca só a página (page=); os outros parâmetros ficam como estão",
      },
    ],
    segredos: [],
    parametros: z.object({
      endpoint: z.url({ protocol: /^https$/, error: "use um endereço https" }),
    }),
  },
};

/**
 * Produtos de uma conexão que serve a vários (um login do Google, um token da
 * Meta). Cada um é testado à parte e vira uma linha da mensagem do teste.
 */
export const PRODUTOS = {
  mkt_google: [
    "Google Ads",
    "Analytics 4",
    "Search Console",
    "YouTube",
    "Perfil da Empresa",
  ],
  mkt_meta: ["Meta Ads", "Facebook", "Instagram"],
} as const;

export function linhaDoProduto(
  produto: string,
  ok: boolean,
  texto: string,
): string {
  return `${ok ? "✓" : "✗"} ${produto}: ${texto}`;
}

/** O produto no último teste: true, false ou null (não testado/sem id). */
export function resultadoDoProduto(
  mensagem: string | null,
  produto: string,
): boolean | null {
  for (const l of (mensagem ?? "").split("\n")) {
    if (l.startsWith(linhaDoProduto(produto, true, ""))) return true;
    if (l.startsWith(linhaDoProduto(produto, false, ""))) return false;
  }
  return null;
}

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
