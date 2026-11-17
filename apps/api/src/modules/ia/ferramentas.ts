import type Anthropic from "@anthropic-ai/sdk";
import type { FonteConsultada } from "@arp/shared/ia/contratos";
import { PERMISSOES } from "@arp/shared/permissions";
import { z } from "zod";
import type { Contexto } from "@/contexto";
import { log } from "@/infra/log";
import { acharFonte, detalheDaFonte, type Fonte } from "./catalogo";
import { lerComo } from "./consulta";

// As duas ferramentas da IA: ver o que uma fonte aceita e devolve, e ler a
// fonte como a pessoa. A entrada vem do modelo: é validada aqui e o caminho
// só é aceito se for uma fonte do catálogo (nunca um endereço livre).

export const FERRAMENTAS: Anthropic.Beta.BetaTool[] = [
  {
    name: "detalhar_fontes",
    description:
      "Mostra, para até 10 fontes do catálogo, os parâmetros aceitos (com tipo e se são obrigatórios) e o formato completo da resposta. Use antes de consultar uma fonte cujo uso não está claro pelo catálogo.",
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
      "Lê uma fonte do catálogo com o acesso da pessoa que perguntou e devolve o JSON (listas longas vêm cortadas, com o total). Para fontes com :parâmetro no caminho, troque pelo valor (ex.: /rh/funcionarios/:id → /rh/funcionarios/123). Pode chamar várias vezes em paralelo.",
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

export interface ResultadoDaFerramenta {
  conteudo: string;
  erro: boolean;
  /** Só em `consultar`: a fonte lida (para o painel e para a tela). */
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
        `… lista cortada: mostrando ${maximo} de ${v.length} itens (use filtros ou outra fonte mais resumida)`,
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
  return `${texto.slice(0, limite)}… [resposta cortada: grande demais; use filtros]`;
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

async function consultar(
  ctx: Contexto,
  catalogo: readonly Fonte[],
  entrada: z.infer<typeof entradaConsultar>,
): Promise<ResultadoDaFerramenta> {
  const trechos = caminhoLimpo(entrada.caminho);
  if (!trechos) return erro("Caminho inválido. Use um caminho do catálogo.");
  const caminho = `/${trechos.join("/")}`;
  const fonte = acharFonte(catalogo, caminho);
  if (!fonte)
    return erro(
      `"${caminho}" não é uma fonte do catálogo. Use só os caminhos listados.`,
    );
  const base = { caminho, modulo: fonte.modulo };
  if (fonte.permissao && !ctx.permissoes.has(fonte.permissao))
    return {
      ...erro(
        `A pessoa não tem a permissão ${fonte.permissao} (${PERMISSOES[fonte.permissao]}). Não insista: diga que ela não tem acesso a esse dado e que o administrador pode liberar.`,
      ),
      fonte: { ...base, ok: false },
    };

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
    return {
      ...erro(
        "A leitura falhou no servidor. Tente outra fonte ou avise a pessoa.",
      ),
      fonte: { ...base, ok: false },
    };
  }
  if (r.status >= 400)
    return {
      ...erro(`Erro ${r.status}: ${textoDoErro(r.corpo)}`),
      fonte: { ...base, ok: false },
    };
  if (!r.tipo.includes("json"))
    return {
      ...erro("Esta fonte devolve um arquivo, não dados."),
      fonte: { ...base, ok: false },
    };
  let dados: unknown;
  try {
    dados = JSON.parse(r.corpo);
  } catch {
    return { ...erro("Resposta ilegível."), fonte: { ...base, ok: false } };
  }
  return {
    conteudo: compactar(dados),
    erro: false,
    fonte: { ...base, ok: true },
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
      : erro(
          'Entrada inválida: mande { caminho: "/modulo/recurso", parametros: { ... } }.',
        );
  }
  return erro(`Ferramenta desconhecida: ${nome}.`);
}
