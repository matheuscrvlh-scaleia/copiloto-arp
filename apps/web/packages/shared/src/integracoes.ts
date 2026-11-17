import { z } from "zod";

// Integrações configuráveis. As gerais (e as que mais de um módulo usa, como
// o RD Station) ficam em Administração › Integrações; as só do Marketing
// (prefixo mkt_), em Marketing › Configurações › Integrações.
// Cada uma tem campos comuns (guardados abertos, para mostrar e editar) e um
// ou mais segredos (senha, token), que o servidor cifra antes de gravar e
// nunca devolve. Endereço público (o site) não tem segredo.

export const SISTEMAS = [
  "secullum",
  "wps",
  "diario_de_obras",
  "copiloto_rh",
  "rd_crm",
  "cameras",
  "mkt_google",
  "mkt_youtube",
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
  /** Só o botão Conectar preenche: fica oculto no formulário, com o salvo. */
  gerado?: boolean;
  /** Lista com o que a conta conectada acessa, em vez de digitar o id. */
  escolha?: boolean;
}

export interface Segredo {
  /** Nome no formulário e chave no JSON (quando há mais de um). */
  nome: string;
  rotulo: string;
  ajuda?: string;
  opcional?: boolean;
  /** Só o botão Conectar preenche: fora do formulário (o salvo continua). */
  gerado?: boolean;
}

export interface DefinicaoIntegracao {
  nome: string;
  serve: string;
  modulo: "admin" | "marketing";
  campos: Campo[];
  segredos: Segredo[];
  /** Validação dos campos comuns (os segredos são validados à parte). */
  parametros: z.ZodType<Record<string, string | number>>;
  /**
   * Botão que leva à tela de autorização da ferramenta (OAuth): ela volta
   * para o sistema com um code, que vira o segredo `segredo`. O app é
   * identificado pelo campo `campo` e pelo segredo `credencial`, deste
   * acesso ou, com `appDe`, do acesso indicado (já salvo).
   */
  autorizar?: {
    rotulo: string;
    segredo: string;
    campo: string;
    credencial: string;
    appDe?: Sistema;
    explicacao: string;
  };
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
  cameras: {
    nome: "Câmeras (contagem de pessoas)",
    modulo: "admin",
    serve:
      "Entradas e saídas de pessoas que as câmeras Intelbras enviam sozinhas. Em cada câmera: Contagem de Pessoas › Enviar para servidor, com o endereço, o usuário e a senha daqui.",
    campos: [
      {
        nome: "usuario",
        rotulo: "Usuário",
        tipo: "text",
        ajuda:
          "O mesmo usuário configurado nas câmeras (não é o login da câmera)",
      },
      {
        nome: "heartbeat_min",
        rotulo: "Heartbeat (min)",
        tipo: "number",
        ajuda:
          "Intervalo do heartbeat configurado nas câmeras. Sem contato por 3 intervalos, a câmera fica sem comunicação",
        exemplo: "5",
      },
    ],
    segredos: [
      {
        nome: "segredo",
        rotulo: "Senha",
        ajuda: "A mesma configurada nas câmeras",
      },
    ],
    parametros: z.object({
      usuario: texto,
      heartbeat_min: z.coerce
        .number({ error: "só números" })
        .int("só números")
        .min(1, "no mínimo 1")
        .max(1440, "no máximo 1440"),
    }),
  },
  rd_crm: {
    nome: "RD Station CRM",
    modulo: "admin",
    serve:
      "Oportunidades, funis, etapas, motivos de perda e responsáveis. Alimenta o Funil comercial e os leads do Painel comercial.",
    campos: [
      {
        nome: "client_id",
        rotulo: "Client ID",
        tipo: "text",
        ajuda:
          "App do RD Station CRM criado na RD Station App Store (o app do Marketing não abre o CRM)",
      },
    ],
    segredos: [
      { nome: "client_secret", rotulo: "Client secret" },
      {
        nome: "refresh_token",
        rotulo: "Refresh token",
        opcional: true,
        gerado: true,
      },
    ],
    parametros: z.object({ client_id: texto }),
    autorizar: {
      rotulo: "Conectar com o RD Station CRM",
      segredo: "refresh_token",
      campo: "client_id",
      credencial: "client_secret",
      explicacao:
        "Com o Client ID e o secret do app do CRM preenchidos, este botão salva os dois e abre a autorização no RD. Na volta, o sistema guarda o acesso e lê as oportunidades todo dia (e em Sincronizar agora).",
    },
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
      "Google Ads, Analytics 4, Search Console e Perfil da Empresa com um login só (o YouTube tem cartão próprio: o canal está em outra conta). Depois de conectar, escolha o que a ARP usa em cada produto; cada um é testado à parte.",
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
        rotulo: "Google Ads: conta",
        tipo: "text",
        opcional: true,
        escolha: true,
      },
      {
        nome: "property_id",
        rotulo: "Analytics 4: propriedade",
        tipo: "text",
        opcional: true,
        escolha: true,
      },
      {
        nome: "site_url",
        rotulo: "Search Console: propriedade",
        tipo: "text",
        opcional: true,
        escolha: true,
      },
      {
        nome: "account_id",
        rotulo: "Perfil da Empresa: conta",
        tipo: "text",
        opcional: true,
        escolha: true,
      },
    ],
    segredos: [
      { nome: "client_secret", rotulo: "Client secret (OAuth)" },
      {
        nome: "refresh_token",
        rotulo: "Refresh token",
        opcional: true,
        gerado: true,
      },
    ],
    parametros: z
      .object({
        client_id: texto,
        // A lista manda "conta@mcc" quando o acesso é pela MCC.
        customer_id: z
          .string()
          .trim()
          .regex(/^(\d+(@\d+)?)?$/, "conta inválida"),
        login_customer_id: idOpcional().default(""),
        property_id: idOpcional(/^properties\//),
        site_url: z
          .string()
          .trim()
          .regex(
            /^(|sc-domain:\S+|https?:\/\/\S+)$/,
            "use sc-domain:… ou https://…",
          ),
        account_id: idOpcional(/^accounts\//),
      })
      .transform((p) => {
        const [conta = "", mcc] = p.customer_id.split("@");
        return mcc === undefined
          ? p
          : { ...p, customer_id: conta, login_customer_id: mcc };
      }),
    autorizar: {
      rotulo: "Conectar com o Google",
      segredo: "refresh_token",
      campo: "client_id",
      credencial: "client_secret",
      explicacao:
        "Com o Client ID e o secret preenchidos, este botão salva o que foi digitado e abre a autorização do Google. Entre com uma conta Google que tenha acesso a todos os produtos. Depois de autorizar, o sistema gera e salva o refresh token sozinho.",
    },
  },
  mkt_youtube: {
    nome: "YouTube",
    serve:
      "Canal da ARP: inscritos, visualizações e vídeos. Fica à parte do Google porque o canal está em outra conta Google.",
    modulo: "marketing",
    // O app OAuth (Client ID e secret) é o do cartão do Google: aqui só o
    // login da conta do canal.
    campos: [
      {
        nome: "channel_id",
        rotulo: "Canal",
        tipo: "text",
        opcional: true,
        escolha: true,
      },
    ],
    segredos: [
      {
        nome: "refresh_token",
        rotulo: "Refresh token",
        opcional: true,
        gerado: true,
      },
    ],
    parametros: z.object({
      channel_id: z
        .string()
        .trim()
        .regex(/^(|UC[\w-]{22})$/, "começa com UC e tem 24 caracteres")
        .default(""),
    }),
    autorizar: {
      rotulo: "Conectar com o YouTube",
      segredo: "refresh_token",
      campo: "client_id",
      credencial: "client_secret",
      appDe: "mkt_google",
      explicacao:
        "Usa o Client ID e o secret já salvos no cartão do Google. Entre com a conta Google dona do canal, não com a dos outros produtos. Depois de autorizar, o sistema gera e salva o refresh token e lista os canais da conta.",
    },
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
    serve: "Anúncios (gasto, alcance e resultados por campanha).",
    modulo: "marketing",
    campos: [
      {
        nome: "app_id",
        rotulo: "App ID",
        tipo: "text",
        ajuda: "App criado no TikTok for Business Developers (My Apps)",
      },
      {
        nome: "advertiser_id",
        rotulo: "Id do anunciante",
        tipo: "text",
        opcional: true,
        gerado: true,
      },
    ],
    segredos: [
      { nome: "app_secret", rotulo: "App secret" },
      {
        nome: "segredo",
        rotulo: "Token de acesso (Ads)",
        opcional: true,
        gerado: true,
      },
    ],
    parametros: z.object({
      app_id: z.string().trim().default(""),
      advertiser_id: idOpcional().default(""),
    }),
    autorizar: {
      rotulo: "Conectar com o TikTok",
      segredo: "segredo",
      campo: "app_id",
      credencial: "app_secret",
      explicacao:
        "Com o App ID e o secret preenchidos, este botão salva os dois e abre a autorização no TikTok. Quem tem acesso à conta de anúncios aprova a leitura, e o sistema salva sozinho o anunciante e o token de Ads.",
    },
  },
  mkt_rd_station: {
    nome: "RD Station Marketing",
    serve:
      "Leads, conversões e landing pages. Usado pelo Marketing (custo por lead, site e leads) e pelo Comercial (landing page de origem de cada oportunidade).",
    modulo: "admin",
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
        opcional: true,
        gerado: true,
      },
    ],
    parametros: z.object({ client_id: texto }),
    autorizar: {
      rotulo: "Conectar com o RD Station",
      segredo: "refresh_token",
      campo: "client_id",
      credencial: "client_secret",
      explicacao:
        "Com o Client ID e o secret preenchidos, este botão salva os dois e abre a autorização no RD. Depois de autorizar, o sistema gera e salva o refresh token sozinho.",
    },
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
    "Conta Google",
    "Google Ads",
    "Analytics 4",
    "Search Console",
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

/**
 * Autorização do RD Station: a URL de callback cadastrada no app é a raiz do
 * sistema; o proxy manda o code que chega lá (com o state que começa com o
 * prefixo) para a rota de retorno.
 */
export const AUTORIZACAO_RD = {
  retorno: "/api/integracoes/rd-station/retorno",
  prefixoState: "rd.",
} as const;

/** "/?code=…&state=rd.…" → caminho da rota de retorno com os dois; senão null. */
export function retornoDoRd(url: URL): string | null {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (
    url.pathname !== "/" ||
    !code ||
    !state?.startsWith(AUTORIZACAO_RD.prefixoState)
  )
    return null;
  return `${AUTORIZACAO_RD.retorno}?${new URLSearchParams({ code, state })}`;
}

/** Resultado da volta da autorização, com o texto que a tela mostra. */
export const RETORNO_RD = {
  conectado: {
    ok: true,
    texto: "RD Station conectado: o refresh token foi gerado e salvo.",
  },
  teste: {
    ok: false,
    texto:
      "Autorizado e salvo, mas o teste da conexão falhou (veja o cartão do RD).",
  },
  permissao: {
    ok: false,
    texto: "Você não tem permissão para configurar integrações.",
  },
  state: {
    ok: false,
    texto:
      "A autorização expirou ou não começou neste navegador. Clique em Conectar com o RD Station de novo.",
  },
  credencial: {
    ok: false,
    texto: "Salve o Client ID e o Client secret antes de conectar.",
  },
  codigo: {
    ok: false,
    texto:
      "O RD recusou o código (expirado, já usado ou de outro app). Clique em Conectar com o RD Station de novo.",
  },
  salvar: {
    ok: false,
    texto: "Não foi possível salvar o acesso. Tente de novo.",
  },
} as const;
export type ResultadoRd = keyof typeof RETORNO_RD;

/** Volta da autorização do RD Station CRM (URL de callback do app do CRM). */
export const AUTORIZACAO_RD_CRM = {
  retorno: "/api/integracoes/rd-crm/retorno",
} as const;

export const RETORNO_RD_CRM: Record<
  ResultadoRd,
  { ok: boolean; texto: string }
> = {
  ...RETORNO_RD,
  conectado: {
    ok: true,
    texto:
      "RD Station CRM conectado. As oportunidades começaram a ser lidas; acompanhe em Últimas sincronizações.",
  },
  teste: {
    ok: false,
    texto:
      "Autorizado e salvo, mas a primeira leitura falhou (veja o cartão do RD Station CRM).",
  },
  state: {
    ok: false,
    texto:
      "A autorização expirou ou não começou neste navegador. Clique em Conectar com o RD Station CRM de novo.",
  },
  codigo: {
    ok: false,
    texto:
      "O RD recusou o código (expirado, já usado ou de outro app). Clique em Conectar com o RD Station CRM de novo.",
  },
};
export type ResultadoAutorizacao = ResultadoRd;

/** A URL de retorno cadastrada no app do TikTok é esta rota, no domínio do sistema. */
export const AUTORIZACAO_TIKTOK = {
  retorno: "/api/integracoes/tiktok/retorno",
} as const;

export const RETORNO_TIKTOK: Record<
  ResultadoAutorizacao,
  { ok: boolean; texto: string }
> = {
  conectado: {
    ok: true,
    texto: "TikTok conectado: o token de Ads foi gerado e salvo.",
  },
  teste: {
    ok: false,
    texto:
      "Autorizado e salvo, mas o teste da conexão falhou (veja o cartão do TikTok).",
  },
  permissao: RETORNO_RD.permissao,
  state: {
    ok: false,
    texto:
      "A autorização expirou ou não começou neste navegador. Clique em Conectar com o TikTok de novo.",
  },
  credencial: {
    ok: false,
    texto: "Salve o App ID e o App secret antes de conectar.",
  },
  codigo: {
    ok: false,
    texto:
      "O TikTok recusou o código (expirado, já usado ou de outro app). Clique em Conectar com o TikTok de novo.",
  },
  salvar: RETORNO_RD.salvar,
};

/** Acessos que autorizam numa conta Google (o YouTube está em outra conta). */
export type SistemaGoogle = "mkt_google" | "mkt_youtube";

export function ehSistemaGoogle(valor: unknown): valor is SistemaGoogle {
  return valor === "mkt_google" || valor === "mkt_youtube";
}

const CONTA_GOOGLE = {
  openid: "identificação da conta",
  "https://www.googleapis.com/auth/userinfo.email": "e-mail da conta",
} as const;

/**
 * Autorização do Google: a URL de callback cadastrada no app do Google Cloud
 * (por domínio) é esta rota, para os dois acessos. Escopos: só leitura, menos
 * o do Ads (o Google não tem um de leitura; o conector só usa search) e o do
 * Perfil da Empresa.
 */
export const AUTORIZACAO_GOOGLE = {
  retorno: "/api/integracoes/google/callback",
  escopos: {
    mkt_google: {
      ...CONTA_GOOGLE,
      "https://www.googleapis.com/auth/adwords": "Google Ads",
      "https://www.googleapis.com/auth/analytics.readonly": "Analytics 4",
      "https://www.googleapis.com/auth/webmasters.readonly": "Search Console",
      "https://www.googleapis.com/auth/business.manage": "Perfil da Empresa",
    },
    mkt_youtube: {
      ...CONTA_GOOGLE,
      "https://www.googleapis.com/auth/youtube.readonly": "YouTube",
      "https://www.googleapis.com/auth/yt-analytics.readonly":
        "YouTube Analytics",
    },
  },
} as const;

/** Nomes dos escopos pedidos que a conta não concedeu (desmarcou na tela). */
export function escoposFaltando(
  sistema: SistemaGoogle,
  concedidos: readonly string[],
): string[] {
  return Object.entries(AUTORIZACAO_GOOGLE.escopos[sistema])
    .filter(([escopo]) => !concedidos.includes(escopo))
    .map(([, nome]) => nome);
}

/** Salvar o app antes de conectar: no cartão do Google, para os dois. */
export const SEM_APP_GOOGLE =
  "Salve o Client ID e o Client secret no cartão do Google antes de conectar.";

function retornoDoGoogle(nome: string) {
  return {
    conectado: {
      ok: true,
      texto: `${nome} conectado: o refresh token foi gerado e salvo.`,
    },
    escopos: {
      ok: false,
      texto: `Conectado, mas a conta não liberou todas as permissões (veja o cartão do ${nome}). Clique em Conectar com o ${nome} e marque todas.`,
    },
    teste: {
      ok: false,
      texto: `Autorizado e salvo, mas o teste falhou (veja o cartão do ${nome}).`,
    },
    negado: {
      ok: false,
      texto: "A autorização foi cancelada na tela do Google. Nada mudou.",
    },
    permissao: RETORNO_RD.permissao,
    state: {
      ok: false,
      texto: `A autorização expirou ou não começou neste navegador. Clique em Conectar com o ${nome} de novo.`,
    },
    credencial: { ok: false, texto: SEM_APP_GOOGLE },
    codigo: {
      ok: false,
      texto: `O Google recusou o código (expirado, já usado ou endereço de retorno não cadastrado no app). Clique em Conectar com o ${nome} de novo.`,
    },
    salvar: RETORNO_RD.salvar,
  } as const;
}

export const RETORNO_GOOGLE = {
  mkt_google: retornoDoGoogle("Google"),
  mkt_youtube: retornoDoGoogle("YouTube"),
} as const;
export type ResultadoGoogle = keyof typeof RETORNO_GOOGLE.mkt_google;

export interface Opcao {
  valor: string;
  rotulo: string;
}

/** O que a conta conectada acessa num campo de escolha; `erro` se a busca falhou. */
export interface Descoberta {
  opcoes: Opcao[];
  erro?: string;
}

/** O valor salvo como a lista mostra (a conta do Ads leva a MCC junto). */
export function valorDaEscolha(
  nome: string,
  parametros: Record<string, unknown>,
): string {
  const v = String(parametros[nome] ?? "");
  const mcc = String(parametros.login_customer_id ?? "");
  return nome === "customer_id" && v && mcc ? `${v}@${mcc}` : v;
}

/**
 * Depois de conectar: fica o salvo se a conta ainda o acessa; senão a única
 * opção; com várias, ninguém escolhe pela pessoa. Busca que falhou não mexe.
 */
export function escolhaInicial(atual: string, d: Descoberta): string {
  if (d.erro || d.opcoes.some((o) => o.valor === atual)) return atual;
  return d.opcoes.length === 1 ? (d.opcoes[0]?.valor ?? "") : "";
}

export function ehSistema(valor: unknown): valor is Sistema {
  return SISTEMAS.includes(valor as Sistema);
}
