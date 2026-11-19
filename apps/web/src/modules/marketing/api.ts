import { respostaMensagem } from "@arp/shared/contratos/auth";
import type { SistemaGoogle } from "@arp/shared/integracoes";
import {
  agendaDoSite,
  LIMITE_HISTORICO,
  respostaBenchmark,
  respostaHistorico,
  respostaLandingPages,
  respostaLocatarios,
  respostaMetas,
  respostaParametros,
  respostaPublico,
  respostaReferencias,
  respostaRegras,
  respostaTemasECodigos,
} from "@arp/shared/marketing/contratos/base";
import {
  type RespostaPreviaCarga,
  respostaDescobertas,
  respostaPreviaCarga,
} from "@arp/shared/marketing/contratos/configuracoes";
import {
  dadosAnuncios,
  dadosAsana,
  dadosRd,
  dadosRedes,
  dadosReputacao,
  dadosSite,
} from "@arp/shared/marketing/contratos/fontes";
import {
  respostaArquivos,
  respostaBlocos,
  respostaEnvio,
  respostaNovoArquivo,
  respostaVersoes,
} from "@arp/shared/marketing/contratos/marca";
import { queryOptions } from "@tanstack/react-query";
import type { EstadoAcao } from "@/components/form-acao";
import { acaoDaApi, formParaObjeto } from "@/lib/acao";
import { api, mensagemDoErro } from "@/lib/api";
import { clienteDeConsultas, VALIDADE } from "@/lib/consulta";

// Chamadas do Marketing (/api/v1/marketing) e as chaves de consulta. Os
// cadastros de Configurações são configuração (5 min) e ficam sob
// chavesMarketing.cadastros: toda gravação de Configurações invalida essa
// chave. As fontes são dado de negócio; as telas fazem as contas com as
// regras de @arp/shared/marketing.

export const chavesMarketing = {
  tudo: ["marketing"] as const,
  /** Cadastros de Configurações e metas (invalidar depois de gravar). */
  cadastros: ["marketing", "cadastros"] as const,
  cadastro: (nome: string) => ["marketing", "cadastros", nome] as const,
  fontes: ["marketing", "fontes"] as const,
  fonte: (nome: string) => ["marketing", "fontes", nome] as const,
  benchmark: () => ["marketing", "benchmark"] as const,
  publico: () => ["marketing", "publico"] as const,
  agenda: () => ["marketing", "agenda"] as const,
  historico: (limite: number) => ["marketing", "historico", limite] as const,
};

// ---------------------------------------------------------------------------
// Cadastros de Configurações
// ---------------------------------------------------------------------------

/** GET /marketing/parametros */
export const consultaDosParametros = queryOptions({
  queryKey: chavesMarketing.cadastro("parametros"),
  queryFn: ({ signal }) =>
    api.get("/marketing/parametros", {
      esquema: respostaParametros,
      sinal: signal,
    }),
  select: (r) => r.parametros,
  staleTime: VALIDADE.configuracao,
});

/** GET /marketing/locatarios */
export const consultaDosLocatarios = queryOptions({
  queryKey: chavesMarketing.cadastro("locatarios"),
  queryFn: ({ signal }) =>
    api.get("/marketing/locatarios", {
      esquema: respostaLocatarios,
      sinal: signal,
    }),
  select: (r) => r.locatarios,
  staleTime: VALIDADE.configuracao,
});

/** GET /marketing/landing-pages */
export const consultaDasLandingPages = queryOptions({
  queryKey: chavesMarketing.cadastro("landing-pages"),
  queryFn: ({ signal }) =>
    api.get("/marketing/landing-pages", {
      esquema: respostaLandingPages,
      sinal: signal,
    }),
  select: (r) => r.landingPages,
  staleTime: VALIDADE.configuracao,
});

/** GET /marketing/regras-alerta */
export const consultaDasRegras = queryOptions({
  queryKey: chavesMarketing.cadastro("regras-alerta"),
  queryFn: ({ signal }) =>
    api.get("/marketing/regras-alerta", {
      esquema: respostaRegras,
      sinal: signal,
    }),
  select: (r) => r.regras,
  staleTime: VALIDADE.configuracao,
});

/** GET /marketing/temas-e-codigos */
export const consultaDosTemasECodigos = queryOptions({
  queryKey: chavesMarketing.cadastro("temas-e-codigos"),
  queryFn: ({ signal }) =>
    api.get("/marketing/temas-e-codigos", {
      esquema: respostaTemasECodigos,
      sinal: signal,
    }),
  staleTime: VALIDADE.configuracao,
});

/** GET /marketing/metas */
export const consultaDasMetas = queryOptions({
  queryKey: chavesMarketing.cadastro("metas"),
  queryFn: ({ signal }) =>
    api.get("/marketing/metas", { esquema: respostaMetas, sinal: signal }),
  select: (r) => r.metas,
  staleTime: VALIDADE.configuracao,
});

/** GET /marketing/referencias (Benchmark: ativas e inativas). */
export const consultaDasReferencias = queryOptions({
  queryKey: chavesMarketing.cadastro("referencias"),
  queryFn: ({ signal }) =>
    api.get("/marketing/referencias", {
      esquema: respostaReferencias,
      sinal: signal,
    }),
  select: (r) => r.referencias,
  staleTime: VALIDADE.configuracao,
});

/** GET /marketing/historico?limite (Configurações › Histórico). */
export const consultaDoHistorico = (limite = LIMITE_HISTORICO) =>
  queryOptions({
    queryKey: chavesMarketing.historico(limite),
    queryFn: ({ signal }) =>
      api.get("/marketing/historico", {
        esquema: respostaHistorico,
        consulta: { limite },
        sinal: signal,
      }),
    select: (r) => r.alteracoes,
  });

// ---------------------------------------------------------------------------
// Fontes (dados das ferramentas)
// ---------------------------------------------------------------------------

/** GET /marketing/fontes/anuncios: Meta e Google; TikTok vazio (não ligado). */
export const consultaDosAnuncios = queryOptions({
  queryKey: chavesMarketing.fonte("anuncios"),
  queryFn: ({ signal }) =>
    api.get("/marketing/fontes/anuncios", {
      esquema: dadosAnuncios,
      sinal: signal,
    }),
});

/** GET /marketing/fontes/rd */
export const consultaDoRd = queryOptions({
  queryKey: chavesMarketing.fonte("rd"),
  queryFn: ({ signal }) =>
    api.get("/marketing/fontes/rd", { esquema: dadosRd, sinal: signal }),
});

/** GET /marketing/fontes/rd-anuncios: leads do custo por lead. */
export const consultaDoRdDosAnuncios = queryOptions({
  queryKey: chavesMarketing.fonte("rd-anuncios"),
  queryFn: ({ signal }) =>
    api.get("/marketing/fontes/rd-anuncios", {
      esquema: dadosRd,
      sinal: signal,
    }),
});

/** GET /marketing/fontes/site: GA4 e Search Console. */
export const consultaDoSite = queryOptions({
  queryKey: chavesMarketing.fonte("site"),
  queryFn: ({ signal }) =>
    api.get("/marketing/fontes/site", { esquema: dadosSite, sinal: signal }),
});

/** GET /marketing/fontes/redes */
export const consultaDasRedes = queryOptions({
  queryKey: chavesMarketing.fonte("redes"),
  queryFn: ({ signal }) =>
    api.get("/marketing/fontes/redes", { esquema: dadosRedes, sinal: signal }),
});

/** GET /marketing/fontes/asana */
export const consultaDoAsana = queryOptions({
  queryKey: chavesMarketing.fonte("asana"),
  queryFn: ({ signal }) =>
    api.get("/marketing/fontes/asana", { esquema: dadosAsana, sinal: signal }),
});

/** GET /marketing/fontes/reputacao (Google Perfil da Empresa; vazio, não ligado). */
export const consultaDaReputacao = queryOptions({
  queryKey: chavesMarketing.fonte("reputacao"),
  queryFn: ({ signal }) =>
    api.get("/marketing/fontes/reputacao", {
      esquema: dadosReputacao,
      sinal: signal,
    }),
});

/** GET /marketing/publico: câmeras (null sem marketing.publico). */
export const consultaDoPublico = queryOptions({
  queryKey: chavesMarketing.publico(),
  queryFn: ({ signal }) =>
    api.get("/marketing/publico", { esquema: respostaPublico, sinal: signal }),
  select: (r) => r.publico,
});

/** GET /marketing/benchmark (null sem marketing.reputacao). */
export const consultaDoBenchmark = queryOptions({
  queryKey: chavesMarketing.benchmark(),
  queryFn: ({ signal }) =>
    api.get("/marketing/benchmark", {
      esquema: respostaBenchmark,
      sinal: signal,
    }),
  select: (r) => r.benchmark,
});

/** GET /marketing/eventos/agenda (marketing.eventos). */
export const consultaDaAgenda = queryOptions({
  queryKey: chavesMarketing.agenda(),
  queryFn: ({ signal }) =>
    api.get("/marketing/eventos/agenda", {
      esquema: agendaDoSite,
      sinal: signal,
    }),
});

// ---------------------------------------------------------------------------
// Configurações (gravações), Integrações e Marca
// ---------------------------------------------------------------------------

/** Depois de gravar um cadastro: os cadastros e o histórico. */
// O Benchmark lê as referências cadastradas: sem ele aqui, a referência nova
// só aparecia quando a consulta vencia.
const CADASTROS = [
  chavesMarketing.cadastros,
  ["marketing", "historico"],
  chavesMarketing.benchmark(),
];

/** Gravação de Configurações (formulário como a tela manda). */
const gravacao = (
  metodo: "POST" | "PATCH" | "DELETE",
  caminho: string | ((form: FormData) => string),
  opcoes: { listas?: string[] } = {},
) =>
  acaoDaApi({
    metodo,
    caminho: (form) =>
      `/marketing/configuracoes${typeof caminho === "function" ? caminho(form) : caminho}`,
    corpo:
      metodo === "DELETE"
        ? undefined
        : (form) => formParaObjeto(form, { listas: opcoes.listas }),
    invalida: CADASTROS,
  });

const campo = (form: FormData, nome: string) =>
  encodeURIComponent(String(form.get(nome) ?? ""));

export const salvarLocatario = gravacao("POST", "/locatarios");
export const removerLocatario = gravacao(
  "DELETE",
  (f) => `/locatarios/${campo(f, "id")}`,
);
export const confirmarCargaLocatarios = gravacao(
  "POST",
  "/locatarios/carga/confirmacao",
);
export const salvarLandingPage = gravacao("POST", "/landing-pages");
export const incluirMeta = gravacao("POST", "/metas");
export const alterarMeta = gravacao("PATCH", (f) => `/metas/${campo(f, "id")}`);
export const removerMeta = gravacao(
  "DELETE",
  (f) => `/metas/${campo(f, "id")}`,
);
export const salvarRegra = gravacao("PATCH", "/regras");
export const salvarReputacao = gravacao("PATCH", "/reputacao", {
  listas: ["estrelas_reclamacao"],
});
export const salvarAsana = gravacao("PATCH", "/asana");
export const salvarTema = gravacao("POST", "/temas");
export const salvarCodigoRonda = gravacao("POST", "/codigos-ronda");
export const removerCodigoRonda = gravacao(
  "DELETE",
  (f) => `/codigos-ronda/${campo(f, "codigo")}`,
);
export const salvarVisualizacao = gravacao("PATCH", "/visualizacao", {
  listas: ["visivel"],
});
export const salvarTermosMarca = gravacao("PATCH", "/termos-marca");
export const salvarReferencia = gravacao("POST", "/referencias");
export const removerReferencia = gravacao(
  "DELETE",
  (f) => `/referencias/${campo(f, "id")}`,
);

/** POST /marketing/historico/:id/volta */
export const voltarAlteracao = acaoDaApi({
  metodo: "POST",
  caminho: (f) => `/marketing/historico/${campo(f, "id")}/volta`,
  corpo: () => undefined,
  invalida: CADASTROS,
});

/** Estado da leitura da planilha: a prévia, quando leu. */
export interface EstadoCarga extends EstadoAcao {
  previa?: RespostaPreviaCarga["previa"];
}

/** POST /marketing/configuracoes/locatarios/carga (multipart): só a prévia. */
export async function lerCargaLocatarios(
  _anterior: EstadoCarga,
  form: FormData,
): Promise<EstadoCarga> {
  try {
    const r = await api.post(
      "/marketing/configuracoes/locatarios/carga",
      form,
      {
        esquema: respostaPreviaCarga,
      },
    );
    return { previa: r.previa };
  } catch (erro) {
    return { erro: mensagemDoErro(erro) };
  }
}

/** GET /marketing/integracoes/:sistema/descobertas (nunca falha: null). */
export const consultaDasDescobertas = (sistema: SistemaGoogle) =>
  queryOptions({
    queryKey: ["marketing", "descobertas", sistema] as const,
    queryFn: ({ signal }) =>
      api.get(`/marketing/integracoes/${sistema}/descobertas`, {
        esquema: respostaDescobertas,
        sinal: signal,
      }),
    select: (r) => r.descobertas,
  });

export const chavesMarca = {
  tudo: ["marketing", "marca"] as const,
  blocos: () => ["marketing", "marca", "blocos"] as const,
  versoes: () => ["marketing", "marca", "versoes"] as const,
  arquivos: () => ["marketing", "marca", "arquivos"] as const,
};

/** GET /marketing/marca/blocos */
export const consultaDosBlocos = queryOptions({
  queryKey: chavesMarca.blocos(),
  queryFn: ({ signal }) =>
    api.get("/marketing/marca/blocos", {
      esquema: respostaBlocos,
      sinal: signal,
    }),
});

/** GET /marketing/marca/versoes */
export const consultaDasVersoes = queryOptions({
  queryKey: chavesMarca.versoes(),
  queryFn: ({ signal }) =>
    api.get("/marketing/marca/versoes", {
      esquema: respostaVersoes,
      sinal: signal,
    }),
});

/** GET /marketing/marca/arquivos */
export const consultaDosArquivos = queryOptions({
  queryKey: chavesMarca.arquivos(),
  queryFn: ({ signal }) =>
    api.get("/marketing/marca/arquivos", {
      esquema: respostaArquivos,
      sinal: signal,
    }),
});

/** Endereço que baixa (ou mostra) um arquivo de marca. */
export const urlDoArquivo = (id: string) =>
  `/api/v1/marketing/marca/arquivos/${id}`;
export const URL_PDF_MARCA = "/api/v1/marketing/marca/pdf";

/** POST /marketing/marca/blocos */
export const salvarBloco = acaoDaApi({
  metodo: "POST",
  caminho: "/marketing/marca/blocos",
  invalida: [chavesMarca.tudo],
});

/** POST /marketing/marca/versoes/:id/volta */
export const voltarVersao = acaoDaApi({
  metodo: "POST",
  caminho: (f) => `/marketing/marca/versoes/${campo(f, "id")}/volta`,
  corpo: () => undefined,
  invalida: [chavesMarca.tudo],
});

/** Erro da API como as ações antigas devolviam: { ok: false, erro }. */
async function comoAcao<T extends object>(
  pedido: () => Promise<T>,
): Promise<({ ok: true } & T) | { ok: false; erro: string }> {
  try {
    const r = await pedido();
    return { ok: true, ...r };
  } catch (erro) {
    return { ok: false, erro: mensagemDoErro(erro) };
  }
}

const reler = () =>
  clienteDeConsultas.invalidateQueries({ queryKey: chavesMarca.tudo });

/** POST /marketing/marca/arquivos: cria o arquivo esperado. */
export const novoArquivoDaMarca = (entrada: {
  titulo: string;
  descricao: string;
  referencia?: boolean;
}) =>
  comoAcao(async () => {
    const r = await api.post("/marketing/marca/arquivos", entrada, {
      esquema: respostaNovoArquivo,
    });
    await reler();
    return r;
  });

/** POST /marketing/marca/arquivos/envio: o link para enviar. */
export const prepararEnvioDaMarca = (entrada: {
  grupo: string;
  nome: string;
  tamanho: number;
}) =>
  comoAcao(() =>
    api.post("/marketing/marca/arquivos/envio", entrada, {
      esquema: respostaEnvio,
    }),
  );

/** POST /marketing/marca/arquivos/registro: registra a versão enviada. */
export async function registrarArquivoDaMarca(entrada: {
  grupo: string;
  path: string;
  nome: string;
}): Promise<EstadoAcao> {
  const r = await comoAcao(() =>
    api.post("/marketing/marca/arquivos/registro", entrada, {
      esquema: respostaMensagem,
    }),
  );
  if (!r.ok) return { erro: r.erro };
  await reler();
  return { ok: r.mensagem };
}
