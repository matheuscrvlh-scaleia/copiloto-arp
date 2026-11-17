import { PERMISSOES, type Permissao } from "@arp/shared/permissions";
import { z } from "zod";
import type { RotaRegistrada } from "@/http/permissao";

// Catálogo de fontes da IA ARP: as leituras (GET) que as telas fazem,
// tiradas das rotas registradas de verdade. Por isso a IA acompanha o
// sistema sozinha: rota GET nova, com schema de resposta, vira fonte nova no
// próximo deploy, com a mesma permissão da rota. Ficam de fora as rotas
// públicas (valem por token de link), as de arquivo (sem schema de resposta:
// PDF, planilha) e as marcadas com `config.ia: false`.

const BASE = "/api/v1";

/** Prefixos que não são dado de negócio (ou seriam a própria IA). */
const FORA = new Set(["auth", "arquivos", "ia"]);

export interface Fonte {
  /** Relativo a /api/v1, com os parâmetros de caminho (`/rh/funcionarios/:id`). */
  caminho: string;
  /** Primeiro trecho do caminho (rh, financeiro…), para o painel de uso. */
  modulo: string;
  /** null: qualquer pessoa logada. */
  permissao: Permissao | null;
  descricao: string | null;
  params: string[];
  /** Parâmetros de consulta, já em texto curto. */
  consulta: Parametro[];
  /** Campos de primeiro nível da resposta. */
  campos: string[];
  /** Esquema completo (para `detalhar_fontes`). */
  schemas: { params: unknown; querystring: unknown; resposta: unknown };
  padrao: RegExp;
}

interface Parametro {
  nome: string;
  obrigatorio: boolean;
  tipo: string;
}

type Js = Record<string, unknown>;

const ehObjeto = (v: unknown): v is Js =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function jsonSchema(schema: unknown, io: "input" | "output"): Js | null {
  if (!(schema instanceof z.ZodType)) return null;
  try {
    return z.toJSONSchema(schema, {
      io,
      unrepresentable: "any",
      cycles: "ref",
      reused: "inline",
    });
  } catch {
    return null;
  }
}

/** Tira o `null` de um `anyOf` (campo que pode faltar). */
function semNulo(js: Js): { js: Js; nulo: boolean } {
  const variantes = js.anyOf ?? js.oneOf;
  if (!Array.isArray(variantes)) return { js, nulo: false };
  const outros = variantes.filter(
    (v): v is Js => ehObjeto(v) && v.type !== "null",
  );
  const nulo = outros.length < variantes.length;
  const [unico] = outros;
  return outros.length === 1 && unico
    ? { js: unico, nulo }
    : { js: { anyOf: outros }, nulo };
}

/** Tipo de um campo em poucas palavras: "texto", "número", "a|b|c"… */
function tipoCurto(entrada: unknown): string {
  if (!ehObjeto(entrada)) return "valor";
  const { js, nulo } = semNulo(entrada);
  const fim = nulo ? " ou nulo" : "";
  if (Array.isArray(js.enum))
    return `${js.enum.slice(0, 12).map(String).join("|")}${fim}`;
  if ("const" in js) return `${String(js.const)}${fim}`;
  if (Array.isArray(js.anyOf))
    return `${js.anyOf.map(tipoCurto).join(" ou ")}${fim}`;
  const t = js.type;
  if (t === "string") {
    const formato = typeof js.format === "string" ? js.format : null;
    const padrao = typeof js.pattern === "string" ? js.pattern : null;
    if (formato === "date") return `data AAAA-MM-DD${fim}`;
    if (formato === "date-time") return `data e hora ISO${fim}`;
    if (formato === "uuid") return `id (uuid)${fim}`;
    if (padrao === "^\\d{4}-\\d{2}$") return `mês AAAA-MM${fim}`;
    return `texto${fim}`;
  }
  if (t === "integer") return `inteiro${fim}`;
  if (t === "number") return `número${fim}`;
  if (t === "boolean") return `sim/não${fim}`;
  if (t === "array") return `lista de ${tipoCurto(js.items)}${fim}`;
  if (t === "object") return `objeto${fim}`;
  return `valor${fim}`;
}

function parametros(schema: unknown): Parametro[] {
  const js = jsonSchema(schema, "input");
  if (!js || !ehObjeto(js.properties)) return [];
  const obrigatorios = new Set(
    Array.isArray(js.required) ? js.required.map(String) : [],
  );
  return Object.entries(js.properties).map(([nome, p]) => {
    const descricao =
      ehObjeto(p) && typeof p.description === "string"
        ? ` (${p.description})`
        : "";
    return {
      nome,
      obrigatorio: obrigatorios.has(nome),
      tipo: `${tipoCurto(p)}${descricao}`,
    };
  });
}

/**
 * Esboço da resposta: os campos e os tipos, até `profundidade` níveis. É o
 * que a IA lê para saber o que cada fonte devolve antes de consultar.
 */
export function esboco(entrada: unknown, profundidade: number): string {
  if (!ehObjeto(entrada)) return "valor";
  const { js, nulo } = semNulo(entrada);
  const fim = nulo ? "?" : "";
  if (js.type === "array") {
    return `[${esboco(js.items, profundidade)}]${fim}`;
  }
  if (js.type === "object" || ehObjeto(js.properties)) {
    if (profundidade <= 0) return `{…}${fim}`;
    if (ehObjeto(js.properties)) {
      const campos = Object.entries(js.properties);
      const partes = campos
        .slice(0, 30)
        .map(([k, v]) => `${k}: ${esboco(v, profundidade - 1)}`);
      if (campos.length > 30) partes.push(`… +${campos.length - 30}`);
      return `{ ${partes.join(", ")} }${fim}`;
    }
    if (ehObjeto(js.additionalProperties))
      return `{ [chave]: ${esboco(js.additionalProperties, profundidade - 1)} }${fim}`;
    return `objeto${fim}`;
  }
  return tipoCurto(entrada);
}

/** Nomes dos campos de um objeto (ou dos itens de uma lista), até `max`. */
function nomesDe(entrada: unknown, max: number): string | null {
  if (!ehObjeto(entrada)) return null;
  const { js } = semNulo(entrada);
  const alvo =
    js.type === "array" && ehObjeto(js.items) ? semNulo(js.items).js : js;
  if (!ehObjeto(alvo.properties)) return null;
  const nomes = Object.keys(alvo.properties);
  const lista = `${nomes.slice(0, max).join(",")}${nomes.length > max ? ",…" : ""}`;
  return js.type === "array" ? `[{${lista}}]` : `{${lista}}`;
}

/**
 * Campos de primeiro nível, com os do nível de baixo entre chaves (muita
 * rota embrulha tudo numa chave só: `pessoas{ativos,admissoes,…}`).
 */
function camposDoTopo(schema: unknown): string[] {
  const js = jsonSchema(schema, "output");
  if (!js) return [];
  const { js: alvo } = semNulo(js);
  if (alvo.type === "array") return [nomesDe(alvo, 10) ?? "lista"];
  if (!ehObjeto(alvo.properties)) return [];
  const campos = Object.entries(alvo.properties);
  const porCampo = campos.length <= 3 ? 10 : campos.length <= 6 ? 5 : 0;
  return campos.map(
    ([k, v]) => `${k}${porCampo ? (nomesDe(v, porCampo) ?? "") : ""}`,
  );
}

const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `/rh/funcionarios/:id` casa com `/rh/funcionarios/abc` e só com isso. */
function padraoDe(caminho: string): RegExp {
  const partes = caminho
    .split("/")
    .map((p) => (p.startsWith(":") ? "[^/]+" : escapar(p)));
  return new RegExp(`^${partes.join("/")}$`);
}

export function montarCatalogo(rotas: readonly RotaRegistrada[]): Fonte[] {
  const fontes: Fonte[] = [];
  const vistos = new Set<string>();
  for (const r of rotas) {
    if (r.metodo !== "GET" || !r.url.startsWith(`${BASE}/`)) continue;
    if (r.acesso === "publico" || r.ia === false) continue;
    if (!r.acesso && !r.permissao) continue;
    if (!(r.schemas.resposta instanceof z.ZodType)) continue;
    if (r.url.includes("*")) continue;
    const caminho = r.url.slice(BASE.length).replace(/\/$/, "") || "/";
    const modulo = caminho.split("/")[1] ?? "";
    if (FORA.has(modulo) || vistos.has(caminho)) continue;
    vistos.add(caminho);
    fontes.push({
      caminho,
      modulo,
      permissao: r.permissao ?? null,
      descricao: typeof r.ia === "string" ? r.ia : null,
      params: caminho
        .split("/")
        .filter((p) => p.startsWith(":"))
        .map((p) => p.slice(1)),
      consulta: parametros(r.schemas.querystring),
      campos: camposDoTopo(r.schemas.resposta),
      schemas: r.schemas,
      padrao: padraoDe(caminho),
    });
  }
  return fontes;
}

/** A fonte de um caminho concreto (`/rh/funcionarios/123`), se houver. */
export function acharFonte(
  catalogo: readonly Fonte[],
  caminho: string,
): Fonte | null {
  const exato = catalogo.find((f) => f.caminho === caminho);
  if (exato) return exato;
  // Entre dois padrões que casam, vale o de mais trechos fixos.
  const fixos = (f: Fonte) =>
    f.caminho.split("/").filter((p) => p && !p.startsWith(":")).length;
  return (
    catalogo
      .filter((f) => f.padrao.test(caminho))
      .sort((a, b) => fixos(b) - fixos(a))[0] ?? null
  );
}

/** Uma linha por fonte: caminho, parâmetros, campos e permissão. */
function linha(f: Fonte): string {
  const consulta = f.consulta.length
    ? ` ?${f.consulta.map((p) => p.nome + (p.obrigatorio ? "" : "?")).join("&")}`
    : "";
  const campos = f.campos.length
    ? ` → ${f.campos.slice(0, 12).join(", ")}${f.campos.length > 12 ? ", …" : ""}`
    : "";
  const quem = f.permissao ? ` [${f.permissao}]` : " [qualquer pessoa]";
  const descricao = f.descricao ? ` — ${f.descricao}` : "";
  return `${f.caminho}${consulta}${campos}${quem}${descricao}`;
}

/**
 * O catálogo em texto, para as instruções da IA: as fontes de cada módulo e
 * o que cada permissão libera. Igual para todo mundo (vai no cache); o que
 * a pessoa pode vem no contexto da conversa.
 */
export function textoDoCatalogo(catalogo: readonly Fonte[]): string {
  const porModulo = new Map<string, Fonte[]>();
  for (const f of catalogo) {
    const lista = porModulo.get(f.modulo) ?? [];
    lista.push(f);
    porModulo.set(f.modulo, lista);
  }
  const blocos = [...porModulo.entries()].map(
    ([modulo, fontes]) =>
      `## ${modulo || "geral"}\n${fontes.map(linha).join("\n")}`,
  );
  const usadas = [
    ...new Set(catalogo.flatMap((f) => (f.permissao ? [f.permissao] : []))),
  ].sort();
  const legenda = usadas.map((p) => `${p}: ${PERMISSOES[p]}`).join("\n");
  return `${blocos.join("\n\n")}\n\n# O que cada permissão libera\n${legenda}`;
}

/** O detalhe de uma fonte: parâmetros com tipo e o esboço da resposta. */
export function detalheDaFonte(f: Fonte): string {
  const params = f.params.length
    ? `Parâmetros no caminho: ${f.params.join(", ")} (troque :nome pelo valor).`
    : null;
  const consulta = f.consulta.length
    ? `Parâmetros de consulta:\n${f.consulta
        .map(
          (p) =>
            `- ${p.nome}${p.obrigatorio ? " (obrigatório)" : ""}: ${p.tipo}`,
        )
        .join("\n")}`
    : "Sem parâmetros de consulta.";
  const resposta = `Resposta: ${esboco(jsonSchema(f.schemas.resposta, "output"), 5)}`;
  return [
    `# ${f.caminho}`,
    f.descricao,
    `Permissão: ${f.permissao ?? "qualquer pessoa logada"}`,
    params,
    consulta,
    resposta,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
