import { z } from "zod";
import { TIPOS_AGUA } from "../agua-formato";
import { STATUS_IMPORTACAO, TIPOS } from "../importacoes";

// Contratos das importações de Operações (spec 4.11): o histórico, uma
// importação com o que ela gravou, a conta da concessionária de água e as
// correções da água (uma leitura por vez).

const data = z.string();
const instante = z.string();
const tipoImportacao = z.enum(TIPOS);
const statusImportacao = z.enum(
  Object.keys(STATUS_IMPORTACAO) as (keyof typeof STATUS_IMPORTACAO)[],
);

const arquivoImportado = z.object({
  nome: z.string(),
  caminho: z.string().optional(),
  sha256: z.string().optional(),
  bytes: z.number().optional(),
});

const avisoImportacao = z.object({
  nivel: z.enum(["erro", "aviso", "info"]),
  bloco: z.union([z.string(), z.number()]).optional(),
  linha: z.number().optional(),
  mensagem: z.string(),
});

export const importacaoNaLista = z.object({
  id: z.string(),
  tipo: tipoImportacao,
  status: statusImportacao,
  referencia: z.string(),
  arquivos: z.array(arquivoImportado),
  avisos: z.object({ erro: z.number(), aviso: z.number(), info: z.number() }),
  bate: z.boolean().nullable(),
  incompleta: z.boolean(),
  motivo: z.string().nullable(),
  exemplo: z.boolean(),
  substitui: z.string().nullable(),
  criadoPor: z.string().nullable(),
  criadoEm: instante,
  confirmadoPor: z.string().nullable(),
  confirmadoEm: instante.nullable(),
  desfeitoPor: z.string().nullable(),
  desfeitoEm: instante.nullable(),
});
export type ImportacaoNaLista = z.infer<typeof importacaoNaLista>;

/** GET /operacoes/importacoes?log_tipo=&status=&de=&ate=&pagina= */
export const respostaPaginaDeImportacoes = z.object({
  linhas: z.array(importacaoNaLista),
  total: z.number(),
});

export const arquivoComLink = arquivoImportado.extend({
  /** Baixar com o nome original. */
  url: z.string().nullable(),
  /** Ver na própria aba (foto ou PDF); null nos outros tipos. */
  urlVer: z.string().nullable(),
  tipo: z.enum(["foto", "pdf", "planilha", "outro"]),
});
export type ArquivoComLink = z.infer<typeof arquivoComLink>;

export const importacaoDetalhe = importacaoNaLista.extend({
  listaDeAvisos: z.array(avisoImportacao),
  resumo: z.array(z.object({ rotulo: z.string(), valor: z.string() })),
  arquivosComLink: z.array(arquivoComLink),
  /** Conciliação em reais da água (só com operacoes.agua.valores). */
  valores: z
    .object({
      arquivo: z.number().nullable(),
      lido: z.number().nullable(),
      porBloco: z.array(
        z.object({
          bloco: z.string(),
          arquivo: z.number().nullable(),
          lido: z.number().nullable(),
        }),
      ),
    })
    .nullable(),
  /** Importação que veio depois e substituiu esta (água). */
  substituidaPor: z.string().nullable(),
});
export type ImportacaoDetalhe = z.infer<typeof importacaoDetalhe>;

export const leituraImportada = z.object({
  id: z.string(),
  bloco: z.string(),
  sala: z.string(),
  cliente: z.string(),
  hidrometro: z.string(),
  dataAnterior: data.nullable(),
  leituraAnterior: z.number().nullable(),
  dataAtual: data.nullable(),
  leituraAtual: z.number().nullable(),
  dias: z.number().nullable(),
  consumo: z.number(),
  volumeFaturado: z.number(),
  tipo: z.enum(TIPOS_AGUA),
  valor: z.number().nullable(),
  linhaArquivo: z.number().nullable(),
  foto: z.string().nullable(),
  fotoUrl: z.string().nullable(),
  vigente: z.boolean(),
});
export type LeituraImportada = z.infer<typeof leituraImportada>;

export const contaImportada = z.object({
  id: z.string(),
  vigente: z.boolean(),
  referencia: data,
  matricula: z.string(),
  vencimento: data.nullable(),
  dataAnterior: data.nullable(),
  dataAtual: data.nullable(),
  leituraAnterior: z.number().nullable(),
  leituraAtual: z.number().nullable(),
  consumoM3: z.number().nullable(),
  valorAgua: z.number().nullable(),
  valorEsgoto: z.number().nullable(),
  total: z.number(),
  observacao: z.string().nullable(),
  atualizadoEm: instante,
});
export type ContaImportada = z.infer<typeof contaImportada>;

export const faturaImportada = z.object({
  id: z.string(),
  matricula: z.string(),
  referencia: data,
  vencimento: data.nullable(),
  consumoKwh: z.number().nullable(),
  total: z.number().nullable(),
  vigente: z.boolean(),
});
export type FaturaImportada = z.infer<typeof faturaImportada>;

export const mesDaImportacao = z.object({
  referencia: data,
  status: z.string(),
  valorBase: z.number().nullable(),
});
export type MesDaImportacao = z.infer<typeof mesDaImportacao>;

export const revisaoImportada = z.object({
  obraId: z.string(),
  obra: z.string(),
  codigo: z.string(),
  vigente: z.boolean(),
  etapas: z.number(),
});
export type RevisaoImportada = z.infer<typeof revisaoImportada>;

/**
 * GET /operacoes/importacoes/:id → a importação e o que ela gravou (só o do
 * tipo dela vem preenchido).
 */
export const respostaImportacao = z.object({
  importacao: importacaoDetalhe,
  leituras: z.array(leituraImportada),
  conta: contaImportada.nullable(),
  faturas: z.array(faturaImportada),
  meses: z.array(mesDaImportacao),
  revisao: revisaoImportada.nullable(),
});
export type RespostaImportacao = z.infer<typeof respostaImportacao>;

const ultimaDoTipo = z.object({
  id: z.string(),
  referencia: z.string(),
  confirmadoEm: instante.nullable(),
  incompleta: z.boolean(),
});

/** GET /operacoes/importacoes/situacao: a última confirmada e as prévias de cada tipo. */
export const respostaSituacaoDasImportacoes = z.object({
  situacao: z.partialRecord(
    tipoImportacao,
    z.object({ ultima: ultimaDoTipo.nullable(), previas: z.number() }),
  ),
});

// ---------------------------------------------------------------------------
// Conta da concessionária de água
// ---------------------------------------------------------------------------

export const previaConta = z.object({
  id: z.string(),
  arquivo: z.object({
    nome: z.string(),
    tipo: z.string(),
    url: z.string().nullable(),
  }),
  sugestao: z.object({
    referencia: z.string().optional(),
    matricula: z.string().optional(),
    vencimento: z.string().optional(),
    consumo_m3: z.string().optional(),
    total: z.string().optional(),
  }),
  /** Mês sugerido (aaaa-mm): o do PDF ou o mês passado. */
  mes: z.string(),
});
export type PreviaConta = z.infer<typeof previaConta>;

/** POST /operacoes/agua/contas (multipart, campo "arquivo") */
export const respostaLerConta = z.object({ previa: previaConta });

/** GET /operacoes/agua/contas/previa-aberta */
export const respostaPreviaAbertaConta = z.object({
  previa: previaConta.nullable(),
});

/** POST /operacoes/agua/contas/:id/confirmar */
export const respostaConfirmarConta = z.object({
  mensagem: z.string(),
  avisos: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Correções da água (uma leitura por vez) e o desfazer do histórico
// ---------------------------------------------------------------------------

/** POST /operacoes/agua/fotos (multipart: hidrometro, mes, foto) */
export const entradaFotoDoHidrometro = z.object({
  hidrometro: z.uuid("Escolha o hidrômetro."),
  mes: z.iso
    .date("Escolha o mês.")
    .refine((d) => d.endsWith("-01"), "Mês inválido."),
});
