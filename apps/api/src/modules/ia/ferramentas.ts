import type Anthropic from "@anthropic-ai/sdk";
import type { FonteConsultada } from "@arp/shared/ia/contratos";
import { PERMISSOES } from "@arp/shared/permissions";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { log } from "@/infra/log";
import { calcular, entradaCalculo } from "./calculo";
import { acharFonte, detalheDaFonte, type Fonte } from "./catalogo";
import { lerComo } from "./consulta";

// As ferramentas da IA: ver o que uma fonte aceita e devolve, ler a fonte
// como a pessoa e fazer contas sobre a lista inteira de uma fonte (aqui no
// servidor). A entrada vem do modelo: é validada aqui e o caminho só é
// aceito se for uma fonte do catálogo (nunca um endereço livre).

const OPERADORES = [
  "igual",
  "diferente",
  "maior",
  "maior_igual",
  "menor",
  "menor_igual",
  "entre",
  "contem",
  "em",
  "vazio",
  "preenchido",
];

export const FERRAMENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: "detalhar_fontes",
    description:
      "Mostra, para até 10 fontes do catálogo, os parâmetros aceitos (com tipo e se são obrigatórios) e o formato completo da resposta, com os nomes dos campos das listas. Use antes de consultar ou calcular sobre uma fonte cujo uso não está claro pelo catálogo.",
    input_schema: {
      type: "object",
      properties: {
        caminhos: {
          type: "array",
          items: { type: "string" },
          description:
            "Caminhos exatamente como no catálogo, ex.: /sustentabilidade/painel",
        },
      },
      required: ["caminhos"],
      additionalProperties: false,
    },
  },
  {
    name: "consultar",
    description:
      "Lê uma fonte do catálogo com o acesso da pessoa que perguntou e devolve o JSON (listas longas vêm cortadas, com o total: para somar, contar ou filtrar por período use calcular). Para fontes com :parâmetro no caminho, troque pelo valor (ex.: /rh/funcionarios/:id → /rh/funcionarios/123). Pode chamar várias vezes em paralelo.",
    input_schema: {
      type: "object",
      properties: {
        caminho: {
          type: "string",
          description: "Caminho da fonte, sem ?parâmetros.",
        },
        parametros: {
          type: "object",
          description:
            'Parâmetros de consulta (o que vem depois do ?), ex.: {"ano": 2026, "mes": "2026-10"}. Lista repete o parâmetro.',
          additionalProperties: true,
        },
      },
      required: ["caminho"],
      additionalProperties: false,
    },
  },
  {
    name: "calcular",
    description:
      'Faz contas sobre uma lista INTEIRA de uma fonte, no servidor, com o acesso da pessoa: filtra (inclusive por período), agrupa (por campo, dia, mês ou ano) e soma, conta, tira média, mínimo, máximo ou distintos. Use para totais, rankings e períodos, em vez de ler a lista com consultar (que vem cortada). Campo dentro de objeto usa ponto (metrics.cost_micros). Datas comparam como texto AAAA-MM-DD ("entre" inclui as duas pontas; instante ISO é comparado pelo dia). Ex.: gasto do Meta em novembro = {"caminho": "/marketing/fontes/anuncios", "lista": "meta.insights", "filtros": [{"campo": "date_start", "op": "entre", "valor": ["2026-11-01", "2026-11-30"]}], "medidas": [{"funcao": "soma", "campo": "spend"}]}. Várias contas independentes podem ir em paralelo.',
    input_schema: {
      type: "object",
      properties: {
        caminho: { type: "string", description: "Caminho da fonte, sem ?." },
        parametros: {
          type: "object",
          description: "Parâmetros de consulta da fonte (como em consultar).",
          additionalProperties: true,
        },
        lista: {
          type: "string",
          description:
            "Caminho da lista dentro da resposta, com ponto (ex.: meta.insights, google.linhas, conversoes). Vazio: a própria resposta é a lista.",
        },
        filtros: {
          type: "array",
          items: {
            type: "object",
            properties: {
              campo: { type: "string" },
              op: { type: "string", enum: OPERADORES },
              valor: {
                description:
                  "Valor; em 'entre', [de, até]; em 'em', uma lista; sem valor em 'vazio' e 'preenchido'.",
              },
            },
            required: ["campo", "op"],
          },
        },
        agrupar_por: {
          type: "array",
          items: { type: "string" },
          description:
            "Campos do grupo; em data, ':dia', ':mes' ou ':ano' (ex.: created_at:mes).",
        },
        medidas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              funcao: {
                type: "string",
                enum: [
                  "soma",
                  "media",
                  "contagem",
                  "minimo",
                  "maximo",
                  "distintos",
                ],
              },
              campo: {
                type: "string",
                description: "Sem campo, 'contagem' conta os itens.",
              },
              multiplicar: {
                type: "number",
                description: "Fator do resultado (ex.: 0.000001 para micros).",
              },
              nome: { type: "string" },
            },
            required: ["funcao"],
          },
        },
        ordenar_por: {
          type: "string",
          description: "Campo do grupo ou nome da medida.",
        },
        decrescente: { type: "boolean" },
        limite: { type: "integer", description: "Máximo de grupos (até 500)." },
      },
      required: ["caminho", "lista", "medidas"],
      additionalProperties: false,
    },
  },
];

const entradaDetalhar = z.object({
  caminhos: z.array(z.string().max(300)).min(1).max(10),
});

const valor = z.union([z.string().max(500), z.number(), z.boolean()]);
const entradaConsultar = z.object({
  caminho: z.string().min(1).max(300),
  parametros: z
    .record(z.string().min(1).max(60), z.union([valor, z.array(valor).max(50)]))
    .optional(),
});
const entradaCalcular = entradaConsultar.extend(entradaCalculo.shape);

export interface ResultadoDaFerramenta {
  conteudo: string;
  erro: boolean;
  /** Em `consultar` e `calcular`: a fonte lida (painel de uso e tela). */
  fonte?: FonteConsultada;
}

const erro = (conteudo: string): ResultadoDaFerramenta => ({
  conteudo,
  erro: true,
});

/** Tamanho máximo do JSON devolvido à IA (≈ 10 mil tokens). */
const LIMITE_DO_RESULTADO = 40_000;

function cortarListas(v: unknown, maximo: number): unknown {
  if (Array.isArray(v)) {
    const itens = v.slice(0, maximo).map((i) => cortarListas(i, maximo));
    if (v.length > maximo)
      itens.push(
        `… lista cortada: mostrando ${maximo} de ${v.length} itens (para totais e períodos use calcular)`,
      );
    return itens;
  }
  if (typeof v === "object" && v !== null)
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, cortarListas(x, maximo)]),
    );
  return v;
}

/** JSON compacto que cabe no limite, cortando as listas aos poucos. */
export function compactar(
  dados: unknown,
  limite = LIMITE_DO_RESULTADO,
): string {
  for (const maximo of [200, 80, 40, 20, 10, 5]) {
    const texto = JSON.stringify(cortarListas(dados, maximo));
    if (texto.length <= limite) return texto;
  }
  const texto = JSON.stringify(cortarListas(dados, 3));
  return `${texto.slice(0, limite)}… [resposta cortada: grande demais; use calcular]`;
}

function decodificar(trecho: string): string | null {
  try {
    return decodeURIComponent(trecho);
  } catch {
    return null;
  }
}

/** Caminho limpo (sem ?, #, .., //), já decodificado, ou null. */
function caminhoLimpo(caminho: string): string[] | null {
  const sem = caminho.trim().replace(/^\/api\/v1(?=\/)/, "");
  if (!sem.startsWith("/") || /[?#\\]/.test(sem) || sem.includes("//"))
    return null;
  const trechos = sem.slice(1).split("/").map(decodificar);
  if (trechos.some((t) => t === null || t === "" || t === "." || t === ".."))
    return null;
  return trechos.filter((t): t is string => t !== null);
}

function textoDoErro(corpo: string): string {
  try {
    const lido = z
      .object({
        erro: z.object({
          mensagem: z.string(),
          campos: z.record(z.string(), z.string()).optional(),
        }),
      })
      .parse(JSON.parse(corpo));
    const campos = lido.erro.campos
      ? ` Campos: ${Object.entries(lido.erro.campos)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")}`
      : "";
    return `${lido.erro.mensagem}${campos}`;
  } catch {
    return "sem detalhe";
  }
}

type Lido =
  | { ok: true; dados: unknown; fonte: FonteConsultada }
  | { ok: false; resultado: ResultadoDaFerramenta };

/** Lê a fonte como a pessoa: só caminho do catálogo e com a permissão. */
async function ler(
  ctx: Contexto,
  catalogo: readonly Fonte[],
  entrada: z.infer<typeof entradaConsultar>,
): Promise<Lido> {
  const falha = (r: ResultadoDaFerramenta): Lido => ({
    ok: false,
    resultado: r,
  });
  const trechos = caminhoLimpo(entrada.caminho);
  if (!trechos)
    return falha(erro("Caminho inválido. Use um caminho do catálogo."));
  const caminho = `/${trechos.join("/")}`;
  const fonte = acharFonte(catalogo, caminho);
  if (!fonte)
    return falha(
      erro(
        `"${caminho}" não é uma fonte do catálogo. Use só os caminhos listados.`,
      ),
    );
  const negada = (conteudo: string): Lido =>
    falha({
      ...erro(conteudo),
      fonte: { caminho, modulo: fonte.modulo, ok: false },
    });
  if (fonte.permissao && !ctx.permissoes.has(fonte.permissao))
    return negada(
      `A pessoa não tem a permissão ${fonte.permissao} (${PERMISSOES[fonte.permissao]}). Não insista: diga que ela não tem acesso a esse dado e que o administrador pode liberar.`,
    );

  const consulta = new URLSearchParams();
  for (const [k, v] of Object.entries(entrada.parametros ?? {}))
    for (const item of Array.isArray(v) ? v : [v])
      consulta.append(k, String(item));
  const query = consulta.toString();
  const url = `/api/v1/${trechos.map(encodeURIComponent).join("/")}${query ? `?${query}` : ""}`;

  const r = await lerComo(ctx, url);
  if (r.status >= 500) {
    log.warn(
      { caminho: fonte.caminho, status: r.status },
      "IA: leitura falhou",
    );
    return negada(
      "A leitura falhou no servidor. Tente outra fonte ou avise a pessoa.",
    );
  }
  if (r.status >= 400)
    return negada(`Erro ${r.status}: ${textoDoErro(r.corpo)}`);
  if (!r.tipo.includes("json"))
    return negada("Esta fonte devolve um arquivo, não dados.");
  try {
    return {
      ok: true,
      dados: JSON.parse(r.corpo),
      fonte: { caminho, modulo: fonte.modulo, ok: true },
    };
  } catch {
    return negada("Resposta ilegível.");
  }
}

async function consultar(
  ctx: Contexto,
  catalogo: readonly Fonte[],
  entrada: z.infer<typeof entradaConsultar>,
): Promise<ResultadoDaFerramenta> {
  const r = await ler(ctx, catalogo, entrada);
  if (!r.ok) return r.resultado;
  return { conteudo: compactar(r.dados), erro: false, fonte: r.fonte };
}

async function fazerConta(
  ctx: Contexto,
  catalogo: readonly Fonte[],
  entrada: z.infer<typeof entradaCalcular>,
): Promise<ResultadoDaFerramenta> {
  const { caminho, parametros, ...conta } = entrada;
  const r = await ler(ctx, catalogo, { caminho, parametros });
  if (!r.ok) return r.resultado;
  return {
    conteudo: compactar(calcular(r.dados, conta)),
    erro: false,
    fonte: r.fonte,
  };
}

function detalhar(
  catalogo: readonly Fonte[],
  entrada: z.infer<typeof entradaDetalhar>,
): ResultadoDaFerramenta {
  const partes = entrada.caminhos.map((c) => {
    const trechos = caminhoLimpo(c);
    const fonte = trechos
      ? acharFonte(catalogo, `/${trechos.join("/")}`)
      : null;
    return fonte
      ? detalheDaFonte(fonte)
      : `# ${c}\nNão é uma fonte do catálogo.`;
  });
  return { conteudo: partes.join("\n\n"), erro: false };
}

const problemas = (e: z.ZodError) =>
  e.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`)
    .join("; ");

/** Quais ferramentas leem dados (contam no limite de leituras da pergunta). */
export const LEITURAS = new Set(["consultar", "calcular"]);

export async function executarFerramenta(
  ctx: Contexto,
  catalogo: readonly Fonte[],
  nome: string,
  entrada: unknown,
): Promise<ResultadoDaFerramenta> {
  if (nome === "detalhar_fontes") {
    const e = entradaDetalhar.safeParse(entrada);
    return e.success
      ? detalhar(catalogo, e.data)
      : erro('Entrada inválida: mande { caminhos: ["/modulo/recurso"] }.');
  }
  if (nome === "consultar") {
    const e = entradaConsultar.safeParse(entrada);
    return e.success
      ? consultar(ctx, catalogo, e.data)
      : erro(`Entrada inválida: ${problemas(e.error)}`);
  }
  if (nome === "calcular") {
    const e = entradaCalcular.safeParse(entrada);
    return e.success
      ? fazerConta(ctx, catalogo, e.data)
      : erro(`Entrada inválida: ${problemas(e.error)}`);
  }
  return erro(`Ferramenta desconhecida: ${nome}.`);
}
