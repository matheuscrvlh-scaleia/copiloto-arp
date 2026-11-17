import { z } from "zod";
import { CODIGOS_ALERTA } from "../agua-alertas";
import { LISTA_CAMPOS, TIPOS_AGUA } from "../agua-formato";
import { LIMITES_AGUA } from "../agua-importacao";

// Contratos da água (spec 4.4): o mês importado com os alertas, os
// hidrômetros, o extrato, a galeria, a importação mensal e o vínculo.

const data = z.string();
const instante = z.string();

/** Mês com importação confirmada (do mais novo ao mais antigo). */
export const mesImportado = z.object({
  id: z.string(),
  referencia: data,
  incompleta: z.boolean(),
  motivo: z.string().nullable(),
  confirmado_em: instante.nullable(),
  confirmado_por: z.string().nullable(),
  /** Nome de quem confirmou (null: sem nome ou sem permissão de ver). */
  confirmadoPorNome: z.string().nullable(),
  exemplo: z.boolean(),
});
export type MesImportado = z.infer<typeof mesImportado>;

/** GET /operacoes/agua/meses */
export const respostaMesesDaAgua = z.object({ meses: z.array(mesImportado) });

export const leitura = z.object({
  id: z.string(),
  importacaoId: z.string(),
  referencia: data,
  /** Bloco e sala que valem (com a correção de vínculo, se houver). */
  bloco: z.string(),
  sala: z.string(),
  /** Como veio no arquivo, quando uma correção de vínculo mudou. */
  noArquivo: z.object({ bloco: z.string(), sala: z.string() }).nullable(),
  cliente: z.string(),
  hidrometro: z.string(),
  dataAnterior: data.nullable(),
  leituraAnterior: z.number().nullable(),
  dataAtual: data.nullable(),
  leituraAtual: z.number().nullable(),
  dias: z.number().nullable(),
  consumo: z.number(),
  volume: z.number(),
  /** Reais; null sem a permissão de ver valores. */
  valor: z.number().nullable(),
  tipo: z.enum(TIPOS_AGUA),
  /** Caminho no bucket "operacoes" (nos dados de exemplo, só um marcador). */
  foto: z.string().nullable(),
  exemplo: z.boolean(),
});
export type Leitura = z.infer<typeof leitura>;

export const alerta = z.object({
  codigo: z.enum(CODIGOS_ALERTA),
  texto: z.string(),
});

export const leituraComAlertas = leitura.extend({
  /** Locatários vigentes no ENET; null quando o ENET não tem contratos. */
  locatarios: z.array(z.string()).nullable(),
  alertas: z.array(alerta),
});
export type LeituraComAlertas = z.infer<typeof leituraComAlertas>;

export const sumido = z.object({
  hidrometro: z.string(),
  bloco: z.string(),
  sala: z.string(),
  cliente: z.string(),
});

/** Links das fotos (caminho → endereço assinado). */
const links = z.record(z.string(), z.string());

/** GET /operacoes/agua/meses/:referencia */
export const respostaMesDaAgua = z.object({
  referencia: data,
  leituras: z.array(leituraComAlertas),
  /** Tinham leitura no mês anterior e não vieram neste. */
  sumidos: z.array(sumido),
  enet: z.boolean(),
  links,
});
export type RespostaMesDaAgua = z.infer<typeof respostaMesDaAgua>;

/** GET /operacoes/agua/extrato?bloco=&q=&h=&de=&ate= */
export const respostaExtratoDaAgua = z.object({
  leituras: z.array(leitura),
  /** Locatários vigentes das salas no ENET (null: ENET indisponível). */
  locatarios: z.array(z.string()).nullable(),
  links,
});
export type RespostaExtratoDaAgua = z.infer<typeof respostaExtratoDaAgua>;

export const correcaoDeVinculo = z.object({
  id: z.string(),
  hidrometro: z.string(),
  desde: data,
  bloco: z.string(),
  sala: z.string(),
  motivo: z.string(),
  criado_por: z.string().nullable(),
  criado_em: instante,
  /** Nome de quem corrigiu ("—" sem nome). */
  criadoPorNome: z.string(),
});

/** GET /operacoes/agua/hidrometros/:hidrometro */
export const respostaHidrometroDaAgua = z.object({
  leituras: z.array(leitura),
  correcoes: z.array(correcaoDeVinculo),
  locatarios: z.array(z.string()).nullable(),
  links,
});
export type RespostaHidrometroDaAgua = z.infer<typeof respostaHidrometroDaAgua>;

// ---------------------------------------------------------------------------
// Vínculo do hidrômetro (sala e bloco a partir de um mês)
// ---------------------------------------------------------------------------

/** POST /operacoes/agua/vinculos */
export const entradaVinculo = z.object({
  hidrometro: z.string().trim().min(1).max(40),
  desde: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Escolha o mês."),
  bloco: z
    .string()
    .trim()
    .regex(/^\d{1,2}$/, "Bloco com 2 dígitos (ex.: 05).")
    .transform((b) => b.padStart(2, "0")),
  sala: z.string().trim().min(1, "Informe a sala.").max(120),
  motivo: z
    .string()
    .trim()
    .min(3, "Escreva o motivo da correção.")
    .max(500, "Motivo com até 500 letras."),
});
export type EntradaVinculo = z.infer<typeof entradaVinculo>;

// ---------------------------------------------------------------------------
// Importação mensal (enviar → prévia → confirmar)
// ---------------------------------------------------------------------------

/** POST /operacoes/agua/importacao/envio */
export const entradaEnvioAgua = z.object({
  arquivos: z
    .array(
      z.object({
        nome: z.string().min(1).max(255),
        tamanho: z.number().int().positive(),
      }),
    )
    .min(1, "Escolha os arquivos.")
    .max(LIMITES_AGUA.arquivos + LIMITES_AGUA.fotos),
});

export const respostaEnvioAgua = z.object({
  envio: z.string(),
  itens: z.array(
    z.object({ nome: z.string(), caminho: z.string(), url: z.string() }),
  ),
});

/** POST /operacoes/agua/importacao/previa */
export const entradaPreviaAgua = z.object({
  envio: z.uuid(),
  arquivos: z
    .array(
      z.object({
        nome: z.string().min(1).max(255),
        caminho: z.string().max(400),
      }),
    )
    .min(1)
    .max(LIMITES_AGUA.arquivos + LIMITES_AGUA.fotos),
  referencia: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  mapeamento: z
    .partialRecord(z.enum(LISTA_CAMPOS), z.number().int().min(0).max(200))
    .optional(),
  salvarModelo: z.boolean().optional(),
});
export type EntradaPreviaAgua = z.infer<typeof entradaPreviaAgua>;

const avisoAgua = z.object({
  nivel: z.enum(["erro", "aviso", "info"]),
  arquivo: z.string().optional(),
  bloco: z.string().optional(),
  linha: z.number().optional(),
  mensagem: z.string(),
});

const conferenciaArquivo = z.object({
  arquivo: z.string(),
  blocos: z.array(z.string()),
  fonte: z.enum(["planilha", "pdf"]),
  linhas: z.number(),
  resumoLinhas: z.number().nullable(),
  consumo: z.number(),
  resumoConsumo: z.number().nullable(),
  volume: z.number(),
  resumoVolume: z.number().nullable(),
  valor: z.number().nullable(),
  resumoValor: z.number().nullable(),
  bate: z.boolean(),
  diferencas: z.array(z.string()),
});

const fotosDaPrevia = z.object({
  ligadas: z.number(),
  semLeitura: z.array(z.string()),
  recusadas: z.array(z.object({ nome: z.string(), motivo: z.string() })),
  semFoto: z.number(),
});

export const previaAgua = z.object({
  id: z.string(),
  referencia: data,
  bate: z.boolean(),
  comValores: z.boolean(),
  conferencias: z.array(conferenciaArquivo),
  mantidos: z.array(z.string()),
  substitui: z
    .object({
      em: instante.nullable(),
      por: z.string(),
      incompleta: z.boolean(),
    })
    .nullable(),
  totais: z.object({
    linhas: z.number(),
    consumo: z.number(),
    volume: z.number(),
    valor: z.number().nullable(),
  }),
  avisos: z.array(avisoAgua),
  ignoradas: z.array(
    z.object({ arquivo: z.string(), linha: z.number(), motivo: z.string() }),
  ),
  fotos: fotosDaPrevia,
  novos: z.array(z.string()),
  linhas: z.array(
    z.object({
      id: z.string(),
      bloco: z.string(),
      sala: z.string(),
      cliente: z.string(),
      hidrometro: z.string(),
      leituraAnterior: z.number().nullable(),
      leituraAtual: z.number().nullable(),
      consumo: z.number(),
      volume: z.number(),
      valor: z.number().nullable(),
      tipo: z.enum(TIPOS_AGUA),
      foto: z.boolean(),
      linha: z.number().nullable(),
    }),
  ),
});

/** Prévia gravada, ou o pedido de escolher as colunas do arquivo. */
export const respostaPreviaAgua = z.union([
  z.object({ previa: previaAgua }),
  z.object({
    colunas: z.object({
      arquivo: z.string(),
      titulos: z.array(z.string()),
      faltam: z.array(z.enum(LISTA_CAMPOS)),
      achadas: z.partialRecord(z.enum(LISTA_CAMPOS), z.string()),
      podeSalvarModelo: z.boolean(),
    }),
  }),
]);

/** GET /operacoes/agua/importacao/previa-aberta */
export const respostaPreviaAbertaAgua = z.object({
  previa: previaAgua.nullable(),
});

/** POST /operacoes/agua/importacao/:id/confirmar */
export const entradaConfirmarAgua = z.object({
  motivo: z
    .string()
    .trim()
    .max(500, "Motivo longo demais (até 500 letras).")
    .optional(),
});

export const respostaConfirmarAgua = z.object({
  mensagem: z.string(),
  referencia: data,
});
