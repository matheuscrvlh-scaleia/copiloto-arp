import { z } from "zod";

// Contratos das rondas dos coletores (spec 4.6) e do RCC (spec 4.7).

const cor = z.enum(["preto", "azul"]);

// ---------------------------------------------------------------- rondas

/** GET /sustentabilidade/rondas?de=aaaa-mm-dd&ate=aaaa-mm-dd */
export const consultaRondas = z.object({
  de: z.iso.date("Data inválida."),
  ate: z.iso.date("Data inválida."),
});

export const itemLido = z.object({
  id: z.string(),
  coletorId: z.string(),
  local: z.string(),
  cor,
  conteineres: z.number(),
  ocupacaoPct: z.number(),
  observacao: z.string().nullable(),
  foto: z.string().nullable(),
});

export const rondaLida = z.object({
  id: z.string(),
  dataHora: z.string(),
  exemplo: z.boolean(),
  lancadoPor: z.string().nullable(),
  itens: z.array(itemLido),
});

export const respostaRondas = z.object({
  /** Rondas da janela (período da lista e as 12 semanas do gráfico). */
  rondas: z.array(rondaLida),
  /** Limite de alerta dos Parâmetros (%). */
  limite: z.number(),
  /** Locais com coletor cadastrado (ativos e inativos), para o filtro. */
  locais: z.array(z.string()),
  temExemplo: z.boolean(),
});
export type RespostaRondas = z.infer<typeof respostaRondas>;

export const coletorParaLancar = z.object({
  id: z.string(),
  local: z.string(),
  cor,
  conteineres: z.number(),
});
export type ColetorParaLancar = z.infer<typeof coletorParaLancar>;

/** GET /sustentabilidade/rondas/lancar */
export const respostaLancarRonda = z.object({
  coletores: z.array(coletorParaLancar),
  limite: z.number(),
  /** Chamado da ronda em aberto (ex.: "#412"); null se não há. */
  chamado: z.string().nullable(),
});

/** POST .../fotos e .../pdf: link para o navegador enviar o arquivo. */
export const entradaEnvio = z.object({
  nome: z.string().min(1).max(255),
  tamanho: z.number().int().positive(),
});
export const respostaEnvio = z.object({ url: z.string(), path: z.string() });

// ---------------------------------------------------------------- RCC

export const notaRcc = z.object({
  id: z.string(),
  competencia: z.string(),
  empresa: z.string(),
  numero: z.string(),
  pdf: z.string(),
  cacambasA: z.number(),
  cacambasB: z.number(),
  /** null sem "Ver valores" ou não informado. */
  valorTotal: z.number().nullable(),
  exemplo: z.boolean(),
});

export const fatorDoRcc = z.object({
  vigenteDesde: z.string(),
  toneladasPorCacamba: z.number(),
});

export const precoDoRcc = z.object({
  vigenteDesde: z.string(),
  precoA: z.number(),
  precoB: z.number(),
});

/** GET /sustentabilidade/rcc */
export const respostaRcc = z.object({
  notas: z.array(notaRcc),
  fatores: z.array(fatorDoRcc),
  /** null sem "Ver valores". */
  precos: z.array(precoDoRcc).nullable(),
  /** Empresas coletoras dos Parâmetros. */
  empresas: z.array(z.string()),
  /** Link temporário (1 h) de cada PDF, pelo caminho. */
  links: z.record(z.string(), z.string()),
});
export type RespostaRcc = z.infer<typeof respostaRcc>;

/** POST /sustentabilidade/rcc/notas: salva ou avisa que o mês já tem nota. */
export const respostaNotaRcc = z.union([
  z.object({ mensagem: z.string() }),
  z.object({
    duplicada: z.array(z.object({ empresa: z.string(), numero: z.string() })),
  }),
]);
export type RespostaNotaRcc = z.infer<typeof respostaNotaRcc>;
