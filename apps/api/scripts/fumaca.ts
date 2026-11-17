// Conferência de fumaça: entra com um usuário e chama todas as rotas GET sem
// parâmetro de caminho, uma por vez. Imprime só rota, status e tempo (nunca
// o conteúdo da resposta). Sai com código 1 se alguma rota responder 5xx ou
// não responder.
//
// No computador de desenvolvimento (lê as rotas do próprio código):
//   cd apps/api
//   npx tsx --env-file=.env --env-file=.env.teste scripts/fumaca.ts
//
// No servidor, contra a API que está no ar (não precisa de node_modules:
// leva a lista de rotas num arquivo, feito com `--listar` no desenvolvimento):
//   npx tsx --env-file=.env scripts/fumaca.ts --listar > rotas.txt
//   BASE_URL=http://127.0.0.1:3001 FUMACA_ORIGEM=https://<site> \
//   FUMACA_EMAIL=... FUMACA_SENHA=... FUMACA_ROTAS=rotas.txt \
//     node apps/api/scripts/fumaca.ts
//
// Ambiente:
//   BASE_URL        onde a API responde (padrão http://127.0.0.1:$PORT ou 3000)
//   FUMACA_EMAIL    usuário (no desenvolvimento, cai no TESTE_EMAIL)
//   FUMACA_SENHA    senha  (no desenvolvimento, cai no TESTE_SENHA)
//   FUMACA_ORIGEM   o SITE_URL da API (padrão: SITE_URL do ambiente, ou BASE_URL);
//                   a API recusa gravação (o login) de outra origem
//   FUMACA_ROTAS    arquivo com uma rota por linha, em vez de ler do código
//   FUMACA_PRAZO_MS quanto esperar cada rota (padrão 60000)

import { readFileSync } from "node:fs";

/**
 * Ficam de fora: chamam sistema externo na hora (ou existem para um terceiro
 * chamar). O resto lê só o banco e o disco.
 */
const FORA: readonly { padrao: RegExp; motivo: string }[] = [
  { padrao: /^\/api\/integracoes\//, motivo: "retorno de autorização (OAuth)" },
  {
    padrao: /^\/api\/v1\/marketing\/fontes\//,
    motivo: "fontes do Marketing ao vivo (Meta, Google, Asana, RD, TikTok)",
  },
  {
    padrao: /^\/api\/v1\/marketing\/(benchmark|eventos\/agenda)$/,
    motivo: "Meta (benchmark) e agenda do site ao vivo",
  },
  {
    padrao: /^\/api\/v1\/(gestao\/painel|rh\/painel|rh\/quadro)$/,
    motivo: "turnover pelo Copiloto RH",
  },
  {
    padrao: /^\/api\/v1\/comercial\/vencimentos$/,
    motivo: "índices (IGP-M/IPCA) do Banco Central",
  },
  {
    padrao:
      /^\/api\/v1\/comercial\/(eventos\/feriados|configuracoes\/parametros\/calendario)$/,
    motivo: "feriados nacionais (BrasilAPI)",
  },
];

const ambiente = (nome: string): string | undefined =>
  process.env[nome]?.trim() || undefined;

const BASE = (
  ambiente("BASE_URL") ?? `http://127.0.0.1:${ambiente("PORT") ?? "3000"}`
).replace(/\/+$/, "");
const ORIGEM = new URL(
  ambiente("FUMACA_ORIGEM") ?? ambiente("SITE_URL") ?? BASE,
).origin;
const PRAZO_MS = Number(ambiente("FUMACA_PRAZO_MS") ?? 60_000);

const semParametro = (url: string) => !url.includes(":") && !url.includes("*");
const motivoDeFora = (url: string) =>
  FORA.find((f) => f.padrao.test(url))?.motivo;

/** Rotas GET sem parâmetro de caminho: do arquivo ou do próprio código. */
async function rotasGet(): Promise<string[]> {
  const arquivo = ambiente("FUMACA_ROTAS");
  let urls: string[];
  if (arquivo) {
    urls = readFileSync(arquivo, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("/"));
  } else {
    // Só aqui o código da API é carregado (precisa do .env e do tsx).
    process.env.AGENDADOR = "0";
    process.env.LOG_LEVEL ??= "silent";
    const caminho = "../src/app";
    const { criarApp } = await import(caminho);
    const app = await criarApp();
    const registradas: { metodo: string; url: string }[] = app.rotas;
    urls = registradas.filter((r) => r.metodo === "GET").map((r) => r.url);
    await app.close();
  }
  return [...new Set(urls)].filter(semParametro).sort();
}

/** Cookies guardados à mão: o `fetch` do Node não guarda, e os da API são `Secure`. */
const cookies = new Map<string, { valor: string; caminho: string }>();

function guardarCookies(resposta: Response): void {
  for (const linha of resposta.headers.getSetCookie()) {
    const [par = "", ...atributos] = linha.split(";").map((p) => p.trim());
    const igual = par.indexOf("=");
    if (igual < 1) continue;
    const nome = par.slice(0, igual);
    const valor = par.slice(igual + 1);
    const atributo = (n: string) =>
      atributos
        .find((a) => a.toLowerCase().startsWith(`${n}=`))
        ?.slice(n.length + 1);
    if (valor === "" || atributo("max-age") === "0") cookies.delete(nome);
    else cookies.set(nome, { valor, caminho: atributo("path") ?? "/" });
  }
}

const cabecalhoCookie = (url: string) =>
  [...cookies]
    .filter(([, c]) => url.startsWith(c.caminho))
    .map(([nome, c]) => `${nome}=${c.valor}`)
    .join("; ");

async function pedir(
  metodo: "GET" | "POST",
  url: string,
  corpo?: Record<string, string>,
): Promise<Response> {
  const cookie = cabecalhoCookie(url);
  const resposta = await fetch(`${BASE}${url}`, {
    method: metodo,
    redirect: "manual",
    signal: AbortSignal.timeout(PRAZO_MS),
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(metodo === "POST"
        ? { origin: ORIGEM, "x-arp": "1", "content-type": "application/json" }
        : {}),
    },
    ...(metodo === "POST" ? { body: JSON.stringify(corpo ?? {}) } : {}),
  });
  guardarCookies(resposta);
  return resposta;
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

/** GET com a sessão; renova o acesso (dura 10 min) e respeita o limite de pedidos. */
async function ler(url: string): Promise<{ status: number; ms: number }> {
  for (let tentativa = 0; ; tentativa++) {
    const inicio = performance.now();
    const resposta = await pedir("GET", url);
    // O corpo é lido até o fim (o tempo conta a resposta inteira) e descartado.
    await resposta.arrayBuffer();
    const ms = Math.round(performance.now() - inicio);
    if (tentativa < 2 && resposta.status === 401) {
      const renovada = await pedir("POST", "/api/v1/auth/renovar");
      await renovada.arrayBuffer();
      if (renovada.ok) continue;
    }
    if (tentativa < 2 && resposta.status === 429) {
      const segundos = Number(resposta.headers.get("retry-after") ?? 30);
      await esperar(Math.min(Math.max(segundos, 1), 90) * 1000);
      continue;
    }
    return { status: resposta.status, ms };
  }
}

async function principal(): Promise<number> {
  const todas = await rotasGet();
  if (process.argv.includes("--listar")) {
    for (const url of todas) console.log(url);
    return 0;
  }
  const rotas = todas.filter((u) => !motivoDeFora(u));

  const email = ambiente("FUMACA_EMAIL") ?? ambiente("TESTE_EMAIL");
  const senha = ambiente("FUMACA_SENHA") ?? ambiente("TESTE_SENHA");
  if (!email || !senha) {
    console.error("Defina FUMACA_EMAIL e FUMACA_SENHA.");
    return 2;
  }
  const entrada = await pedir("POST", "/api/v1/auth/entrar", { email, senha });
  await entrada.arrayBuffer();
  if (!entrada.ok || cookies.size === 0) {
    console.error(
      `Não entrou (status ${entrada.status}). Confira BASE_URL, FUMACA_ORIGEM e o usuário.`,
    );
    return 2;
  }

  console.log(`Fumaça em ${BASE}: ${rotas.length} rotas GET`);
  const resultados: { url: string; status: number; ms: number }[] = [];
  for (const url of rotas) {
    let r: { status: number; ms: number };
    try {
      r = await ler(url);
    } catch {
      // Sem resposta (prazo, conexão): conta como defeito.
      r = { status: 0, ms: PRAZO_MS };
    }
    resultados.push({ url, ...r });
    console.log(
      `${String(r.status).padStart(3)} ${String(r.ms).padStart(6)} ms  ${url}`,
    );
  }
  const saida = await pedir("POST", "/api/v1/auth/sair");
  await saida.arrayBuffer();

  const conta = (de: number, ate: number) =>
    resultados.filter((r) => r.status >= de && r.status <= ate).length;
  const defeitos = resultados.filter((r) => r.status >= 500 || r.status === 0);
  console.log(
    `\nTotal ${resultados.length} | 2xx ${conta(200, 299)} | 3xx ${conta(300, 399)} | 4xx ${conta(400, 499)} | 5xx ${conta(500, 599)} | sem resposta ${conta(0, 0)}`,
  );
  console.log(
    `Fora da conferência (sistema externo): ${todas.length - rotas.length}`,
  );
  console.log("\nMais lentas:");
  for (const r of [...resultados].sort((a, b) => b.ms - a.ms).slice(0, 10))
    console.log(
      `${String(r.ms).padStart(6)} ms  ${String(r.status).padStart(3)}  ${r.url}`,
    );
  if (defeitos.length) {
    console.log("\nDefeitos:");
    for (const r of defeitos) console.log(`${r.status}  ${r.url}`);
  }
  return defeitos.length ? 1 : 0;
}

process.exit(await principal());
