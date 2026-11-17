import { z } from "zod";
import { TIPOS_PERGUNTA } from "../formulario/tipos";

// Contratos dos Programas (spec 4.8): cadastro, indicadores, a lista da tela
// de Programas e as abas Resumo, Indicadores e Link do parceiro. Os
// lançamentos estão em ./lancamentos e a página pública em ./parceiro.

const data = z.string();
const instante = z.string();
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((t) => t || null);
const dataOpcional = z
  .string()
  .trim()
  .refine((d) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d), "Data inválida.")
  .transform((d) => d || null);
/** Checkbox do formulário ("on") ou booleano. */
const sim = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true" || v === "1");

export const idDoPrograma = z.object({ id: z.uuid("Programa inválido.") });
export const idDoIndicador = z.object({ id: z.uuid("Indicador inválido.") });

/** "aaaa-mm" do mês escolhido na tela. */
export const consultaDoMes = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido."),
});

export const programa = z.object({
  id: z.string(),
  nome: z.string(),
  descricao: z.string().nullable(),
  area: z.string().nullable(),
  parceiro_nome: z.string().nullable(),
  parceiro_doc: z.string().nullable(),
  inicio: data.nullable(),
  fim: data.nullable(),
  frequencia: z.string(),
  ativo: z.boolean(),
  exemplo: z.boolean(),
});
export type Programa = z.infer<typeof programa>;

export const indicador = z.object({
  id: z.string(),
  programa_id: z.string(),
  nome: z.string(),
  formulario_id: z.string(),
  campo_id: z.string().nullable(),
  calculo: z.string(),
  filtro: z.unknown(),
  percentual_valor: z.string().nullable(),
  unidade: z.string().nullable(),
  grupo: z.string().nullable(),
  mostrar_painel: z.boolean(),
  em_reais: z.boolean(),
  ativo: z.boolean(),
  ordem: z.number(),
});
export type Indicador = z.infer<typeof indicador>;

/** Contato do parceiro (null sem "Ver contato"). */
export const contatoDoPrograma = z
  .object({
    email: z.string().nullable(),
    telefone: z.string().nullable(),
    contato: z.string().nullable(),
  })
  .nullable();
export type ContatoDoPrograma = z.infer<typeof contatoDoPrograma>;

/** Lançamento para os indicadores (comuns e em reais juntos). */
export const lancamentoDoIndicador = z.object({
  programa_id: z.string(),
  formulario_id: z.string(),
  data,
  valores: z.record(z.string(), z.unknown()),
});

export const movimentoDoMes = z.object({
  programa_id: z.string(),
  equipe: z.number(),
  link: z.number(),
  importacao: z.number(),
  /** "aaaa-mm-dd" do último lançamento (de qualquer mês). */
  ultimo: data.nullable(),
});
export type MovimentoDoMes = z.infer<typeof movimentoDoMes>;

/** GET /sustentabilidade/programas?mes=aaaa-mm (tela Programas). */
export const respostaProgramas = z.object({
  /** Os que a pessoa vê nesta tela: quem gerencia, todos; quem lança, os seus. */
  programas: z.array(programa),
  indicadores: z.array(indicador),
  movimento: z.array(movimentoDoMes),
  /** Lançamentos do mês, para os indicadores e o cartão de pessoas. */
  lancamentos: z.array(lancamentoDoIndicador),
  areas_impacto: z.array(z.string()),
  grupos_impacto: z.array(z.string()),
  cobranca_dia: z.number(),
});
export type RespostaProgramas = z.infer<typeof respostaProgramas>;

/** GET /sustentabilidade/programas/:id (cabeçalho e cadastro). */
export const respostaPrograma = z.object({
  programa,
  contato: contatoDoPrograma,
  areas_impacto: z.array(z.string()),
});
export type RespostaPrograma = z.infer<typeof respostaPrograma>;

/** GET /sustentabilidade/programas/:id/resumo?mes=aaaa-mm */
export const respostaResumo = z.object({
  indicadores: z.array(indicador),
  /** Doze meses até o mês escolhido e o ano dele. */
  lancamentos: z.array(lancamentoDoIndicador),
});
export type RespostaResumo = z.infer<typeof respostaResumo>;

// ---------------------------------------------------------------- cadastro

export const entradaPrograma = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, "Informe o nome do programa.")
      .max(120, "Nome com no máximo 120 caracteres."),
    descricao: texto(1000),
    area: texto(80),
    parceiro_nome: texto(150),
    parceiro_doc: z
      .string()
      .transform((d) => d.replace(/\D/g, ""))
      .refine(
        (d) => !d || d.length === 14 || d.length === 11,
        "CNPJ com 14 dígitos (ou CPF com 11).",
      )
      .transform((d) => d || null),
    inicio: dataOpcional,
    fim: dataOpcional,
    frequencia: z.enum(["mensal", "evento"], "Escolha a frequência."),
    email: z
      .string()
      .trim()
      .max(150)
      .refine(
        (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
        "E-mail inválido.",
      )
      .transform((e) => e || null)
      .optional(),
    telefone: texto(40).optional(),
    contato: texto(150).optional(),
  })
  .refine((p) => !p.inicio || !p.fim || p.fim >= p.inicio, {
    message: "O fim não pode ser antes do início.",
    path: ["fim"],
  });
export type EntradaPrograma = z.infer<typeof entradaPrograma>;

/** Inativar ou reativar (programa ou indicador). */
export const entradaSituacao = z.object({
  ativo: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((v) => v === true || v === "true"),
});

export const respostaProgramaCriado = z.object({
  id: z.string(),
  mensagem: z.string(),
});

// ---------------------------------------------------------------- indicadores

export const CALCULOS_INDICADOR = [
  "soma",
  "contagem",
  "contagem_distintos",
  "media",
  "percentual",
] as const;

export const entradaIndicador = z.object({
  nome: z
    .string()
    .trim()
    .min(1, "Informe o nome do indicador.")
    .max(120, "Nome com no máximo 120 caracteres."),
  formulario_id: z.uuid("Escolha o formulário."),
  campo_id: z.string().trim().max(100).default(""),
  calculo: z.enum(CALCULOS_INDICADOR, "Escolha o cálculo."),
  filtro_campo: z.string().trim().max(100).optional(),
  filtro_valor: z.string().trim().max(200).optional(),
  percentual_valor: z.string().trim().max(200).optional(),
  unidade: texto(40),
  grupo: texto(80),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  mostrar_painel: sim,
  em_reais: sim,
});
export type EntradaIndicador = z.infer<typeof entradaIndicador>;

export const idDoIndicadorDoPrograma = z.object({
  id: z.uuid("Programa inválido."),
  indicadorId: z.uuid("Indicador inválido."),
});

export const campoDoFormulario = z.object({
  id: z.string(),
  texto: z.string(),
  tipo: z.enum(TIPOS_PERGUNTA),
  ativo: z.boolean(),
  opcoes: z.array(z.object({ id: z.string(), texto: z.string() })),
});
export type CampoDoFormulario = z.infer<typeof campoDoFormulario>;

export const formularioComCampos = z.object({
  id: z.string(),
  nome: z.string(),
  ativo: z.boolean(),
  versao: z.number(),
  campos: z.array(campoDoFormulario),
});
export type FormularioComCampos = z.infer<typeof formularioComCampos>;

/** GET /sustentabilidade/programas/:id/indicadores (aba Indicadores). */
export const respostaIndicadores = z.object({
  /** Os do programa, ativos e inativos (os em reais só com "Ver valores"). */
  indicadores: z.array(indicador),
  /** Quantos em reais ficaram de fora (sem "Ver valores"). */
  ocultos: z.number(),
  /** Ordem sugerida para o próximo (conta também os ocultos). */
  proxima_ordem: z.number(),
  formularios: z.array(formularioComCampos),
  grupos_impacto: z.array(z.string()),
});
export type RespostaIndicadores = z.infer<typeof respostaIndicadores>;

// ---------------------------------------------------------------- link

export const linkDaEquipe = z.object({
  id: z.string(),
  criadoEm: instante,
  criadoPor: z.string().nullable(),
  desligadoEm: instante.nullable(),
  desligadoPor: z.string().nullable(),
  ultimoAcesso: instante.nullable(),
  lancamentos: z.number(),
});
export type LinkDaEquipe = z.infer<typeof linkDaEquipe>;

/** GET /sustentabilidade/programas/:id/links (aba Link do parceiro). */
export const respostaLinks = z.object({ links: z.array(linkDaEquipe) });

/** POST /sustentabilidade/programas/:id/link: o endereço aparece só aqui. */
export const respostaLinkGerado = z.object({
  mensagem: z.string(),
  link: z.string(),
});
