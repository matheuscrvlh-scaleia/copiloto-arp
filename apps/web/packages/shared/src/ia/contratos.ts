import { z } from "zod";

// IA ARP: o assistente do sistema (cabeçalho de toda tela) e a gestão dele
// em Administração › Configurações › IA. A IA só lê, pelas mesmas rotas e
// permissões das telas; aqui ficam a entrada do chat, os eventos que chegam
// durante a resposta, as conversas e o painel de uso.

/** Quanto o modelo pensa antes de responder (mais = melhor e mais caro). */
export const ESFORCOS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EsforcoDaIa = (typeof ESFORCOS)[number];

export const ROTULO_DO_ESFORCO: Record<EsforcoDaIa, string> = {
  low: "Baixo (mais rápido e barato)",
  medium: "Médio (recomendado)",
  high: "Alto",
  xhigh: "Muito alto",
  max: "Máximo (mais lento e caro)",
};

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

/** Tela em que a pessoa está ao perguntar ("o que é este número aqui?"). */
export const telaAtual = z.object({
  caminho: z.string().max(300),
  titulo: z.string().max(200),
});

/** Uma tela do menu da pessoa: a IA usa para indicar onde ver o dado. */
export const telaDoMenu = z.object({
  secao: z.string().max(80),
  rotulo: z.string().max(120),
  caminho: z.string().max(300),
});
export type TelaDoMenu = z.infer<typeof telaDoMenu>;

export const PERGUNTA_MAXIMO = 4000;

export const entradaPergunta = z.object({
  /** Sem valor, começa uma conversa nova. */
  conversa_id: z.uuid().optional(),
  pergunta: z
    .string()
    .trim()
    .min(1, "Escreva a pergunta.")
    .max(PERGUNTA_MAXIMO, "A pergunta pode ter no máximo 4.000 caracteres."),
  tela: telaAtual.optional(),
  /** Só na primeira pergunta da conversa. */
  telas: z.array(telaDoMenu).max(400).optional(),
});
export type EntradaPergunta = z.infer<typeof entradaPergunta>;

/** Fonte de dados que a IA consultou para responder. */
export const fonteConsultada = z.object({
  caminho: z.string(),
  modulo: z.string(),
  ok: z.boolean(),
});
export type FonteConsultada = z.infer<typeof fonteConsultada>;

/** Eventos da resposta, na ordem em que chegam (text/event-stream). */
export const eventoDoAssistente = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("inicio"),
    conversa_id: z.uuid(),
    pergunta_id: z.uuid(),
  }),
  /** A IA está consultando uma fonte (mostra "Consultando…"). */
  z.object({ tipo: z.literal("consulta"), fonte: fonteConsultada }),
  /** Pedaço do texto da resposta. */
  z.object({ tipo: z.literal("texto"), texto: z.string() }),
  z.object({
    tipo: z.literal("fim"),
    tokens: z.number().int(),
    custo_usd: z.number(),
  }),
  z.object({ tipo: z.literal("erro"), mensagem: z.string() }),
]);
export type EventoDoAssistente = z.infer<typeof eventoDoAssistente>;

/** O que o botão do cabeçalho precisa saber para aparecer. */
export const respostaEstado = z.object({
  /** A IA está ligada e configurada (chave da Claude salva). */
  disponivel: z.boolean(),
  motivo: z.string().nullable(),
  modelo: z.string().nullable(),
  /** Uso da pessoa no mês (tokens) e o limite dela (null: sem limite). */
  usados_mes: z.number(),
  limite_mes: z.number().nullable(),
});
export type RespostaEstado = z.infer<typeof respostaEstado>;

export const conversaResumida = z.object({
  id: z.uuid(),
  titulo: z.string(),
  atualizada_em: z.string(),
});
export type ConversaResumida = z.infer<typeof conversaResumida>;

export const respostaConversas = z.object({
  conversas: z.array(conversaResumida),
});

export const AVALIACOES = [1, -1] as const;

export const perguntaDaConversa = z.object({
  id: z.uuid(),
  pergunta: z.string(),
  resposta: z.string(),
  fontes: z.array(fonteConsultada),
  status: z.string(),
  avaliacao: z.number().int().nullable(),
  criada_em: z.string(),
});
export type PerguntaDaConversa = z.infer<typeof perguntaDaConversa>;

export const respostaConversa = z.object({
  id: z.uuid(),
  titulo: z.string(),
  perguntas: z.array(perguntaDaConversa),
});
export type RespostaConversa = z.infer<typeof respostaConversa>;

export const idDaConversa = z.object({ id: z.uuid() });

export const entradaAvaliacao = z.object({
  avaliacao: z.union([z.literal(1), z.literal(-1), z.null()]),
});

// ---------------------------------------------------------------------------
// Configuração (ia.gerenciar)
// ---------------------------------------------------------------------------

/** US$ por milhão de tokens, por tipo de token. */
export const precoDoModelo = z.object({
  entrada: z.number().min(0).max(1000),
  saida: z.number().min(0).max(1000),
  cache_escrita: z.number().min(0).max(1000),
  cache_leitura: z.number().min(0).max(1000),
});
export type PrecoDoModelo = z.infer<typeof precoDoModelo>;

const inteiroOuNulo = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable();

export const configDaIa = z.object({
  ativa: z.boolean(),
  esforco: z.enum(ESFORCOS),
  /** Teto de consultas (leituras do sistema) por pergunta. */
  max_consultas: z.number().int().min(1, "Mínimo 1.").max(40, "Máximo 40."),
  /** Tokens por pessoa por mês quando não há limite do cargo ou da pessoa. */
  limite_padrao_mes: inteiroOuNulo(1000, 1_000_000_000),
  /** Teto de gasto de todo o sistema no mês, em US$ (null: sem teto). */
  orcamento_mes_usd: z.number().min(1).max(1_000_000).nullable(),
  /** Conversas mais velhas que isto são apagadas (o uso fica). */
  dias_de_guarda: z.number().int().min(1).max(3650),
  /** Para estimar em reais. */
  cotacao_dolar: z.number().min(0.01).max(100),
  precos: z.record(z.string().min(1).max(80), precoDoModelo),
  /** Instruções extras da empresa para a IA (tom, termos internos). */
  instrucoes: z.string().max(4000),
});
export type ConfigDaIa = z.infer<typeof configDaIa>;

export const limiteDeUso = z.object({
  tipo: z.enum(["cargo", "usuario"]),
  id: z.uuid(),
  nome: z.string(),
  /** Tokens por mês (null: sem limite). */
  tokens_mes: z.number().nullable(),
});
export type LimiteDeUso = z.infer<typeof limiteDeUso>;

export const respostaConfig = z.object({
  config: configDaIa,
  /** Modelo da integração da Claude (Administração › Integrações). */
  modelo: z.string().nullable(),
  configurada: z.boolean(),
  limites: z.array(limiteDeUso),
  cargos: z.array(z.object({ id: z.uuid(), nome: z.string() })),
  usuarios: z.array(
    z.object({ id: z.uuid(), nome: z.string(), cargo: z.string().nullable() }),
  ),
  /** Quantas fontes de dados a IA enxerga hoje (crescem com o sistema). */
  fontes: z.number().int(),
});
export type RespostaConfig = z.infer<typeof respostaConfig>;

export const entradaLimite = z.object({
  tipo: z.enum(["cargo", "usuario"]),
  id: z.uuid(),
  tokens_mes: inteiroOuNulo(0, 1_000_000_000),
});
export type EntradaLimite = z.infer<typeof entradaLimite>;

export const entradaRemoverLimite = z.object({
  tipo: z.enum(["cargo", "usuario"]),
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Painel de uso (ia.gerenciar)
// ---------------------------------------------------------------------------

const dia = z.iso.date();

export const consultaDoUso = z
  .object({ de: dia, ate: dia })
  .refine((v) => v.de <= v.ate, {
    message: "O início vem antes do fim.",
    path: ["de"],
  });
export type ConsultaDoUso = z.infer<typeof consultaDoUso>;

const somaDeUso = z.object({
  perguntas: z.number(),
  tokens: z.number(),
  custo_usd: z.number(),
});

export const respostaUso = z.object({
  resumo: z.object({
    perguntas: z.number(),
    pessoas: z.number(),
    conversas: z.number(),
    tokens_entrada: z.number(),
    tokens_saida: z.number(),
    tokens_cache: z.number(),
    custo_usd: z.number(),
    tempo_medio_ms: z.number(),
    consultas: z.number(),
    erros: z.number(),
    positivas: z.number(),
    negativas: z.number(),
  }),
  /** Mês corrente, para o teto (independe do período escolhido). */
  mes: z.object({ custo_usd: z.number(), tokens: z.number() }),
  por_dia: z.array(somaDeUso.extend({ dia })),
  por_hora: z.array(z.object({ hora: z.number(), perguntas: z.number() })),
  por_usuario: z.array(
    somaDeUso.extend({
      id: z.uuid(),
      nome: z.string(),
      cargo: z.string().nullable(),
      ultima: z.string(),
    }),
  ),
  por_cargo: z.array(
    somaDeUso.extend({ id: z.uuid().nullable(), nome: z.string() }),
  ),
  por_modulo: z.array(
    z.object({
      modulo: z.string(),
      consultas: z.number(),
      perguntas: z.number(),
    }),
  ),
  por_modelo: z.array(somaDeUso.extend({ modelo: z.string() })),
  por_status: z.array(z.object({ status: z.string(), perguntas: z.number() })),
});
export type RespostaUso = z.infer<typeof respostaUso>;

export const ROTULO_DO_STATUS: Record<string, string> = {
  ok: "Respondida",
  erro: "Erro",
  limite: "Barrada pelo limite",
  recusa: "Recusada pela IA",
  cancelada: "Interrompida",
};

/** Nome do módulo pelo primeiro trecho do endereço da fonte (/rh/...). */
export const TITULO_DO_MODULO: Record<string, string> = {
  admin: "Administração",
  gestao: "Gestão",
  rh: "RH",
  financeiro: "Financeiro",
  os: "Tickets",
  marketing: "Marketing",
  comercial: "Comercial",
  operacoes: "Operações",
  sustentabilidade: "Sustentabilidade",
  calendario: "Calendário",
  relatorios: "Relatórios",
  casca: "Sistema",
};

export function tituloDoModulo(modulo: string): string {
  return (
    TITULO_DO_MODULO[modulo] ??
    (modulo ? modulo[0]?.toUpperCase() + modulo.slice(1) : "Sistema")
  );
}
