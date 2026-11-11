import { z } from "zod";
import { formatarMes, formatarNumero } from "@/lib/formato";
import type { Status } from "@/lib/indicadores";
import type { Permissao } from "@/lib/permissions";

// Importações de Operações (spec 4.11): os tipos, quem pode importar cada um
// (mesma regra de operacoes.pode_importar), os rótulos do histórico, os
// cartões da tela (por área), os filtros da URL e a leitura segura dos
// campos jsonb (arquivos, avisos, resumo), que cada área grava no seu formato.

export const TIPOS_IMPORTACAO = {
  agua: {
    rotulo: "Contas de água por sala (faturamento individualizado)",
    curto: "Água por sala",
    permissao: "operacoes.agua.importar",
    descricao:
      "Planilhas (ou PDFs) de cada bloco do mês e as fotos dos hidrômetros, como o parceiro envia. Pode mandar tudo de uma vez.",
  },
  agua_conta: {
    rotulo: "Conta da concessionária (água)",
    curto: "Conta de água",
    permissao: "operacoes.agua.importar",
    descricao:
      "A conta do macromedidor do prédio, em PDF ou foto. O arquivo fica guardado como comprovante e os campos, como dado.",
  },
  energisa: {
    rotulo: "Faturas da Energisa",
    curto: "Energisa",
    permissao: "operacoes.energia.contas",
    descricao: "PDFs das faturas da área comum, um por matrícula.",
  },
  orcamento: {
    rotulo: "Orçamento de obra",
    curto: "Orçamento",
    permissao: "operacoes.obras.importar",
    descricao:
      "Planilha de previsão orçamentária (cada envio vira uma revisão).",
  },
  limpeza: {
    rotulo: "Rateio da limpeza · histórico (planilha)",
    curto: "Rateio da limpeza",
    permissao: "operacoes.limpeza.fechar",
    descricao: "Planilha do rateio com as abas mensais.",
  },
} as const satisfies Record<
  string,
  { rotulo: string; curto: string; permissao: Permissao; descricao: string }
>;
export type TipoImportacao = keyof typeof TIPOS_IMPORTACAO;
export const TIPOS = Object.keys(TIPOS_IMPORTACAO) as TipoImportacao[];

/** Cada cartão da tela de Importações: um tipo (ou um atalho dele). */
export interface CartaoImportacao {
  chave: string;
  tipo: TipoImportacao;
  titulo: string;
  texto: string;
  aceita: string;
  /** Atalho do mesmo tipo com outra orientação (ex.: só as fotos). */
  foco?: "fotos";
}

/** Os cartões por área, na ordem da tela. */
export const AREAS_IMPORTACAO: {
  area: "agua" | "energia" | "limpeza" | "obras";
  titulo: string;
  cartoes: CartaoImportacao[];
}[] = [
  {
    area: "agua",
    titulo: "Água",
    cartoes: [
      {
        chave: "agua",
        tipo: "agua",
        titulo: "Contas de água por sala",
        texto:
          "Faturamento individualizado do mês: leituras, consumo e valor de cada hidrômetro, com as fotos dos visores.",
        aceita: "Planilha .xlsx ou PDF de cada bloco + fotos",
      },
      {
        chave: "fotos",
        tipo: "agua",
        foco: "fotos",
        titulo: "Fotos dos hidrômetros",
        texto:
          "Só as fotos de um mês já importado. Cada foto se liga ao hidrômetro pelo nome do arquivo (ex.: SET_26_A19L036553.jpg).",
        aceita: "Fotos .jpg, .png, .webp ou a pasta inteira",
      },
      {
        chave: "agua_conta",
        tipo: "agua_conta",
        titulo: "Conta da concessionária",
        texto:
          "A conta do macromedidor (Águas de Nova Friburgo): consumo, leituras, vencimento e total, com o comprovante guardado.",
        aceita: "PDF ou foto da conta",
      },
    ],
  },
  {
    area: "energia",
    titulo: "Energia",
    cartoes: [
      {
        chave: "energisa",
        tipo: "energisa",
        titulo: "Faturas da Energisa",
        texto:
          "Consumo, energia compensada, itens e total de cada matrícula da área comum, lidos do PDF.",
        aceita: "PDF da fatura, um por matrícula",
      },
    ],
  },
  {
    area: "limpeza",
    titulo: "Limpeza",
    cartoes: [
      {
        chave: "limpeza",
        tipo: "limpeza",
        titulo: "Rateio da limpeza",
        texto:
          "Histórico do rateio: cada aba mensal da planilha vira um mês, com minutos por bloco e extras.",
        aceita: "Planilha .xlsx do rateio",
      },
    ],
  },
  {
    area: "obras",
    titulo: "Obras",
    cartoes: [
      {
        chave: "orcamento",
        tipo: "orcamento",
        titulo: "Orçamento de obra",
        texto:
          "Previsão orçamentária por etapa e mês. Cada envio da mesma obra vira uma revisão (R00, R01…).",
        aceita: "Planilha .xlsx de previsão orçamentária",
      },
    ],
  },
];

/** Link da tela de envio de um cartão. */
export const hrefDoCartao = (c: CartaoImportacao) =>
  `/operacoes/importacoes?tipo=${c.tipo}${c.foco ? `&foco=${c.foco}` : ""}`;

export const ehTipo = (v: unknown): v is TipoImportacao =>
  typeof v === "string" && v in TIPOS_IMPORTACAO;

/** Tipos que a pessoa pode importar (e desfazer). */
export function tiposQuePode(
  pode: (p: Permissao) => boolean,
): TipoImportacao[] {
  return TIPOS.filter((t) => pode(TIPOS_IMPORTACAO[t].permissao));
}

export const STATUS_IMPORTACAO = {
  previa: { rotulo: "Prévia, sem confirmar", status: "atencao" },
  confirmada: { rotulo: "Confirmada", status: "ok" },
  desfeita: { rotulo: "Desfeita", status: "sem_dado" },
  substituida: { rotulo: "Substituída", status: "sem_dado" },
  cancelada: { rotulo: "Prévia descartada", status: "sem_dado" },
} as const satisfies Record<string, { rotulo: string; status: Status }>;
export type StatusImportacao = keyof typeof STATUS_IMPORTACAO;

export const ehStatus = (v: unknown): v is StatusImportacao =>
  typeof v === "string" && v in STATUS_IMPORTACAO;

/** Só a prévia (descartar) e a confirmada (desfazer) voltam atrás. */
export const podeDesfazer = (status: string) =>
  status === "previa" || status === "confirmada";

/** "2026-09-01" → "set/2026"; o resto (obra e revisão) fica como está. */
export const textoDaReferencia = (referencia: string) =>
  /^\d{4}-\d{2}-01$/.test(referencia) ? formatarMes(referencia) : referencia;

// ---------------------------------------------------------------------------
// Filtros da URL (?tipo=agua&status=confirmada&de=…&ate=…&pagina=2)
// ---------------------------------------------------------------------------

export const POR_PAGINA = 30;

export interface FiltroImportacoes {
  tipo: TipoImportacao | null;
  status: StatusImportacao | null;
  de: string | null;
  ate: string | null;
  pagina: number;
}

const primeiro = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const data = z.preprocess(
  primeiro,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .catch(null),
);
const esquemaFiltro = z.object({
  tipo: z.preprocess(
    primeiro,
    z.string().refine(ehTipo).nullable().catch(null),
  ),
  status: z.preprocess(
    primeiro,
    z.string().refine(ehStatus).nullable().catch(null),
  ),
  de: data,
  ate: data,
  pagina: z.preprocess(
    primeiro,
    z.coerce.number().int().min(1).max(10_000).catch(1),
  ),
});

/** Valor inválido na URL vira "sem filtro"; datas trocadas, o intervalo certo. */
export function lerFiltroImportacoes(
  busca: Record<string, string | string[] | undefined>,
): FiltroImportacoes {
  const f = esquemaFiltro.parse({
    // log_tipo: na mesma tela, ?tipo= escolhe a aba do importador.
    tipo: busca.log_tipo ?? null,
    status: busca.status ?? null,
    de: busca.de ?? null,
    ate: busca.ate ?? null,
    pagina: busca.pagina ?? 1,
  });
  const [de, ate] =
    f.de && f.ate && f.de > f.ate ? [f.ate, f.de] : [f.de, f.ate];
  return {
    tipo: (f.tipo as TipoImportacao | null) ?? null,
    status: (f.status as StatusImportacao | null) ?? null,
    de,
    ate,
    pagina: f.pagina,
  };
}

// ---------------------------------------------------------------------------
// Campos jsonb: cada área grava; aqui só se lê o que tem o formato combinado
// ---------------------------------------------------------------------------

const arquivo = z.object({
  nome: z.string().min(1),
  caminho: z.string().min(1).optional(),
  sha256: z.string().optional(),
  bytes: z.number().nonnegative().optional(),
});
export type ArquivoImportado = z.infer<typeof arquivo>;

const aviso = z.object({
  nivel: z.enum(["erro", "aviso", "info"]).catch("aviso"),
  bloco: z.union([z.string(), z.number()]).optional(),
  linha: z.number().optional(),
  mensagem: z.string().min(1),
});
export type AvisoImportacao = z.infer<typeof aviso>;

/** Itens que seguem o formato; o resto é ignorado (nunca quebra a tela). */
function itensValidos<T>(valor: unknown, esquema: z.ZodType<T>): T[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((v) => {
    const r = esquema.safeParse(v);
    return r.success ? [r.data] : [];
  });
}

export const lerArquivos = (v: unknown) => itensValidos(v, arquivo);
export const lerAvisos = (v: unknown) => itensValidos(v, aviso);

export function contarAvisos(avisos: AvisoImportacao[]): {
  erro: number;
  aviso: number;
  info: number;
} {
  const n = { erro: 0, aviso: 0, info: 0 };
  for (const a of avisos) n[a.nivel]++;
  return n;
}

/** "linhas_lidas" → "Linhas lidas"; "porBloco" → "Por bloco". */
export function rotuloDaChave(chave: string): string {
  const t = chave
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : chave;
}

function textoDoValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number")
    return formatarNumero(v, Number.isInteger(v) ? 0 : 2);
  if (typeof v === "string") return textoDaReferencia(v);
  if (Array.isArray(v))
    return v.every((x) => typeof x !== "object" || x === null)
      ? v.map(textoDoValor).join(", ")
      : `${v.length} ${v.length === 1 ? "item" : "itens"}`;
  return JSON.stringify(v);
}

/**
 * O resumo da importação (o que foi lido e o resumo do arquivo) em linhas
 * "rótulo: valor", um nível de objeto aninhado ("Arquivo · Linhas").
 */
export function linhasDoResumo(
  resumo: unknown,
  max = 40,
): { rotulo: string; valor: string }[] {
  if (!resumo || typeof resumo !== "object" || Array.isArray(resumo)) return [];
  const linhas: { rotulo: string; valor: string }[] = [];
  for (const [k, v] of Object.entries(resumo)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v))
        linhas.push({
          rotulo: `${rotuloDaChave(k)} · ${rotuloDaChave(k2)}`,
          valor: textoDoValor(v2),
        });
    } else linhas.push({ rotulo: rotuloDaChave(k), valor: textoDoValor(v) });
  }
  return linhas.slice(0, max);
}
