import { z } from "zod";
import {
  campoExtra,
  motivoAguardando,
  origem,
  prioridade,
  statusChamado,
  statusDestino,
  tipoChamado,
} from "./base";

// Contratos do chamado (prefixo /api/v1/os): o detalhe e as gravações.
//
//   GET    /os/chamados/:id                 → DetalheChamado (chamado ou OS)
//   GET    /os/contatos                     → { contatos }
//   POST   /os/chamados                     multipart (campos do formulário) → RespostaCriacao
//   POST   /os/chamados/:id/acoes           EntradaAcao → { mensagem }
//   PATCH  /os/chamados/:id                 EntradaAlteracao → { mensagem }
//   POST   /os/chamados/:id/checklist       EntradaChecklist → { mensagem }
//   POST   /os/chamados/:id/comentarios     multipart (texto, visivel_lojista, arquivos) → { mensagem }
//   POST   /os/chamados/:id/seguir          EntradaSeguir → { mensagem }
//   POST   /os/chamados/:id/leitura         → { mensagem }
//   POST   /os/destinos/:id/mover           EntradaMoverDestino → { mensagem }
//   POST   /os/destinos/:id/andar           EntradaAndarDestino → { mensagem }
//   PATCH  /os/destinos/:id                 EntradaTarefaDestino → { mensagem }

const instante = z.string();

export const idDoChamado = z.object({ id: z.uuid("inválido") });

// ---------------------------------------------------------------------------
// Linhas do banco que o detalhe mostra
// ---------------------------------------------------------------------------

/** Linha de os.chamados (a OS tem as mesmas colunas, e mais as dela). */
export const chamadoInteiro = z.object({
  id: z.string(),
  numero: z.number(),
  tipo: tipoChamado,
  titulo: z.string(),
  descricao: z.string().nullable(),
  setor_id: z.string(),
  categoria_id: z.string().nullable(),
  status: statusChamado,
  prioridade,
  origem,
  pessoal: z.boolean(),
  precisa_confirmacao: z.boolean(),
  destinos_em_ordem: z.boolean(),
  aberto_por: z.string().nullable(),
  solicitante_nome: z.string().nullable(),
  solicitante_telefone: z.string().nullable(),
  responsavel_id: z.string().nullable(),
  prazo: instante.nullable(),
  loja_id: z.string().nullable(),
  ativo_id: z.string().nullable(),
  vistoria_id: z.string().nullable(),
  ambiente_id: z.string().nullable(),
  vinculado_a_id: z.string().nullable(),
  etiquetas: z.array(z.string()),
  campos: z.record(z.string(), z.unknown()),
  checklist: z.unknown(),
  recorrencia: z.unknown(),
  serie_id: z.string().nullable(),
  serie_data: z.string().nullable(),
  aguardando_tipo: motivoAguardando.nullable(),
  aguardando_motivo: z.string().nullable(),
  aguardando_min: z.number(),
  aguardando_desde: instante.nullable(),
  primeira_resposta_em: instante.nullable(),
  iniciado_em: instante.nullable(),
  concluido_em: instante.nullable(),
  concluido_por: z.string().nullable(),
  fechado_em: instante.nullable(),
  fechado_por: z.string().nullable(),
  fechado_automatico: z.boolean(),
  cancelado_em: instante.nullable(),
  cancelado_por: z.string().nullable(),
  motivo_cancelamento: z.string().nullable(),
  reaberto_vezes: z.number(),
  ultimo_motivo_reabertura: z.string().nullable(),
  solucao: z.string().nullable(),
  causa_falha: z.string().nullable(),
  conclusao_externa: z.boolean(),
  avaliacao: z.number().nullable(),
  avaliacao_comentario: z.string().nullable(),
  avaliado_em: instante.nullable(),
  acao_rotulo: z.string().nullable(),
  acao_url: z.string().nullable(),
  /** Módulo que criou o chamado (origem 'modulo'). */
  origem_modulo: z.string().nullable(),
  criado_em: instante,
  atualizado_em: instante,
});
export type ChamadoInteiro = z.infer<typeof chamadoInteiro>;

export const eventoDoChamado = z.object({
  id: z.number(),
  chamado_id: z.string().nullable(),
  ordem_id: z.string().nullable(),
  tipo: z.string(),
  texto: z.string().nullable(),
  dados: z.unknown(),
  visivel_lojista: z.boolean(),
  autor_id: z.string().nullable(),
  autor_nome: z.string().nullable(),
  em: instante,
});
export type EventoDoChamado = z.infer<typeof eventoDoChamado>;

export const anexoDetalhe = z.object({
  id: z.string(),
  chamado_id: z.string().nullable(),
  ordem_id: z.string().nullable(),
  evento_id: z.number().nullable(),
  categoria: z.string(),
  nome: z.string(),
  path: z.string(),
  mime: z.string().nullable(),
  tamanho: z.number().nullable(),
  visivel_lojista: z.boolean(),
  enviado_por: z.string().nullable(),
  enviado_por_nome: z.string().nullable(),
  em: instante,
  /** Link temporário (1 h); null se o arquivo não está no disco. */
  url: z.string().nullable(),
});
export type AnexoDetalhe = z.infer<typeof anexoDetalhe>;

export const destinoDetalhe = z.object({
  id: z.string(),
  chamado_id: z.string().nullable(),
  ordem_id: z.string().nullable(),
  setor_id: z.string().nullable(),
  usuario_id: z.string().nullable(),
  responsavel_id: z.string().nullable(),
  titulo: z.string().nullable(),
  observacao: z.string().nullable(),
  ordem: z.number(),
  status: statusDestino,
  prazo: instante.nullable(),
  lido_em: instante.nullable(),
  concluido_em: instante.nullable(),
  concluido_por: z.string().nullable(),
  nome: z.string(),
  /** A pessoa pode mexer nesta linha (é dela, do setor dela ou gerencia). */
  meu: z.boolean(),
  /** Destinos em ordem: o anterior que ainda não concluiu (null: é a vez). */
  espera: z.string().nullable(),
});
export type DestinoDetalhe = z.infer<typeof destinoDetalhe>;

export const chamadoCurto = z.object({
  id: z.string(),
  numero: z.number(),
  titulo: z.string(),
  status: statusChamado,
  tipo: tipoChamado,
});
export type ChamadoCurto = z.infer<typeof chamadoCurto>;

export const acaoChamado = z.enum([
  "assumir",
  "iniciar",
  "aguardar",
  "retomar",
  "concluir",
  "confirmar",
  "reabrir",
  "cancelar",
  "devolver",
]);

const setorDoDetalhe = z.object({
  id: z.string(),
  nome: z.string(),
  cor: z.string(),
  icone: z.string(),
  ativo: z.boolean(),
});
const categoriaDoDetalhe = z.object({
  id: z.string(),
  nome: z.string(),
  setor_id: z.string(),
  pai_id: z.string().nullable(),
});

export const detalheChamado = z.object({
  ch: chamadoInteiro,
  setor: setorDoDetalhe.nullable(),
  categoria: categoriaDoDetalhe.nullable(),
  /** Categoria-mãe, se a do chamado for subcategoria. */
  categoriaPai: categoriaDoDetalhe.nullable(),
  campos: z.array(campoExtra),
  checklist: z.array(
    z.object({
      texto: z.string(),
      obrigatorio: z.boolean(),
      feito: z.boolean(),
      por: z.string().nullable().optional(),
      em: z.string().nullable().optional(),
    }),
  ),
  destinos: z.array(destinoDetalhe),
  andamento: z
    .object({
      concluidos: z.number(),
      total: z.number(),
      faltam: z.number(),
      texto: z.string(),
      todosConcluidos: z.boolean(),
    })
    .nullable(),
  /** Aviso: quem recebe e quando leu; `euRecebo` e `liEm` são os meus. */
  leitura: z
    .object({
      leitores: z.array(
        z.object({
          id: z.string(),
          lidoEm: z.string().nullable(),
          nome: z.string(),
        }),
      ),
      euRecebo: z.boolean(),
      liEm: z.string().nullable(),
    })
    .nullable(),
  eventos: z.array(eventoDoChamado),
  anexos: z.array(anexoDetalhe),
  /** Nome de cada pessoa (id → nome) para a tela. */
  nomes: z.record(z.string(), z.string()),
  seguidores: z.array(z.string()),
  sigo: z.boolean(),
  loja: z
    .object({
      id: z.string(),
      luc: z.string(),
      nome: z.string(),
      telefone: z.string().nullable(),
    })
    .nullable(),
  ativo: z
    .object({
      id: z.string(),
      codigo: z.string(),
      nome: z.string(),
      local: z.string(),
    })
    .nullable(),
  vistoria: z.object({ id: z.string(), codigo: z.string() }).nullable(),
  /** Na OS: o chamado a que ela está ligada. */
  vinculado: chamadoCurto.nullable(),
  /** No chamado: as OS ligadas a ele. */
  ordensLigadas: z.array(chamadoCurto),
  papel: z.object({
    solicitante: z.boolean(),
    responsavel: z.boolean(),
    doSetor: z.boolean(),
    gestor: z.boolean(),
  }),
  acoes: z.array(acaoChamado),
  bloqueio: z.string().nullable(),
  pode: z.object({
    gerenciar: z.boolean(),
    editarPrazo: z.boolean(),
    historico: z.boolean(),
    verAtivo: z.boolean(),
    verVistoria: z.boolean(),
    editar: z.boolean(),
    definirTarefas: z.boolean(),
    /** Gestor do setor: reordena as etapas que ainda não começaram. */
    reordenar: z.boolean(),
  }),
  avisoHoras: z.number(),
  causasFalha: z.array(z.string()),
  modeloMensagem: z.string().nullable(),
  /** Endereço absoluto do chamado (vai na mensagem do WhatsApp). */
  link: z.string(),
});
export type DetalheChamado = z.infer<typeof detalheChamado>;

export const respostaContatos = z.object({
  contatos: z.array(
    z.object({
      id: z.string(),
      nome: z.string(),
      telefone: z.string(),
      empresa: z.string().nullable(),
    }),
  ),
});
export type ContatoSalvo = z.infer<typeof respostaContatos>["contatos"][number];

// ---------------------------------------------------------------------------
// Abrir (multipart: os campos chegam como texto; arquivos em `arquivos` e
// `arquivo:<chave do campo>`)
// ---------------------------------------------------------------------------

const opcional = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.uuid().nullable(),
);
const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : null),
    z.string().max(max, `máximo de ${max} caracteres`).nullable(),
  );

export const recorrenciaDoChamado = z
  .object({
    frequencia: z.enum([
      "diaria",
      "semanal",
      "mensal",
      "cada_n_dias",
      "cada_n_meses",
    ]),
    intervalo: z.number().int().min(1).max(365).optional(),
    dias_semana: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    dia_mes: z.number().int().min(1).max(31).optional(),
    fim: z.iso.date().nullable().optional(),
  })
  .nullable();

/** Campos de texto do formulário de abrir chamado. */
export const entradaNovoChamado = z.object({
  tipo: tipoChamado,
  setor_id: z.uuid("inválido"),
  categoria_id: opcional,
  titulo: z.string().trim().min(3, "escreva o título").max(200),
  descricao: textoOpcional(5000),
  prioridade: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    prioridade.nullable(),
  ),
  prazo: z.string().optional(),
  // "" = padrão da categoria; "fila" = sem responsável.
  responsavel: z.union([z.literal(""), z.literal("fila"), z.uuid()]),
  pessoal: z.enum(["0", "1"]).default("0"),
  loja_id: opcional,
  ativo_id: opcional,
  vistoria_id: opcional,
  ambiente_id: opcional,
  vinculado_a_id: opcional,
  vinculado_numero: z
    .string()
    .trim()
    .regex(/^#?\d*$/, "número inválido"),
  agenda_id: opcional,
  horario: z.string().optional(),
  etiquetas: z.string().max(600).default(""),
});
export type EntradaNovoChamado = z.infer<typeof entradaNovoChamado>;

export const ROTULOS_NOVO: Record<string, string> = {
  tipo: "Tipo",
  setor_id: "Setor",
  categoria_id: "Categoria",
  titulo: "Título",
  descricao: "Descrição",
  prioridade: "Prioridade",
  responsavel: "Responsável",
  vinculado_numero: "Chamado vinculado",
};

export const respostaCriacao = z.object({
  mensagem: z.string(),
  id: z.string(),
  numero: z.number(),
  /** Abriu, mas algo opcional falhou (horário, arquivo). */
  aviso: z.string().optional(),
});
export type RespostaCriacao = z.infer<typeof respostaCriacao>;

// ---------------------------------------------------------------------------
// Ciclo, gestão, checklist, conversa, destinos, seguir
// ---------------------------------------------------------------------------

export const entradaAcao = z.object({
  acao: acaoChamado,
  aguardando_tipo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    motivoAguardando.optional(),
  ),
  motivo: z
    .string()
    .trim()
    .max(1000, "Motivo: máximo de 1000 caracteres")
    .optional(),
  solucao: z.string().trim().max(5000).optional(),
  causa_falha: z.string().trim().max(200).optional(),
});
export type EntradaAcao = z.infer<typeof entradaAcao>;

export const entradaAlteracao = z.object({
  responsavel: z.union([z.literal(""), z.uuid()]).optional(),
  prazo: z.string().optional(),
  prioridade: prioridade.optional(),
  setor_id: z.uuid().optional(),
  categoria_id: opcional.optional(),
  // Como a janela viu ao abrir: o que voltar igual a isso não foi mexido.
  antes_responsavel: z.string().optional(),
  antes_prioridade: z.string().optional(),
  antes_setor: z.string().optional(),
  antes_categoria: z.string().optional(),
});
export type EntradaAlteracao = z.infer<typeof entradaAlteracao>;

export const entradaChecklist = z.object({
  indice: z.coerce.number().int().min(0),
  feito: z.enum(["0", "1"]),
});
export type EntradaChecklist = z.infer<typeof entradaChecklist>;

/** Campos de texto do comentário (os arquivos vão em `arquivos`). */
export const entradaComentario = z.object({
  texto: z.string().trim().max(5000, "máximo de 5000 caracteres"),
  visivel_lojista: z.enum(["0", "1"]).default("0"),
});

export const entradaSeguir = z.object({ ligar: z.enum(["0", "1"]) });
export type EntradaSeguir = z.infer<typeof entradaSeguir>;

export const entradaMoverDestino = z.object({ passo: z.enum(["-1", "1"]) });
export type EntradaMoverDestino = z.infer<typeof entradaMoverDestino>;

export const entradaAndarDestino = z.object({
  acao: z.enum(["ler", "iniciar", "concluir"]),
});
export type EntradaAndarDestino = z.infer<typeof entradaAndarDestino>;

export const entradaTarefaDestino = z.object({ tarefa: textoOpcional(200) });
export type EntradaTarefaDestino = z.infer<typeof entradaTarefaDestino>;
