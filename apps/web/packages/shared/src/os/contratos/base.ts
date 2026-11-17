import { z } from "zod";
import { normalizarCnpj } from "../configuracoes";
import type {
  CampoExtra,
  MotivoAguardando,
  Origem,
  Prioridade,
  StatusChamado,
  TipoChamado,
} from "../rotulos";
import { limparTelefone } from "../whatsapp";

// Contratos da base do módulo Tickets (prefixo /api/v1/os), usados pela API
// e pela tela: enums, o apoio das telas (setores, catálogo, pessoas), o
// formulário de abrir chamado e as preferências.
//
//   GET  /os/apoio                        → RespostaApoio
//   GET  /os/formulario                   → DadosDoFormulario
//   GET  /os/formulario/inicial           ConsultaInicial → InicialDoFormulario
//   GET  /os/formulario/vinculos          → OpcoesDeVinculo
//   GET  /os/agendas/:id/horarios?data=   → HorariosDoDia
//   POST /os/categorias/rapida            EntradaCategoriaRapida → { categoria }
//   POST /os/terceirizados/rapido         EntradaTerceirizadoRapido → { mensagem }
//   PUT  /os/preferencias/filtros/:tela   EntradaLembrarFiltros → { mensagem }
//   POST /os/preferencias/seu-dia         → { mensagem }

export const respostaMensagem = z.object({ mensagem: z.string() });
export type RespostaMensagem = z.infer<typeof respostaMensagem>;

// ---------------------------------------------------------------------------
// Enums (as chaves gravadas no banco; rótulos em ../rotulos)
// ---------------------------------------------------------------------------

export const tipoChamado = z.enum([
  "tarefa",
  "solicitacao",
  "os",
  "aviso",
]) satisfies z.ZodType<TipoChamado>;
export const statusChamado = z.enum([
  "aberto",
  "em_andamento",
  "aguardando",
  "concluido",
  "fechado",
  "cancelado",
]) satisfies z.ZodType<StatusChamado>;
export const prioridade = z.enum([
  "baixa",
  "media",
  "alta",
  "urgente",
]) satisfies z.ZodType<Prioridade>;
export const origem = z.enum([
  "sistema",
  "portal",
  "modelo",
  "preventiva",
  "recorrencia",
  "vistoria",
  "importacao",
  "modulo",
]) satisfies z.ZodType<Origem>;
export const motivoAguardando = z.enum([
  "lojista",
  "terceirizado",
  "material",
  "aprovacao",
  "outro",
]) satisfies z.ZodType<MotivoAguardando>;
export const statusDestino = z.enum([
  "aberto",
  "em_andamento",
  "aguardando",
  "concluido",
]);

export const campoExtra = z.object({
  chave: z.string(),
  rotulo: z.string(),
  tipo: z.enum([
    "texto",
    "numero",
    "data",
    "lista",
    "sim_nao",
    "foto",
    "anexo",
  ]),
  opcoes: z.array(z.string()).optional(),
  obrigatorio: z.boolean().optional(),
}) satisfies z.ZodType<CampoExtra>;

// ---------------------------------------------------------------------------
// Apoio: o que toda tela do módulo usa (configuração; muda pouco)
// ---------------------------------------------------------------------------

export const setorDoApoio = z.object({
  id: z.string(),
  nome: z.string(),
  cor: z.string(),
  icone: z.string(),
  ativo: z.boolean(),
  ordem: z.number(),
});
export type SetorDoApoio = z.infer<typeof setorDoApoio>;

export const categoriaDoApoio = z.object({
  id: z.string(),
  nome: z.string(),
  setor_id: z.string(),
  pai_id: z.string().nullable(),
  ativo: z.boolean(),
});
export type CategoriaDoApoio = z.infer<typeof categoriaDoApoio>;

export const pessoaDoModulo = z.object({
  id: z.string(),
  nome: z.string(),
  /** Setores de que a pessoa faz parte. */
  setores: z.array(z.string()),
});
export type PessoaDoModulo = z.infer<typeof pessoaDoModulo>;

export const respostaApoio = z.object({
  /** Todos os setores (ativos e inativos), na ordem da tela. */
  setores: z.array(setorDoApoio),
  /** Todas as categorias (ativas e inativas), na ordem do catálogo. */
  categorias: z.array(categoriaDoApoio),
  /** Quem usa o módulo, pelo nome. */
  pessoas: z.array(pessoaDoModulo),
  /** Setores de quem está logado e aqueles em que é gestor. */
  meusSetores: z.array(z.string()),
  gestorDe: z.array(z.string()),
  /** Horas antes do prazo em que o selo fica amarelo (parâmetros). */
  avisoHoras: z.number(),
});
export type RespostaApoio = z.infer<typeof respostaApoio>;

// ---------------------------------------------------------------------------
// Formulário de abrir chamado
// ---------------------------------------------------------------------------

export const setorDoFormulario = z.object({
  id: z.string(),
  nome: z.string(),
  cor: z.string(),
  icone: z.string(),
});
export type SetorDoFormulario = z.infer<typeof setorDoFormulario>;

export const categoriaDoFormulario = z.object({
  id: z.string(),
  setorId: z.string(),
  paiId: z.string().nullable(),
  nome: z.string(),
  icone: z.string(),
  cor: z.string().nullable(),
  tipo: tipoChamado,
  prioridade,
  responsavelId: z.string().nullable(),
  /** "2 dias úteis", "4 horas"; null sem prazo padrão. */
  prazo: z.string().nullable(),
  precisaConfirmacao: z.boolean(),
  vincularAtivo: z.boolean(),
  vincularLoja: z.boolean(),
  agendaId: z.string().nullable(),
  campos: z.array(campoExtra),
  itensChecklist: z.number(),
});
export type CategoriaDoFormulario = z.infer<typeof categoriaDoFormulario>;

export const dadosDoFormulario = z.object({
  eu: z.object({ id: z.string(), nome: z.string() }),
  meusSetores: z.array(z.string()),
  setores: z.array(setorDoFormulario),
  categorias: z.array(categoriaDoFormulario),
  pessoas: z.array(pessoaDoModulo),
  agendas: z.array(z.object({ id: z.string(), nome: z.string() })),
});
export type DadosDoFormulario = z.infer<typeof dadosDoFormulario>;

/** Contexto que chega pela URL ou pelo botão de outra tela. */
export const inicialDoFormulario = z.object({
  setorId: z.string().optional(),
  categoriaId: z.string().nullable().optional(),
  tipo: tipoChamado.optional(),
  titulo: z.string().optional(),
  descricao: z.string().optional(),
  prioridade: prioridade.optional(),
  etiquetas: z.string().optional(),
  lojaId: z.string().optional(),
  ativoId: z.string().optional(),
  vistoriaId: z.string().optional(),
  ambienteId: z.string().optional(),
  vinculadoAId: z.string().optional(),
  /** O que já vem ligado, para mostrar no topo ("Ativo AT-0012 · Bomba"). */
  contexto: z.array(z.object({ rotulo: z.string(), valor: z.string() })),
});
export type InicialDoFormulario = z.infer<typeof inicialDoFormulario>;

/** ?duplicar=&vinculado=&ativo=&loja=&vistoria=&ambiente=&titulo=&descricao= */
export const consultaInicial = z.looseObject({
  /** "1": a página é a de abrir OS (/os/ordens/nova). */
  os: z.enum(["0", "1"]).default("0"),
});
export type ConsultaInicial = z.infer<typeof consultaInicial>;

const opcao = z.object({
  id: z.string(),
  rotulo: z.string(),
  descricao: z.string(),
});
export const opcoesDeVinculo = z.object({
  lojas: z.array(opcao),
  ativos: z.array(opcao),
});
export type OpcoesDeVinculo = z.infer<typeof opcoesDeVinculo>;

export const consultaHorarios = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const horariosDoDia = z.object({
  orientacao: z.string().nullable(),
  /** ISO 8601. */
  livres: z.array(z.object({ inicio: z.string(), fim: z.string() })),
});
export type HorariosDoDia = z.infer<typeof horariosDoDia>;

export const respostaCategoriaRapida = z.object({
  categoria: categoriaDoFormulario,
});

// ---------------------------------------------------------------------------
// Preferências da tela
// ---------------------------------------------------------------------------

export const telaComFiltros = z.enum([
  "caixa",
  "setor",
  "quadro",
  "calendario",
  "avisos",
  "os_caixa",
  "os_setor",
  "os_quadro",
]);
export const entradaLembrarFiltros = z.object({
  valores: z.record(z.string().max(40), z.string().max(400)),
});
export type EntradaLembrarFiltros = z.infer<typeof entradaLembrarFiltros>;

// ---------------------------------------------------------------------------
// Cadastros rápidos do "Novo chamado" (categoria e terceirizado)
// ---------------------------------------------------------------------------

export const entradaCategoriaRapida = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome: informe o nome")
    .max(80, "Nome: no máximo 80 caracteres"),
  setorId: z.uuid("Setor: escolha o setor"),
  icone: z.string().regex(/^[a-z0-9-]{1,40}$/, "icone: escolha um ícone"),
  tipo: z.enum(
    ["tarefa", "solicitacao", "os", "aviso"],
    "Tipo: escolha o tipo",
  ),
});
export type EntradaCategoriaRapida = z.infer<typeof entradaCategoriaRapida>;

const opcionalDe = (max: number, rotulo: string) =>
  z.preprocess(
    (v) => (v == null || String(v).trim() === "" ? null : String(v).trim()),
    z.string().max(max, `${rotulo}: no máximo ${max} caracteres`).nullable(),
  );

export const entradaTerceirizadoRapido = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Nome: informe o nome")
    .max(120, "Nome: no máximo 120 caracteres"),
  cnpj: z
    .string()
    .default("")
    .transform((v) => normalizarCnpj(v))
    .refine((v) => v !== undefined, "CNPJ: CNPJ inválido"),
  contato: opcionalDe(120, "Contato"),
  telefone: opcionalDe(30, "Telefone").refine(
    (t) => t === null || limparTelefone(t) !== null,
    "Telefone: telefone com DDD (10 ou 11 dígitos)",
  ),
  email: z.preprocess(
    (v) =>
      String(v ?? "").trim() === "" ? null : String(v).trim().toLowerCase(),
    z.email("E-mail: e-mail inválido").nullable(),
  ),
  servicos: opcionalDe(500, "Serviços"),
});
export type EntradaTerceirizadoRapido = z.infer<
  typeof entradaTerceirizadoRapido
>;
