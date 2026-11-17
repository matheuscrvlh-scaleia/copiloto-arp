import { z } from "zod";
import { type Campo, camposSchema, recebeResposta } from "./campos";

// O formulário como um todo: situação, se o link aceita resposta agora e a
// validação das configurações. Funções puras, com testes.

export const SITUACOES = ["rascunho", "publicado", "encerrado"] as const;
export type Situacao = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  rascunho: "Rascunho",
  publicado: "Publicado",
  encerrado: "Encerrado",
};

/** Por que o link não aceita resposta agora. */
export type MotivoFechado = "inexistente" | "rascunho" | "encerrado";

export interface EstadoDoLink {
  situacao: Situacao;
  encerra_em: string | null;
  limite_respostas: number | null;
  total_respostas: number;
}

/**
 * Situação de fato do link: publicado mas vencido (data) ou cheio (limite)
 * conta como encerrado. A mesma regra está em formularios.responder().
 */
export function situacaoEfetiva(f: EstadoDoLink, agora: Date): Situacao {
  if (f.situacao !== "publicado") return f.situacao;
  if (f.encerra_em && new Date(f.encerra_em).getTime() <= agora.getTime())
    return "encerrado";
  if (f.limite_respostas !== null && f.total_respostas >= f.limite_respostas)
    return "encerrado";
  return "publicado";
}

/** Motivo do link fechado, ou null quando aceita resposta. */
export function motivoFechado(
  f: EstadoDoLink | null,
  agora: Date,
): MotivoFechado | null {
  if (!f) return "inexistente";
  const s = situacaoEfetiva(f, agora);
  return s === "publicado" ? null : s;
}

/** Título, descrição e perguntas, como o editor grava. */
export const conteudoSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Dê um título ao relatório.")
    .max(200, "Título com no máximo 200 caracteres."),
  descricao: z.string().trim().max(5000).default(""),
  campos: camposSchema,
});

/** Configurações do link. */
export const configuracoesSchema = z.object({
  mensagem_final: z.string().trim().max(2000).default(""),
  /** "aaaa-mm-ddThh:mm" no horário de Brasília, ou vazio. */
  encerra_em: z
    .string()
    .trim()
    .regex(
      /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/,
      "Data de encerramento inválida.",
    ),
  limite_respostas: z
    .string()
    .trim()
    .regex(/^\d{0,6}$/, "Limite de respostas inválido.")
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || v > 0, "O limite precisa ser maior que zero."),
});

/** "aaaa-mm-ddThh:mm" em Brasília (UTC-3, sem horário de verão) → ISO UTC. */
export function deBrasilia(local: string): string | null {
  if (!local) return null;
  const d = new Date(`${local}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO UTC → "aaaa-mm-ddThh:mm" em Brasília (para o campo datetime-local). */
export function paraBrasiliaLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000);
  return d.toISOString().slice(0, 16);
}

/** O que impede publicar: precisa de ao menos uma pergunta respondível. */
export function problemaParaPublicar(campos: Campo[]): string | null {
  return campos.some(recebeResposta)
    ? null
    : "Inclua ao menos uma pergunta antes de publicar.";
}

// ---------------------------------------------------------------------------
// Aparência do link
// ---------------------------------------------------------------------------

/** Cores de destaque do link (barra do topo, progresso e botões). */
export const CORES = {
  grafite: { rotulo: "Grafite", hex: "#171717" },
  azul: { rotulo: "Azul", hex: "#1d4ed8" },
  verde: { rotulo: "Verde", hex: "#15803d" },
  vinho: { rotulo: "Vinho", hex: "#9f1239" },
  laranja: { rotulo: "Laranja", hex: "#c2410c" },
  roxo: { rotulo: "Roxo", hex: "#6d28d9" },
} as const;
export type Cor = keyof typeof CORES;
export const NOMES_DAS_CORES = Object.keys(CORES) as Cor[];

export const hexDaCor = (cor: string): string =>
  (CORES as Record<string, { hex: string }>)[cor]?.hex ?? CORES.grafite.hex;

/** Cor, páginas e para onde levar depois do envio. */
export const aparenciaSchema = z.object({
  cor: z.enum(NOMES_DAS_CORES as [Cor, ...Cor[]], {
    error: "Escolha uma das cores.",
  }),
  paginas: z.boolean(),
  /** Vazio: mostra a mensagem de agradecimento. */
  redirecionar_para: z
    .string()
    .trim()
    .max(500, "Endereço com no máximo 500 caracteres.")
    .refine(
      (v) => !v || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v),
      "O endereço precisa começar com https://",
    )
    .transform((v) => v || null),
});

/**
 * Uma seção por página: cada título de seção abre uma página nova (o que vem
 * antes da primeira seção fica na primeira). Devolve os ids de cada página.
 */
export function paginasDosCampos(campos: Campo[]): string[][] {
  const paginas: string[][] = [];
  for (const c of campos) {
    if (c.tipo === "secao" || paginas.length === 0) paginas.push([]);
    paginas.at(-1)?.push(c.id);
  }
  return paginas.filter((p) => p.length > 0);
}
