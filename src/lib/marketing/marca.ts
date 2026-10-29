import { z } from "zod";

// Base da marca (spec 4.4): os blocos de marketing.marca_blocos, o formato
// do conteúdo de cada tipo, o texto do formulário de edição (uma linha por
// item) e a comparação "antes × depois" do histórico. Sem banco, sem Next.

export const ABAS_MARCA = {
  plataforma: "Plataforma da marca",
  tom_de_voz: "Tom de voz e palavras",
  publico: "Público",
  identidade: "Identidade visual",
  arquivos: "Arquivos",
  revisor: "Revisor de texto",
  historico: "Histórico",
} as const;
export type AbaMarca = keyof typeof ABAS_MARCA;
/** Abas cujo conteúdo vem dos blocos (as outras são telas próprias). */
export type AbaDeBlocos =
  | "plataforma"
  | "tom_de_voz"
  | "publico"
  | "identidade";

export type TipoBloco = "texto" | "lista" | "cores";

const curto = (max: number) => z.string().trim().max(max);

export const itemLista = z.object({
  titulo: curto(200).min(1),
  texto: curto(2000).optional(),
});
export type ItemLista = z.infer<typeof itemLista>;

/** "#1e7dd2", "1E7DD2" ou "#1ED" → "#1E7DD2". */
export function normalizarHex(valor: string): string | null {
  const v = valor.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(v)) return `#${v.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(v))
    return `#${[...v]
      .map((c) => c + c)
      .join("")
      .toUpperCase()}`;
  return null;
}

export const cor = z.object({
  nome: curto(100).min(1),
  hex: z.string().regex(/^#[0-9A-F]{6}$/, "HEX no formato #RRGGBB"),
  uso: curto(300).optional(),
});
export type Cor = z.infer<typeof cor>;

export const CONTEUDO = {
  texto: z.object({ texto: z.string().max(10000) }),
  lista: z.object({ itens: z.array(itemLista).max(100) }),
  cores: z.object({ itens: z.array(cor).max(40) }),
} as const;

export type Conteudo =
  | { tipo: "texto"; texto: string }
  | { tipo: "lista"; itens: ItemLista[] }
  | { tipo: "cores"; itens: Cor[] };

/** jsonb do banco → conteúdo tipado (inválido vira vazio, nunca quebra a tela). */
export function lerConteudo(tipo: string, json: unknown): Conteudo {
  if (tipo === "cores") {
    const r = CONTEUDO.cores.safeParse(json);
    return { tipo, itens: r.success ? r.data.itens : [] };
  }
  if (tipo === "lista") {
    const r = CONTEUDO.lista.safeParse(json);
    return { tipo, itens: r.success ? r.data.itens : [] };
  }
  const r = CONTEUDO.texto.safeParse(json);
  return { tipo: "texto", texto: r.success ? r.data.texto : "" };
}

/** Conteúdo → o jsonb que vai para o banco (sem campos vazios). */
export function paraJson(c: Conteudo) {
  if (c.tipo === "texto") return { texto: c.texto };
  if (c.tipo === "lista")
    return {
      itens: c.itens.map((i) =>
        i.texto ? { titulo: i.titulo, texto: i.texto } : { titulo: i.titulo },
      ),
    };
  return {
    itens: c.itens.map((i) =>
      i.uso
        ? { nome: i.nome, hex: i.hex, uso: i.uso }
        : { nome: i.nome, hex: i.hex },
    ),
  };
}

export function estaVazio(c: Conteudo): boolean {
  return c.tipo === "texto" ? !c.texto.trim() : c.itens.length === 0;
}

/** Itens da lista ainda sem a explicação (ex.: tons cadastrados só com o nome). */
export function semExplicacao(c: Conteudo): number {
  return c.tipo === "lista" ? c.itens.filter((i) => !i.texto).length : 0;
}

// ---------------------------------------------------------------------------
// Texto do formulário: uma linha por item, "Título — explicação"
// ---------------------------------------------------------------------------

/** Separa título e explicação: travessão, meia-risca ou hífen com espaços. */
const SEPARADOR = /\s+[—–-]\s+/;

function partes(linha: string): string[] {
  return linha
    .split(SEPARADOR)
    .map((p) => p.trim())
    .filter((p, i) => i === 0 || p);
}

/** Conteúdo → texto para o campo de edição. */
export function textoDoConteudo(c: Conteudo): string {
  if (c.tipo === "texto") return c.texto;
  if (c.tipo === "lista")
    return c.itens
      .map((i) => (i.texto ? `${i.titulo} — ${i.texto}` : i.titulo))
      .join("\n");
  return c.itens
    .map((i) => [i.nome, i.hex, i.uso].filter(Boolean).join(" — "))
    .join("\n");
}

export type Leitura =
  | { ok: true; conteudo: Conteudo }
  | { ok: false; erro: string };

/** Texto do formulário → conteúdo validado (erros dizem a linha). */
export function conteudoDoTexto(tipo: TipoBloco, texto: string): Leitura {
  if (tipo === "texto") {
    const r = CONTEUDO.texto.safeParse({ texto: texto.trim() });
    return r.success
      ? { ok: true, conteudo: { tipo, texto: r.data.texto } }
      : { ok: false, erro: "Texto longo demais (até 10.000 caracteres)." };
  }
  const linhas = texto
    .split(/\r?\n/)
    // Marcador de lista colado ("- item", "• item") não faz parte do item.
    .map((l, i) => ({ n: i + 1, l: l.trim().replace(/^[-•*—–]\s+/, "") }))
    .filter((x) => x.l);
  if (tipo === "lista") {
    const itens: ItemLista[] = [];
    for (const { n, l } of linhas) {
      const [titulo = "", ...resto] = partes(l);
      const r = itemLista.safeParse({
        titulo,
        texto: resto.join(" — ") || undefined,
      });
      if (!titulo)
        return {
          ok: false,
          erro: `Linha ${n}: falta o item antes do travessão.`,
        };
      if (!r.success)
        return {
          ok: false,
          erro: `Linha ${n}: título ou explicação longa demais.`,
        };
      // Repetido confunde o revisor e a lista: um item uma vez só.
      if (itens.some((i) => i.titulo.toLowerCase() === titulo.toLowerCase()))
        return { ok: false, erro: `Linha ${n}: "${titulo}" já está na lista.` };
      itens.push(r.data);
    }
    if (itens.length > 100) return { ok: false, erro: "No máximo 100 itens." };
    return { ok: true, conteudo: { tipo, itens } };
  }
  const itens: Cor[] = [];
  for (const { n, l } of linhas) {
    const [nome = "", hexBruto = "", ...uso] = partes(l);
    const hex = normalizarHex(hexBruto);
    if (!hex)
      return {
        ok: false,
        erro: `Linha ${n}: escreva "Nome — #RRGGBB — uso" (o código HEX tem 6 dígitos de 0-9 e A-F).`,
      };
    const r = cor.safeParse({ nome, hex, uso: uso.join(" — ") || undefined });
    if (!r.success)
      return {
        ok: false,
        erro: `Linha ${n}: falta o nome, ou nome ou uso longo demais.`,
      };
    if (itens.some((i) => i.nome.toLowerCase() === r.data.nome.toLowerCase()))
      return {
        ok: false,
        erro: `Linha ${n}: a cor "${r.data.nome}" já está na lista.`,
      };
    itens.push(r.data);
  }
  if (itens.length > 40) return { ok: false, erro: "No máximo 40 cores." };
  return { ok: true, conteudo: { tipo, itens } };
}

/** Mesmo conteúdo (para não gravar uma versão que não muda nada). */
export function mesmoConteudo(a: Conteudo, b: Conteudo): boolean {
  return JSON.stringify(paraJson(a)) === JSON.stringify(paraJson(b));
}

// ---------------------------------------------------------------------------
// Histórico: antes × depois por linha
// ---------------------------------------------------------------------------

export interface LinhaDiff {
  tipo: "igual" | "removido" | "incluido";
  texto: string;
}

/** Uma linha por item (ou por parágrafo, no texto). */
export function linhasDoConteudo(c: Conteudo | null): string[] {
  if (!c) return [];
  if (c.tipo === "texto") return c.texto.split(/\r?\n/).filter((l) => l.trim());
  return textoDoConteudo(c).split("\n").filter(Boolean);
}

/** Diferença por linha (maior subsequência comum): o que saiu e o que entrou. */
export function diferenca(antes: string[], depois: string[]): LinhaDiff[] {
  const n = antes.length;
  const m = depois.length;
  // lcs[i][j]: tamanho da maior subsequência comum de antes[i..] e depois[j..].
  const lcs = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      (lcs[i] as number[])[j] =
        antes[i] === depois[j]
          ? ((lcs[i + 1] as number[])[j + 1] as number) + 1
          : Math.max(
              (lcs[i + 1] as number[])[j] as number,
              (lcs[i] as number[])[j + 1] as number,
            );
  const saida: LinhaDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (antes[i] === depois[j]) {
      saida.push({ tipo: "igual", texto: antes[i] as string });
      i++;
      j++;
    } else if (
      ((lcs[i + 1] as number[])[j] as number) >=
      ((lcs[i] as number[])[j + 1] as number)
    ) {
      saida.push({ tipo: "removido", texto: antes[i++] as string });
    } else {
      saida.push({ tipo: "incluido", texto: depois[j++] as string });
    }
  }
  while (i < n) saida.push({ tipo: "removido", texto: antes[i++] as string });
  while (j < m) saida.push({ tipo: "incluido", texto: depois[j++] as string });
  return saida;
}

// ---------------------------------------------------------------------------
// Resumo para o Painel do Marketing
// ---------------------------------------------------------------------------

export interface ResumoMarca {
  blocos: number;
  preenchidos: number;
  /** Títulos dos blocos ainda vazios ("a preencher"). */
  vazios: string[];
  /** Itens de lista ainda sem explicação (tons, personas, jornada…). */
  itensSemExplicacao: number;
}

export function resumoMarca(
  blocos: { titulo: string; conteudo: Conteudo }[],
): ResumoMarca {
  const vazios = blocos.filter((b) => estaVazio(b.conteudo));
  return {
    blocos: blocos.length,
    preenchidos: blocos.length - vazios.length,
    vazios: vazios.map((b) => b.titulo),
    itensSemExplicacao: blocos.reduce(
      (s, b) => s + semExplicacao(b.conteudo),
      0,
    ),
  };
}

/** Termos de uma lista de palavras (proprietárias ou proibidas) para o revisor. */
export function termosDa(c: Conteudo | undefined): string[] {
  return c?.tipo === "lista" ? c.itens.map((i) => i.titulo) : [];
}

// ---------------------------------------------------------------------------
// Arquivos de marca (bucket privado "marketing")
// ---------------------------------------------------------------------------

/** Limite técnico do envio (o PDF do rebranding tem ~20 MB). */
export const ARQUIVO_MAX_BYTES = 25 * 1024 * 1024;

/** Extensão → tipo aceito. */
export const TIPOS_ARQUIVO: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  zip: "application/zip",
};

/** Tipo pelo nome do arquivo (null: não aceito). */
export function tipoDoArquivo(nome: string): string | null {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  return TIPOS_ARQUIVO[ext] ?? null;
}

/** Nome que pode ir no caminho do Storage: sem acento, espaço nem símbolo. */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .toLowerCase();
  return (limpo || "arquivo").slice(-120);
}

/** "2,4 MB", "830 KB". */
export function formatarTamanho(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024 * 1024)
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** "#58C069" → "88, 192, 105" e se o texto em cima deve ser escuro. */
export function rgbDe(hex: string): { rgb: string; textoEscuro: boolean } {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Luminância relativa (WCAG), aproximada: acima de ~0,5 pede texto escuro.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return { rgb: `${r}, ${g}, ${b}`, textoEscuro: lum > 0.6 };
}
