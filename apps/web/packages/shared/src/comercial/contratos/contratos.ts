import { z } from "zod";
import { type ParametrosContrato, TIPOS_ANEXO } from "../contrato";
import { momento } from "./base";

// Contratos e distratos (spec 4.11): lista, o assistente de 8 etapas, o
// distrato, anexos, fichas e vistorias do Tickets. Sem comercial.valores.ver,
// o aluguel vem null e os valores de `dados` vêm zerados.
//
//   GET    /api/v1/comercial/contratos?atualizacao=90          → RespostaListaContratos
//   GET    /api/v1/comercial/contratos/apoio                   → RespostaApoioContrato
//   GET    /api/v1/comercial/contratos/distratos/enet          → RespostaContratosEnet
//   GET    /api/v1/comercial/contratos/vistorias?luc=&tipo=     → { vistoria: VistoriaDoLuc | null }
//   GET    /api/v1/comercial/contratos/:id                     → RespostaContrato
//   POST   /api/v1/comercial/contratos                         EntradaSalvarContrato → RespostaGravacao
//   POST   /api/v1/comercial/contratos/:id/pronto              { lido } → RespostaGravacao
//   POST   /api/v1/comercial/contratos/distratos               EntradaSalvarDistrato → RespostaGravacao
//   POST   /api/v1/comercial/contratos/fichas/:id/carregar     → RespostaFichaCarregada
//   POST   /api/v1/comercial/contratos/vistoria-de-entrada     { lucs } → RespostaVistoriaPuxada
//   POST   /api/v1/comercial/contratos/:id/anexos/envio        { tipo, nome, tamanho } → { url, path }
//   POST   /api/v1/comercial/contratos/:id/anexos              { tipo, path, nome } → { mensagem }
//   DELETE /api/v1/comercial/contratos/anexos/:anexo           → { mensagem }
//   GET    /api/v1/comercial/contratos/anexos/:anexo/link      → { url }

const status = z.enum(["rascunho", "pronto", "gerado"]);
const tipoContrato = z.enum(["contrato", "distrato"]);
const tiposAnexo = Object.keys(TIPOS_ANEXO) as [
  keyof typeof TIPOS_ANEXO,
  ...(keyof typeof TIPOS_ANEXO)[],
];
export const tipoAnexo = z.enum(tiposAnexo);

export const ATUALIZACAO = {
  "30": "Últimos 30 dias",
  "90": "Últimos 90 dias",
  "365": "Últimos 12 meses",
  todos: "Qualquer data",
} as const;
export type Atualizacao = keyof typeof ATUALIZACAO;

export const consultaListaContratos = z.object({
  atualizacao: z.enum(["30", "90", "365", "todos"]).optional(),
});

export const linhaContrato = z.object({
  id: z.string(),
  tipo: tipoContrato,
  status,
  versao: z.number(),
  lucs: z.array(z.string()),
  bloco: z.string().nullable(),
  locatario: z.string().nullable(),
  parte: z.enum(["pf", "pj"]).nullable(),
  garantia: z
    .enum([
      "fiador",
      "capitalizacao",
      "seguro_fianca",
      "caucao",
      "sem_garantia",
    ])
    .nullable(),
  /** null sem comercial.valores.ver. */
  aluguel: z.number().nullable(),
  atualizadoEm: z.string(),
  atualizadoPor: z.string().nullable(),
  geradoEm: z.string().nullable(),
  exemplo: z.boolean(),
});
export type LinhaContrato = z.infer<typeof linhaContrato>;

export const respostaListaContratos = momento.extend({
  linhas: z.array(linhaContrato),
});
export type RespostaListaContratos = z.infer<typeof respostaListaContratos>;

export const parametrosContrato = z.object({
  empreendimento_nome: z.string(),
  locadora_razao_social: z.string(),
  locadora_cnpj: z.string(),
  locadora_representacao: z.string(),
  endereco_cep: z.string(),
  endereco_logradouro: z.string(),
  endereco_numero: z.string(),
  endereco_complemento: z.string().nullable(),
  endereco_bairro: z.string(),
  endereco_cidade: z.string(),
  endereco_uf: z.string(),
  indice_padrao: z.string(),
  dia_vencimento_padrao: z.number(),
  caucao_alugueis: z.number(),
  caucao_prazo_dias: z.number(),
  capitalizacao_prazo_dias: z.number(),
  nc004_versao: z.string(),
  obras_tapume_dias: z.number(),
  obras_retirada_dias: z.number(),
  obras_projetos_dias: z.number(),
  multa_alugueis: z.number(),
  vaga_promocional_padrao: z.number(),
  consumo_agua_padrao: z.boolean(),
  entrega_tipo_imovel: z.string(),
  entrega_padrao: z.string(),
  entrega_prazo_implantacao_dias: z.number(),
}) satisfies z.ZodType<ParametrosContrato>;

export const lucParaContrato = z.object({
  numero: z.string(),
  local: z.string(),
  piso: z.string(),
  tipo: z.string(),
  abl: z.number(),
  status: z.enum(["Locado", "Vago"]),
  rua: z.string(),
});
export type LucParaContrato = z.infer<typeof lucParaContrato>;

export const fichaParaContrato = z.object({
  id: z.string(),
  tipo: z.enum(["pj", "pf", "fiador"]),
  nome: z.string(),
  luc: z.string().nullable(),
  data: z.string(),
  situacao: z.string(),
});
export type FichaParaContrato = z.infer<typeof fichaParaContrato>;

export const documentoDoKitContrato = z.object({
  documentoId: z.string(),
  nome: z.string(),
  ativo: z.boolean(),
  todo_contrato: z.boolean(),
  blocos: z.array(z.string()),
  lucs: z.array(z.string()),
  ordem: z.number(),
  versaoId: z.string().nullable(),
  versao: z.string().nullable(),
  validade: z.string().nullable(),
});
export type DocumentoDoKitContrato = z.infer<typeof documentoDoKitContrato>;

/** O que o assistente precisa além do contrato. */
export const respostaApoioContrato = momento.extend({
  parametros: parametrosContrato,
  /** Obrigatórios por garantia (parâmetros), lidos com lerObrigatorios. */
  obrigatorios: z.unknown(),
  lucs: z.array(lucParaContrato),
  /** LUCs do ENET de exemplo. */
  exemplo: z.boolean(),
  /** Só para quem edita. */
  fichas: z.array(fichaParaContrato),
  kit: z.array(documentoDoKitContrato),
});
export type RespostaApoioContrato = z.infer<typeof respostaApoioContrato>;

export const anexoDoContrato = z.object({
  id: z.string(),
  tipo: tipoAnexo,
  nome: z.string(),
  tamanho: z.number().nullable(),
  enviadoEm: z.string(),
  enviadoPor: z.string().nullable(),
});
export type AnexoDoContrato = z.infer<typeof anexoDoContrato>;

export const versaoDoContrato = z.object({
  id: z.number(),
  versao: z.number(),
  status,
  etapa: z.number(),
  por: z.string().nullable(),
  em: z.string(),
});
export type VersaoDoContrato = z.infer<typeof versaoDoContrato>;

export const vistoriaDoLuc = z.object({
  id: z.string(),
  codigo: z.string(),
  data: z.string(),
  href: z.string(),
});
export type VistoriaDoLuc = z.infer<typeof vistoriaDoLuc>;

export const consultaVistoria = z.object({
  luc: z.string().max(30),
  tipo: z.enum(["entrada", "saida"]),
});
export const respostaVistoria = z.object({
  vistoria: vistoriaDoLuc.nullable(),
});

export const paramsId = z.object({ id: z.uuid() });

/** Um contrato (ou distrato): `dados` se lê com lerDados/lerDistrato. */
export const respostaContrato = momento.extend({
  contrato: z.object({
    id: z.string(),
    tipo: tipoContrato,
    status,
    versao: z.number(),
    etapaAtual: z.number(),
    /** Para conferir, ao gravar, se ninguém mudou no meio. */
    atualizadoEm: z.string(),
    atualizadoPor: z.string().nullable(),
    exemplo: z.boolean(),
    contratoEnet: z.string().nullable(),
    dados: z.unknown(),
  }),
  anexos: z.array(anexoDoContrato),
  versoes: z.array(versaoDoContrato),
  /** Só no distrato: última vistoria de saída do LUC no Tickets. */
  vistoriaSaida: vistoriaDoLuc.nullable(),
});
export type RespostaContrato = z.infer<typeof respostaContrato>;

export const contratoEnetParaDistrato = z.object({
  codigo: z.string(),
  luc: z.string(),
  bloco: z.string(),
  locatario: z.string(),
  documento: z.string(),
  tipoPessoa: z.enum(["PF", "PJ"]),
  inicio: z.string(),
  termino: z.string().nullable(),
  indeterminado: z.boolean(),
  rua: z.string(),
});
export type ContratoEnetParaDistrato = z.infer<typeof contratoEnetParaDistrato>;

export const respostaContratosEnet = momento.extend({
  contratos: z.array(contratoEnetParaDistrato),
  exemplo: z.boolean(),
  /** Endereço do empreendimento (parâmetros) para o distrato. */
  endereco: z.object({
    logradouro: z.string(),
    numero: z.string(),
    bairro: z.string(),
    cidade: z.string(),
    uf: z.string(),
  }),
});
export type RespostaContratosEnet = z.infer<typeof respostaContratosEnet>;

const instante = z.string().max(40);

export const entradaSalvarContrato = z.object({
  id: z.uuid().nullable(),
  /** atualizado_em lido (null no contrato novo). */
  lido: instante.nullable(),
  etapa: z.number().int(),
  /** Validado com esquemaContrato no service (mensagem própria). */
  dados: z.unknown(),
});
export type EntradaSalvarContrato = z.infer<typeof entradaSalvarContrato>;

export const entradaSalvarDistrato = z.object({
  id: z.uuid().nullable(),
  lido: instante.nullable(),
  dados: z.unknown(),
});
export type EntradaSalvarDistrato = z.infer<typeof entradaSalvarDistrato>;

export const entradaPronto = z.object({ lido: instante });

export const respostaGravacao = z.object({
  mensagem: z.string(),
  id: z.string(),
  atualizadoEm: z.string(),
  status,
  versao: z.number(),
  /** A ficha ligada não existe mais (expirou ou foi excluída): o vínculo saiu. */
  fichaSolta: z.boolean().optional(),
});
export type RespostaGravacao = z.infer<typeof respostaGravacao>;

export const respostaFichaCarregada = z.object({
  nome: z.string(),
  /** Lida na tela com dadosDaFichaParaContrato. */
  ficha: z.object({
    id: z.string(),
    tipo: z.string().nullable(),
    origem: z.string(),
    respostas: z.unknown(),
  }),
});
export type RespostaFichaCarregada = z.infer<typeof respostaFichaCarregada>;

export const entradaVistoriaDeEntrada = z.object({
  lucs: z.array(z.string().max(30)).max(10),
});

export const respostaVistoriaPuxada = z.object({
  vistoria: vistoriaDoLuc,
  fisica: z.record(z.string(), z.string()),
});
export type RespostaVistoriaPuxada = z.infer<typeof respostaVistoriaPuxada>;

export const entradaEnvioAnexo = z.object({
  tipo: tipoAnexo,
  nome: z.string().min(1).max(255),
  tamanho: z.number().int().positive(),
});
export const respostaEnvioAnexo = z.object({
  url: z.string(),
  path: z.string(),
});

export const entradaRegistrarAnexo = z.object({
  tipo: tipoAnexo,
  path: z.string().max(400),
  nome: z.string().min(1).max(255),
});

export const paramsAnexo = z.object({ anexo: z.uuid() });
export const respostaLink = z.object({ url: z.string() });
