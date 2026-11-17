import { z } from "zod";

// Contratos do Clube SustentArp (spec 4.5): a lista do ano, o detalhe do
// participante, o relatório de contribuições e as gravações. As entradas das
// gravações são os schemas de ../clube-cadastro (mesmas mensagens da tela).
// Reais (valor combinado, contribuído) chegam null sem "Ver valores" e
// contato null sem "Ver contato".

const situacaoEntrevista = z.enum([
  "aguardando",
  "pendente",
  "em_dia",
  "a_vencer",
  "vencida",
  "dispensada",
]);
const situacaoClube = z.enum([
  "ativo",
  "a_vencer",
  "vencido",
  "saiu",
  "interessado",
]);

export const participanteBase = z.object({
  id: z.string(),
  nome: z.string(),
  doc: z.string(),
  locatario: z.boolean(),
  lucs: z.array(z.string()),
  blocos: z.array(z.string()),
  formas: z.array(z.string()),
  termos: z.array(
    z.object({
      ano: z.number(),
      assinadoEm: z.string(),
      validoAte: z.string(),
    }),
  ),
  saiuEm: z.string().nullable(),
  interesse: z.boolean(),
});

export const extrasDoAno = z.object({
  contribuido: z.number(),
  contribuicoes: z.number(),
  acoes: z.number(),
  combinadoMes: z.number().nullable(),
});

export const clienteParaParticipar = z.object({
  doc: z.string(),
  nome: z.string(),
  lucs: z.array(z.string()),
});
export type ClienteParaParticipar = z.infer<typeof clienteParaParticipar>;

/** GET /sustentabilidade/clube?ano= */
export const respostaClube = z.object({
  /** clube_formas dos Parâmetros. */
  formas: z.array(z.string()),
  avisoDias: z.number(),
  participantes: z.array(participanteBase),
  /** Por id do participante. */
  extras: z.record(z.string(), extrasDoAno),
  /** Situação da entrevista por documento do cliente. */
  entrevistas: z.record(z.string(), situacaoEntrevista.nullable()),
  clientesPj: z.array(
    z.object({ doc: z.string(), blocos: z.array(z.string()) }),
  ),
  blocos: z.array(z.string()),
  /** Anos com termo, do mais novo ao mais antigo. */
  anos: z.array(z.number()),
  temExemplo: z.boolean(),
  interessados: z.number(),
  /** Clientes para "Novo participante" (vazio sem clube.editar). */
  clientes: z.array(clienteParaParticipar),
});
export type RespostaClube = z.infer<typeof respostaClube>;

export const consultaClube = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
});

const contratoDoCliente = z.object({
  id: z.string(),
  contrato: z.string().nullable(),
  clienteDoc: z.string().nullable(),
  lucs: z.array(z.string()),
  bloco: z.string().nullable(),
  tipoLoja: z.string().nullable(),
  situacao: z.enum(["vigente", "encerrado"]),
  rescisao: z.string().nullable(),
  ativacao: z.string().nullable(),
  inicio: z.string().nullable(),
  ativacaoCorrigida: z.string().nullable(),
  validadeMesesEspecifica: z.number().nullable(),
  dispensada: z.boolean(),
});

export const entrevistaDoContrato = z.object({
  contratoId: z.string(),
  contrato: contratoDoCliente,
  foraDaLista: z.boolean(),
  situacao: situacaoEntrevista,
  ultimaData: z.string().nullable(),
  validaAte: z.string().nullable(),
  dataPrevista: z.string().nullable(),
});

/** GET /sustentabilidade/clube/participantes/:id */
export const respostaParticipante = z.object({
  participante: z.object({
    id: z.string(),
    cliente_doc: z.string(),
    nome: z.string(),
    locatario_manual: z.boolean(),
    formas: z.array(z.string()),
    saiu_em: z.string().nullable(),
    saiu_motivo: z.string().nullable(),
    interesse: z.boolean(),
    exemplo: z.boolean(),
    criado_em: z.string(),
  }),
  /** Null sem "Ver contato" (ou sem contato cadastrado). */
  contato: z
    .object({
      email: z.string().nullable(),
      telefone: z.string().nullable(),
      contato: z.string().nullable(),
    })
    .nullable(),
  /** Null sem "Ver valores" ou sem valor combinado. */
  valorCombinadoMes: z.number().nullable(),
  termos: z.array(
    z.object({
      id: z.string(),
      ano: z.number(),
      assinado_em: z.string(),
      valido_ate: z.string(),
      arquivo: z.string().nullable(),
      assinatura: z.string().nullable(),
    }),
  ),
  contribuicoes: z.array(
    z.object({
      id: z.string(),
      data: z.string(),
      forma: z.string(),
      competencia: z.string(),
      observacao: z.string().nullable(),
      /** Null sem "Ver valores". */
      valor: z.number().nullable(),
    }),
  ),
  acoes: z.array(
    z.object({
      id: z.string(),
      data: z.string(),
      tipo: z.string(),
      observacao: z.string().nullable(),
    }),
  ),
  situacao: situacaoClube,
  validoAte: z.string().nullable(),
  locatario: z.boolean(),
  /** Entrevista de cada contrato do cliente (vigentes primeiro). */
  entrevistas: z.array(entrevistaDoContrato),
  formasDoClube: z.array(z.string()),
  formasDeContribuicao: z.array(z.string()),
  tiposDeAcao: z.array(z.string()),
  validadeMeses: z.number(),
  avisoDias: z.number(),
});
export type RespostaParticipante = z.infer<typeof respostaParticipante>;

export const consultaContribuicoes = z.object({
  de: z.iso.date("Período inválido."),
  ate: z.iso.date("Período inválido."),
  /** "" = todos os participantes. */
  participante: z.string().max(64).optional().default(""),
  /** "" = todas as formas. */
  forma: z.string().max(80).optional().default(""),
});

/** GET /sustentabilidade/clube/contribuicoes */
export const respostaContribuicoes = z.object({
  participantes: z.array(z.object({ id: z.string(), nome: z.string() })),
  /** formas_contribuicao dos Parâmetros. */
  formas: z.array(z.string()),
  /** Os filtros que valeram (o que não está na lista vira ""). */
  participante: z.string(),
  forma: z.string(),
  linhas: z.array(
    z.object({
      id: z.string().nullable(),
      participanteId: z.string().nullable(),
      participante: z.string(),
      doc: z.string(),
      data: z.string(),
      forma: z.string(),
      competencia: z.string(),
      valor: z.number().nullable(),
      observacao: z.string().nullable(),
    }),
  ),
});
export type RespostaContribuicoes = z.infer<typeof respostaContribuicoes>;

/** POST /sustentabilidade/clube/participantes */
export const respostaParticipanteCriado = z.object({ id: z.string() });

/** GET /sustentabilidade/clube/termos/:id/link?qual= */
export const consultaLinkDoTermo = z.object({
  qual: z.enum(["arquivo", "assinatura"], "Termo inválido."),
});
export const respostaLinkDoTermo = z.object({ url: z.string() });
