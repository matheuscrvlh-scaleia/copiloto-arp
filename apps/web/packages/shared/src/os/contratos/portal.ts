import { z } from "zod";
import { documentoValido } from "../../documentos";
import { limparTelefone } from "../whatsapp";
import { campoExtra, motivoAguardando, statusChamado } from "./base";
import { planilha } from "./visoes";

// Contratos do Portal do lojista: a tela interna (/os/portal/**, rotas
// /api/v1/os/portal/*) e o portal público (/portal/**, rotas
// /api/v1/os/portal-publico/*). As mensagens são as do sistema antigo.

const texto = (v: unknown) => (typeof v === "string" ? v : "");
const diaDaEscolha = z.object({
  data: z.string(),
  rotulo: z.string(),
  horarios: z.array(z.object({ valor: z.string(), rotulo: z.string() })),
});

// ---------------------------------------------------------------------------
// Tela interna: links das lojas
// ---------------------------------------------------------------------------

export const consultaDosLinks = z.object({
  f: z.string().max(40).optional(),
  q: z.string().max(200).optional(),
  pagina: z.string().max(12).optional(),
});
export type ConsultaDosLinks = z.infer<typeof consultaDosLinks>;

export const linhaDoPortal = z.object({
  loja: z.object({
    id: z.string(),
    luc: z.string(),
    nome: z.string(),
    bloco: z.string().nullable(),
    telefone: z.string().nullable(),
    cnpj: z.string().nullable(),
  }),
  /** Último acesso de qualquer sessão; dentro: tem sessão aberta agora. */
  acesso: z.object({ ultimo: z.string().nullable(), dentro: z.boolean() }),
  /** WhatsApp com a mensagem e o link do portal. */
  whatsapp: z.string(),
  pedidosNoMes: z.number(),
  media: z.number().nullable(),
  avaliacoes: z.number(),
});
export type LinhaDoPortal = z.infer<typeof linhaDoPortal>;

export const respostaLinks = z.object({
  agora: z.string(),
  /** Janela da avaliação média, em dias. */
  diasDaMedia: z.number(),
  indicadores: z.object({
    vigentes: z.number(),
    entraram: z.number(),
    semCnpj: z.number(),
    pedidosNoMes: z.number(),
    media: z.number().nullable(),
    avaliacoes: z.number(),
  }),
  linhas: z.array(linhaDoPortal),
  total: z.number(),
});
export type RespostaLinks = z.infer<typeof respostaLinks>;

export const entradaEncerrarAcesso = z.object({
  loja: z.uuid("Loja inválida."),
});
export type EntradaEncerrarAcesso = z.infer<typeof entradaEncerrarAcesso>;

export { planilha as planilhaDoPortal };

// ---------------------------------------------------------------------------
// Tela interna: lojas (contratos)
// ---------------------------------------------------------------------------

export const consultaDasLojas = z.object({
  s: z.string().max(40).optional(),
  q: z.string().max(200).optional(),
  pagina: z.string().max(12).optional(),
});
export type ConsultaDasLojas = z.infer<typeof consultaDasLojas>;

export const lojaDoPortal = z.object({
  id: z.string(),
  luc: z.string(),
  nome: z.string(),
  locatario: z.string().nullable(),
  cnpj: z.string().nullable(),
  contrato: z.string().nullable(),
  bloco: z.string().nullable(),
  situacao: z.string(),
  inicio: z.string().nullable(),
  fim: z.string().nullable(),
  telefone: z.string().nullable(),
  tem_vaga: z.boolean().nullable(),
  tipo_loja: z.string().nullable(),
  ramo: z.string().nullable(),
  ativacao: z.string().nullable(),
  rescisao: z.string().nullable(),
  piso: z.string().nullable(),
  rua: z.string().nullable(),
  enet_id: z.string().nullable(),
});
export type LojaDoPortal = z.infer<typeof lojaDoPortal>;

export const respostaLojas = z.object({
  lojas: z.array(lojaDoPortal),
  total: z.number(),
});
export const respostaLoja = z.object({ loja: lojaDoPortal.nullable() });

const opcional = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? null : (v ?? null)),
  z.string().trim().max(200).nullable(),
);
const dataOpcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.iso.date("Início: data inválida").nullable(),
);

/** Mensagens no formato do antigo `primeiroErro`: "Rótulo: mensagem". */
export const entradaLoja = z
  .object({
    id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
    luc: z
      .string("LUC: informe a LUC")
      .trim()
      .min(1, "LUC: informe a LUC")
      .max(40),
    nome: z
      .string("Nome da loja: informe o nome")
      .trim()
      .min(2, "Nome da loja: informe o nome")
      .max(120),
    locatario: opcional,
    cnpj: z.preprocess(
      (v) => (typeof v === "string" ? v.replace(/\D/g, "") || null : null),
      z
        .string()
        .refine(documentoValido, "CPF ou CNPJ: CPF ou CNPJ inválido")
        .nullable(),
    ),
    contrato: opcional,
    bloco: opcional,
    situacao: z.enum(["vigente", "encerrado"], "Situação: escolha a situação"),
    inicio: dataOpcional,
    fim: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.iso.date("Fim: data inválida").nullable(),
    ),
    telefone: opcional.refine(
      (t) => t === null || limparTelefone(t) !== null,
      "Telefone: informe com DDD",
    ),
    tem_vaga: z.preprocess(
      (v) => (v === "sim" ? true : v === "nao" ? false : null),
      z.boolean().nullable(),
    ),
    // Usados pelo Sustentabilidade (entrevista na ativação, dispensa por
    // tipo de loja, cancelamento na rescisão). Todos opcionais.
    tipo_loja: opcional,
    ramo: opcional,
    ativacao: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.iso.date("Ativação: data inválida").nullable(),
    ),
    rescisao: z.preprocess(
      (v) => (v === "" || v == null ? null : v),
      z.iso.date("Rescisão: data inválida").nullable(),
    ),
    piso: opcional,
    rua: opcional,
  })
  .refine((l) => !l.inicio || !l.fim || l.inicio <= l.fim, {
    message: "Fim: o fim vem antes do início",
    path: ["fim"],
  })
  .refine((l) => !l.ativacao || !l.rescisao || l.ativacao <= l.rescisao, {
    message: "Rescisão: a rescisão vem antes da ativação",
    path: ["rescisao"],
  });
export type EntradaLoja = z.infer<typeof entradaLoja>;

export const respostaGravacao = z.object({
  mensagem: z.string(),
  /** true: registro novo (a tela volta para a lista). */
  criado: z.boolean(),
});
export type RespostaGravacao = z.infer<typeof respostaGravacao>;

// ---------------------------------------------------------------------------
// Tela interna: agendas, bloqueios e horários
// ---------------------------------------------------------------------------

export const agendaDoPortal = z.object({
  id: z.string(),
  nome: z.string(),
  hora_inicio: z.string(),
  hora_fim: z.string(),
  duracao_min: z.number(),
  limite_por_dia: z.number(),
  antecedencia_dias: z.number(),
  dias_semana: z.array(z.number()),
  orientacao: z.string().nullable(),
  ativo: z.boolean(),
});
export type AgendaDoPortal = z.infer<typeof agendaDoPortal>;

export const agendamentoDoPortal = z.object({
  id: z.string(),
  agenda_id: z.string(),
  chamado_id: z.string().nullable(),
  loja_id: z.string().nullable(),
  inicio: z.string(),
  fim: z.string(),
  status: z.string(),
  observacao: z.string().nullable(),
  loja: z
    .object({
      nome: z.string(),
      luc: z.string(),
      telefone: z.string().nullable(),
    })
    .nullable(),
  chamado: z
    .object({
      numero: z.number(),
      titulo: z.string(),
      solicitante_nome: z.string().nullable(),
      solicitante_telefone: z.string().nullable(),
    })
    .nullable(),
});
export type AgendamentoDoPortal = z.infer<typeof agendamentoDoPortal>;

export const respostaAgendas = z.object({
  agora: z.string(),
  /** aaaa-mm-dd de Brasília. */
  hoje: z.string(),
  agendas: z.array(agendaDoPortal),
  bloqueios: z.array(
    z.object({
      id: z.string(),
      agenda_id: z.string(),
      inicio: z.string(),
      fim: z.string(),
      motivo: z.string(),
    }),
  ),
  /** Quem precisa remarcar, com a mensagem pronta do WhatsApp. */
  remarcar: z.array(agendamentoDoPortal.extend({ whatsapp: z.string() })),
  /** Dias livres de cada agenda que tem alguém para remarcar. */
  dias: z.record(z.string(), z.array(diaDaEscolha)),
  proximos: z.array(agendamentoDoPortal),
  /** Categorias do catálogo que reservam em cada agenda. */
  usos: z.record(z.string(), z.array(z.string())),
});
export type RespostaAgendas = z.infer<typeof respostaAgendas>;

export const respostaAgenda = z.object({ agenda: agendaDoPortal.nullable() });

const hora = (rotulo: string) =>
  z
    .string(`${rotulo}: hora inválida`)
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${rotulo}: hora inválida`);

const inteiro = (rotulo: string) =>
  z.coerce.number(`${rotulo}: número inteiro`).int(`${rotulo}: número inteiro`);

export const entradaAgenda = z
  .object({
    id: z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional()),
    nome: z
      .string("Nome: informe o nome")
      .trim()
      .min(2, "Nome: informe o nome")
      .max(60),
    hora_inicio: hora("Início"),
    hora_fim: hora("Fim"),
    duracao_min: inteiro("Duração")
      .min(15, "Duração: mínimo de 15 minutos")
      .max(720, "Duração: máximo de 12 horas"),
    limite_por_dia: inteiro("Limite por dia")
      .min(1, "Limite por dia: pelo menos 1")
      .max(200),
    antecedencia_dias: inteiro("Marca até")
      .min(1, "Marca até: pelo menos 1 dia")
      .max(180, "Marca até: no máximo 180 dias"),
    dias_semana: z.preprocess(
      (v) => (v == null ? [] : Array.isArray(v) ? v : [v]),
      z
        .array(z.coerce.number().int().min(0).max(6))
        .min(1, "Dias da semana: escolha pelo menos um dia"),
    ),
    orientacao: opcional,
    ativo: z.preprocess(
      (v) => v === "on" || v === "true" || v === true,
      z.boolean(),
    ),
  })
  .refine((a) => a.hora_inicio < a.hora_fim, {
    message: "Fim: o fim vem antes do início",
    path: ["hora_fim"],
  });
export type EntradaAgenda = z.infer<typeof entradaAgenda>;

const horaOpcional = (rotulo: string) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    hora(rotulo).nullable(),
  );

export const entradaBloqueio = z.object({
  agenda: z.uuid("Agenda: escolha a agenda"),
  data_inicio: z.iso.date("Dia: escolha o dia"),
  data_fim: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.iso.date("Até: data inválida").nullable(),
  ),
  dia_inteiro: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  hora_inicio: horaOpcional("Das"),
  hora_fim: horaOpcional("Até as"),
  motivo: z
    .string("Motivo: informe o motivo")
    .trim()
    .min(3, "Motivo: informe o motivo")
    .max(200),
});
export type EntradaBloqueio = z.infer<typeof entradaBloqueio>;

export const idDoPortal = z.object({ id: z.uuid() });

export const entradaRemarcarAgendamento = z.object({
  horario: z.iso.datetime({
    offset: true,
    error: "Horário: escolha o novo horário",
  }),
});
export type EntradaRemarcarAgendamento = z.infer<
  typeof entradaRemarcarAgendamento
>;

export const entradaCancelarAgendamento = z.object({
  motivo: z.string().trim().max(200).optional(),
});
export type EntradaCancelarAgendamento = z.infer<
  typeof entradaCancelarAgendamento
>;

// ---------------------------------------------------------------------------
// Portal público: entrada pelo CPF ou CNPJ
// ---------------------------------------------------------------------------

export const lojaDaEntrada = z.object({
  id: z.string(),
  nome: z.string(),
  luc: z.string(),
  bloco: z.string().nullable(),
});
export type LojaDaEntrada = z.infer<typeof lojaDaEntrada>;

export const entradaEntrar = z.object({
  cnpj: z.preprocess(texto, z.string().max(200)),
  loja: z.preprocess(texto, z.string().max(60)),
});
export type EntradaEntrar = z.infer<typeof entradaEntrar>;

export const respostaEntrar = z.object({
  /** true: a sessão foi aberta (o cookie veio junto). */
  entrou: z.boolean(),
  /** Mais de uma loja vigente no documento: a pessoa escolhe. */
  lojas: z.array(lojaDaEntrada).optional(),
});
export type RespostaEntrar = z.infer<typeof respostaEntrar>;

// ---------------------------------------------------------------------------
// Portal público: o que a loja vê
// ---------------------------------------------------------------------------

export const pedidoDoPortal = z.object({
  id: z.string(),
  numero: z.number(),
  titulo: z.string(),
  descricao: z.string().nullable(),
  status: statusChamado,
  aguardando_tipo: motivoAguardando.nullable(),
  campos: z.unknown(),
  solicitante_nome: z.string().nullable(),
  criado_em: z.string(),
  atualizado_em: z.string(),
  primeira_resposta_em: z.string().nullable(),
  iniciado_em: z.string().nullable(),
  concluido_em: z.string().nullable(),
  fechado_em: z.string().nullable(),
  cancelado_em: z.string().nullable(),
  avaliacao: z.number().nullable(),
  avaliacao_comentario: z.string().nullable(),
  avaliado_em: z.string().nullable(),
  setor: z.string().nullable(),
  categoria: z.string().nullable(),
  icone: z.string().nullable(),
  camposDaCategoria: z.array(campoExtra),
});
export type PedidoDoPortal = z.infer<typeof pedidoDoPortal>;

export const categoriaDoPortal = z.object({
  id: z.string(),
  nome: z.string(),
  icone: z.string(),
  orientacao: z.string().nullable(),
  campos: z.array(campoExtra),
});
export type CategoriaDoPortal = z.infer<typeof categoriaDoPortal>;

/** Sem sessão (`loja: null`) a tela mostra a entrada pelo CPF ou CNPJ. */
export const respostaInicioDoPortal = z.object({
  loja: lojaDaEntrada.nullable(),
  boasVindas: z.string().nullable(),
  categorias: z.array(categoriaDoPortal),
  pedidos: z.array(pedidoDoPortal),
  documentos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      em: z.string(),
      url: z.string().nullable(),
    }),
  ),
});
export type RespostaInicioDoPortal = z.infer<typeof respostaInicioDoPortal>;

export const idDaCategoriaDoPortal = z.object({ id: z.string().max(60) });
export const idDoPedidoDoPortal = z.object({ id: z.string().max(60) });

export const respostaNovoPedido = z.object({
  loja: lojaDaEntrada.nullable(),
  /** null: o tipo de pedido não está mais disponível. */
  categoria: categoriaDoPortal.nullable(),
  /** Dias com horário livre; null quando a categoria não tem agenda. */
  dias: z.array(diaDaEscolha).nullable(),
});
export type RespostaNovoPedido = z.infer<typeof respostaNovoPedido>;

export const arquivoDoPortal = z.object({
  id: z.string(),
  nome: z.string(),
  url: z.string().nullable(),
  mime: z.string().nullable(),
  tamanho: z.number().nullable(),
  daLoja: z.boolean(),
  categoria: z.string(),
  em: z.string(),
  eventoId: z.number().nullable(),
});
export type ArquivoDoPortal = z.infer<typeof arquivoDoPortal>;

export const detalheDoPedido = z.object({
  pedido: pedidoDoPortal,
  eventos: z.array(
    z.object({
      id: z.number(),
      tipo: z.string(),
      texto: z.string().nullable(),
      dados: z.unknown(),
      em: z.string(),
    }),
  ),
  arquivos: z.array(arquivoDoPortal),
  horarios: z.array(
    z.object({
      id: z.string(),
      agendaId: z.string(),
      agenda: z.string(),
      inicio: z.string(),
      fim: z.string(),
      status: z.string(),
    }),
  ),
});
export type DetalheDoPedido = z.infer<typeof detalheDoPedido>;

export const respostaPedidoDoPortal = z.object({
  loja: lojaDaEntrada.nullable(),
  /** null: pedido não encontrado (ou de outra loja). */
  detalhe: detalheDoPedido.nullable(),
  /** Dias livres de cada agenda com horário a remarcar. */
  remarcar: z.record(z.string(), z.array(diaDaEscolha)),
});
export type RespostaPedidoDoPortal = z.infer<typeof respostaPedidoDoPortal>;

// --- Gravações do lojista (formulário multipart: tudo chega como texto) ---

/** Nome e telefone de quem pede: obrigatórios em tudo o que grava. */
export const quemPede = z.object({
  nome: z.preprocess(
    texto,
    z
      .string()
      .trim()
      .min(2, "Informe o seu nome.")
      .max(80, "Nome muito longo."),
  ),
  telefone: z.preprocess(
    texto,
    z
      .string()
      .trim()
      .refine(
        (t) => limparTelefone(t) !== null,
        "Informe um telefone com DDD.",
      ),
  ),
});
export type QuemPede = z.infer<typeof quemPede>;

const horarioEscolhido = z.iso.datetime({
  offset: true,
  error: "Escolha um horário.",
});

export const entradaPedido = z.object({
  categoria: z.uuid(),
  descricao: z.preprocess(
    texto,
    z.string().max(4000, "Descrição muito longa."),
  ),
  horario: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    horarioEscolhido.optional(),
  ),
});

export const entradaResposta = z.object({
  texto: z.preprocess(texto, z.string().max(4000, "Mensagem muito longa.")),
});

export const entradaAvaliacao = z.object({
  nota: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number({ error: "Escolha de 1 a 5 estrelas." })
      .int()
      .min(1, "Escolha de 1 a 5 estrelas.")
      .max(5, "Escolha de 1 a 5 estrelas."),
  ),
  comentario: z.preprocess(
    texto,
    z.string().max(1000, "Comentário muito longo."),
  ),
});

export const entradaReabertura = z.object({
  motivo: z.preprocess(
    texto,
    z
      .string()
      .trim()
      .min(3, "Conte o que ainda falta.")
      .max(1000, "Texto muito longo."),
  ),
});

export const entradaRemarcacao = z.object({
  agendamento: z.uuid(),
  horario: z.preprocess(texto, horarioEscolhido),
});

export const respostaPedidoCriado = z.object({
  mensagem: z.string(),
  id: z.string(),
  numero: z.number(),
  aviso: z.string().optional(),
});
export type RespostaPedidoCriado = z.infer<typeof respostaPedidoCriado>;
