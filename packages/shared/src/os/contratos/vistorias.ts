import { z } from "zod";
import type {
  RespostaAmbiente,
  StatusVistoria,
  TipoVistoria,
} from "../rotulos";
import { statusChamado, tipoChamado } from "./base";

// Contratos das Vistorias do Tickets (prefixo /api/v1/os) e do link do
// locatário (sem login).
//
//   GET    /os/vistorias                          ?filtros&pagina → RespostaVistorias
//   GET    /os/vistorias/exportacao               ?filtros → Planilha
//   GET    /os/vistorias/nova                     → RespostaNovaVistoria
//   POST   /os/vistorias                          EntradaNovaVistoria → { id }
//   GET    /os/vistorias/:id                      → DetalheDaVistoria
//   PATCH  /os/vistorias/:id                      EntradaVistoria
//   POST   /os/vistorias/:id/duplicar             → { id, mensagem }
//   GET    /os/vistorias/:id/laudo                ?entrada&baixar → PDF
//   POST   /os/vistorias/:id/envio                → RespostaEnvio
//   POST   /os/vistorias/:id/link-assinatura      → RespostaEnvio
//   POST   /os/vistorias/:id/ambientes            EntradaNovoAmbiente → RespostaAmbienteIncluido
//   PUT    /os/vistorias/:id/ambientes/ordem      { ids }
//   PATCH  /os/vistorias/:id/ambientes/:ambiente  EntradaAmbiente
//   DELETE /os/vistorias/ambientes/:id
//   POST   /os/vistorias/:id/ambientes/:ambiente/fotos  multipart (arquivo) → { foto }
//   DELETE /os/vistorias/fotos/:id
//   POST   /os/vistorias/:id/assinaturas/:parte   multipart (arquivo) → { url }
//   DELETE /os/vistorias/:id/assinaturas/:parte
//   GET    /os/vistoria-publica/:token            → PaginaDaVistoria (404: link inativo)
//   GET    /os/vistoria-publica/:token/laudo      → PDF
//   POST   /os/vistoria-publica/:token/assinatura multipart → { mensagem }

export const tipoVistoria = z.enum(
  ["entrada", "saida", "preventiva", "extraordinaria"],
  "escolha o tipo",
) satisfies z.ZodType<TipoVistoria>;
export const statusVistoria = z.enum(
  ["andamento", "finalizado", "cancelado"],
  "escolha o status",
) satisfies z.ZodType<StatusVistoria>;
export const respostaAmbiente = z.enum([
  "respondido",
  "nao_se_aplica",
  "pendente",
]) satisfies z.ZodType<RespostaAmbiente>;

export const idDaVistoria = z.object({ id: z.uuid("inválido") });
export const idDoAmbiente = z.object({
  id: z.uuid("inválido"),
  ambiente: z.uuid("inválido"),
});
export const parteDaAssinatura = z.enum(["locador", "locatario"]);
export const idDaAssinatura = z.object({
  id: z.uuid("inválido"),
  parte: parteDaAssinatura,
});
export const tokenDaVistoria = z.object({ token: z.string().max(4096) });

// ---------------------------------------------------------------------------
// Lista
// ---------------------------------------------------------------------------

export const vistoriaResumo = z.object({
  id: z.string(),
  codigo: z.string(),
  tipo: tipoVistoria,
  status: statusVistoria,
  rascunho: z.boolean(),
  data: z.string(),
  hora: z.string().nullable(),
  vistoriador_id: z.string().nullable(),
  vistoriador_nome: z.string(),
  loja_id: z.string().nullable(),
  locatario: z.string(),
  bloco: z.string(),
  unidade: z.string(),
  assinatura_locador_path: z.string().nullable(),
  assinatura_locatario_path: z.string().nullable(),
  legado_id: z.string().nullable(),
  criado_em: z.string(),
  atualizado_em: z.string(),
  /** OS abertas a partir dos ambientes desta vistoria. */
  ordens: z.number(),
});
export type VistoriaResumo = z.infer<typeof vistoriaResumo>;

export const consultaVistorias = z.looseObject({});

export const respostaVistorias = z.object({
  vistorias: z.array(vistoriaResumo),
  total: z.number(),
  pagina: z.number(),
  contagem: z.object({
    andamento: z.number(),
    assinatura: z.number(),
    concluidas: z.number(),
    com_os: z.number(),
  }),
  /** [valor do filtro, nome], para o filtro de vistoriador. */
  vistoriadores: z.array(z.tuple([z.string(), z.string()])),
  blocos: z.array(z.string()),
});
export type RespostaVistorias = z.infer<typeof respostaVistorias>;

// ---------------------------------------------------------------------------
// Detalhe
// ---------------------------------------------------------------------------

export const vistoria = z.object({
  id: z.string(),
  codigo: z.string(),
  tipo: tipoVistoria,
  status: statusVistoria,
  rascunho: z.boolean(),
  data: z.string(),
  hora: z.string().nullable(),
  vistoriador_id: z.string().nullable(),
  vistoriador_nome: z.string(),
  locador: z.string(),
  loja_id: z.string().nullable(),
  locatario: z.string(),
  bloco: z.string(),
  unidade: z.string(),
  campo_tipo: z.string().nullable(),
  itens_anteriores: z.string().nullable(),
  observacao: z.string(),
  consideracoes: z.string().nullable(),
  termo: z.string(),
  local_data: z.string(),
  comparar_no_laudo: z.boolean(),
  entrada_id: z.string().nullable(),
  assinatura_locador_path: z.string().nullable(),
  assinatura_locatario_path: z.string().nullable(),
  assinado_em: z.string().nullable(),
  assinatura_enviada_em: z.string().nullable(),
  locatario_assinado_em: z.string().nullable(),
  locatario_assinatura_nome: z.string().nullable(),
  locatario_assinatura_documento: z.string().nullable(),
  legado_id: z.string().nullable(),
  criado_em: z.string(),
  atualizado_em: z.string(),
});
export type Vistoria = z.infer<typeof vistoria>;

export const foto = z.object({
  id: z.string(),
  nome: z.string(),
  path: z.string(),
  url: z.string().nullable(),
});
export type Foto = z.infer<typeof foto>;

export const ambienteDaEntrada = z.object({
  titulo: z.string(),
  resposta: respostaAmbiente,
  descricao: z.string().nullable(),
  fotos: z.array(foto),
});
export type AmbienteDaEntrada = z.infer<typeof ambienteDaEntrada>;

export const ambienteCompleto = z.object({
  id: z.string(),
  titulo: z.string(),
  resposta: respostaAmbiente,
  descricao: z.string().nullable(),
  problema: z.boolean(),
  ordem: z.number(),
  fotos: z.array(foto),
  entrada: ambienteDaEntrada.nullable(),
});

export const chamadoDaVistoria = z.object({
  id: z.string(),
  numero: z.number(),
  tipo: tipoChamado,
  titulo: z.string(),
  status: statusChamado,
  ambiente_id: z.string().nullable(),
  criado_em: z.string(),
});
export type ChamadoDaVistoria = z.infer<typeof chamadoDaVistoria>;

const textosDoTipo = z.object({ observacao: z.string(), termo: z.string() });

export const lojaParaVistoria = z.object({
  id: z.string(),
  nome: z.string(),
  luc: z.string(),
  bloco: z.string().nullable(),
  locatario: z.string().nullable(),
  situacao: z.string(),
});
export type LojaParaVistoria = z.infer<typeof lojaParaVistoria>;

export const detalheDaVistoria = z.object({
  vistoria,
  ambientes: z.array(ambienteCompleto),
  entrada: z
    .object({ id: z.string(), codigo: z.string(), data: z.string() })
    .nullable(),
  chamados: z.array(chamadoDaVistoria),
  assinaturas: z.object({
    locador: z.string().nullable(),
    locatario: z.string().nullable(),
  }),
  lojas: z.array(lojaParaVistoria),
  pessoas: z.array(z.object({ id: z.string(), nome: z.string() })),
  padroes: z.object({
    local: z.string(),
    textos: z.object({
      entrada: textosDoTipo,
      saida: textosDoTipo,
      preventiva: textosDoTipo,
      extraordinaria: textosDoTipo,
    }),
  }),
});
export type DetalheDaVistoria = z.infer<typeof detalheDaVistoria>;

export const respostaNovaVistoria = z.object({
  lojas: z.array(lojaParaVistoria),
});

// ---------------------------------------------------------------------------
// Gravações
// ---------------------------------------------------------------------------

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `máximo de ${max} caracteres`)
    .nullable()
    .transform((v) => v || null);

export const ROTULOS_VISTORIA: Record<string, string> = {
  tipo: "Tipo",
  codigo: "Código do laudo",
  status: "Status",
  data: "Data",
  hora: "Hora",
  vistoriador_nome: "Vistoriador",
  locador: "Locador",
  locatario: "Locatário(a)",
  bloco: "Bloco / Área",
  unidade: "Locação / Unidade",
  titulo: "Título do ambiente",
  arquivo: "Arquivo",
};

export const entradaNovaVistoria = z.object({
  tipo: tipoVistoria,
  loja_id: z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z.uuid().nullable(),
  ),
  locatario: z.string().trim().max(200).default(""),
  bloco: z.string().trim().max(100).default(""),
  unidade: z.string().trim().max(100).default(""),
  data,
});

export const entradaAmbiente = z.object({
  titulo: z.string().trim().min(1, "informe o título").max(120),
  resposta: respostaAmbiente,
  descricao: textoOpcional(4000),
  problema: z.boolean(),
});

export const entradaVistoria = z.object({
  rascunho: z.boolean(),
  tipo: tipoVistoria,
  codigo: z.string().trim().min(1, "informe o código").max(30),
  status: statusVistoria,
  data,
  hora: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "hora inválida")
    .nullable()
    .or(z.literal("").transform(() => null)),
  vistoriador_id: z.uuid().nullable(),
  vistoriador_nome: z.string().trim().min(1, "escolha o vistoriador").max(120),
  locador: z.string().trim().max(200),
  loja_id: z.uuid().nullable(),
  locatario: z.string().trim().max(200),
  bloco: z.string().trim().max(100),
  unidade: z.string().trim().max(100),
  campo_tipo: z.enum(["sim", "nao", "nao_se_aplica"]).nullable(),
  itens_anteriores: textoOpcional(2000),
  observacao: z.string().max(6000),
  consideracoes: textoOpcional(6000),
  termo: z.string().max(10000),
  local_data: z.string().trim().max(200),
  comparar_no_laudo: z.boolean(),
  ambientes: z.array(entradaAmbiente.extend({ id: z.uuid() })).max(80),
});
export type EntradaVistoria = z.input<typeof entradaVistoria>;

export const entradaNovoAmbiente = z.object({
  titulo: z.string().trim().min(1, "informe o título").max(120),
  ordem: z.number().int().min(0).max(1000),
});

export const respostaAmbienteIncluido = z.object({
  mensagem: z.string(),
  id: z.string(),
  entrada: ambienteDaEntrada.nullable(),
});

export const entradaOrdemDosAmbientes = z.object({
  ids: z.array(z.uuid()).max(80),
});

export const respostaFoto = z.object({ mensagem: z.string(), foto });

export const respostaAssinatura = z.object({
  mensagem: z.string(),
  url: z.string().nullable(),
});

export const respostaCriada = z.object({
  mensagem: z.string(),
  id: z.string(),
});

export const respostaEnvio = z.object({
  mensagem: z.string(),
  link: z.string(),
  whatsapp: z.string(),
});
export type RespostaEnvio = z.infer<typeof respostaEnvio>;

export const consultaLaudo = z.object({
  entrada: z.string().optional(),
  baixar: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Link do locatário
// ---------------------------------------------------------------------------

export const paginaDaVistoria = z.object({
  token: z.string(),
  codigo: z.string(),
  tipo: z.string(),
  data: z.string(),
  unidade: z.string(),
  locador: z.string(),
  locatario: z.string(),
  observacao: z.string(),
  consideracoes: z.string().nullable(),
  termo: z.string(),
  localData: z.string(),
  ambientes: z.array(
    z.object({
      id: z.string(),
      titulo: z.string(),
      texto: z.string(),
      fotos: z.array(
        z.object({ id: z.string(), nome: z.string(), url: z.string() }),
      ),
    }),
  ),
  assinaturaLocador: z.string().nullable(),
  assinado: z
    .object({
      nome: z.string(),
      documento: z.string().nullable(),
      em: z.string().nullable(),
    })
    .nullable(),
  motivo: z.string().nullable(),
});
export type PaginaDaVistoria = z.infer<typeof paginaDaVistoria>;

export const entradaAssinaturaDoLink = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/),
  nome: z.string().trim().min(2, "Informe o nome de quem assina.").max(120),
  documento: z.string().trim().max(30),
  concordo: z.literal("1", "Marque que leu e concorda com o laudo."),
});
