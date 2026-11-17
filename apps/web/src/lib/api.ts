import type { CodigoDeErro } from "@arp/shared/contratos/erro";
import { respostaDeErro } from "@arp/shared/contratos/erro";
import { destinoSeguro } from "@arp/shared/destino-seguro";
import type { z } from "zod";

// Único ponto de `fetch` da tela. Cuida de: cookies da sessão (mesma
// origem), cabeçalho `X-ARP` nas gravações, JSON e multipart, erro
// padronizado, renovação do acesso (401 → renovar uma vez → repetir) e
// download de arquivo. Os caminhos são relativos a /api/v1 ("/auth/eu").

export const BASE_DA_API = "/api/v1";

/** `rede`: a resposta não chegou (sem internet, servidor fora do ar). */
export type CodigoDoErro = CodigoDeErro | "rede";

/** Erro de qualquer chamada, no formato `{ erro: { codigo, mensagem, campos? } }`. */
export class ErroDaApi extends Error {
  readonly codigo: CodigoDoErro;
  /** Texto para a pessoa ler (português, sem detalhe técnico). */
  readonly mensagem: string;
  /** Só em `validacao`: campo → mensagem. */
  readonly campos?: Record<string, string>;
  /** Status HTTP; 0 quando a resposta não chegou. */
  readonly status: number;

  constructor(dados: {
    codigo: CodigoDoErro;
    mensagem: string;
    status: number;
    campos?: Record<string, string>;
  }) {
    super(dados.mensagem);
    this.name = "ErroDaApi";
    this.codigo = dados.codigo;
    this.mensagem = dados.mensagem;
    this.status = dados.status;
    this.campos = dados.campos;
  }
}

/** Texto do erro para mostrar à pessoa (o primeiro campo inválido, se houver). */
export function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ErroDaApi) {
    const doCampo = Object.values(erro.campos ?? {})[0];
    return erro.codigo === "validacao" && doCampo ? doCampo : erro.mensagem;
  }
  return "Não foi possível concluir. Tente de novo.";
}

type Metodo = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type ValorDaConsulta = string | number | boolean | null | undefined;
export type Consulta = Record<string, ValorDaConsulta | ValorDaConsulta[]>;

export interface OpcoesDoPedido {
  /** Parâmetros da URL; vazio, null e undefined ficam de fora. */
  consulta?: Consulta | URLSearchParams;
  /**
   * Schema Zod da resposta (contratos de @arp/shared): valida e dá o tipo.
   * Sem ele a resposta volta como `unknown` (quem usa confere).
   */
  esquema?: z.ZodType;
  sinal?: AbortSignal;
  /** false: não tenta renovar a sessão num 401 (entrar, renovar, sair). */
  renovar?: boolean;
  /** false: sessão perdida não leva ao login (quem chama trata o erro). */
  irParaOLogin?: boolean;
}

/** Opções com o schema da resposta: a chamada devolve o tipo do contrato. */
type ComEsquema<S extends z.ZodType> = OpcoesDoPedido & { esquema: S };

// ---------------------------------------------------------------------------
// Sessão perdida e senha provisória: o que fazer é configurável (testes).
// ---------------------------------------------------------------------------

/** Endereço do login que volta para a tela atual depois de entrar. */
export function enderecoDoLogin(
  atual: { pathname: string; search: string },
  motivo?: "expirou",
): string {
  const params = new URLSearchParams();
  const destino = destinoSeguro(atual.pathname + atual.search, "");
  if (destino && !destino.startsWith("/login")) params.set("destino", destino);
  if (motivo) params.set("motivo", motivo);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

const reacoes = {
  /** A renovação falhou: a sessão acabou. Sai da tela (os dados somem junto). */
  aoPerderSessao(): void {
    window.location.assign(enderecoDoLogin(window.location, "expirou"));
  },
  /** A API só aceita trocar a senha: leva para a tela certa. */
  aoExigirSenha(): void {
    if (window.location.pathname !== "/trocar-senha")
      window.location.assign("/trocar-senha");
  },
};

/** Troca as reações padrão (usado nos testes). Devolve como desfazer. */
export function configurarApi(novas: Partial<typeof reacoes>): () => void {
  const antes = { ...reacoes };
  Object.assign(reacoes, novas);
  return () => {
    Object.assign(reacoes, antes);
  };
}

// ---------------------------------------------------------------------------
// Renovação: uma por vez. Chamadas que tomam 401 juntas esperam a mesma.
// ---------------------------------------------------------------------------

let renovando: Promise<boolean> | null = null;
/** O `entrar` que está no ar (ver `semRenovacaoNoMeio`). */
let entrando: Promise<void> | null = null;

/** Pede um acesso novo. true se a sessão continua valendo. */
export function renovarSessao(): Promise<boolean> {
  renovando ??= (entrando ?? Promise.resolve())
    .then(() =>
      fetch(`${BASE_DA_API}/auth/renovar`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-ARP": "1", Accept: "application/json" },
      }),
    )
    .then(async (r) => {
      // Lê o corpo até o fim: sem isso o pedido fica "pendente" no navegador.
      await r.text().catch(() => undefined);
      return r.ok;
    })
    .catch(() => false)
    .finally(() => {
      renovando = null;
    });
  return renovando;
}

/**
 * Faz o pedido de entrar sem nenhuma renovação no meio. A tela de login
 * pergunta quem está logado ao abrir e, no 401, tenta renovar; se a pessoa
 * entra nesse meio-tempo, a resposta atrasada do `renovar` (pedido sem a
 * sessão nova) chegava depois dos cookies do `entrar` e os apagava. Aqui o
 * `entrar` espera a renovação que já saiu, e a que for pedida enquanto ele
 * está no ar espera por ele (e sai já com os cookies novos).
 */
export async function semRenovacaoNoMeio<T>(
  entrar: () => Promise<T>,
): Promise<T> {
  while (renovando || entrando) await (renovando ?? entrando);
  const pedido = entrar();
  entrando = pedido
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      entrando = null;
    });
  return pedido;
}

// ---------------------------------------------------------------------------
// Pedido
// ---------------------------------------------------------------------------

function montarUrl(caminho: string, consulta?: Consulta | URLSearchParams) {
  const url = `${BASE_DA_API}${caminho}`;
  if (!consulta) return url;
  const params = new URLSearchParams();
  const entradas =
    consulta instanceof URLSearchParams
      ? [...consulta.entries()]
      : Object.entries(consulta);
  for (const [chave, valor] of entradas) {
    for (const v of Array.isArray(valor) ? valor : [valor]) {
      if (v === undefined || v === null || v === "") continue;
      params.append(chave, String(v));
    }
  }
  const query = params.toString();
  return query ? `${url}?${query}` : url;
}

function montarPedido(metodo: Metodo, corpo: unknown, sinal?: AbortSignal) {
  const headers: Record<string, string> = { Accept: "application/json" };
  // Gravação: a API recusa sem este cabeçalho (defesa contra CSRF).
  if (metodo !== "GET") headers["X-ARP"] = "1";
  const init: RequestInit = {
    method: metodo,
    credentials: "same-origin",
    headers,
    signal: sinal,
  };
  if (corpo instanceof FormData || corpo instanceof Blob) {
    // Multipart ou arquivo: o navegador escreve o Content-Type (com o limite).
    init.body = corpo;
  } else if (corpo !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(corpo);
  }
  return init;
}

const POR_STATUS: Partial<Record<number, [CodigoDeErro, string]>> = {
  401: ["nao_autenticado", "Sua sessão expirou. Entre de novo."],
  403: ["sem_permissao", "Você não tem acesso a isto."],
  404: ["nao_encontrado", "Não encontrado."],
  413: ["validacao", "O arquivo é grande demais."],
  429: ["limite", "Muitas tentativas. Espere um pouco e tente de novo."],
};

async function lerErro(resposta: Response): Promise<ErroDaApi> {
  const corpo: unknown = await resposta.json().catch(() => null);
  const lido = respostaDeErro.safeParse(corpo);
  if (lido.success)
    return new ErroDaApi({ ...lido.data.erro, status: resposta.status });
  // Resposta fora do formato (nginx sem a API atrás, 502, 413...).
  const [codigo, mensagem] = POR_STATUS[resposta.status] ?? [
    "interno",
    "Não foi possível concluir. Tente de novo.",
  ];
  return new ErroDaApi({ codigo, mensagem, status: resposta.status });
}

/** Faz o pedido (com a renovação) e devolve a resposta crua, já conferida. */
async function buscar(
  metodo: Metodo,
  caminho: string,
  corpo: unknown,
  opcoes: OpcoesDoPedido,
): Promise<Response> {
  const url = montarUrl(caminho, opcoes.consulta);
  const enviar = () =>
    fetch(url, montarPedido(metodo, corpo, opcoes.sinal)).catch(
      (causa: unknown) => {
        // Pedido cancelado (a tela mudou): não é erro para mostrar.
        if (causa instanceof DOMException && causa.name === "AbortError")
          throw causa;
        throw new ErroDaApi({
          codigo: "rede",
          mensagem:
            "Sem conexão com o servidor. Confira a internet e tente de novo.",
          status: 0,
        });
      },
    );

  let resposta = await enviar();
  if (resposta.ok) return resposta;
  let erro = await lerErro(resposta);

  if (erro.codigo === "nao_autenticado" && opcoes.renovar !== false) {
    if (await renovarSessao()) {
      resposta = await enviar();
      if (resposta.ok) return resposta;
      erro = await lerErro(resposta);
    }
    if (erro.codigo === "nao_autenticado" && opcoes.irParaOLogin !== false)
      reacoes.aoPerderSessao();
  }
  if (erro.codigo === "senha_provisoria") reacoes.aoExigirSenha();
  throw erro;
}

function conferir(
  dados: unknown,
  esquema: z.ZodType | undefined,
  caminho: string,
): unknown {
  if (!esquema) return dados;
  const lido = esquema.safeParse(dados);
  if (lido.success) return lido.data;
  // A API respondeu fora do contrato: é defeito, não culpa de quem usa.
  console.error(`Resposta fora do contrato em ${caminho}`, lido.error.issues);
  throw new ErroDaApi({
    codigo: "interno",
    mensagem: "Resposta inesperada do servidor. Tente de novo.",
    status: 200,
  });
}

/** Qualquer método (usado por lib/acao.ts). */
function pedir<S extends z.ZodType>(
  metodo: Metodo,
  caminho: string,
  corpo: unknown,
  opcoes: ComEsquema<S>,
): Promise<z.output<S>>;
function pedir(
  metodo: Metodo,
  caminho: string,
  corpo?: unknown,
  opcoes?: OpcoesDoPedido,
): Promise<unknown>;
async function pedir(
  metodo: Metodo,
  caminho: string,
  corpo?: unknown,
  opcoes: OpcoesDoPedido = {},
): Promise<unknown> {
  const resposta = await buscar(metodo, caminho, corpo, opcoes);
  const dados: unknown =
    resposta.status === 204
      ? undefined
      : await resposta.json().catch(() => undefined);
  return conferir(dados, opcoes.esquema, caminho);
}

/** Leitura. */
function get<S extends z.ZodType>(
  caminho: string,
  opcoes: ComEsquema<S>,
): Promise<z.output<S>>;
function get(caminho: string, opcoes?: OpcoesDoPedido): Promise<unknown>;
function get(caminho: string, opcoes?: OpcoesDoPedido): Promise<unknown> {
  return pedir("GET", caminho, undefined, opcoes);
}

/** Cria ou executa. `corpo`: objeto (vira JSON) ou FormData (multipart). */
function post<S extends z.ZodType>(
  caminho: string,
  corpo: unknown,
  opcoes: ComEsquema<S>,
): Promise<z.output<S>>;
function post(
  caminho: string,
  corpo?: unknown,
  opcoes?: OpcoesDoPedido,
): Promise<unknown>;
function post(
  caminho: string,
  corpo?: unknown,
  opcoes?: OpcoesDoPedido,
): Promise<unknown> {
  return pedir("POST", caminho, corpo, opcoes);
}

/** Altera parte de um registro. */
function patch<S extends z.ZodType>(
  caminho: string,
  corpo: unknown,
  opcoes: ComEsquema<S>,
): Promise<z.output<S>>;
function patch(
  caminho: string,
  corpo?: unknown,
  opcoes?: OpcoesDoPedido,
): Promise<unknown>;
function patch(
  caminho: string,
  corpo?: unknown,
  opcoes?: OpcoesDoPedido,
): Promise<unknown> {
  return pedir("PATCH", caminho, corpo, opcoes);
}

/** Substitui (ou grava o valor de uma chave). */
function put<S extends z.ZodType>(
  caminho: string,
  corpo: unknown,
  opcoes: ComEsquema<S>,
): Promise<z.output<S>>;
function put(
  caminho: string,
  corpo?: unknown,
  opcoes?: OpcoesDoPedido,
): Promise<unknown>;
function put(
  caminho: string,
  corpo?: unknown,
  opcoes?: OpcoesDoPedido,
): Promise<unknown> {
  return pedir("PUT", caminho, corpo, opcoes);
}

/** Remove. */
function remover<S extends z.ZodType>(
  caminho: string,
  opcoes: ComEsquema<S>,
): Promise<z.output<S>>;
function remover(caminho: string, opcoes?: OpcoesDoPedido): Promise<unknown>;
function remover(caminho: string, opcoes?: OpcoesDoPedido): Promise<unknown> {
  return pedir("DELETE", caminho, undefined, opcoes);
}

/** Nome do arquivo no cabeçalho Content-Disposition (aceita o formato UTF-8). */
function nomeDoArquivo(resposta: Response): string | null {
  const cabecalho = resposta.headers.get("content-disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(cabecalho)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      return utf8;
    }
  }
  return /filename="?([^";]+)"?/i.exec(cabecalho)?.[1] ?? null;
}

export interface ArquivoBaixado {
  blob: Blob;
  /** Nome sugerido pelo servidor (null se ele não disse). */
  nome: string | null;
}

/**
 * Lê uma resposta em text/event-stream: chama `aoEvento` com o JSON de cada
 * linha `data:` conforme chega. Erro antes de começar (sessão, permissão,
 * limite) sai como `ErroDaApi`, igual aos outros pedidos.
 */
async function fluxo(
  caminho: string,
  corpo: unknown,
  aoEvento: (dado: unknown) => void,
  opcoes: Omit<OpcoesDoPedido, "esquema"> = {},
): Promise<void> {
  const resposta = await buscar("POST", caminho, corpo, opcoes);
  if (!resposta.body) return;
  const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = "";
  for (;;) {
    const { value, done } = await leitor.read();
    if (done) break;
    resto += value;
    for (
      let fim = resto.indexOf("\n\n");
      fim >= 0;
      fim = resto.indexOf("\n\n")
    ) {
      const bloco = resto.slice(0, fim);
      resto = resto.slice(fim + 2);
      for (const linha of bloco.split("\n"))
        if (linha.startsWith("data: ")) {
          let dado: unknown;
          try {
            dado = JSON.parse(linha.slice(6));
          } catch {
            continue;
          }
          aoEvento(dado);
        }
    }
  }
}

export const api = {
  get,
  post,
  patch,
  put,
  delete: remover,
  pedir,
  fluxo,
  /** Baixa um arquivo gerado pela API (planilha, PDF) com a sessão da pessoa. */
  async baixar(
    caminho: string,
    opcoes: Omit<OpcoesDoPedido, "esquema"> & {
      metodo?: "GET" | "POST";
      corpo?: unknown;
    } = {},
  ): Promise<ArquivoBaixado> {
    const resposta = await buscar(
      opcoes.metodo ?? "GET",
      caminho,
      opcoes.corpo,
      opcoes,
    );
    return { blob: await resposta.blob(), nome: nomeDoArquivo(resposta) };
  },
};

/**
 * Envia o arquivo, do navegador, para o link assinado que a API preparou
 * (o link já carrega a autorização e o prazo): PUT com o arquivo no corpo.
 * true se chegou.
 */
export async function enviarParaLink(
  url: string,
  arquivo: File,
): Promise<boolean> {
  const r = await fetch(url, {
    method: "PUT",
    body: arquivo,
    credentials: "same-origin",
    headers: {
      "content-type": arquivo.type || "application/octet-stream",
      "x-upsert": "false",
      "X-ARP": "1",
    },
  }).catch(() => null);
  return r?.ok === true;
}

/** Entrega o arquivo à pessoa (o "Salvar como" do navegador). */
export function salvarArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  // Dá tempo de o navegador começar o download antes de soltar a memória.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
