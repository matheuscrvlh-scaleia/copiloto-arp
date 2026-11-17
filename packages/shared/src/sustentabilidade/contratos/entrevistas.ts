import { z } from "zod";
import { definicaoSchema } from "../formulario/tipos";

// Contratos das entrevistas de resíduos (spec 4.4): controle, ficha do
// contrato, aplicar (rascunho, assinaturas, salvar), respostas e as ações de
// "dispensar ou corrigir". As leituras levam as linhas como as regras puras
// de ../entrevistas-controle as recebem.

const situacaoEntrevista = z.enum([
  "aguardando",
  "pendente",
  "em_dia",
  "a_vencer",
  "vencida",
  "dispensada",
]);
const respostas = z.record(z.string(), z.unknown());

export const contratoControle = z.object({
  id: z.string(),
  loja_id: z.string().nullable(),
  contrato: z.string().nullable(),
  cliente_nome: z.string(),
  cliente_doc: z.string().nullable(),
  lucs: z.array(z.string()),
  bloco: z.string().nullable(),
  tipo_loja: z.string().nullable(),
  ramo: z.string().nullable(),
  ativacao: z.string().nullable(),
  inicio: z.string().nullable(),
  rescisao: z.string().nullable(),
  situacao: z.string(),
  ativacao_corrigida: z.string().nullable(),
  validade_meses_especifica: z.number().nullable(),
  dispensada_motivo: z.string().nullable(),
  dispensada_em: z.string().nullable(),
  chamado_id: z.string().nullable(),
  exemplo: z.boolean(),
});

export const entrevistaResumo = z.object({
  id: z.string(),
  contrato_id: z.string(),
  data: z.string(),
  tipo: z.string(),
  setor: z.string().nullable(),
  entrevistador_id: z.string().nullable(),
  valida_ate: z.string().nullable(),
  tem_pdf: z.boolean(),
  origem: z.string(),
  formulario_versao: z.number(),
  exemplo: z.boolean(),
});

export const chamadoDoContrato = z.object({
  id: z.string(),
  numero: z.string(),
  status: z.string(),
  situacao: z.string(),
  responsavel: z.string().nullable(),
  href: z.string(),
});

export const linhaControle = z.object({
  id: z.string(),
  contrato: z.string().nullable(),
  cliente: z.string(),
  clienteDoc: z.string().nullable(),
  lucs: z.array(z.string()),
  bloco: z.string().nullable(),
  tipoLoja: z.string().nullable(),
  ramo: z.string().nullable(),
  setor: z.string().nullable(),
  ativacao: z.string().nullable(),
  ativacaoCorrigida: z.boolean(),
  dataPrevista: z.string().nullable(),
  ultima: z.string().nullable(),
  validaAte: z.string().nullable(),
  situacao: situacaoEntrevista,
  entrevistador: z.string().nullable(),
  chamado: chamadoDoContrato.nullable(),
  naLista: z.boolean(),
  fora: z.string().nullable(),
  rescisao: z.string().nullable(),
  dispensa: z.string().nullable(),
  exemplo: z.boolean(),
});

const parametrosEntrevista = z.object({
  mesesPrimeira: z.number(),
  validadePadraoMeses: z.number(),
  validadePorSetor: z.record(z.string(), z.number()),
  avisoDias: z.number(),
});

export const configControle = z.object({
  hoje: z.string(),
  parametros: parametrosEntrevista,
  tiposLojaDispensados: z.array(z.string()),
  dataInauguracao: z.string(),
});

/** GET /sustentabilidade/entrevistas/controle */
export const respostaControle = z.object({
  contratos: z.array(contratoControle),
  entrevistas: z.array(entrevistaResumo),
  linhas: z.array(linhaControle),
  config: configControle,
  /** Há contrato de exemplo na lista (nota de dado fictício). */
  exemplo: z.boolean(),
});
export type RespostaControle = z.infer<typeof respostaControle>;

/** GET /sustentabilidade/entrevistas/contratos/:id (a ficha). */
export const respostaFicha = z.object({
  contrato: contratoControle.extend({
    ativacao_corrigida_motivo: z.string().nullable(),
    ativacao_corrigida_em: z.string().nullable(),
    dispensada_por: z.string().nullable(),
  }),
  linha: linhaControle,
  entrevistas: z.array(
    z.object({
      id: z.string(),
      data: z.string(),
      tipo: z.string(),
      setor: z.string().nullable(),
      versao: z.number(),
      origem: z.string(),
      entrevistador: z.string().nullable(),
      validaAte: z.string().nullable(),
      exemplo: z.boolean(),
      /** Linha completa visível pelo RLS (respostas, PDF e anexos). */
      completa: z.boolean(),
      respondente: z.string().nullable(),
      /** Link do PDF assinado. */
      pdf: z.string().nullable(),
      anexos: z.array(
        z.object({
          nome: z.string(),
          caminho: z.string(),
          url: z.string().nullable(),
        }),
      ),
      transferidaDe: z.string().nullable(),
    }),
  ),
  transferencias: z.array(
    z.object({
      quando: z.string(),
      quem: z.string().nullable(),
      motivo: z.string(),
      de: z.string(),
      para: z.string(),
      entrevistaId: z.string(),
    }),
  ),
  mesmoCliente: z.array(z.object({ id: z.string(), rotulo: z.string() })),
  dispensadaPor: z.string().nullable(),
  /** motivos_dispensa dos Parâmetros. */
  motivosDispensa: z.array(z.string()),
});
export type RespostaFicha = z.infer<typeof respostaFicha>;

/** GET /sustentabilidade/entrevistas/salvas/:id: respostas de uma entrevista. */
export const respostaEntrevistaSalva = z.object({
  /** Null quando a pessoa não lê as respostas (RLS) ou falta a versão. */
  respostas: z
    .object({
      versao: z.number(),
      definicao: definicaoSchema,
      respostas,
    })
    .nullable(),
});

export const problemaDeAplicar = z.enum(["contrato", "questionario", "versao"]);

/** GET /sustentabilidade/entrevistas/contratos/:id/aplicar */
export const respostaAplicar = z.union([
  z.object({ problema: problemaDeAplicar }),
  z.object({
    contrato: contratoControle,
    tipo: z.enum(["primeira", "atualizacao"]),
    versao: z.number(),
    definicao: definicaoSchema,
    unidades: z.array(z.string()),
    rascunho: z
      .object({
        chave: z.string(),
        versao: z.number(),
        respostas,
        alteradoEm: z.number(),
        respondente: z.string().nullable(),
        urlRespondente: z.string().nullable(),
        urlEntrevistador: z.string().nullable(),
        temRespondente: z.boolean(),
        temEntrevistador: z.boolean(),
      })
      .nullable(),
  }),
]);
export type RespostaAplicar = z.infer<typeof respostaAplicar>;

export const consultaRespostas = z.object({
  de: z.iso.date("Período inválido."),
  ate: z.iso.date("Período inválido."),
});

/** GET /sustentabilidade/entrevistas/respostas?de&ate */
export const respostaRespostas = z.object({
  /** Versão publicada do questionário (0: nunca publicado). */
  publicada: z.number(),
  versoes: z.array(
    z.object({ versao: z.number(), definicao: definicaoSchema }),
  ),
  lista: z.array(
    z.object({
      id: z.string(),
      contrato_id: z.string(),
      data: z.string(),
      tipo: z.string(),
      setor: z.string().nullable(),
      formulario_versao: z.number(),
      respostas,
      respondente_nome: z.string().nullable(),
      entrevistador_id: z.string().nullable(),
      origem: z.string(),
      pdf: z.string().nullable(),
      exemplo: z.boolean(),
      bloco: z.string().nullable(),
      cliente: z.string(),
      lucs: z.array(z.string()),
      entrevistador: z.string().nullable(),
    }),
  ),
  /** Link do PDF assinado, por caminho. */
  pdfs: z.record(z.string(), z.string()),
});
export type RespostaRespostas = z.infer<typeof respostaRespostas>;

// ---------------------------------------------------------------- gravações

/** POST /sustentabilidade/entrevistas/rascunhos (idempotente pela chave). */
export const entradaRascunho = z.object({
  chave: z.uuid(),
  contratoId: z.uuid(),
  versao: z.number().int().positive(),
  respostas: z.record(z.string().max(80), z.unknown()),
});
export const respostaRascunho = z.object({ salva: z.boolean() });

/** POST /sustentabilidade/entrevistas/assinaturas (multipart, com a PNG). */
export const entradaAssinatura = z.object({
  chave: z.uuid(),
  quem: z.enum(["respondente", "entrevistador"]),
  nome: z.string().trim().min(2, "informe o nome de quem assina").max(120),
});

/** POST /sustentabilidade/entrevistas/concluir */
export const entradaConcluir = z.object({
  chave: z.uuid("Rascunho inválido."),
});
export const respostaConcluir = z.object({
  mensagem: z.string(),
  aviso: z.string().optional(),
});

/** POST /sustentabilidade/entrevistas/interesse */
export const entradaInteresse = z.object({
  contratoId: z.uuid("Contrato inválido."),
});

const contratoId = z.uuid("Contrato inválido.");

/** POST /sustentabilidade/entrevistas/dispensar */
export const entradaDispensa = z.object({
  contrato_id: contratoId,
  motivo: z.string().trim().min(1, "Escolha o motivo."),
  observacao: z.string().trim().max(400).optional().default(""),
});

/** POST /sustentabilidade/entrevistas/desfazer-dispensa */
export const entradaDesfazerDispensa = z.object({ contrato_id: contratoId });

/** POST /sustentabilidade/entrevistas/ativacao */
export const entradaAtivacao = z
  .object({
    contrato_id: contratoId,
    data: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Data inválida."),
    motivo: z.string().trim().max(500).optional().default(""),
  })
  .refine((v) => !v.data || v.motivo.length >= 3, {
    message: "Escreva o motivo da correção.",
  });

/** POST /sustentabilidade/entrevistas/prazo */
export const entradaPrazo = z.object({
  contrato_id: contratoId,
  meses: z
    .string()
    .trim()
    .regex(/^\d{0,3}$/, "Informe os meses (número inteiro).")
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (v >= 1 && v <= 120), "Entre 1 e 120 meses."),
});

/** POST /sustentabilidade/entrevistas/transferir */
export const entradaTransferencia = z.object({
  entrevista_id: z.uuid("Entrevista inválida."),
  para_contrato_id: z.uuid("Escolha o contrato de destino."),
  motivo: z.string().trim().min(3, "Escreva o motivo.").max(500),
});

/** POST /sustentabilidade/entrevistas/anexos (multipart). */
export const entradaAnexo = z.object({
  entrevista_id: z.uuid("Entrevista inválida."),
});
