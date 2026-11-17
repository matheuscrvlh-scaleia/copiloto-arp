import { z } from "zod";

// Contas da IA sobre uma lista inteira de uma fonte, feitas aqui no
// servidor: filtrar (inclusive por período), agrupar (por campo, dia, mês ou
// ano) e somar, contar, tirar média, mínimo, máximo e distintos. Assim a IA
// não depende de ler a lista (que chega cortada) para chegar num total:
// "gasto de anúncios em novembro" vira uma soma com filtro de data.

const valorSimples = z.union([z.string().max(500), z.number(), z.boolean()]);

export const entradaCalculo = z.object({
  /** Caminho da lista dentro da resposta, com ponto: "meta.insights". */
  lista: z.string().max(200),
  filtros: z
    .array(
      z.object({
        campo: z.string().min(1).max(200),
        op: z.enum([
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
        ]),
        valor: z
          .union([valorSimples, z.array(valorSimples).max(100)])
          .optional(),
      }),
    )
    .max(20)
    .optional(),
  /** Campos do grupo; data com ":dia", ":mes" ou ":ano" (ex.: "date_start:mes"). */
  agrupar_por: z.array(z.string().min(1).max(200)).max(4).optional(),
  medidas: z
    .array(
      z.object({
        funcao: z.enum([
          "soma",
          "media",
          "contagem",
          "minimo",
          "maximo",
          "distintos",
        ]),
        campo: z.string().max(200).optional(),
        /** Multiplica o resultado (ex.: 0.000001 para micros → reais). */
        multiplicar: z.number().optional(),
        nome: z.string().max(60).optional(),
      }),
    )
    .min(1)
    .max(12),
  ordenar_por: z.string().max(200).optional(),
  decrescente: z.boolean().optional(),
  limite: z.number().int().min(1).max(500).optional(),
});
export type EntradaCalculo = z.infer<typeof entradaCalculo>;

type Valor = unknown;

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Segue o caminho com ponto; listas no meio são achatadas. */
function seguir(raiz: unknown, caminho: string): unknown[] {
  let atuais: unknown[] = [raiz];
  for (const trecho of caminho.split(".").filter(Boolean)) {
    const proximos: unknown[] = [];
    for (const a of atuais) {
      const filhos = Array.isArray(a) ? a : [a];
      for (const f of filhos)
        if (ehObjeto(f) && trecho in f) proximos.push(f[trecho]);
    }
    atuais = proximos;
  }
  return atuais.flatMap((a) => (Array.isArray(a) ? a : [a]));
}

/** O valor de um campo do item (com ponto para campo dentro de objeto). */
function campoDe(item: unknown, caminho: string): Valor {
  let atual: unknown = item;
  for (const trecho of caminho.split(".")) {
    if (!ehObjeto(atual)) return undefined;
    atual = atual[trecho];
  }
  return atual;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function numero(v: Valor): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
    return Number(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  return null;
}

/** Compara como número quando os dois são números; como data/texto senão. */
function comparar(a: Valor, b: Valor): number | null {
  const na = numero(a);
  const nb = numero(b);
  if (na !== null && nb !== null && typeof b !== "string") return na - nb;
  if (typeof a === "string" && typeof b === "string") {
    // "2026-11-17T10:00Z" contra "2026-11-17": compara só o dia.
    const x = DATA.test(b) && a.length > 10 ? a.slice(0, 10) : a;
    return x < b ? -1 : x > b ? 1 : 0;
  }
  if (na !== null && nb !== null) return na - nb;
  return null;
}

type Filtro = NonNullable<EntradaCalculo["filtros"]>[number];

function passa(item: unknown, f: Filtro): boolean {
  const v = campoDe(item, f.campo);
  const alvo = f.valor;
  const lista = Array.isArray(alvo) ? alvo : [alvo];
  const c = (b: Valor) => comparar(v, b);
  switch (f.op) {
    case "vazio":
      return v === null || v === undefined || v === "";
    case "preenchido":
      return !(v === null || v === undefined || v === "");
    case "igual":
      return c(alvo) === 0 || String(v) === String(alvo);
    case "diferente":
      return !(c(alvo) === 0 || String(v) === String(alvo));
    case "maior":
      return (c(alvo) ?? 0) > 0;
    case "maior_igual":
      return (c(alvo) ?? -1) >= 0;
    case "menor":
      return (c(alvo) ?? 0) < 0;
    case "menor_igual":
      return (c(alvo) ?? 1) <= 0;
    case "entre": {
      const [de, ate] = lista;
      return (comparar(v, de) ?? -1) >= 0 && (comparar(v, ate) ?? 1) <= 0;
    }
    case "em":
      return lista.some((x) => c(x) === 0 || String(v) === String(x));
    case "contem":
      return String(v ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(String(alvo ?? "").toLocaleLowerCase("pt-BR"));
    default:
      return false;
  }
}

function chaveDo(item: unknown, grupo: string): string {
  const [campo = "", corte] = grupo.split(":");
  const v = campoDe(item, campo);
  const t = v === null || v === undefined ? "(vazio)" : String(v);
  if (corte === "dia") return t.slice(0, 10);
  if (corte === "mes") return t.slice(0, 7);
  if (corte === "ano") return t.slice(0, 4);
  return t;
}

type Medida = EntradaCalculo["medidas"][number];

const nomeDa = (m: Medida) =>
  m.nome ?? (m.campo ? `${m.funcao}(${m.campo})` : m.funcao);

function medir(itens: unknown[], m: Medida): number {
  if (m.funcao === "contagem" && !m.campo) return itens.length;
  const valores = itens.map((i) => campoDe(i, m.campo ?? ""));
  if (m.funcao === "contagem")
    return valores.filter((v) => v !== null && v !== undefined).length;
  if (m.funcao === "distintos")
    return new Set(valores.filter((v) => v !== undefined).map(String)).size;
  const nums = valores.map(numero).filter((n): n is number => n !== null);
  const fator = m.multiplicar ?? 1;
  if (nums.length === 0) return 0;
  let r: number;
  if (m.funcao === "soma") r = nums.reduce((s, n) => s + n, 0);
  else if (m.funcao === "media")
    r = nums.reduce((s, n) => s + n, 0) / nums.length;
  else if (m.funcao === "minimo") r = Math.min(...nums);
  else r = Math.max(...nums);
  return Math.round(r * fator * 1e6) / 1e6;
}

export interface ResultadoDoCalculo {
  lista: string;
  itens_na_lista: number;
  itens_no_filtro: number;
  grupos: Record<string, string | number>[];
  grupos_no_total: number;
  aviso?: string;
}

export function calcular(
  dados: unknown,
  e: EntradaCalculo,
): ResultadoDoCalculo {
  const todos = seguir(dados, e.lista);
  const filtrados = todos.filter((i) =>
    (e.filtros ?? []).every((f) => passa(i, f)),
  );
  const porGrupo = new Map<string, { chaves: string[]; itens: unknown[] }>();
  const grupos = e.agrupar_por ?? [];
  for (const item of filtrados) {
    const chaves = grupos.map((g) => chaveDo(item, g));
    const k = JSON.stringify(chaves);
    const atual = porGrupo.get(k) ?? { chaves, itens: [] };
    atual.itens.push(item);
    porGrupo.set(k, atual);
  }
  if (grupos.length === 0 && porGrupo.size === 0)
    porGrupo.set("[]", { chaves: [], itens: [] });

  let linhas = [...porGrupo.values()].map(({ chaves, itens }) => {
    const linha: Record<string, string | number> = {};
    grupos.forEach((g, k) => {
      linha[g] = chaves[k] ?? "";
    });
    for (const m of e.medidas) linha[nomeDa(m)] = medir(itens, m);
    return linha;
  });

  const ordem = e.ordenar_por ?? grupos[0];
  if (ordem)
    linhas.sort((a, b) => {
      const x = a[ordem];
      const y = b[ordem];
      const r =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR");
      return e.decrescente ? -r : r;
    });
  const total = linhas.length;
  linhas = linhas.slice(0, e.limite ?? 200);
  return {
    lista: e.lista,
    itens_na_lista: todos.length,
    itens_no_filtro: filtrados.length,
    grupos: linhas,
    grupos_no_total: total,
    ...(todos.length === 0
      ? {
          aviso:
            "A lista está vazia ou o caminho não existe nesta fonte. Confira o caminho com detalhar_fontes.",
        }
      : {}),
  };
}
